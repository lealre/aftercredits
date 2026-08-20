import { useState, useEffect, useCallback, useMemo } from 'react';
import { Movie, User, Rating, SeasonRating } from '@/types/movie';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Star, Trash2, ExternalLink, X, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './StarRating';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { CommentsSection } from './modal/CommentsSection';
import { StagedChangesSummary } from './modal/StagedChangesSummary';
import { updateMovieWatchedStatus, deleteMovie } from '@/services/backendService';
import { getUserId } from '@/services/authService';
import { useActiveGroupId } from '@/hooks/useActiveGroupId';
import { useEpisodes } from '@/hooks/useEpisodes';
import { useStagedTitleEdits } from '@/hooks/useStagedTitleEdits';
import { TITLE_SCOPE, seasonScope, isSeasonScope, seasonOf, type ScopeKey } from '@/lib/stagedEdits';
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

  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

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
   * The current user's server-truth rating for whatever scope is visible —
   * the season's rating when a season is selected, else the title's. This is
   * the `baseline` half of every staged rating action below: `stage` needs it
   * to know whether a typed value differs from the server at all, and
   * `stageRatingDelete` needs it to know whether there's anything to delete.
   */
  const ratingBaseline: number | null = currentUserId
    ? (isTVSeries && selectedSeason
        ? getRatingForUser(currentUserId)?.seasonsRatings?.[selectedSeason]?.rating ?? null
        : getRatingForUser(currentUserId)?.rating ?? null)
    : null;

  /**
   * The one place a user-typed note enters this component's state.
   *
   * Normalizing here rather than at save time is deliberate: it makes the value
   * on screen the value that will be sent. `step="0.1"` on the input below is
   * only a browser hint — it is validated on form submission, which this
   * free-standing input never does — so typing `8.55` used to reach the backend
   * untouched and now earns a 400 (ErrNoteTooPrecise). Clamping and rounding at
   * the point of capture means the UI simply cannot hold a note the backend
   * would refuse.
   */
  const onRatingInput = (raw: number) => {
    const note = normalizeNote(raw);
    staged.stage(visibleScope, 'rating', note, ratingBaseline);
  };

  /**
   * The watched/watchedAt half of what a successful flush just persisted, in
   * the `Partial<Movie>` shape `onUpdate` expects — mirrors the payload the
   * pre-staging code built inline. Reads `staged.changes` rather than
   * `baselines`/`movie`: those are only current as of the last render, and by
   * the time this runs (after an `await`) they may already be one flush
   * behind. `staged.changes`, `staged.isStaged` and `staged.fieldValue` all
   * close over the same pre-flush draft snapshot for the lifetime of this
   * call, so they stay a matched, uncontended set even though the reducer
   * has already been dispatched into by the flush.
   */
  const updatesFromBaselines = (): Partial<Movie> => {
    const scopesWithWatchedChanges = new Set<ScopeKey>(
      staged.changes
        .filter((change) => change.field === 'watched' || change.field === 'watchedAt')
        .map((change) => change.scope),
    );

    const updates: Partial<Movie> = {};
    let seasonsWatched: Movie['seasonsWatched'] | undefined;

    for (const scope of scopesWithWatchedChanges) {
      const watched = staged.isStaged(scope, 'watched')
        ? (staged.fieldValue(scope, 'watched') as boolean)
        : baselines[scope]?.watched ?? false;
      const watchedAt = staged.isStaged(scope, 'watchedAt')
        ? (staged.fieldValue(scope, 'watchedAt') as string)
        : baselines[scope]?.watchedAt ?? '';

      if (isSeasonScope(scope)) {
        seasonsWatched = {
          ...(seasonsWatched ?? movie.seasonsWatched ?? {}),
          [seasonOf(scope)]: { watched, watchedAt: watchedAt || undefined },
        };
      } else {
        updates.watched = watched;
        updates.watchedAt = watchedAt || '';
      }
    }

    if (seasonsWatched) {
      updates.seasonsWatched = seasonsWatched;
    }

    return updates;
  };

  const handleSave = async () => {
    if (!currentGroupId) {
      toast({
        title: "No group selected",
        description: "Please select a group to save changes.",
        variant: "destructive",
      });
      return;
    }

    const { ok } = await staged.flush();
    // One refresh each, after the whole batch — never per staged item. The
    // flush already ran every call through `Promise.allSettled`; refetching
    // per item here would turn one save into N races against the same data.
    await onRefreshRatings?.();
    await onRefreshMovies?.();
    if (!ok) return; // stay open — StagedChangesSummary already renders the failure block

    onUpdate(movie.id, updatesFromBaselines());
    toast({
      title: "Saved",
      description: "Your changes have been saved.",
    });
    staged.reset(); // before onClose, or the discard guard fires on the modal's own success
    onClose();
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

  // The single funnel for every way this dialog can be asked to close: the X,
  // Escape and an overlay click all arrive as `onOpenChange(false)`, and the
  // footer Cancel button calls this directly. Routing all of them through one
  // function is what makes the discard guard cover all of them without
  // needing `onEscapeKeyDown`/`onPointerDownOutside` handlers of their own.
  const attemptClose = () => (staged.isDirty ? setShowDiscardModal(true) : onClose());

  const discardAndClose = () => {
    setShowDiscardModal(false);
    staged.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) attemptClose(); }}>
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
                  disabled={staged.saving}
                  onCheckedChange={(next) =>
                    staged.stage(visibleScope, 'watched', next, baselines[visibleScope]?.watched ?? false)
                  }
                />
                <Label htmlFor="watched">Watched</Label>
                {staged.isStaged(visibleScope, 'watched') && (
                  <>
                    <span className="text-movie-blue text-xs" aria-hidden="true">•</span>
                    <span className="sr-only">(unsaved)</span>
                  </>
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
                        <>
                          <span className="text-movie-blue text-xs" aria-hidden="true">•</span>
                          <span className="sr-only">(unsaved)</span>
                        </>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteWatchedDate}
                      disabled={staged.saving}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>

                  <Input
                    type="date"
                    value={shownWatchedAt}
                    disabled={staged.saving}
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

                  // Only the current user's own rating can be staged, so
                  // `ratingBaseline` (computed above for `currentUserId`) is
                  // reused rather than recomputed here for that one row.
                  // Every other row is a plain, unstaged read of the server
                  // value — there is no draft to overlay it with.
                  const baselineForUser = canEditRating
                    ? ratingBaseline
                    : (isTVSeries && selectedSeason
                        ? getRatingForUser(user.id)?.seasonsRatings?.[selectedSeason]?.rating ?? null
                        : getRatingForUser(user.id)?.rating ?? null);

                  const stagedRating = canEditRating && staged.isStaged(visibleScope, 'rating')
                    ? (staged.fieldValue(visibleScope, 'rating') as number | null)
                    : undefined;
                  const isRatingStaged = stagedRating !== undefined;
                  // A staged `null` is a pending deletion, not "no rating" —
                  // it renders struck through rather than as a bare '-' so it
                  // stays visibly different from a title that was never rated.
                  const isRatingStagedDeletion = stagedRating === null;
                  const displayedRating = isRatingStaged ? stagedRating : baselineForUser;

                  return (
                    <div key={user.id} className="space-y-2">
                      {index > 0 && <Separator className="bg-border" />}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">{user.name && user.name.trim() !== "" ? user.name : user.username}</Label>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {canEditRating && !isRatingStagedDeletion ? (
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={displayedRating ?? ''}
                                disabled={staged.saving}
                                onChange={(e) => {
                                  const inputValue = e.target.value;
                                  if (inputValue === '' || inputValue === '.') {
                                    onRatingInput(0);
                                    return;
                                  }
                                  const value = parseFloat(inputValue);
                                  // NaN only for a part-typed value like "-";
                                  // ignoring it leaves what was there rather
                                  // than wiping it. Everything else is clamped
                                  // and rounded by onRatingInput.
                                  if (!isNaN(value)) {
                                    onRatingInput(value);
                                  }
                                }}
                                className="w-20 bg-movie-surface border-border text-sm"
                                placeholder="0.0"
                              />
                            ) : (
                              <div
                                className={`text-sm ${
                                  isRatingStagedDeletion
                                    ? 'line-through text-muted-foreground'
                                    : 'text-foreground'
                                }`}
                              >
                                {displayedRating === null ? '-' : displayedRating.toFixed(1)}
                              </div>
                            )}
                            {isRatingStaged && (
                              <>
                                <span className="text-movie-blue text-xs" aria-hidden="true">•</span>
                                <span className="sr-only">(unsaved)</span>
                              </>
                            )}
                            <StarRating
                              rating={displayedRating ?? 0}
                              readonly={true}
                              size={20}
                            />
                          </div>
                          {canEditRating && (
                            <div className="flex items-center gap-1">
                              {isRatingStaged ? (
                                // Reverts either a typed-but-unsaved value or a
                                // staged deletion back to the server baseline —
                                // for the latter this doubles as "undo".
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => staged.unstage(visibleScope, 'rating')}
                                  disabled={staged.saving}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              ) : ratingBaseline !== null ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => staged.stageRatingDelete(visibleScope, ratingBaseline !== null)}
                                  disabled={staged.saving}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              ) : null}
                            </div>
                          )}
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
              <div className="shrink-0 md:mt-auto px-3 space-y-3">
                {/*
                  No wrapper div around the summary: when it renders null
                  (nothing off-screen, nothing failed), `space-y-3` sees no
                  preceding sibling at all and adds no gap above the button
                  row — a wrapper div would still count as one and leave a
                  dangling gap even with nothing inside it.
                */}
                <StagedChangesSummary
                  changes={staged.changes}
                  visibleScope={visibleScope}
                  saving={staged.saving}
                  onRetry={handleSave}
                />
                <div className="flex gap-2 pb-4 border-t border-border pt-4">
                  {/*
                    `variant="outline"` inherits a gold `hover:bg-accent` from
                    this theme's `--accent` — the same leak the blue Save
                    button next to it exists to avoid — so both states are
                    overridden explicitly rather than left default.
                  */}
                  <Button
                    variant="outline"
                    onClick={attemptClose}
                    className="flex-1 min-w-0 border-border bg-movie-surface hover:bg-movie-surface-hover hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!staged.isDirty || staged.saving}
                    className="flex-1 min-w-0 truncate bg-movie-blue hover:bg-movie-blue-light"
                  >
                    {staged.saving
                      ? 'Saving…'
                      : staged.isDirty
                        ? `Save ${staged.changeCount} change${staged.changeCount === 1 ? '' : 's'}`
                        : 'Save'}
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
        </div>
      </DialogContent>
      
      <DeleteConfirmationModal
        movie={movie}
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />

      <AlertDialog open={showDiscardModal} onOpenChange={(open) => { if (!open) setShowDiscardModal(false); }}>
        <AlertDialogContent className="bg-movie-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You have {staged.changeCount} unsaved change{staged.changeCount === 1 ? '' : 's'}. They will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDiscardModal(false)}
              className="bg-movie-surface border-border hover:bg-movie-surface/80"
            >
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={discardAndClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};