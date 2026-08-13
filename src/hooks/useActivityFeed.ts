import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityFeed,
  fetchActivityUnreadCount,
  markActivityRead,
} from '@/services/backendService';
import { getToken } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';
import { describeActivityText } from '@/lib/activityText';
import {
  ActivityFeed,
  ActivityFeatureDisabledError,
  ActivitySessionExpiredError,
  ActivityUnreadCount,
} from '@/types/activity';

/**
 * How often the unread badge re-checks while the tab is focused.
 *
 * A minute reads as broken when two people use the app side by side, which is
 * how this gets tested; 10s is short enough to feel live and still cheap — the
 * count is one indexed query, and this backend serves a handful of users on a
 * Raspberry Pi.
 *
 * It cannot be made instant by shortening it further: polling has a floor of
 * "however long since the last tick". Real immediacy is phase 2, which replaces
 * this with a server push (SSE) and deletes this constant.
 */
const UNREAD_POLL_INTERVAL_MS = 10_000;

/** Rows fetched per feed page. */
export const ACTIVITY_PAGE_SIZE = 15;

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
 * The unread badge count, polled, plus a toast when new activity arrives.
 *
 * The toast fires only on an *increase* against a baseline taken from the first
 * successful poll — so opening the app with 4 unread does not announce them,
 * and marking things read (which lowers the count) never announces anything.
 * The count already excludes the user's own actions, so nobody is toasted
 * about their own rating.
 */
export const useActivityUnreadCount = () => {
  const token = getToken();
  const { toast } = useToast();
  const [stopped, setStopped] = useState(false);
  const previousUnread = useRef<number | null>(null);

  const query = useQuery<ActivityUnreadCount>({
    queryKey: ['activity', 'unread-count'],
    queryFn: fetchActivityUnreadCount,
    enabled: !!token && !stopped,
    refetchInterval: stopped ? false : UNREAD_POLL_INTERVAL_MS,
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
    previousUnread.current = unread;

    // First successful read is the baseline, not news.
    if (previous === null || unread <= previous) return;

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
  }, [unread, query.isLoading, query.error, toast]);

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
 */
export const useActivityFeedPanel = (open: boolean) => {
  const token = getToken();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<ActivityFeed[]>([]);

  const first = useQuery<ActivityFeed>({
    queryKey: ['activity', 'feed', 'first'],
    queryFn: () => fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE }),
    enabled: !!token && open,
    retry: (failureCount, error) => !isTerminal(error) && failureCount < 2,
  });

  const loadMore = useMutation({
    mutationFn: (before: number) =>
      fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE, before }),
    onSuccess: (page) => setPages((prev) => [...prev, page]),
  });

  const markRead = useMutation({
    mutationFn: markActivityRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', 'unread-count'] });
    },
  });

  const events = [
    ...(first.data?.events ?? []),
    ...pages.flatMap((page) => page.events),
  ];

  const last = pages.length > 0 ? pages[pages.length - 1] : first.data;

  const reset = useCallback(() => setPages([]), []);

  return {
    events,
    isLoading: first.isLoading,
    isError: !!first.error && !isTerminal(first.error),
    hasMore: last?.hasMore ?? false,
    nextBefore: last?.nextBefore ?? null,
    loadMore: (before: number) => loadMore.mutate(before),
    isLoadingMore: loadMore.isPending,
    markRead: (seq: number) => markRead.mutate(seq),
    reset,
  };
};
