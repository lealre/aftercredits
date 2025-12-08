import { useState, useCallback } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';
import { getGroupId } from '@/services/authService';

const Index = () => {
  const navigate = useNavigate();
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  
  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  
  const { 
    movies, 
    loading, 
    adding,
    setAdding,
    pagination,
    ratingsMap,
    updateMovie, 
    deleteMovie, 
    refreshMovies,
    changePage,
    changePageSize,
    orderBy,
    setOrderBy,
    ascending,
    setAscending,
  } = useMovies(watchedFilterValue);
  const { users, getUserNameById } = useUsers();
  
  const getRatingForUser = useCallback((titleId: string, userId: string) => {
    const list = ratingsMap[titleId] || [];
    const r = list.find(x => x.userId === userId);
    return r ? { rating: r.note } : undefined;
  }, [ratingsMap]);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) {
      navigate('/groups', { replace: true });
    }
  }, [navigate]);

  const refreshRatingsForTitle = useCallback(async (titleId: string) => {
    // Refresh movies to get updated ratings
    await refreshMovies();
  }, [refreshMovies]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header movieCount={pagination?.totalResults || movies.length} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onRefresh={refreshMovies}
          loading={adding} 
          setLoading={setAdding} 
        />
        
        <FilterControls
          watchedFilter={watchedFilter}
          onWatchedFilterChange={setWatchedFilter}
          movieCount={pagination.totalResults}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
          ascending={ascending}
          onAscendingChange={setAscending}
        />
        
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-movie-blue" />
              <p className="text-lg font-medium text-foreground">Loading movies...</p>
            </div>
          </div>
        )}
        
        <MovieGrid 
          movies={movies} 
          onUpdate={updateMovie} 
          onDelete={deleteMovie} 
          onRefreshMovies={refreshMovies}
          users={users}
          getUserNameById={getUserNameById}
          ratingsMap={ratingsMap}
          getRatingForUser={getRatingForUser}
          refreshRatingsForTitle={refreshRatingsForTitle}
          pagination={pagination}
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
          loading={loading}
        />
      </main>
    </div>
  );
};

export default Index;
