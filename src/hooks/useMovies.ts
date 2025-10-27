import { useState, useEffect } from 'react';
import { Movie, PaginatedResponse, PaginationParams } from '@/types/movie';
import { fetchMovies } from '@/services/backendService';

export const useMovies = (watchedFilter?: boolean) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    totalPages: 0,
    totalResults: 0,
  });
  const [orderBy, setOrderBy] = useState<string | undefined>(undefined);
  const [ascending, setAscending] = useState<boolean>(false);

  const loadMovies = async (paginationParams?: PaginationParams) => {
    setLoading(true);
    try {
      // Use provided params or defaults, ensuring watched filter is always included
      const params: PaginationParams = paginationParams || { 
        page: 1, 
        size: 20, 
        watched: watchedFilter 
      };
      
      // If watched wasn't explicitly provided, use the hook's filter
      if (params.watched === undefined) {
        params.watched = watchedFilter;
      }

      // Add sorting parameters if not provided
      if (params.orderBy === undefined) {
        params.orderBy = orderBy;
      }
      if (params.ascending === undefined) {
        params.ascending = orderBy ? ascending : undefined;
      }
      
      const response = await fetchMovies(params);
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
    loadMovies({ page: 1, size: 20, watched: watchedFilter, orderBy, ascending });
  }, [watchedFilter, orderBy, ascending]);

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
    await loadMovies({ page: pagination.page, size: pagination.size, watched: watchedFilter, orderBy, ascending });
  };

  const changePage = (page: number) => {
    loadMovies({ page, size: pagination.size, watched: watchedFilter, orderBy, ascending });
  };

  const changePageSize = (size: number) => {
    loadMovies({ page: 1, size, watched: watchedFilter, orderBy, ascending });
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
    orderBy,
    setOrderBy,
    ascending,
    setAscending,
  };
};