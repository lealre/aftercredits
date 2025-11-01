import { useState, useEffect, useCallback } from 'react';
import { Movie, User, Rating, Comment } from '@/types/movie';
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
import { Star, Trash2, ExternalLink, X, Edit3, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './StarRating';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { saveOrUpdateRating, updateMovieWatchedStatus, deleteMovie, fetchComments, createComment, updateComment } from '@/services/backendService';

interface MovieModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Movie>) => void;
  onDelete: (id: string) => void;
  onRefreshRatings?: () => void;
  onRefreshMovies?: () => void;
  users: User[];
  getUserNameById: (userId: string) => string;
  ratings: Rating[];
  getRatingForUser: (userId: string) => { rating: number } | undefined;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete, onRefreshRatings, onRefreshMovies, users, getUserNameById, ratings, getRatingForUser }: MovieModalProps) => {
  const { toast } = useToast();
  const [userRatings, setUserRatings] = useState<Record<string, { rating: number }>>({});
  const [userComments, setUserComments] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [watched, setWatched] = useState(movie.watched || false);
  const [watchedAt, setWatchedAt] = useState(movie.watchedAt || '');
  const [isEditingWatchedAt, setIsEditingWatchedAt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const loadedComments = await fetchComments(movie.imdbId);
      setComments(loadedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
      // If error, just set empty array
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [movie.imdbId]);

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComments();
    } else {
      // Reset state when modal closes
      setComments([]);
      setUserRatings({});
      setUserComments({});
    }
  }, [isOpen, loadComments]);

  const updateUserRating = (userId: string, rating: number) => {
    setUserRatings(prev => ({
      ...prev,
      [userId]: { rating }
    }));
  };

  const updateUserComments = (userId: string, comment: string) => {
    setUserComments(prev => ({
      ...prev,
      [userId]: comment
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
    // First check if user has a local comment being edited
    if (userComments[userId] !== undefined) {
      return userComments[userId];
    }
    // Otherwise get from comments API
    const userComment = comments.find(c => c.userId === userId);
    return userComment ? userComment.comment : '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save ratings if there are any changes
      const ratingPromises = Object.entries(userRatings).map(async ([userId, ratingData]) => {
        if (ratingData.rating >= 0) {
          return saveOrUpdateRating({
            titleId: movie.imdbId,
            userId: userId,
            note: ratingData.rating,
          }, ratings);
        }
        return null;
      });

      await Promise.all(ratingPromises.filter(Boolean));

      // Save comments if there are any changes
      const commentPromises = Object.entries(userComments).map(async ([userId, comment]) => {
        const existingComment = comments.find(c => c.userId === userId);
        
        if (existingComment) {
          // Update existing comment
          return updateComment(existingComment.id, comment);
        } else if (comment.trim()) {
          // Create new comment
          return createComment(userId, movie.imdbId, comment);
        }
        return null;
      });

      await Promise.all(commentPromises.filter(Boolean));

      // Refresh ratings to get the latest data from batch endpoint
      if (onRefreshRatings) {
        await onRefreshRatings();
      }

      // Reload comments after save
      await loadComments();

      // Clear local state after successful save
      setUserRatings({});
      setUserComments({});

      // Update watched status if it changed
      if (watched !== movie.watched || watchedAt !== movie.watchedAt) {
        await updateMovieWatchedStatus(movie.imdbId, watched, watchedAt || '');
        
        // Refresh movies to get the latest data from backend
        if (onRefreshMovies) {
          await onRefreshMovies();
        }
      }

      // Save movie updates locally
      const updates: Partial<Movie> = {
        watched,
        watchedAt: watchedAt || ''
      };
      
      onUpdate(movie.id, updates);
      
      toast({
        title: "Movie updated!",
        description: "Your movie information, ratings, and comments have been saved.",
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

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      // Delete from backend
      await deleteMovie(movie.imdbId);
      
      // Update local state
      onDelete(movie.id);
      
      toast({
        title: "Movie deleted",
        description: `"${movie.title}" has been removed from your list.`,
      });
      
      // Close both modals
      setShowDeleteModal(false);
      onClose();
    } catch (error) {
      console.error('Error deleting movie:', error);
      toast({
        title: "Error deleting movie",
        description: "Failed to delete movie. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleDeleteWatchedDate = async () => {
    // Only update local state; persist on Save
    setWatchedAt('');
    setIsEditingWatchedAt(false);
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

          {/* Movie Status */}
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
              
              {/* Watched Date */}
              {watched && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Watched on:</Label>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingWatchedAt(!isEditingWatchedAt)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteWatchedDate}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {isEditingWatchedAt ? (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="date"
                        value={watchedAt}
                        onChange={(e) => setWatchedAt(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingWatchedAt(false)}
                        className="h-8 px-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground">
                      {watchedAt ? new Date(watchedAt).toLocaleDateString() : 'No date set'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Ratings */}
            {users.map((user, index) => (
              <div key={user.id}>
                {index > 0 && <Separator className="bg-border" />}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-movie-blue">{user.name}'s Rating</h3>
                  <div className="space-y-2">
                    <Label>Rating (0-10 scale)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={getUserRating(user.id)}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            updateUserRating(user.id, Math.min(10, Math.max(0, value)));
                          }
                        }}
                        className="w-20 bg-movie-surface border-border"
                        placeholder="0.0"
                      />
                      <StarRating 
                        rating={getUserRating(user.id)} 
                        readonly={true}
                        size={24}
                      />
                    </div>
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
                onClick={handleDeleteClick}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      
      <DeleteConfirmationModal
        movie={movie}
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </Dialog>
  );
};