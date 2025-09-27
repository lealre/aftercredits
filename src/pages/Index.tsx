import { useState } from 'react';
import { useMovies } from '@/hooks/useMovies';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';

const Index = () => {
  const { movies, loading, setLoading, addMovie, updateMovie, deleteMovie, exportToCSV } = useMovies();
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');

  const filteredMovies = movies.filter(movie => {
    if (watchedFilter === 'watched') return movie.watched;
    if (watchedFilter === 'unwatched') return !movie.watched;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header onExport={exportToCSV} movieCount={movies.length} />
      
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
        />
      </main>
    </div>
  );
};

export default Index;
