import { useCallback, useEffect, useMemo, useState } from 'react';
import { Rating } from '@/types/movie';
import { fetchRatingsBatch, fetchRatings } from '@/services/backendService';

export const useBatchRatings = (titleIds: string[]) => {
  const [ratingsMap, setRatingsMap] = useState<Record<string, Rating[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueIds = useMemo(() => Array.from(new Set(titleIds)).filter(Boolean), [titleIds]);

  const load = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) {
      setRatingsMap({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRatingsBatch(ids);
      // Ensure we include empty arrays for titles not returned
      const complete: Record<string, Rating[]> = {};
      ids.forEach(id => {
        complete[id] = result[id] ?? [];
      });
      setRatingsMap(complete);
    } catch (e) {
      console.error(e);
      setError('Failed to load ratings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(uniqueIds);
  }, [uniqueIds, load]);

  const getRatingForUser = useCallback((titleId: string, userId: string) => {
    const list = ratingsMap[titleId] || [];
    const r = list.find(x => x.userId === userId);
    return r ? { rating: r.note } : undefined;
  }, [ratingsMap]);

  const refreshRatingsForTitle = useCallback(async (titleId: string) => {
    try {
      const list = await fetchRatings(titleId);
      setRatingsMap(prev => ({ ...prev, [titleId]: list }));
    } catch (e) {
      console.error('Failed to refresh ratings for title', titleId, e);
    }
  }, []);

  return { ratingsMap, loading, error, getRatingForUser, refreshRatingsForTitle };
};


