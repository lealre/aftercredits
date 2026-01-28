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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star, Trash2, ExternalLink, X, Edit3, XCircle, MessageCircle, Trash, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './StarRating';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { saveOrUpdateRating, updateMovieWatchedStatus, deleteMovie, fetchComments, createComment, updateComment, deleteComment } from '@/services/backendService';
import { getGroupId, getUserId } from '@/services/authService';

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
  getRatingForUser: (userId: string) => { rating: number; seasonsRatings?: Record<string, number> } | undefined;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete, onRefreshRatings, onRefreshMovies, users, getUserNameById, ratings, getRatingForUser }: MovieModalProps) => {
  const { toast } = useToast();
  const currentUserId = getUserId();
  
  // Check if this is a TV series - must be declared before useEffects that use it
  const isTVSeries = movie.type === 'tvSeries' || movie.type === 'tvMiniSeries';
  
  const [userRatings, setUserRatings] = useState<Record<string, { rating: number }>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  // Initialize watched state directly from movie prop - update only when modal opens with new movie
  const [watched, setWatched] = useState(() => movie.watched || false);
  const [watchedAt, setWatchedAt] = useState(() => movie.watchedAt || '');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [isEditingWatchedAt, setIsEditingWatchedAt] = useState(false);
  const [tempWatchedAt, setTempWatchedAt] = useState(''); // Temporary date while editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null); // Track which user's rating is being edited
  const [tempUserRatings, setTempUserRatings] = useState<Record<string, { rating: number }>>({}); // Temporary ratings while editing
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [addingComment, setAddingComment] = useState(false);
  const [showAddCommentForm, setShowAddCommentForm] = useState(false);
  
  // Sync watched state only when modal opens with a specific movie
  useEffect(() => {
    if (isOpen) {
      // Reset season selection when modal opens
      if (isTVSeries && movie.seasons && movie.seasons.length > 0) {
        const firstSeason = movie.seasons[0].season;
        setSelectedSeason(firstSeason);

        const seasonWatched = movie.seasonsWatched?.[firstSeason];
        setWatched(seasonWatched?.watched ?? false);
        setWatchedAt(seasonWatched?.watchedAt ?? '');
      } else {
        setSelectedSeason('');
        setWatched(movie.watched || false);
        setWatchedAt(movie.watchedAt || '');
      }
    }
  }, [isOpen, movie.id, movie.watched, movie.watchedAt, movie.seasonsWatched, isTVSeries, movie.seasons]); // Sync when modal opens or movie changes

  // When user changes season, update watched state to reflect that season (TV series only)
  useEffect(() => {
    if (!isOpen) return;
    if (!isTVSeries) return;
    if (!selectedSeason) return;

    const seasonWatched = movie.seasonsWatched?.[selectedSeason];
    setWatched(seasonWatched?.watched ?? false);
    setWatchedAt(seasonWatched?.watchedAt ?? '');
    setIsEditingWatchedAt(false);
    setTempWatchedAt('');
  }, [isOpen, isTVSeries, selectedSeason, movie.seasonsWatched]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        // No group selected - just set empty comments
        setComments([]);
        setLoadingComments(false);
        return;
      }
      const loadedComments = await fetchComments(groupId, movie.imdbId);
      // Filter comments by season for TV series
      if (isTVSeries && selectedSeason) {
        const filteredComments = loadedComments
          .filter(comment => {
            // For TV series, show comments that have a comment for this season
            return comment.seasonsComments && comment.seasonsComments[selectedSeason] !== undefined;
          })
          .map(comment => ({
            ...comment,
            comment: comment.seasonsComments?.[selectedSeason] || comment.comment || '',
          }));
        setComments(Array.isArray(filteredComments) ? filteredComments : []);
      } else {
        // For movies, show regular comments
        const movieComments = loadedComments
          .filter(comment => comment.comment !== undefined && comment.comment !== null)
          .map(comment => ({
            ...comment,
            comment: comment.comment || '',
          }));
        setComments(Array.isArray(movieComments) ? movieComments : []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      // If error, just set empty array
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [movie.imdbId, isTVSeries, selectedSeason]);

  // No longer needed - comments are always created by current user

  // Load comments when modal opens or season changes - defer to next tick to not block rendering
  useEffect(() => {
    if (isOpen) {
      // Use setTimeout to defer to next event loop tick, allowing modal to render first
      const timer = setTimeout(() => {
        loadComments();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // Reset state when modal closes - revert to original movie data
      setComments([]);
      setUserRatings({});
      setEditingCommentId(null);
      setEditingCommentText('');
      setNewCommentText('');
      setShowAddCommentForm(false);
      setWatched(movie.watched || false);
      setWatchedAt(movie.watchedAt || '');
      setIsEditingWatchedAt(false);
      setTempWatchedAt('');
      setEditingUserId(null);
      setTempUserRatings({});
    }
  }, [isOpen, loadComments, movie.watched, movie.watchedAt, selectedSeason]);

  const updateUserRating = (userId: string, rating: number) => {
    if (editingUserId === userId) {
      // Update temporary rating when editing this specific user
      setTempUserRatings(prev => ({
        ...prev,
        [userId]: { rating }
      }));
    } else {
      // Update actual ratings when not editing (shouldn't happen, but keep for safety)
      setUserRatings(prev => ({
        ...prev,
        [userId]: { rating }
      }));
    }
  };

  const getUserRating = (userId: string) => {
    // For TV series with a selected season, check for season-specific rating
    if (isTVSeries && selectedSeason) {
      // When editing this user, use temp rating if available
      if (editingUserId === userId && tempUserRatings[userId]) {
        return tempUserRatings[userId].rating;
      }
      // When not editing but has local rating, use that
      if (userRatings[userId]) {
        return userRatings[userId].rating;
      }
      // Otherwise get from API season ratings
      const apiRating = getRatingForUser(userId);
      if (apiRating?.seasonsRatings && apiRating.seasonsRatings[selectedSeason] !== undefined) {
        return apiRating.seasonsRatings[selectedSeason];
      }
      // If no season rating, return 0 as specified
      return 0;
    }

    // For movies or when no season is selected, use the regular rating logic
    if (editingUserId === userId) {
      // When editing this user, use temp rating if available, otherwise fall back to current rating
      if (tempUserRatings[userId]) {
        return tempUserRatings[userId].rating;
      }
      // Fall back to current rating (from API or userRatings)
      if (userRatings[userId]) {
        return userRatings[userId].rating;
      }
      const apiRating = getRatingForUser(userId);
      return apiRating ? apiRating.rating : 0;
    } else {
      // When not editing, check if user has a local rating being edited
      if (userRatings[userId]) {
        return userRatings[userId].rating;
      }
      // Otherwise get from API
      const apiRating = getRatingForUser(userId);
      return apiRating ? apiRating.rating : 0;
    }
  };

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else if (diffInDays < 7) {
      const days = Math.floor(diffInDays);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
  }, []);

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    // For TV series, get the season-specific comment; for movies, use regular comment
    const commentText = isTVSeries && selectedSeason && comment.seasonsComments
      ? comment.seasonsComments[selectedSeason] || ''
      : comment.comment || '';
    setEditingCommentText(commentText);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = async (commentId: string) => {
    const trimmedComment = editingCommentText.trim();
    
    if (!trimmedComment || trimmedComment.length === 0) {
      toast({
        title: "Error",
        description: "Comment cannot be empty or contain only spaces.",
        variant: "destructive",
      });
      return;
    }

    // For TV series, ensure a season is selected
    if (isTVSeries && !selectedSeason) {
      toast({
        title: "Season required",
        description: "Please select a season before updating the comment.",
        variant: "destructive",
      });
      return;
    }

    setSavingComment(true);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: "No group selected",
          description: "Please select a group to update comments.",
          variant: "destructive",
        });
        setSavingComment(false);
        return;
      }
      // For TV series, pass the selected season; for movies, don't pass season
      const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
      await updateComment(groupId, movie.imdbId, commentId, trimmedComment, season);
      await loadComments();
      setEditingCommentId(null);
      setEditingCommentText('');
      toast({
        title: "Comment updated!",
        description: "Your comment has been updated.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingComment(false);
    }
  };

  const handleAddComment = async () => {
    const trimmedComment = newCommentText.trim();
    
    if (!trimmedComment || trimmedComment.length === 0) {
      toast({
        title: "Error",
        description: "Comment cannot be empty or contain only spaces.",
        variant: "destructive",
      });
      return;
    }

    // For TV series, ensure a season is selected
    if (isTVSeries && !selectedSeason) {
      toast({
        title: "Season required",
        description: "Please select a season before adding a comment.",
        variant: "destructive",
      });
      return;
    }

    const groupId = getGroupId();
    if (!groupId) {
      toast({
        title: "No group selected",
        description: "Please select a group to add comments.",
        variant: "destructive",
      });
      return;
    }

    setAddingComment(true);
    try {
      // For TV series, pass the selected season; for movies, don't pass season
      const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
      await createComment(groupId, movie.imdbId, trimmedComment, season);
      await loadComments();
      setNewCommentText('');
      setShowAddCommentForm(false);
      toast({
        title: "Comment added!",
        description: "Your comment has been added.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: "No group selected",
          description: "Please select a group to delete comments.",
          variant: "destructive",
        });
        setDeletingCommentId(null);
        return;
      }
      await deleteComment(groupId, movie.imdbId, commentId);
      await loadComments();
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: "No group selected",
          description: "Please select a group to save changes.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Save ratings if there are any changes
      const ratingPromises = Object.entries(userRatings).map(async ([userId, ratingData]) => {
        if (ratingData.rating >= 0) {
          // For TV series, pass the selected season; for movies, don't pass season
          const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
          return saveOrUpdateRating({
            groupId: groupId,
            titleId: movie.imdbId,
            note: ratingData.rating,
            userId: userId,
            season: season,
          }, ratings);
        }
        return null;
      });

      await Promise.all(ratingPromises.filter(Boolean));

      // Refresh ratings to get the latest data from batch endpoint
      if (onRefreshRatings) {
        await onRefreshRatings();
      }

      // Clear local state after successful save
      setUserRatings({});

      // Update watched status if it changed
      const baselineWatched =
        isTVSeries && selectedSeason
          ? (movie.seasonsWatched?.[selectedSeason]?.watched ?? false)
          : (movie.watched ?? false);
      const baselineWatchedAt =
        isTVSeries && selectedSeason
          ? (movie.seasonsWatched?.[selectedSeason]?.watchedAt ?? '')
          : (movie.watchedAt ?? '');

      if (watched !== baselineWatched || watchedAt !== baselineWatchedAt) {
        const groupId = getGroupId();
        if (!groupId) {
          toast({
            title: "No group selected",
            description: "Please select a group to update watched status.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        // For TV series, send the selected season; for movies, don't send season
        const season = isTVSeries && selectedSeason ? parseInt(selectedSeason, 10) : undefined;
        await updateMovieWatchedStatus(groupId, movie.imdbId, watched, watchedAt || '', season);
        
        // Refresh movies to get the latest data from backend
        if (onRefreshMovies) {
          await onRefreshMovies();
        }
      }

      // Save movie updates locally
      const updates: Partial<Movie> = {};
      if (isTVSeries && selectedSeason) {
        updates.seasonsWatched = {
          ...(movie.seasonsWatched || {}),
          [selectedSeason]: {
            watched,
            watchedAt: watchedAt || undefined,
          },
        };
      } else {
        updates.watched = watched;
        updates.watchedAt = watchedAt || '';
      }
      
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
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: "No group selected",
          description: "Please select a group to delete movies.",
          variant: "destructive",
        });
        setDeleting(false);
        setShowDeleteModal(false);
        return;
      }
      await deleteMovie(groupId, movie.imdbId);
      
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-movie-surface border-border p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-movie-blue">{movie.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* On mobile: single scroll container, on desktop: grid with separate scrolls */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 md:overflow-hidden md:flex md:flex-col">
            <div className="flex flex-col md:grid md:grid-cols-2 gap-3 w-full md:flex-1 md:min-h-0">
              {/* Movie Info */}
              <div className="md:overflow-y-auto md:h-full space-y-4 md:px-3 md:pb-3">
                {/* Hide poster on mobile */}
                <div className="hidden md:block aspect-[2/3] relative overflow-hidden rounded-lg">
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

              {/* Movie Status - on mobile scrolls with everything, on desktop scrolls separately */}
              <div className="flex flex-col min-h-0 md:h-full md:flex md:flex-col">
                <div className="flex-1 overflow-y-auto md:overflow-y-auto space-y-6 md:px-3 md:pb-3 md:min-h-0">
            {/* Season Selection for TV Series */}
            {isTVSeries && movie.seasons && movie.seasons.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Season</Label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-full bg-movie-surface border-border">
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    {movie.seasons.map((season) => (
                      <SelectItem key={season.season} value={season.season}>
                        Season {season.season}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSeason && (() => {
                  const selectedSeasonData = movie.seasons?.find(s => s.season === selectedSeason);
                  // Find the first episode of the selected season to get the started date
                  const firstEpisode = movie.episodes?.find(ep => ep.season === selectedSeason);
                  const startedDate = firstEpisode?.releaseDate 
                    ? new Date(firstEpisode.releaseDate.year, firstEpisode.releaseDate.month - 1, firstEpisode.releaseDate.day)
                    : null;
                  
                  return (
                    selectedSeasonData && (
                      <div className="text-sm text-muted-foreground">
                        {selectedSeasonData.episodeCount} episodes{startedDate && ` - ${startedDate.toLocaleDateString('en-US', { month: 'short' })}/${startedDate.getFullYear()}`}
                      </div>
                    )
                  );
                })()}
              </div>
            )}

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
                        onClick={() => {
                          if (!isEditingWatchedAt) {
                            setTempWatchedAt(watchedAt);
                          }
                          setIsEditingWatchedAt(!isEditingWatchedAt);
                        }}
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
                        value={tempWatchedAt}
                        onChange={(e) => setTempWatchedAt(e.target.value)}
                        className="text-sm bg-movie-surface border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setWatchedAt(tempWatchedAt);
                          setIsEditingWatchedAt(false);
                        }}
                        className="h-8 px-2"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTempWatchedAt(watchedAt);
                          setIsEditingWatchedAt(false);
                        }}
                        className="h-8 px-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground">
                      {watchedAt ? new Date(watchedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date set'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Ratings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-movie-blue flex items-center gap-2">
                <Star className="w-4 h-4" />
                Ratings
              </h3>
              <div className="space-y-3">
                {users.map((user, index) => {
                  const canEditRating = currentUserId && user.id === currentUserId;
                  
                  return (
                    <div key={user.id} className="space-y-2">
                      {index > 0 && <Separator className="bg-border" />}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">{user.name && user.name.trim() !== "" ? user.name : user.username}</Label>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {editingUserId === user.id ? (
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={getUserRating(user.id)}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue === '' || inputValue === '.') {
                                    updateUserRating(user.id, 0);
                                    return;
                                  }
                                  const value = parseFloat(inputValue);
                                  if (!isNaN(value)) {
                                    updateUserRating(user.id, Math.min(10, Math.max(0, value)));
                                  }
                                }}
                                className="w-20 bg-movie-surface border-border text-sm"
                                placeholder="0.0"
                                autoFocus
                              />
                            ) : (
                              <div className="text-sm text-foreground">
                                {getUserRating(user.id).toFixed(1)}
                              </div>
                            )}
                            <StarRating 
                              rating={getUserRating(user.id)} 
                              readonly={true}
                              size={20}
                            />
                          </div>
                          {canEditRating && editingUserId === user.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Confirm: commit temp rating to userRatings
                                  if (tempUserRatings[user.id]) {
                                    setUserRatings(prev => ({
                                      ...prev,
                                      [user.id]: tempUserRatings[user.id]
                                    }));
                                  }
                                  setEditingUserId(null);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Cancel: revert temp rating
                                  const updatedTemp = { ...tempUserRatings };
                                  delete updatedTemp[user.id];
                                  setTempUserRatings(updatedTemp);
                                  setEditingUserId(null);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : canEditRating ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Initialize temp rating with current value
                                // For TV series, get the season rating; for movies, get the regular rating
                                let currentRating = 0;
                                if (isTVSeries && selectedSeason) {
                                  const apiRating = getRatingForUser(user.id);
                                  currentRating = apiRating?.seasonsRatings?.[selectedSeason] ?? 0;
                                } else {
                                  const apiRating = getRatingForUser(user.id);
                                  currentRating = apiRating?.rating ?? 0;
                                }
                                setTempUserRatings(prev => ({
                                  ...prev,
                                  [user.id]: { rating: currentRating }
                                }));
                                setEditingUserId(user.id);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-border" />

            {/* Comments Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-movie-blue flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Comments ({comments.length})
              </h3>
              {/* Comments Feed */}
              <div className="space-y-3 overflow-x-hidden max-h-[300px] overflow-y-auto">
                {loadingComments ? (
                  <div className="text-center text-xs text-muted-foreground py-2">Loading comments...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-2">No comments yet. Be the first to comment!</div>
                ) : (
                  comments.map((comment) => {
                        const isEditing = editingCommentId === comment.id;
                        const isUpdated = comment.updatedAt !== comment.createdAt;

                        return (
                          <div key={comment.id} className="bg-movie-surface border border-border rounded-lg p-3 space-y-2 overflow-x-hidden">
                            {/* Comment Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{getUserNameById(comment.userId)}</span>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
                                  {isUpdated && (
                                    <>
                                      <span className="text-xs text-muted-foreground">•</span>
                                      <span className="text-xs text-muted-foreground italic">edited {formatDate(comment.updatedAt)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {!isEditing && currentUserId && comment.userId === currentUserId && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditComment(comment)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    disabled={deletingCommentId === comment.id}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    {deletingCommentId === comment.id ? (
                                      <X className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Trash className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Comment Content */}
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  placeholder="Write your comment..."
                                  className="bg-background border-border resize-none min-h-[70px] text-sm"
                                  rows={3}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEditComment}
                                    disabled={savingComment}
                                    className="h-8 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveEditComment(comment.id)}
                                    disabled={savingComment || !editingCommentText.trim() || editingCommentText.trim().length === 0}
                                    className="h-8 text-xs bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light"
                                  >
                                    {savingComment ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground whitespace-pre-wrap break-words max-w-full">{comment.comment}</p>
                            )}
                          </div>
                        );
                      })
                )}
              </div>

              {/* Add Comment Button */}
              {!showAddCommentForm && (
                <Button
                  variant="outline"
                  onClick={() => setShowAddCommentForm(true)}
                  className="w-full border-movie-blue/30 text-movie-blue hover:bg-movie-blue/10"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
              )}

              {/* Add Comment Form */}
              {showAddCommentForm && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write your comment..."
                    className="bg-background border-border resize-none min-h-[70px] text-sm"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddCommentForm(false);
                        setNewCommentText('');
                      }}
                      disabled={addingComment}
                      className="flex-1 h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddComment}
                      disabled={addingComment || !newCommentText.trim() || newCommentText.trim().length === 0}
                      className="flex-1 h-8 text-xs bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue-light"
                    >
                      {addingComment ? 'Adding...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
              )}
                </div>
              </div>

              {/* Actions - Fixed at bottom on desktop, normal flow on mobile */}
              <div className="flex gap-2 pt-4 pb-4 px-3 md:px-3 md:mt-auto md:shrink-0 shrink-0 border-t border-border">
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