import { useState } from 'react';
import { Movie } from '@/types/movie';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Star, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MovieModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete }: MovieModalProps) => {
  const { toast } = useToast();
  const [renanRating, setRenanRating] = useState(movie.renanRating?.toString() || '');
  const [renanComments, setRenanComments] = useState(movie.renanComments || '');
  const [brunaRating, setBrunaRating] = useState(movie.brunaRating?.toString() || '');
  const [brunaComments, setBrunaComments] = useState(movie.brunaComments || '');

  const handleSave = () => {
    const updates: Partial<Movie> = {};
    
    if (renanRating) {
      const rating = parseFloat(renanRating);
      if (rating >= 0 && rating <= 10) {
        updates.renanRating = rating;
      }
    } else {
      updates.renanRating = undefined;
    }
    
    if (brunaRating) {
      const rating = parseFloat(brunaRating);
      if (rating >= 0 && rating <= 10) {
        updates.brunaRating = rating;
      }
    } else {
      updates.brunaRating = undefined;
    }
    
    updates.renanComments = renanComments || undefined;
    updates.brunaComments = brunaComments || undefined;
    
    onUpdate(movie.id, updates);
    toast({
      title: "Ratings saved!",
      description: "Your movie ratings have been updated.",
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this movie?')) {
      onDelete(movie.id);
      toast({
        title: "Movie deleted",
        description: `"${movie.title}" has been removed from your list.`,
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-movie-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-movie-gold">{movie.title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Movie Info */}
          <div className="space-y-4">
            <div className="aspect-[2/3] relative overflow-hidden rounded-lg">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-movie.jpg';
                }}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-movie-surface border-movie-gold/30">
                  <Star className="w-3 h-3 mr-1 text-movie-gold" />
                  IMDB: {movie.imdbRating}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://www.imdb.com/title/${movie.imdbId}/`, '_blank')}
                  className="text-movie-gold hover:text-movie-gold-light"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {movie.year} • {movie.genre}
              </p>
              <p className="text-sm text-muted-foreground">
                Director: {movie.director}
              </p>
              <p className="text-sm">{movie.plot}</p>
            </div>
          </div>

          {/* Ratings */}
          <div className="space-y-6">
            {/* Renan's Rating */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-movie-gold">Renan's Rating</h3>
              <div className="space-y-2">
                <Label htmlFor="renan-rating">Rating (0-10)</Label>
                <Input
                  id="renan-rating"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={renanRating}
                  onChange={(e) => setRenanRating(e.target.value)}
                  placeholder="Rate this movie"
                  className="bg-movie-surface border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="renan-comments">Comments</Label>
                <Textarea
                  id="renan-comments"
                  value={renanComments}
                  onChange={(e) => setRenanComments(e.target.value)}
                  placeholder="What did you think about this movie?"
                  className="bg-movie-surface border-border resize-none"
                  rows={3}
                />
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Bruna's Rating */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-movie-gold">Bruna's Rating</h3>
              <div className="space-y-2">
                <Label htmlFor="bruna-rating">Rating (0-10)</Label>
                <Input
                  id="bruna-rating"
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={brunaRating}
                  onChange={(e) => setBrunaRating(e.target.value)}
                  placeholder="Rate this movie"
                  className="bg-movie-surface border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bruna-comments">Comments</Label>
                <Textarea
                  id="bruna-comments"
                  value={brunaComments}
                  onChange={(e) => setBrunaComments(e.target.value)}
                  placeholder="What did you think about this movie?"
                  className="bg-movie-surface border-border resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1 bg-movie-gold text-movie-gold-foreground hover:bg-movie-gold-light">
                Save Ratings
              </Button>
              <Button 
                variant="destructive" 
                size="icon"
                onClick={handleDelete}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};