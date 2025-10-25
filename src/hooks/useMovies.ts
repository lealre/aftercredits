import { useState, useEffect } from 'react';
import { Movie, PaginatedResponse, PaginationParams } from '@/types/movie';
import { fetchMovies } from '@/services/backendService';

export const useMovies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    totalPages: 0,
    totalResults: 0,
  });

  const loadMovies = async (paginationParams?: PaginationParams) => {
    setLoading(true);
    try {
      const response = await fetchMovies(paginationParams);
      setMovies(response.Content);
      setPagination({
        page: response.Page,
        size: response.Size,
        totalPages: response.TotalPages,
        totalResults: response.TotalResults,
      });
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovies({ page: 1, size: 20 });
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
    await loadMovies({ page: pagination.page, size: pagination.size });
  };

  const changePage = (page: number) => {
    loadMovies({ page, size: pagination.size });
  };

  const changePageSize = (size: number) => {
    loadMovies({ page: 1, size });
  };

  return {
    movies,
    loading,
    setLoading,
    pagination,
    addMovie,
    updateMovie,
    deleteMovie,
    refreshMovies,
    changePage,
    changePageSize,
  };
};