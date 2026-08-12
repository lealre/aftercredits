import { useQuery } from '@tanstack/react-query';
import { User } from '@/types/movie';
import { fetchUsers } from '@/services/backendService';
import { useActiveGroupId } from '@/hooks/useActiveGroupId';

export const useUsers = () => {
  const groupId = useActiveGroupId();

  const { data: users = [], isLoading: loading, error: queryError } = useQuery<User[]>({
    queryKey: ['users', groupId],
    queryFn: () => fetchUsers(groupId!),
    enabled: !!groupId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to load users' : null;

  const getUserById = (userId: string): User | undefined => {
    return users.find(user => user.id === userId);
  };

  const getUserNameById = (userId: string): string => {
    const user = getUserById(userId);
    if (!user) return 'Unknown User';
    return user.name && user.name.trim() !== "" ? user.name : user.username;
  };

  return {
    users,
    loading,
    error,
    getUserById,
    getUserNameById,
  };
};
