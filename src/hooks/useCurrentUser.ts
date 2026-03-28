import { useQuery } from '@tanstack/react-query';
import { fetchUserById } from '@/services/backendService';
import { getUserId, getToken } from '@/services/authService';
import { UserResponse } from '@/types/movie';

export const useCurrentUser = () => {
  const userId = getUserId();
  const token = getToken();

  return useQuery<UserResponse>({
    queryKey: ['user', userId],
    queryFn: () => fetchUserById(userId!),
    enabled: !!userId && !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
