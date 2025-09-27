import { useMovies } from '@/hooks/useMovies';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';

const Index = () => {
  const { movies, loading, setLoading, addMovie, updateMovie, deleteMovie, exportToCSV } = useMovies();

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header onExport={exportToCSV} movieCount={movies.length} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onAdd={addMovie} 
          loading={loading} 
          setLoading={setLoading} 
        />
        
        <MovieGrid 
          movies={movies} 
          onUpdate={updateMovie} 
          onDelete={deleteMovie} 
        />
      </main>
    </div>
  );
};

export default Index;
