import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/services/backendService';
import { getToken } from '@/services/authService';
import { UserResponse } from '@/types/movie';

export const useCurrentUser = () => {
  const token = getToken();

  return useQuery<UserResponse>({
    queryKey: ['user', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
