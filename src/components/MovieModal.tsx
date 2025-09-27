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
import { Switch } from '@/components/ui/switch';
import { Star, Trash2, ExternalLink, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './StarRating';

interface MovieModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete }: MovieModalProps) => {
  const { toast } = useToast();
  const [renanRating, setRenanRating] = useState(movie.renanRating || 0);
  const [renanComments, setRenanComments] = useState(movie.renanComments || '');
  const [brunaRating, setBrunaRating] = useState(movie.brunaRating || 0);
  const [brunaComments, setBrunaComments] = useState(movie.brunaComments || '');
  const [watched, setWatched] = useState(movie.watched || false);
  const [tags, setTags] = useState<string[]>(movie.tags || []);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim() && !newTag.includes(' ') && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    const updates: Partial<Movie> = {
      renanRating: renanRating || undefined,
      brunaRating: brunaRating || undefined,
      renanComments: renanComments || undefined,
      brunaComments: brunaComments || undefined,
      watched,
      tags: tags.length > 0 ? tags : undefined,
    };
    
    onUpdate(movie.id, updates);
    toast({
      title: "Movie updated!",
      description: "Your movie information has been saved.",
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
          <DialogTitle className="text-movie-blue">{movie.title}</DialogTitle>
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
                <Badge variant="secondary" className="bg-movie-surface border-movie-blue/30">
                  <Star className="w-3 h-3 mr-1 text-movie-blue" />
                  IMDB: {movie.imdbRating}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://www.imdb.com/title/${movie.imdbId}/`, '_blank')}
                  className="text-movie-blue hover:text-movie-blue-light"
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

          {/* Movie Status and Tags */}
          <div className="space-y-6">
            {/* Watched Status */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="watched"
                  checked={watched}
                  onCheckedChange={setWatched}
                />
                <Label htmlFor="watched">Watched</Label>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-movie-blue">Tags</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-movie-surface border-movie-blue/30">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag (no spaces)"
                  className="bg-movie-surface border-border"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} size="sm" variant="outline">
                  Add
                </Button>
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Renan's Rating */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-movie-blue">Renan's Rating</h3>
              <div className="space-y-2">
                <Label>Rating (0-5 stars)</Label>
                <StarRating rating={renanRating} onRatingChange={setRenanRating} />
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
              <h3 className="text-lg font-semibold text-movie-blue">Bruna's Rating</h3>
              <div className="space-y-2">
                <Label>Rating (0-5 stars)</Label>
                <StarRating rating={brunaRating} onRatingChange={setBrunaRating} />
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
              <Button onClick={handleSave} className="flex-1 bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light">
                Save Changes
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