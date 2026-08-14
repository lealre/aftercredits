import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityFeed,
  fetchActivityUnreadCount,
  markActivityRead,
} from '@/services/backendService';
import { getToken } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';
import {
  ACTIVITY_FEED_FIRST_KEY,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_UNREAD_COUNT_KEY,
  useActivityStream,
} from '@/hooks/useActivityStream';
import { describeActivityText } from '@/lib/activityText';
import {
  ActivityEvent,
  ActivityFeed,
  ActivityFeatureDisabledError,
  ActivitySessionExpiredError,
  ActivityUnreadCount,
} from '@/types/activity';

/**
 * How often the unread badge re-checks — in degraded mode ONLY.
 *
 * Phase 1 polled on this interval as the normal path. Phase 2's normal path is
 * the SSE stream, and while it is live this interval must be off: a push and a
 * poll doing the same job is one of them wasted. It survives as the fallback
 * for a proxy that will not carry a stream, so the feature degrades to phase 1
 * behaviour rather than to nothing.
 *
 * Kept at phase 1's 10s rather than made slower, deliberately: degraded mode
 * is the state where the user has no other source of updates, so making it
 * lazier would punish exactly the situation it exists for. The count is one
 * indexed query for a handful of users.
 */
const DEGRADED_POLL_INTERVAL_MS = 10_000;

/**
 * Re-exported from its new home. The page size now belongs to the stream
 * module, which takes the connect-time snapshot with it, and one page size has
 * to serve both or the first page would change length depending on which of
 * them wrote it last.
 */
export { ACTIVITY_PAGE_SIZE };

/**
 * A failure that means "stop asking", not "retry": the feature is switched off
 * on this backend, or the session has expired. Either way, continuing to poll
 * is pointless — and in the expired case actively harmful, since a 401 from a
 * background poll must never bounce the user to /login (see activityFetch).
 */
const isTerminal = (error: unknown) =>
  error instanceof ActivityFeatureDisabledError ||
  error instanceof ActivitySessionExpiredError;

/**
 * The unread badge count, pushed over SSE, plus a toast when new activity
 * arrives.
 *
 * Two sources, never both at once:
 *
 * - **Live** (the normal path): useActivityStream keeps the cached count
 *   current — a snapshot on connect, +1 per pushed event — and announces each
 *   event from the frame it just received. The poll interval is off.
 * - **Degraded**: the stream could not be established (a proxy that buffers,
 *   or a backend without the stream routes), so the phase 1 poll takes over
 *   and the toast falls back to noticing the count go up.
 *
 * The toast fires only on an *increase* against a baseline taken from the first
 * successful read — so opening the app with 4 unread does not announce them,
 * and marking things read (which lowers the count) never announces anything.
 * The count already excludes the user's own actions, so nobody is toasted
 * about their own rating.
 *
 * Mount this once. It owns the app's single stream connection, and a second
 * copy would open a second one. Today that is ActivityBell, in the header.
 */
export const useActivityUnreadCount = () => {
  const token = getToken();
  const { toast } = useToast();
  const [stopped, setStopped] = useState(false);
  const previousUnread = useRef<number | null>(null);

  // Named from the event itself: the stream already delivered the whole row,
  // so unlike the poll path below this costs no extra request.
  const announce = useCallback(
    (event: ActivityEvent) => {
      toast({ title: 'New activity', description: describeActivityText(event) });
    },
    [toast]
  );

  const { live, degraded } = useActivityStream(!!token && !stopped, announce);

  const query = useQuery<ActivityUnreadCount>({
    queryKey: ACTIVITY_UNREAD_COUNT_KEY,
    queryFn: fetchActivityUnreadCount,
    enabled: !!token && !stopped,
    // Off unless the stream has proven it cannot work here.
    refetchInterval: !stopped && degraded ? DEGRADED_POLL_INTERVAL_MS : false,
    // Already TanStack's default; stated explicitly because it is load-bearing
    // here. Two accounts open side by side is the way this gets used, and
    // clicking into the other window refetches at once rather than waiting out
    // the interval. (Two windows both visible, with no click, still waits.)
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !isTerminal(error) && failureCount < 2,
  });

  if (query.error && isTerminal(query.error) && !stopped) {
    setStopped(true);
  }

  const unread = query.data?.unread ?? 0;

  useEffect(() => {
    if (query.isLoading || query.error) return;

    const previous = previousUnread.current;
    // Tracked even when the toast below is skipped: a stale baseline would
    // announce an old rise the moment the stream drops.
    previousUnread.current = unread;

    // First successful read is the baseline, not news.
    if (previous === null || unread <= previous) return;

    // While the stream is live, every arrival was already announced from its
    // own frame (see announce). Toasting the resulting rise too would double
    // every notification. This path is the degraded one.
    if (live) return;

    // Name what happened. One extra tiny request, only when the count rose.
    fetchActivityFeed({ limit: 1 })
      .then((feed) => {
        const newest = feed.events[0];
        toast({
          title: 'New activity',
          description: newest ? describeActivityText(newest) : 'Someone in your groups did something',
        });
      })
      .catch(() => {
        // A toast is a nicety; never let its failure surface as an error.
        toast({ title: 'New activity', description: 'Someone in your groups did something' });
      });
  }, [unread, live, query.isLoading, query.error, toast]);

  return {
    unread,
    // "Unavailable" covers both off-by-flag and expired-session: in both cases
    // the bell should not be shown at all rather than shown broken.
    unavailable: stopped || isTerminal(query.error),
  };
};

