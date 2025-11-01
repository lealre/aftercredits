import { Movie, User, Rating } from '@/types/movie';
import { MovieCard } from './MovieCard';
import { Pagination } from './Pagination';

interface MovieGridProps {
  movies: Movie[];
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
  onRefreshMovies?: () => void;
  users: User[];
  getUserNameById: (userId: string) => string;
  ratingsMap: Record<string, Rating[]>;
  getRatingForUser: (titleId: string, userId: string) => { rating: number } | undefined;
  refreshRatingsForTitle: (titleId: string) => Promise<void>;
  pagination?: {
    page: number;
    totalPages: number;
    totalResults: number;
    size: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  loading?: boolean;
}

export const MovieGrid = ({ 
  movies, 
  onUpdate, 
  onDelete, 
  onRefreshMovies, 
  users, 
  getUserNameById,
  ratingsMap,
  getRatingForUser,
  refreshRatingsForTitle,
  pagination,
  onPageChange,
  onPageSizeChange,
  loading = false
}: MovieGridProps) => {
  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-24 h-24 rounded-full bg-movie-surface flex items-center justify-center mb-4">
          <span className="text-3xl">🎬</span>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No movies yet</h3>
        <p className="text-muted-foreground max-w-md">
          Start building your movie collection by adding your first film from IMDB. 
          You and Bruna can rate and comment on each movie!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pagination && onPageChange && onPageSizeChange && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalResults={pagination.totalResults}
            pageSize={pagination.size}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            loading={loading}
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onRefreshMovies={onRefreshMovies}
            users={users}
            getUserNameById={getUserNameById}
            ratings={ratingsMap[movie.imdbId] || []}
            getRatingForUser={(userId) => getRatingForUser(movie.imdbId, userId)}
            onRefreshRatings={() => refreshRatingsForTitle(movie.imdbId)}
          />
        ))}
      </div>
    </div>
  );
};