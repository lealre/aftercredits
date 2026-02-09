import { Movie, User, Rating, SeasonRating } from '@/types/movie';
import { MovieCard } from './MovieCard';
import { PaginationSummary, PaginationNavigation } from './Pagination';

interface MovieGridProps {
  movies: Movie[];
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
  onRefreshMovies?: () => void;
  users: User[];
  getUserNameById: (userId: string) => string;
  ratingsMap: Record<string, Rating[]>;
  getRatingForUser: (titleId: string, userId: string) => { rating: number; seasonsRatings?: Record<string, SeasonRating> } | undefined;
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
  orderBy?: string;
  ascending?: boolean;
  titleType?: 'all' | 'serie' | 'movie' | undefined;
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
  loading = false,
  orderBy,
  ascending,
  titleType,
}: MovieGridProps) => {
  if (movies.length === 0 && !loading) {
    // Check if a titleType filter is active
    const hasTitleTypeFilter = titleType === 'serie' || titleType === 'movie';
    
    if (hasTitleTypeFilter) {
      // Show filter-specific message when a filter is active but no results
      const filterLabel = titleType === 'serie' ? 'series' : 'movies';
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 rounded-full bg-movie-surface flex items-center justify-center mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No titles found for this filter</h3>
          <p className="text-muted-foreground max-w-md">
            There are no {filterLabel} matching your current filter criteria. Try adjusting your filters or add some {filterLabel} to your collection.
          </p>
        </div>
      );
    }
    
    // Show default message when no filter is active
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
    <div className="!mt-3">
      {/* Pagination Summary - at the top */}
      {pagination && onPageSizeChange && (
        <div className="flex justify-center mb-3">
          <PaginationSummary
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalResults={pagination.totalResults}
            pageSize={pagination.size}
            onPageSizeChange={onPageSizeChange}
            loading={loading}
            orderBy={orderBy}
            ascending={ascending}
            titleType={titleType}
          />
        </div>
      )}
      
      {/* Movie Grid */}
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
      
      {/* Pagination Navigation - at the bottom */}
      {pagination && onPageChange && pagination.totalPages > 1 && (
        <div className="flex justify-center pt-6">
          <PaginationNavigation
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={onPageChange}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};