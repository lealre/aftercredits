import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Movie, PaginationParams, Rating } from "@/types/movie";
import { fetchMovies } from "@/services/backendService";
import { getGroupId } from "@/services/authService";

export const useMovies = (watchedFilter?: boolean, titleType?: 'serie' | 'movie') => {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [orderBy, setOrderBy] = useState<string | undefined>(undefined);
  const [ascending, setAscending] = useState<boolean>(true);

  const groupId = getGroupId();

  const params: PaginationParams = {
    page,
    size,
    watched: watchedFilter,
    orderBy,
    ascending: orderBy ? ascending : undefined,
    titleType,
  };

  const queryKey = ['movies', groupId, page, size, watchedFilter, orderBy, ascending, titleType];

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchMovies(groupId!, params),
    enabled: !!groupId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const movies = data?.Content ?? [];
  const ratingsMap = data?.ratingsMap ?? {};
  const pagination = {
    page: data?.Page ?? 1,
    size: data?.Size ?? 20,
    totalPages: data?.TotalPages ?? 0,
    totalResults: data?.TotalResults ?? 0,
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    queryClient.setQueryData(queryKey, (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        Content: old.Content.map((movie: Movie) =>
          movie.id === id ? { ...movie, ...updates } : movie
        ),
      };
    });
  };

  const deleteMovie = (id: string) => {
    queryClient.setQueryData(queryKey, (old: typeof data) => {
      if (!old) return old;
      return {
        ...old,
        Content: old.Content.filter((movie: Movie) => movie.id !== id),
        TotalResults: old.TotalResults - 1,
      };
    });
  };

  const refreshMovies = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['movies', groupId] });
  }, [queryClient, groupId]);

  const changePage = (newPage: number) => {
    setPage(newPage);
  };

  const changePageSize = (newSize: number) => {
    setPage(1);
    setSize(newSize);
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
