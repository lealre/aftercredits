import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { useGroups } from '@/hooks/useGroups';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { MovieModal } from '@/components/MovieModal';
import { FilterControls, loadFiltersFromStorage } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';
import { getGroupId, getUserId, saveGroupId } from '@/services/authService';
import { useActiveGroupId } from '@/hooks/useActiveGroupId';
import { useGroupTitle, GROUP_TITLE_KEY } from '@/hooks/useGroupTitle';
// The bare `toast`, not `useToast`: the hook subscribes its caller to the toast
// store, and this page renders the grid. The activity stream writes a toast per
// pushed event, and none of them has anything to do with the watchlist.
import { toast } from '@/hooks/use-toast';
import { TitleNotInGroupError } from '@/types/movie';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';

// Load filters once at module level for initial state
const initialFilters = loadFiltersFromStorage();

const Index = () => {
  const navigate = useNavigate();
  const activeGroupId = useActiveGroupId();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>(
    () => (initialFilters?.watchedFilter as 'all' | 'watched' | 'unwatched') || 'all'
  );
  const [titleType, setTitleType] = useState<'all' | 'serie' | 'movie' | undefined>(() => {
    const storedTitleType = initialFilters?.titleType;
    if (!storedTitleType || storedTitleType === 'all') return undefined;
    return storedTitleType as 'serie' | 'movie';
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  const titleTypeValue = titleType === 'all' || titleType === undefined ? undefined : titleType;

  const {
    movies,
    loading,
    adding,
    setAdding,
    pagination,
    ratingsMap,
    updateMovie,
    deleteMovie,
    refreshMovies,
    changePage,
    changePageSize,
    orderBy,
    setOrderBy,
    ascending,
    setAscending,
  } = useMovies(watchedFilterValue, titleTypeValue, initialFilters?.orderBy, initialFilters?.ascending);

  const { groups, loading: loadingGroups, hasNoGroups, refreshGroups } = useGroups();
  const groupData = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null,
    [groups, activeGroupId]
  );

  const handleTitleTypeChange = (newTitleType: 'all' | 'serie' | 'movie' | undefined) => {
    setTitleType(newTitleType);
  };
  const { users, getUserNameById } = useUsers();

  const getRatingForUser = useCallback((titleId: string, userId: string) => {
    // A user can hold one rating per group for the same title, so match the active
    // group too instead of trusting the payload to already be scoped to it. The group
    // comes from the same reactive value that keys the query behind `ratingsMap`, so
    // the two can never disagree.
    const list = ratingsMap[titleId] || [];
    const r = list.find(x => x.userId === userId && x.groupId === activeGroupId);
    return r ? { rating: r.note, seasonsRatings: r.seasonsRatings } : undefined;
  }, [ratingsMap, activeGroupId]);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    // Auto-select first group if none selected. The write is reactive, so the movies
    // and users queries re-key onto the new group on their own.
    if (!activeGroupId && groups.length > 0) {
      saveGroupId(groups[0].id);
    }
  }, [navigate, groups, activeGroupId]);

  const refreshRatingsForTitle = useCallback(async (_titleId: string) => {
    await refreshMovies();
  }, [refreshMovies]);

  // -------------------------------------------------------------------------
  // Deep link: /watchlist?group=<groupId>&title=<titleId>
  //
  // The activity feed's rows link here. The grid cannot serve this on its own —
  // MovieModal is rendered by MovieCard and opened by that card's own state, so
  // "open the modal for title X" only works while X's card is mounted, and the
  // grid is paginated. So this page renders a second, standalone modal fed by
  // the single-title endpoint, and MovieCard is left exactly as it was.
  // -------------------------------------------------------------------------

  /**
   * The title the URL asked for, once this page has taken ownership of it.
   *
   * State rather than a read of the URL on every render, because the params are
   * stripped the moment they are seen: the link is a one-shot instruction, not
   * a piece of view state to be re-derived.
   */
  const [deepLink, setDeepLink] = useState<{ groupId: string; titleId: string } | null>(null);

  /**
   * Consume the params, then take them out of the URL in the same effect.
   *
   * `replace` rather than push, so the entry the user came from stays where it
   * was in history; clearing them at all is what stops a refresh — or a back
   * navigation landing on this entry — from re-opening a modal that has already
   * been closed once. This runs again on the resulting location change and
   * falls straight out at the guard, so it terminates.
   */
  useEffect(() => {
    const groupId = searchParams.get('group');
    const titleId = searchParams.get('title');
    if (!groupId || !titleId) return;

    setDeepLink({ groupId, titleId });

    const remaining = new URLSearchParams(searchParams);
    remaining.delete('group');
    remaining.delete('title');
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * Switch to the link's group before anything is fetched or shown for it.
   *
   * The modal is group-scoped through and through: its ratings come from the
   * group, and it reads the active group itself for them (useActiveGroupId in
   * MovieModal, getGroupId in CommentsSection). Opening a title while the app
   * still points at another group would therefore show that other group's
   * ratings and comments under this title — silently, and wrongly. The switch
   * is a precondition, not a side effect: nothing below fetches until the
   * reactive active group has actually become the requested one.
   *
   * A group the reader is not a member of is refused instead of switched to.
   * Pointing the app at such a group would break the watchlist, the member list
   * and the filters behind the modal, and from the reader's side it is the same
   * failure as a removed title — so it gets the same message.
   */
  useEffect(() => {
    if (!deepLink) return;
    // Wait for the real membership list rather than concluding from an empty one.
    if (loadingGroups) return;

    if (!groups.some((group) => group.id === deepLink.groupId)) {
      toast({
        title: 'Title unavailable',
        description: 'That title is no longer in that group.',
        variant: 'destructive',
      });
      setDeepLink(null);
      return;
    }

    // Read imperatively: this wants the value as it is now, not as it was when
    // this effect last closed over it.
    if (getGroupId() !== deepLink.groupId) {
      saveGroupId(deepLink.groupId);
    }
  }, [deepLink, groups, loadingGroups]);

  /**
   * True only once the switch has landed, measured by the same reactive value
   * that keys the movies and users queries. Until then the fetch stays off.
   */
  const deepLinkReady = !!deepLink && activeGroupId === deepLink.groupId;

  const { data: deepLinkTitle, error: deepLinkError } = useGroupTitle(
    deepLink?.groupId ?? null,
    deepLink?.titleId ?? null,
    deepLinkReady
  );

  /**
   * A 404 here is reachable in normal use — the title can be removed from the
   * group between the event being written and the row being clicked — so it
   * degrades to a toast and no modal, never an error screen. Dropping the deep
   * link also re-keys the query, so this cannot fire twice for one click.
   */
  useEffect(() => {
    if (!deepLinkError) return;

    toast({
      title: 'Title unavailable',
      description:
        deepLinkError instanceof TitleNotInGroupError
          ? 'That title is no longer in that group.'
          : "Couldn't open that title. Please try again.",
      variant: 'destructive',
    });
    setDeepLink(null);
  }, [deepLinkError]);

  /**
   * Refresh everything showing the deep-linked title.
   *
   * Two caches hold it now: this page's single read and the grid's page. The
   * modal makes edits without closing — deleting a rating is one — so
   * refreshing only the grid would leave the open modal still showing what it
   * just deleted, and refreshing only the single read would leave a stale card
   * behind it.
   */
  const refreshDeepLinkedTitle = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [GROUP_TITLE_KEY] }),
      refreshMovies(),
    ]);
  }, [queryClient, refreshMovies]);

  /**
   * The same resolution the grid does, against this title's own ratings: match
   * the user *and* the active group, since a user holds one rating per group
   * for a title. The payload is already group-scoped, so the group term is a
   * second lock rather than the filter itself.
   */
  const deepLinkRatings = deepLinkTitle?.ratings;
  const getDeepLinkRatingForUser = useCallback((userId: string) => {
    const r = (deepLinkRatings ?? []).find(
      (x) => x.userId === userId && x.groupId === activeGroupId
    );
    return r ? { rating: r.note, seasonsRatings: r.seasonsRatings } : undefined;
  }, [deepLinkRatings, activeGroupId]);

  const handleGroupChange = (newGroupId: string) => {
    // Reactive write: the re-render swings useMovies/useUsers onto the new group's
    // query keys, which fetches it. Invalidating here would only ever hit the *old*
    // group's key (captured by refreshMovies) and refetch the group we just left.
    saveGroupId(newGroupId);
  };

  const handleGroupCreated = async () => {
    await refreshGroups();
  };

  // Memoize existingTitleIds to prevent unnecessary re-renders of AddMovieForm
  const existingTitleIds = useMemo(
    () => movies.map((m) => m.imdbId || m.id),
    [movies]
  );

  // Show empty state if user has no groups
  if (hasNoGroups && !loadingGroups) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Header />
        <main className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Card className="w-full max-w-md p-6 bg-movie-surface/60 border border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground">No Groups Available</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-2">
                You don't have any groups yet. Create a group to start managing your watchlist.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
              >
                Create Group
              </Button>
            </CardContent>
          </Card>
        </main>

        <CreateGroupModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onSuccess={handleGroupCreated}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {loadingGroups ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-movie-blue" />
          </div>
        ) : (
          <>
            <AddMovieForm
              onRefresh={refreshMovies}
              loading={adding}
              setLoading={setAdding}
              existingTitleIds={existingTitleIds}
            />

            <FilterControls
              watchedFilter={watchedFilter}
              onWatchedFilterChange={setWatchedFilter}
              orderBy={orderBy}
              onOrderByChange={setOrderBy}
              ascending={ascending}
              onAscendingChange={setAscending}
              titleType={titleType}
              onTitleTypeChange={handleTitleTypeChange}
              groups={groups}
              currentGroupId={activeGroupId}
              onGroupChange={handleGroupChange}
            />

            <MovieGrid
              movies={movies}
              onUpdate={updateMovie}
              onDelete={deleteMovie}
              onRefreshMovies={refreshMovies}
              users={users}
              getUserNameById={getUserNameById}
              ratingsMap={ratingsMap}
              getRatingForUser={getRatingForUser}
              refreshRatingsForTitle={refreshRatingsForTitle}
              pagination={pagination}
              onPageChange={changePage}
              onPageSizeChange={changePageSize}
              loading={loading}
              orderBy={orderBy}
              ascending={ascending}
              titleType={titleType}
            />
          </>
        )}
      </main>
      <CreateGroupModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleGroupCreated}
      />

      {/*
        The deep-linked title's modal. A second, standalone MovieModal that the
        grid knows nothing about — the card keeps its own — given exactly the
        props MovieGrid gives its cards' modals, so rating, commenting and
        refreshing work from here identically and not just display.

        `deepLinkReady` is re-checked at render, not only at fetch: if the
        active group moves out from under an open modal, the modal goes with it
        rather than staying up over another group's data.
      */}
      {deepLinkTitle && deepLinkReady && (
        <MovieModal
          movie={deepLinkTitle.movie}
          isOpen
          onClose={() => setDeepLink(null)}
          onUpdate={updateMovie}
          onDelete={deleteMovie}
          onRefreshRatings={refreshDeepLinkedTitle}
          onRefreshMovies={refreshDeepLinkedTitle}
          users={users}
          getUserNameById={getUserNameById}
          ratings={deepLinkTitle.ratings}
          getRatingForUser={getDeepLinkRatingForUser}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
};

export default Index;
