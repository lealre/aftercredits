import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityFeed,
  fetchActivityUnreadCount,
  markActivityEventRead,
  markAllActivityRead,
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
 * Sets the read flag on the named rows of a page, leaving every other row
 * untouched — and returning the *same array* when none of them are in it.
 *
 * The identity is what keeps the optimistic updates from churning: a page that
 * does not hold the clicked row is not rewritten, so it does not re-render, and
 * the row's DOM node survives the update with its focus intact.
 */
const withReadFlag = (events: ActivityEvent[], ids: Set<string>, read: boolean) => {
  if (!events.some((event) => ids.has(event.id) && event.read !== read)) return events;
  return events.map((event) =>
    ids.has(event.id) && event.read !== read ? { ...event, read } : event
  );
};

/**
 * The feed itself, fetched while the panel is open, plus cursor paging and
 * mark-as-read.
 *
 * ## Read state is per event
 *
 * The backend keeps a read row per (reader, event), not one watermark per
 * reader, and every event DTO carries `read` for the asking reader. So "unread"
 * here is a *set*, not a boundary: it is exactly the rows with `read === false`,
 * and nothing is inferred from a count plus a list position. Marking one row
 * read leaves every other row — older ones included — exactly as it was, which
 * is what makes clicking a single row a meaningful action at all.
 *
 * Nothing marks anything read as a side effect of *reading* the feed. Opening
 * the panel runs the query below and nothing else; GET /activity does not
 * change read state either. The only writes are the two the user asks for by
 * clicking: a row, or "mark all as read".
 *
 * ## Paging
 *
 * The first page lives in a TanStack entry (shared with the stream, which
 * merges pushed events into it); every "Load more" page is appended to local
 * state. The two are flattened into one list that is deduplicated by id — see
 * `events` below for why that matters.
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

  const loadMoreMutation = useMutation({
    mutationFn: (before: number) =>
      fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE, before }),
    onSuccess: (page) => setPages((prev) => [...prev, page]),
  });

  /**
   * Every loaded row, newest first, each id appearing once.
   *
   * The dedupe is load-bearing in both directions, and it is the reason this is
   * a fold rather than a flat concat:
   *
   * - **Live pushes.** A pushed event is prepended to the first page's cache
   *   entry by the stream. It is newer than every `before` cursor already
   *   spent, so it cannot come back in a later page — but the stream also
   *   re-snapshots the first page on every reconnect, and a snapshot taken
   *   after rows were deleted can pull up rows an appended page already holds.
   * - **Refetches.** The first page refetches on window focus. Its window
   *   slides as the log grows, so it can overlap page 2 for the same reason.
   *
   * First occurrence wins, and the first page is scanned first, so the copy
   * that survives is always the freshest one — the one carrying the `read`
   * flag the optimistic updates below have been writing to.
   *
   * Order stays newest-first: the first page is sorted by the stream on merge,
   * and every appended page's seqs are strictly below the cursor that fetched
   * it.
   */
  const events = useMemo(() => {
    const seen = new Set<string>();
    const merged: ActivityEvent[] = [];
    for (const event of [
      ...(first.data?.events ?? []),
      ...pages.flatMap((page) => page.events),
    ]) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      merged.push(event);
    }
    return merged;
  }, [first.data, pages]);

  // Read by the mutations below, which run outside render and must see the list
  // as it is at click time rather than as it was when the mutation was created.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  /**
   * Flip the read flag on a set of rows, everywhere those rows are held.
   *
   * A row can live in either of two stores — the first page's cache entry or
   * the appended pages in local state — and which one is not knowable from the
   * id, so both are visited. A store that holds none of them is left completely
   * alone, down to object identity.
   *
   * Takes a set rather than one id so "mark all as read" is a single pass and a
   * single render, not one per row.
   */
  const setReadFlags = useCallback(
    (ids: Set<string>, read: boolean) => {
      if (ids.size === 0) return;

      queryClient.setQueryData<ActivityFeed>(ACTIVITY_FEED_FIRST_KEY, (feed) => {
        if (!feed) return feed;
        const events = withReadFlag(feed.events, ids, read);
        return events === feed.events ? feed : { ...feed, events };
      });

      setPages((prev) => {
        let changed = false;
        const next = prev.map((page) => {
          const events = withReadFlag(page.events, ids, read);
          if (events === page.events) return page;
          changed = true;
          return { ...page, events };
        });
        return changed ? next : prev;
      });
    },
    [queryClient]
  );

  const markRead = useMutation({
    mutationFn: markActivityEventRead,
    // The row and the badge both have to move on the click, not a round trip
    // later. Per-event read state makes the new count exactly knowable: one
    // fewer, and only if this row was actually unread — re-clicking a read row
    // is a 204 no-op server-side and must not move the badge here either.
    onMutate: (id: string) => {
      const wasUnread = eventsRef.current.some((event) => event.id === id && !event.read);
      setReadFlags(new Set([id]), true);
      if (wasUnread) {
        queryClient.setQueryData<ActivityUnreadCount>(ACTIVITY_UNREAD_COUNT_KEY, (count) =>
          count ? { unread: Math.max(0, count.unread - 1) } : count
        );
      }
      return { wasUnread };
    },
    // A rejected write must not leave the row lying either. Only a row this
    // call actually changed is put back.
    onError: (_error, id, context) => {
      if (context?.wasUnread) setReadFlags(new Set([id]), false);
    },
    // On success this confirms the optimistic count; on failure it replaces it
    // with the server's.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_UNREAD_COUNT_KEY });
    },
  });

  /**
   * Mark everything read — including rows that were never loaded.
   *
   * This is a single call that clears the badge server-side, so it is not "mark
   * the loaded rows read": the count goes to 0 because everything invisible is
   * covered too. Locally only the loaded rows can be repainted, which is all
   * the user can see.
   */
  const markAllRead = useMutation({
    mutationFn: markAllActivityRead,
    onMutate: () => {
      const unreadIds = new Set(
        eventsRef.current.filter((event) => !event.read).map((event) => event.id)
      );
      setReadFlags(unreadIds, true);
      queryClient.setQueryData<ActivityUnreadCount>(ACTIVITY_UNREAD_COUNT_KEY, { unread: 0 });
      return { unreadIds };
    },
    // Restores exactly the rows this call flipped, so a failure cannot silently
    // swallow the panel's unread marks. Rows pushed in by the stream while the
    // request was in flight were never flipped, so they stay unread throughout.
    onError: (_error, _variables, context) => {
      if (context) setReadFlags(context.unreadIds, false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITY_UNREAD_COUNT_KEY });
    },
  });

  const last = pages.length > 0 ? pages[pages.length - 1] : first.data;
  const nextBefore = last?.nextBefore ?? null;
  const hasMore = (last?.hasMore ?? false) && nextBefore !== null;

  const reset = useCallback(() => setPages([]), []);

  return {
    events,
    isLoading: first.isLoading,
    isError: !!first.error && !isTerminal(first.error),
    /** True only when there is both more to fetch and a cursor to fetch it with. */
    hasMore,
    isLoadingMore: loadMoreMutation.isPending,
    /** No-op unless there is a cursor and no page already in flight. */
    loadMore: () => {
      if (nextBefore === null || loadMoreMutation.isPending) return;
      loadMoreMutation.mutate(nextBefore);
    },
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
    isMarkingAllRead: markAllRead.isPending,
    reset,
  };
};
