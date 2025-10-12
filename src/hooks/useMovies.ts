import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';
import { fetchMovies } from '@/services/backendService';

export const useMovies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMovies = async () => {
    setLoading(true);
    try {
      // Fetch movies from backend only
      const fetchedMovies = await fetchMovies();
      setMovies(fetchedMovies);
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, []);

  const addMovie = (movie: Movie) => {
    const newMovies = [...movies, movie];
    setMovies(newMovies);
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    const newMovies = movies.map(movie => 
      movie.id === id ? { ...movie, ...updates } : movie
    );
    setMovies(newMovies);
  };

  const deleteMovie = (id: string) => {
    const newMovies = movies.filter(movie => movie.id !== id);
    setMovies(newMovies);
  };

  const refreshMovies = async () => {
    await loadMovies();
  };

  return {
    movies,
    loading,
    setLoading,
    addMovie,
    updateMovie,
    deleteMovie,
    refreshMovies,
  };
};