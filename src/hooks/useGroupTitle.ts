import { useQuery } from '@tanstack/react-query';
import { Movie, Rating, TitleNotInGroupError } from '@/types/movie';
import { fetchGroupTitle } from '@/services/backendService';

/**
 * The cache key for one group's view of one title.
 *
 * Exported so a caller can invalidate the entry it is showing: the same title
 * is held by two caches at once (this one and the grid's page), and an edit
 * made from the standalone modal has to move both.
 */
export const GROUP_TITLE_KEY = 'groupTitle';

export const groupTitleKey = (groupId: string | null, titleId: string | null) =>
  [GROUP_TITLE_KEY, groupId, titleId] as const;

/**
 * One title read on its own, for when it is not on the grid's current page —
 * today, the activity feed's deep link.
 *
 * `enabled` is the caller's assertion that the active group is *already*
 * `groupId`. The payload is group-scoped (its ratings are that group's, and the
 * modal it feeds reads the active group for its comments), so fetching before a
 * pending group switch has landed would put one group's data behind another
 * group's title. The group is in the key as well, so even a mistake there
 * cannot serve a cached answer for the wrong group.
 */
export const useGroupTitle = (
  groupId: string | null,
  titleId: string | null,
  enabled: boolean
) =>
  useQuery<{ movie: Movie; ratings: Rating[] }>({
    queryKey: groupTitleKey(groupId, titleId),
    queryFn: () => fetchGroupTitle(groupId!, titleId!),
    enabled: enabled && !!groupId && !!titleId,
    // A 404 is an answer, not a blip — the title really is not in that group.
    // Retrying it only delays the toast that says so.
    retry: (failureCount, error) =>
      !(error instanceof TitleNotInGroupError) && failureCount < 2,
    // Ratings and watched state are exactly what the modal this feeds edits, so
    // it opens on a fresh read rather than on whatever a previous visit cached.
    staleTime: 0,
    // And keeps nothing after it closes. There is no second reader to serve —
    // the grid has its own cache — and a retained entry would flash a title
    // that has since been deleted back on screen for the moment before the
    // refetch answers 404.
    gcTime: 0,
  });
