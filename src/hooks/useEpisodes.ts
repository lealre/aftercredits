import { useQuery } from '@tanstack/react-query';
import { Episode } from '@/types/movie';
import { fetchEpisodes } from '@/services/backendService';

// Lazy-loads a title's episodes; only fetches when `enabled` (e.g. the modal is
// open for a TV series). Cached per title via React Query.
export const useEpisodes = (titleId: string | undefined, enabled: boolean) => {
  return useQuery<Episode[]>({
    queryKey: ['episodes', titleId],
    queryFn: () => fetchEpisodes(titleId!),
    enabled: enabled && !!titleId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
