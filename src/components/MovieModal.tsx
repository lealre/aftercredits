import { useState, useEffect, useCallback, useMemo } from 'react';
import { Movie, User, Rating, SeasonRating } from '@/types/movie';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Star, Trash2, ExternalLink, X, Edit3, XCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './StarRating';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { CommentsSection } from './modal/CommentsSection';
import { saveOrUpdateRating, updateMovieWatchedStatus, deleteMovie, deleteRating, deleteRatingSeason as deleteRatingSeasonService } from '@/services/backendService';
import { getUserId } from '@/services/authService';
import { useActiveGroupId } from '@/hooks/useActiveGroupId';
import { useEpisodes } from '@/hooks/useEpisodes';
import { useStagedTitleEdits } from '@/hooks/useStagedTitleEdits';
import { TITLE_SCOPE, seasonScope, type ScopeKey } from '@/lib/stagedEdits';
import type { ScopeBaseline } from '@/lib/flushPlan';
import { normalizeNote } from '@/lib/rating';

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
  getRatingForUser: (userId: string) => { rating: number; seasonsRatings?: Record<string, SeasonRating> } | undefined;
}

export const MovieModal = ({ movie, isOpen, onClose, onUpdate, onDelete, onRefreshRatings, onRefreshMovies, users, getUserNameById, ratings, getRatingForUser }: MovieModalProps) => {
  const { toast } = useToast();
  const currentUserId = getUserId();
  // Ratings are group-scoped, so resolving one needs the active group as well as the
  // user. Read reactively so it stays in step with the `ratings` prop's group.
  const currentGroupId = useActiveGroupId();

  // Check if this is a TV series - must be declared before useEffects that use it
  const isTVSeries = movie.type === 'tvSeries' || movie.type === 'tvMiniSeries';

  // Episodes are fetched on demand (backend omits them from the list payload)
  const { data: episodes = [], isLoading: episodesLoading, isError: episodesError } = useEpisodes(movie.imdbId, isOpen && isTVSeries);

  const [userRatings, setUserRatings] = useState<Record<string, { rating: number }>>({});
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null); // Track which user's rating is being edited
  const [tempUserRatings, setTempUserRatings] = useState<Record<string, { rating: number }>>({}); // Temporary ratings while editing
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null); // Track which rating is being deleted
  const [showDeleteRatingModal, setShowDeleteRatingModal] = useState(false);
  const [ratingToDelete, setRatingToDelete] = useState<string | null>(null); // userId to delete
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset which season is shown each time the modal opens. `movie.id` is
  // stable for the lifetime of a MovieCard's modal instance (one card, one
  // title), so this only needs to react to the open transition — not to
  // `movie.seasons`, whose array identity can change on every refetch and
  // would otherwise stomp a season the user had already picked.
  useEffect(() => {
    if (!isOpen) return;
    if (isTVSeries && movie.seasons && movie.seasons.length > 0) {
      setSelectedSeason(movie.seasons[0].season);
    } else {
      setSelectedSeason('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /**
   * The scope backing whatever the modal currently shows: the title itself,
   * or the selected season for a TV series. Every staged read/write below
   * goes through this so switching seasons never touches another season's
   * draft.
   */
  const visibleScope: ScopeKey = isTVSeries && selectedSeason ? seasonScope(selectedSeason) : TITLE_SCOPE;

  /**
   * Server-truth baselines, one per scope, derived from `movie` alone —
   * never from local state. `planFlush` fills in the baseline for whichever
   * half of the watched/watchedAt pair wasn't staged, so a stale baseline
   * here would silently flush stale data while reporting success. `movie` is
   * refetched after every save, which is what keeps this current.
   */
  const baselines = useMemo<Record<ScopeKey, ScopeBaseline>>(() => {
    const map: Record<ScopeKey, ScopeBaseline> = {
      [TITLE_SCOPE]: { watched: movie.watched ?? false, watchedAt: movie.watchedAt ?? '' },
    };
    for (const season of Object.keys(movie.seasonsWatched ?? {})) {
      const seasonWatched = movie.seasonsWatched?.[season];
      map[seasonScope(season)] = {
        watched: seasonWatched?.watched ?? false,
        watchedAt: seasonWatched?.watchedAt ?? '',
      };
    }
    return map;
  }, [movie.watched, movie.watchedAt, movie.seasonsWatched]);

  const staged = useStagedTitleEdits({
    groupId: currentGroupId,
    titleId: movie.imdbId,
    userId: currentUserId,
    ratings,
    baselines,
  });

  // The modal is permanently mounted (MovieCard toggles only the Radix
  // dialog via `isOpen`), so without this an abandoned draft would survive
  // being closed and still be flushable the next time the modal opens.
  useEffect(() => {
    if (!isOpen) {
      staged.reset();
    }
    // `staged.reset` is a stable useCallback (empty deps); depending on the
    // whole `staged` object would rerun this every render, since the hook
    // returns a new object each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, staged.reset]);

  const shownWatched = staged.isStaged(visibleScope, 'watched')
    ? (staged.fieldValue(visibleScope, 'watched') as boolean)
    : baselines[visibleScope]?.watched ?? false;
  const shownWatchedAt = staged.isStaged(visibleScope, 'watchedAt')
    ? (staged.fieldValue(visibleScope, 'watchedAt') as string)
    : baselines[visibleScope]?.watchedAt ?? '';

  /**
   * The one place a user-typed note enters this component's state.
   *
   * Normalizing here rather than at save time is deliberate: it makes the value
   * on screen the value that will be sent. `step="0.1"` on the input below is
   * only a browser hint — it is validated on form submission, which this
   * free-standing input never does — so typing `8.55` used to reach the backend
   * untouched and now earns a 400 (ErrNoteTooPrecise). Clamping and rounding at
   * the point of capture means the UI simply cannot hold a note the backend
   * would refuse, in either the editing or the committed branch below.
   */
  const updateUserRating = (userId: string, rating: number) => {
    const note = normalizeNote(rating);
    if (editingUserId === userId) {
      // Update temporary rating when editing this specific user
      setTempUserRatings(prev => ({
        ...prev,
        [userId]: { rating: note }
      }));
    } else {
      // Update actual ratings when not editing (shouldn't happen, but keep for safety)
      setUserRatings(prev => ({
        ...prev,
        [userId]: { rating: note }
      }));
    }
  };

  const getUserRating = (userId: string): number | null => {
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
        return apiRating.seasonsRatings[selectedSeason].rating;
      }
      // If no season rating, return null (no rating exists)
      return null;
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
      return apiRating?.rating ?? null;
    } else {
      // When not editing, check if user has a local rating being edited
      if (userRatings[userId]) {
        return userRatings[userId].rating;
      }
      // Otherwise get from API
      const apiRating = getRatingForUser(userId);
      return apiRating?.rating ?? null;
    }
  };

  const handleDeleteRatingClick = (userId: string) => {
    setRatingToDelete(userId);
    setShowDeleteRatingModal(true);
  };

  const handleDeleteRatingConfirm = async () => {
    if (!ratingToDelete) return;
    
    const userId = ratingToDelete;
    setShowDeleteRatingModal(false);
    setDeletingRatingId(userId);
    
    // Store the current selected season to preserve it after refresh
    const currentSeason = selectedSeason;
    
    try {
      // Find the full rating object from the ratings array (which includes the id)
      const fullRating = ratings.find(r => r.userId === userId && r.titleId === movie.imdbId && r.groupId === currentGroupId);
      if (!fullRating) {
        toast({
          title: "Error",
          description: "Rating not found.",
          variant: "destructive",
        });
        setDeletingRatingId(null);
        setRatingToDelete(null);
        return;
      }

      if (isTVSeries && currentSeason) {
        // For TV series, delete the season-specific rating
        const seasonKey = currentSeason;
        const seasonRating = fullRating.seasonsRatings?.[seasonKey];
        if (!seasonRating) {
          toast({
            title: "Error",
            description: "Season rating not found.",
            variant: "destructive",
          });
          setDeletingRatingId(null);
          setRatingToDelete(null);
          return;
        }
        await deleteRatingSeasonService(fullRating.id, parseInt(currentSeason, 10));
      } else {
        // For movies, delete the entire rating
        await deleteRating(fullRating.id);
      }

      // Refresh ratings
      if (onRefreshRatings) {
        onRefreshRatings();
      }

      // Clear local state
      const updatedUserRatings = { ...userRatings };
      delete updatedUserRatings[userId];
      setUserRatings(updatedUserRatings);

      const updatedTempRatings = { ...tempUserRatings };
      delete updatedTempRatings[userId];
      setTempUserRatings(updatedTempRatings);

      if (editingUserId === userId) {
        setEditingUserId(null);
      }

      // Restore the selected season after refresh (for TV series)
      if (isTVSeries && currentSeason) {
        // The season will be preserved because we're not resetting selectedSeason
        // But we need to make sure the useEffect doesn't reset it
        // The useEffect only runs when selectedSeason changes, so we're good
      }

      toast({
        title: "Rating deleted",
        description: "The rating has been removed.",
      });
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast({
        title: "Error",
        description: "Failed to delete rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingRatingId(null);
      setRatingToDelete(null);
    }
  };

  const handleDeleteRatingCancel = () => {
    setShowDeleteRatingModal(false);
    setRatingToDelete(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const groupId = currentGroupId;
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
      // Include both confirmed ratings (userRatings) and temporary ratings (tempUserRatings) if still editing
      const allRatingsToSave = { ...userRatings };
      
      // If a user is currently editing, use their temp rating value
      if (editingUserId && tempUserRatings[editingUserId]) {
        allRatingsToSave[editingUserId] = tempUserRatings[editingUserId];
      }
      
      const ratingPromises = Object.entries(allRatingsToSave).map(async ([userId, ratingData]) => {
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

      // Close editing states after save (values are already saved)
      if (editingUserId) {
        setEditingUserId(null);
      }
      
      // Clear local state after successful save
      setUserRatings({});

      // Update watched status if it changed. `shownWatched`/`shownWatchedAt`
      // already resolve to the staged value when one is staged, else the
      // baseline, so this is unchanged in effect from before staging existed.
      const currentWatchedAt = shownWatchedAt;
      const baselineWatched = baselines[visibleScope]?.watched ?? false;
      const baselineWatchedAt = baselines[visibleScope]?.watchedAt ?? '';

      if (shownWatched !== baselineWatched || currentWatchedAt !== baselineWatchedAt) {
        const groupId = currentGroupId;
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
        await updateMovieWatchedStatus(groupId, movie.imdbId, shownWatched, currentWatchedAt || '', season);

        // Refresh movies to get the latest data from backend
        if (onRefreshMovies) {
          await onRefreshMovies();
        }
      }

      // Save movie updates locally
      const finalWatchedAt = shownWatchedAt;

      const updates: Partial<Movie> = {};
      if (isTVSeries && selectedSeason) {
        updates.seasonsWatched = {
          ...(movie.seasonsWatched || {}),
          [selectedSeason]: {
            watched: shownWatched,
            watchedAt: finalWatchedAt || undefined,
          },
        };
      } else {
        updates.watched = shownWatched;
        updates.watchedAt = finalWatchedAt || '';
      }
      
      onUpdate(movie.id, updates);
      
      toast({
        title: "Movie updated!",
        description: "Your movie information, ratings, and comments have been saved.",
      });
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      // saveRating/updateRating already unwrap the backend's `errorMessage` and
      // rethrow it as the Error message — this used to throw that away and show
      // a generic line instead, so a rejected note (ErrNoteTooPrecise,
      // ErrInvalidNoteValue, a season conflict) looked like an unexplained
      // failure. Say what the backend said, and keep the generic line as the
      // fallback for something that is not an Error.
      toast({
        title: "Error saving",
        description:
          error instanceof Error && error.message
            ? error.message
            : "Failed to save changes. Please try again.",
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
      const groupId = currentGroupId;
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

  const handleDeleteWatchedDate = () => {
    // Stages a cleared date; nothing is persisted until Save.
    staged.stage(visibleScope, 'watchedAt', '', baselines[visibleScope]?.watchedAt ?? '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/*
        The base dialog is `w-full ... sm:rounded-lg`, so below 640px it went
        edge to edge with square corners — the poster grid showed above and
        below it and the whole thing read as unfinished rather than as a panel.
        Insetting it from the viewport and rounding it at every width makes it a
        card floating over the grid. max-h leaves less showing through, and
        overflow-hidden keeps the scrolling body inside the rounded corners.
      */}
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-movie-surface border-border p-0 rounded-lg overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 shrink-0">
          <DialogTitle className="text-movie-blue">{movie.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* On mobile: single scroll container, on desktop: grid with separate scrolls */}
          <div className="flex-1 overflow-y-auto scrollbar-subtle px-4 sm:px-6 pb-4 sm:pb-5 md:overflow-hidden md:flex md:flex-col">
            <div className="flex flex-col md:grid md:[grid-template-columns:minmax(0,260px)_minmax(0,1fr)] gap-3 w-full md:flex-1 md:min-h-0">
              {/* Movie Info */}
              <div className="md:overflow-y-auto scrollbar-subtle md:h-full space-y-4 md:px-3 md:pb-3">
                {/* Hide poster on mobile */}
                <div className="hidden md:block aspect-[2/3] relative overflow-hidden rounded-lg">
                  {(() => {
                    // For TV series, try to get the first episode image of the selected season
                    let imageSrc = movie.poster;
                    if (isTVSeries && selectedSeason && episodes.length > 0) {
                      const seasonEpisodes = episodes.filter(ep => ep.season === selectedSeason);
                      const firstEpisode = seasonEpisodes.find(ep => ep.episodeNumber === 1) || seasonEpisodes[0];
                      if (firstEpisode?.primaryImage?.url) {
                        imageSrc = firstEpisode.primaryImage.url;
                      }
                    }
                    return (
                      <img
                        src={imageSrc}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-movie.jpg';
                        }}
                      />
                    );
                  })()}
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
                <div className="flex-1 overflow-y-auto md:overflow-y-auto scrollbar-subtle space-y-6 md:px-3 md:pb-3 md:min-h-0">
            {/* Season Selection for TV Series */}
            {isTVSeries && movie.seasons && movie.seasons.length > 0 && (
              <div className="space-y-2">
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-full bg-movie-surface border-border focus:border-ring focus-visible:border-ring focus:ring-0 focus-visible:ring-0">
                    <SelectValue placeholder="Select a season">
                      {selectedSeason ? `Season ${selectedSeason}` : "Select a season"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    sideOffset={4}
                    className="max-h-[200px] overflow-y-auto scrollbar-subtle"
                  >
                    {[...movie.seasons]
                      .sort((a, b) => parseInt(a.season, 10) - parseInt(b.season, 10))
                      .map((season) => {
                        // Check if current user has rated this season
                        const currentUserRating = ratings.find(r => r.userId === currentUserId && r.titleId === movie.imdbId && r.groupId === currentGroupId);
                        const hasRating = currentUserRating?.seasonsRatings?.[season.season] !== undefined;
                        
                        return (
                          <SelectItem key={season.season} value={season.season} className="[&>span:last-child]:w-full [&>span:first-child]:hidden">
                            <div className="flex items-center justify-between w-full">
                              <span className="flex-shrink-0">Season {season.season}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {hasRating && (
                                  <Star className="w-4 h-4 text-movie-blue" />
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {selectedSeason && (() => {
                  const selectedSeasonData = movie.seasons?.find(s => s.season === selectedSeason);
                  // Find the first episode of the selected season (episodeNumber === 1 or first in array)
                  const seasonEpisodes = episodes.filter(ep => ep.season === selectedSeason);
                  const firstEpisode = seasonEpisodes.find(ep => ep.episodeNumber === 1) || seasonEpisodes[0];
                  const releaseDate = firstEpisode?.releaseDate 
                    ? new Date(firstEpisode.releaseDate.year, firstEpisode.releaseDate.month - 1, firstEpisode.releaseDate.day)
                    : null;
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isFuture = releaseDate && releaseDate > today;
                  
                  const dateText = releaseDate 
                    ? `${releaseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                    : '';
                  
                  return (
                    selectedSeasonData && (
                      <div className="text-sm text-muted-foreground">
                        {selectedSeasonData.episodeCount} episodes
                        {episodesError
                          ? ' • Couldn\'t load episode details'
                          : dateText && ` • ${isFuture ? 'Releases at' : 'Released'} ${dateText}`}
                        {!episodesError && episodesLoading && !dateText && ' • …'}
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
                  checked={shownWatched}
                  onCheckedChange={(next) =>
                    staged.stage(visibleScope, 'watched', next, baselines[visibleScope]?.watched ?? false)
                  }
                />
                <Label htmlFor="watched">Watched</Label>
                {staged.isStaged(visibleScope, 'watched') && (
                  <span className="text-movie-blue text-xs" aria-hidden="true">•</span>
                )}
              </div>

              {/*
                Gated on the *effective* (staged-or-baseline) value, not the raw
                staged one: `updateMovieWatchedStatus` force-blanks `watchedAt`
                whenever `watched` is false, so a staged date paired with an
                unwatched state would flush as watched=false and silently drop
                the date. Hiding the control here is what keeps that unreachable.
              */}
              {shownWatched && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      Watched on:
                      {staged.isStaged(visibleScope, 'watchedAt') && (
                        <span className="text-movie-blue text-xs" aria-hidden="true">•</span>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteWatchedDate}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>

                  <Input
                    type="date"
                    value={shownWatchedAt}
                    onChange={(e) =>
                      staged.stage(
                        visibleScope,
                        'watchedAt',
                        e.target.value,
                        baselines[visibleScope]?.watchedAt ?? '',
                      )
                    }
                    className="text-sm bg-movie-surface border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
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
                                value={getUserRating(user.id) ?? ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue === '' || inputValue === '.') {
                                    updateUserRating(user.id, 0);
                                    return;
                                  }
                                  const value = parseFloat(inputValue);
                                  // NaN only for a part-typed value like "-";
                                  // ignoring it leaves what was there rather
                                  // than wiping it. Everything else is clamped
                                  // and rounded by updateUserRating.
                                  if (!isNaN(value)) {
                                    updateUserRating(user.id, value);
                                  }
                                }}
                                className="w-20 bg-movie-surface border-border text-sm"
                                placeholder="0.0"
                                autoFocus
                              />
                            ) : (
                              <div className="text-sm text-foreground">
                                {getUserRating(user.id) === null ? '-' : getUserRating(user.id)!.toFixed(1)}
                              </div>
                            )}
                            <StarRating 
                              rating={getUserRating(user.id) ?? 0} 
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
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Initialize temp rating with current value
                                  // For TV series, get the season rating; for movies, get the regular rating
                                  let currentRating: number | null = null;
                                  if (isTVSeries && selectedSeason) {
                                    const apiRating = getRatingForUser(user.id);
                                    currentRating = apiRating?.seasonsRatings?.[selectedSeason]?.rating ?? null;
                                  } else {
                                    const apiRating = getRatingForUser(user.id);
                                    currentRating = apiRating?.rating ?? null;
                                  }
                                  // Use 0 as default when starting to edit (user can change it)
                                  setTempUserRatings(prev => ({
                                    ...prev,
                                    [user.id]: { rating: currentRating ?? 0 }
                                  }));
                                  setEditingUserId(user.id);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              {(() => {
                                // Check if rating exists
                                const apiRating = getRatingForUser(user.id);
                                let hasRating = false;
                                if (isTVSeries && selectedSeason) {
                                  hasRating = apiRating?.seasonsRatings?.[selectedSeason] !== undefined;
                                } else {
                                  hasRating = apiRating?.rating !== undefined;
                                }
                                
                                if (hasRating) {
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteRatingClick(user.id)}
                                      disabled={deletingRatingId === user.id}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Trash2 className={`h-3 w-3 ${deletingRatingId === user.id ? 'opacity-50' : ''}`} />
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
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
            <CommentsSection
              movieImdbId={movie.imdbId}
              isOpen={isOpen}
              isTVSeries={isTVSeries}
              selectedSeason={selectedSeason}
              getUserNameById={getUserNameById}
            />
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
      
      <AlertDialog open={showDeleteRatingModal} onOpenChange={handleDeleteRatingCancel}>
        <AlertDialogContent className="bg-movie-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete Rating
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isTVSeries && selectedSeason
                ? `Are you sure you want to delete the rating for Season ${selectedSeason}? (Other seasons will be kept)`
                : 'Are you sure you want to delete this rating? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleDeleteRatingCancel}
              disabled={deletingRatingId !== null}
              className="bg-movie-surface border-border hover:bg-movie-surface/80"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRatingConfirm}
              disabled={deletingRatingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRatingId !== null ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete Rating
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
    </Dialog>
  );
};