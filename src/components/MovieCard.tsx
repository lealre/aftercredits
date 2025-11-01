import { useState } from "react";
import { Movie, User, Rating } from "@/types/movie";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageCircle, Eye, EyeOff } from "lucide-react";
import { MovieModal } from "./MovieModal";
import { StarRating } from "./StarRating";
// Ratings are now passed from parent via batch fetch

interface MovieCardProps {
  movie: Movie;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
  onRefreshMovies?: () => void;
  users: User[];
  getUserNameById: (userId: string) => string;
  ratings: Rating[];
  getRatingForUser: (userId: string) => { rating: number } | undefined;
  onRefreshRatings?: () => void;
}

export const MovieCard = ({
  movie,
  onUpdate,
  onDelete,
  onRefreshMovies,
  users,
  getUserNameById,
  ratings,
  getRatingForUser,
  onRefreshRatings,
}: MovieCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatDuration = (runtimeSeconds?: number): string => {
    if (!runtimeSeconds) return "";
    const hours = Math.floor(runtimeSeconds / 3600);
    const minutes = Math.floor((runtimeSeconds % 3600) / 60);

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    }
    return "";
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <>
      <Card
        className="group relative overflow-hidden bg-gradient-card border-border/50 hover:border-movie-blue/30 transition-all duration-300 hover:shadow-glow cursor-pointer transform hover:scale-[1.02]"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="aspect-[16/9] sm:aspect-[2/3] relative overflow-hidden">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-movie.jpg";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* IMDB Rating Badge */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className="bg-movie-surface/90 border-movie-blue/30"
            >
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
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-movie-blue transition-colors">
            {movie.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            {movie.year} • {movie.genre}
          </p>

          {/* Watched Date */}
          {movie.watched && movie.watchedAt && (
            <p className="text-xs text-movie-rating mb-2">
              Watched on {formatDate(movie.watchedAt)}
            </p>
          )}

          {/* Personal Ratings */}
          <div className="space-y-1">
            {users.map((user) => {
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

          {/* Duration */}
          {movie.type === "movie" && movie.runtimeSeconds && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              Duration: {formatDuration(movie.runtimeSeconds)}
            </p>
          )}
        </div>
      </Card>

      <MovieModal
        movie={movie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onRefreshRatings={onRefreshRatings}
        onRefreshMovies={onRefreshMovies}
        users={users}
        getUserNameById={getUserNameById}
        ratings={ratings}
        getRatingForUser={getRatingForUser}
      />
    </>
  );
};
