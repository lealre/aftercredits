import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGroupById } from '@/services/backendService';
import { useCurrentUser } from './useCurrentUser';
import { GroupResponse } from '@/types/movie';

export const useGroups = () => {
  const queryClient = useQueryClient();
  const { data: userData, isLoading: loadingUser } = useCurrentUser();

  const groupIds = userData?.groups ?? [];

  const { data: groups = [], isLoading: loadingGroups } = useQuery<GroupResponse[]>({
    queryKey: ['groups', groupIds],
    queryFn: () => Promise.all(groupIds.map((gId) => fetchGroupById(gId))),
    enabled: groupIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refreshGroups = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user'] });
    await queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  return {
    groups,
    loading: loadingUser || loadingGroups,
    hasNoGroups: !loadingUser && !loadingGroups && groups.length === 0,
    refreshGroups,
  };
};