/**
 * The feed itself, fetched while the panel is open, plus cursor paging and
 * mark-as-read.
 *
 * Note what mark-as-read can and cannot express. The backend keeps ONE
 * watermark per user (`activity_reads.read_seq`, advanced monotonically), not a
 * read flag per event. So marking event S read necessarily marks everything
 * older than S read too — "read" is a boundary, not a set. Clicking a row
 * therefore means "I have seen this and everything below it", which is what the
 * ordering makes natural anyway.
 *
 * Nothing here advances the watermark as a side effect of *reading* the feed.
 * Opening the panel runs the query below and nothing else; the only calls to
 * POST /activity/read are the two the user asks for by clicking (a row, or
 * "mark all as read"). GET /activity does not move the watermark either, so an
 * unopened event stays unread until it is actually acted on.
 */
export const useActivityFeedPanel = (open: boolean) => {
  const token = getToken();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<ActivityFeed[]>([]);

  const first = useQuery<ActivityFeed>({
    // The same entry the stream merges pushed events into, so a row appears
    // in an open panel without a refetch.
    queryKey: ACTIVITY_FEED_FIRST_KEY,
    queryFn: () => fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE }),
    enabled: !!token && open,
    retry: (failureCount, error) => !isTerminal(error) && failureCount < 2,
  });

  const loadMore = useMutation({
    mutationFn: (before: number) =>
      fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE, before }),
    onSuccess: (page) => setPages((prev) => [...prev, page]),
  });

  const events = [
    ...(first.data?.events ?? []),
    ...pages.flatMap((page) => page.events),
  ];

  // Read by the mutation below, which runs outside render and must see the list
  // as it is at click time rather than as it was when the mutation was created.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const markRead = useMutation({
    mutationFn: markActivityRead,
    // The badge has to move on the click, not a round trip later, and the count
    // after moving the watermark to S is knowable here: it is the number of
    // still-unread rows newer than S. The feed is newest-first and complete
    // from the top, so every event newer than S is already loaded — nothing
    // unloaded can be newer than a row the user just clicked.
    //
    // Clamped by the current count because the watermark only ever moves
    // forward (the backend upserts with GREATEST): clicking an already-read row
    // is a no-op server-side, and must not *raise* the badge here either.
    onMutate: (seq: number) => {
      queryClient.setQueryData<ActivityUnreadCount>(ACTIVITY_UNREAD_COUNT_KEY, (count) => {
        if (!count) return count;
        const newer = eventsRef.current.filter((event) => event.seq > seq).length;
        return { unread: Math.min(count.unread, newer) };
      });
    },
    // On success it confirms the optimistic value; on failure it puts the real
    // one back, so a rejected write cannot leave the badge lying.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_UNREAD_COUNT_KEY });
    },
  });

  const last = pages.length > 0 ? pages[pages.length - 1] : first.data;

  const reset = useCallback(() => setPages([]), []);

  /**
   * Mark everything read.
   *
   * One watermark means this is just "mark the newest event read": the newest
   * loaded event is the newest that exists for this user (the first page is the
   * head of the log), so moving the watermark there covers the whole feed.
   */
  const markAllRead = () => {
    const newest = eventsRef.current[0];
    if (newest) markRead.mutate(newest.seq);
  };

  return {
    events,
    isLoading: first.isLoading,
    isError: !!first.error && !isTerminal(first.error),
    hasMore: last?.hasMore ?? false,
    nextBefore: last?.nextBefore ?? null,
    loadMore: (before: number) => loadMore.mutate(before),
    isLoadingMore: loadMore.isPending,
    markRead: (seq: number) => markRead.mutate(seq),
    markAllRead,
    /** No event loaded means there is nothing whose seq we could mark read. */
    canMarkAllRead: events.length > 0,
    reset,
  };
};
