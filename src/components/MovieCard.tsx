import { useState } from 'react';
import { Movie } from '@/types/movie';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageCircle } from 'lucide-react';
import { MovieModal } from './MovieModal';

interface MovieCardProps {
  movie: Movie;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}

export const MovieCard = ({ movie, onUpdate, onDelete }: MovieCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'text-muted-foreground';
    if (rating >= 8) return 'text-movie-rating';
    if (rating >= 6) return 'text-movie-gold';
    return 'text-orange-400';
  };

  const hasRatings = movie.renanRating || movie.brunaRating;
  const hasComments = movie.renanComments || movie.brunaComments;

  return (
    <>
      <Card 
        className="group relative overflow-hidden bg-gradient-card border-border/50 hover:border-movie-gold/30 transition-all duration-300 hover:shadow-glow cursor-pointer transform hover:scale-[1.02]"
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
            <Badge variant="secondary" className="bg-movie-surface/90 border-movie-gold/30">
              <Star className="w-3 h-3 mr-1 text-movie-gold" />
              {movie.imdbRating}
            </Badge>
          </div>

          {/* Rating Indicators */}
          {hasRatings && (
            <div className="absolute top-3 right-3 flex gap-1">
              {movie.renanRating && (
                <div className={`w-2 h-2 rounded-full ${getRatingColor(movie.renanRating)} bg-current`} />
              )}
              {movie.brunaRating && (
                <div className={`w-2 h-2 rounded-full ${getRatingColor(movie.brunaRating)} bg-current`} />
              )}
            </div>
          )}

          {/* Comments Indicator */}
          {hasComments && (
            <div className="absolute bottom-3 right-3 opacity-70">
              <MessageCircle className="w-4 h-4 text-movie-gold" />
            </div>
          )}
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-movie-gold transition-colors">
            {movie.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            {movie.year} • {movie.genre}
          </p>
          
          {/* Personal Ratings */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex gap-3">
              <span className={`${movie.renanRating ? getRatingColor(movie.renanRating) : 'text-muted-foreground'}`}>
                Renan: {movie.renanRating || '-'}
              </span>
              <span className={`${movie.brunaRating ? getRatingColor(movie.brunaRating) : 'text-muted-foreground'}`}>
                Bruna: {movie.brunaRating || '-'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <MovieModal
        movie={movie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
};