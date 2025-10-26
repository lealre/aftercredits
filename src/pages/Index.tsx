import { useState } from 'react';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';

const Index = () => {
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  
  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  
  const { 
    movies, 
    loading, 
    setLoading, 
    pagination,
    addMovie, 
    updateMovie, 
    deleteMovie, 
    refreshMovies,
    changePage,
    changePageSize
  } = useMovies(watchedFilterValue);
  const { users, getUserNameById } = useUsers();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header movieCount={pagination?.totalResults || movies.length} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onAdd={addMovie} 
          loading={loading} 
          setLoading={setLoading} 
        />
        
        <FilterControls
          watchedFilter={watchedFilter}
          onWatchedFilterChange={setWatchedFilter}
          movieCount={pagination.totalResults}
        />
        
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
