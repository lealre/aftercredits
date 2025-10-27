import { useState } from 'react';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  
  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  
  const { 
    movies, 
    loading, 
    setLoading, 
    adding,
    setAdding,
    pagination,
    addMovie, 
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

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header movieCount={pagination?.totalResults || movies.length} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onAdd={addMovie} 
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
