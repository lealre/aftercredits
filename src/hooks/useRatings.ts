import { useState, useEffect } from 'react';
import { Rating } from '@/types/movie';
import { fetchRatings } from '@/services/backendService';

export const useRatings = (titleId: string) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRatings = async () => {
    if (!titleId) return;
    
    setLoading(true);
    setError(null);
    try {
      const fetchedRatings = await fetchRatings(titleId);
      setRatings(fetchedRatings);
    } catch (err) {
      console.error('Error loading ratings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ratings');
      // If ratings fail to load, just leave empty array (as requested)
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRatings();
  }, [titleId]);

  const getRatingByUserId = (userId: string): Rating | undefined => {
    return ratings.find(rating => rating.userId === userId);
  };

  const getRatingForUser = (userId: string): { rating: number; comments: string } | undefined => {
    const rating = getRatingByUserId(userId);
    if (!rating) return undefined;
    return {
      rating: rating.note,
      comments: rating.comments
    };
  };

  return {
    ratings,
    loading,
    error,
    getRatingByUserId,
    getRatingForUser,
    refreshRatings: loadRatings,
  };
};
