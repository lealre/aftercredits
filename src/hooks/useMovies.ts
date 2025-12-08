import { useState, useEffect, useCallback } from "react";
import { Movie, PaginatedResponse, PaginationParams, Rating } from "@/types/movie";
import { fetchMovies } from "@/services/backendService";

export const GROUP_ID = "690bb4b2029d2b31b8b66835";

export const useMovies = (watchedFilter?: boolean) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, Rating[]>>({});
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    totalPages: 0,
    totalResults: 0,
  });
  const [orderBy, setOrderBy] = useState<string | undefined>(undefined);
  const [ascending, setAscending] = useState<boolean>(true);

  const loadMovies = useCallback(
    async (paginationParams?: PaginationParams) => {
      setLoading(true);
      try {
        // Use provided params or defaults, ensuring watched filter is always included
        const params: PaginationParams = paginationParams || {
          page: 1,
          size: 20,
          watched: watchedFilter,
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

        const response = await fetchMovies(GROUP_ID, params);
        setMovies(response.Content);
        setRatingsMap(response.ratingsMap);
        setPagination({
          page: response.Page,
          size: response.Size,
          totalPages: response.TotalPages,
          totalResults: response.TotalResults,
        });
      } catch (error) {
        console.error("Error loading movies:", error);
      } finally {
        setLoading(false);
      }
    },
    [ascending, orderBy, watchedFilter],
  );

  useEffect(() => {
    loadMovies({
      page: 1,
      size: 20,
      watched: watchedFilter,
      orderBy,
      ascending: orderBy ? ascending : undefined,
    });
  }, [ascending, loadMovies, orderBy, watchedFilter]);

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    const newMovies = movies.map((movie) =>
      movie.id === id ? { ...movie, ...updates } : movie
    );
    setMovies(newMovies);
  };

  const deleteMovie = (id: string) => {
    const newMovies = movies.filter((movie) => movie.id !== id);
    setMovies(newMovies);
  };

  const refreshMovies = async () => {
    await loadMovies({
      page: pagination.page,
      size: pagination.size,
      watched: watchedFilter,
      orderBy,
      ascending: orderBy ? ascending : undefined,
    });
  };

  const changePage = (page: number) => {
    loadMovies({
      page,
      size: pagination.size,
      watched: watchedFilter,
      orderBy,
      ascending: orderBy ? ascending : undefined,
    });
  };

  const changePageSize = (size: number) => {
    loadMovies({
      page: 1,
      size,
      watched: watchedFilter,
      orderBy,
      ascending: orderBy ? ascending : undefined,
    });
  };

  return {
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
  };
};
