import { useState, useEffect } from 'react';
import { User } from '@/types/movie';
import { fetchUsers } from '@/services/backendService';
import { getGroupId, handleUnauthorized } from '@/services/authService';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const groupId = getGroupId();
        if (!groupId) {
          handleUnauthorized('No group selected. Please log in again.');
          return;
        }
        const fetchedUsers = await fetchUsers(groupId);
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Error loading users:', err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const getUserById = (userId: string): User | undefined => {
    return users.find(user => user.id === userId);
  };

  const getUserNameById = (userId: string): string => {
    const user = getUserById(userId);
    return user ? user.name : 'Unknown User';
  };

  return {
    users,
    loading,
    error,
    getUserById,
    getUserNameById,
  };
};
