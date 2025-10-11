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
import { useUsers } from '@/hooks/useUsers';
import { useRatings } from '@/hooks/useRatings';
import { saveRating } from '@/services/backendService';

interface MovieModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete }: MovieModalProps) => {
  const { toast } = useToast();
  const { users, getUserNameById } = useUsers();
  const { getRatingForUser } = useRatings(movie.imdbId);
  const [userRatings, setUserRatings] = useState<Record<string, { rating: number; comments: string }>>({});
  const [watched, setWatched] = useState(movie.watched || false);
  const [tags, setTags] = useState<string[]>(movie.tags || []);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    if (newTag.trim() && !newTag.includes(' ') && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const updateUserRating = (userId: string, rating: number) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: { ...prev[userId], rating }
    }));
  };

  const updateUserComments = (userId: string, comments: string) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: { ...prev[userId], comments }
    }));
  };

  const getUserRating = (userId: string) => {
    // First check if user has a local rating being edited
    if (userRatings[userId]) {
      return userRatings[userId].rating;
    }
    // Otherwise get from API
    const apiRating = getRatingForUser(userId);
    return apiRating ? apiRating.rating : 0;
  };

  const getUserComments = (userId: string) => {
    // First check if user has a local rating being edited
    if (userRatings[userId]) {
      return userRatings[userId].comments;
    }
    // Otherwise get from API
    const apiRating = getRatingForUser(userId);
    return apiRating ? apiRating.comments : '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save ratings first if there are any
      if (Object.keys(userRatings).length > 0) {
        const savePromises = Object.entries(userRatings).map(async ([userId, ratingData]) => {
          if (ratingData.rating > 0 || ratingData.comments.trim()) {
            return saveRating({
              titleId: movie.imdbId,
              userId: userId,
              note: ratingData.rating,
              comments: ratingData.comments,
            });
          }
          return null;
        });

        await Promise.all(savePromises.filter(Boolean));
        
        // Clear local ratings after successful save
        setUserRatings({});
      }

      // Save movie updates
      const updates: Partial<Movie> = {
        watched,
        tags: tags.length > 0 ? tags : undefined,
      };
      
      onUpdate(movie.id, updates);
      
      toast({
        title: "Movie updated!",
        description: "Your movie information and ratings have been saved.",
      });
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Error saving",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
            {/* <div className="space-y-3">
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

            <Separator className="bg-border" /> */}

            {/* User Ratings */}
            {users.map((user, index) => (
              <div key={user.id}>
                {index > 0 && <Separator className="bg-border" />}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-movie-blue">{user.name}'s Rating</h3>
                  <div className="space-y-2">
                    <Label>Rating (0-10 scale)</Label>
                    <StarRating 
                      rating={getUserRating(user.id)} 
                      onRatingChange={(rating) => updateUserRating(user.id, rating)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${user.id}-comments`}>Comments</Label>
                    <Textarea
                      id={`${user.id}-comments`}
                      value={getUserComments(user.id)}
                      onChange={(e) => updateUserComments(user.id, e.target.value)}
                      placeholder="What did you think about this movie?"
                      className="bg-movie-surface border-border resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1 bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light"
              >
                {saving ? 'Saving...' : 'Save Changes'}
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