import { useState } from 'react';
import { Movie } from '@/types/movie';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageCircle, Eye, EyeOff } from 'lucide-react';
import { MovieModal } from './MovieModal';
import { StarRating } from './StarRating';
import { useUsers } from '@/hooks/useUsers';
import { useRatings } from '@/hooks/useRatings';

interface MovieCardProps {
  movie: Movie;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}

export const MovieCard = ({ movie, onUpdate, onDelete }: MovieCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { users, getUserNameById } = useUsers();
  const { getRatingForUser, refreshRatings } = useRatings(movie.imdbId);

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'text-muted-foreground';
    if (rating >= 4) return 'text-movie-rating';
    if (rating >= 2.5) return 'text-movie-blue';
    return 'text-orange-400';
  };

  const hasRatings = users.some(user => {
    const apiRating = getRatingForUser(user.id);
    return apiRating && apiRating.rating > 0;
  });
  
  const hasComments = users.some(user => {
    const apiRating = getRatingForUser(user.id);
    return apiRating && apiRating.comments;
  });

  return (
    <>
      <Card 
        className="group relative overflow-hidden bg-gradient-card border-border/50 hover:border-movie-blue/30 transition-all duration-300 hover:shadow-glow cursor-pointer transform hover:scale-[1.02]"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="aspect-[2/3] relative overflow-hidden">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-movie.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* IMDB Rating Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-movie-surface/90 border-movie-blue/30">
              <Star className="w-3 h-3 mr-1 text-movie-blue" />
              {movie.imdbRating}
            </Badge>
          </div>

          {/* Watched Status */}
          <div className="absolute top-3 right-3">
            {movie.watched ? (
              <Eye className="w-4 h-4 text-movie-rating" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>


          {/* Comments Indicator */}
          {/* {hasComments && (
            <div className="absolute bottom-3 right-3 opacity-70">
              <MessageCircle className="w-4 h-4 text-movie-blue" />
            </div>
          )} */}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-movie-blue transition-colors">
            {movie.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            {movie.year} • {movie.genre}
          </p>
          
          {/* Personal Ratings */}
          <div className="space-y-1">
            {users.map(user => {
              const apiRating = getRatingForUser(user.id);
              const userRating = apiRating ? apiRating.rating : 0;
              return (
                <div key={user.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{user.name}:</span>
                  <StarRating rating={userRating} readonly size={16} />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <MovieModal
        movie={movie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onRefreshRatings={refreshRatings}
      />
    </>
  );
};