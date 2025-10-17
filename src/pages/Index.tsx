import { useState } from 'react';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';

const Index = () => {
  const { movies, loading, setLoading, addMovie, updateMovie, deleteMovie, refreshMovies } = useMovies();
  const { users, getUserNameById } = useUsers();
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');

  const filteredMovies = movies.filter(movie => {
    if (watchedFilter === 'watched') return movie.watched;
    if (watchedFilter === 'unwatched') return !movie.watched;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header movieCount={movies.length} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onAdd={addMovie} 
          loading={loading} 
          setLoading={setLoading} 
        />
        
        <FilterControls
          watchedFilter={watchedFilter}
          onWatchedFilterChange={setWatchedFilter}
          movieCount={filteredMovies.length}
        />
        
        <MovieGrid 
          movies={filteredMovies} 
          onUpdate={updateMovie} 
          onDelete={deleteMovie} 
          onRefreshMovies={refreshMovies}
          users={users}
          getUserNameById={getUserNameById}
        />
      </main>
    </div>
  );
};

export default Index;
