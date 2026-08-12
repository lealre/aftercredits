import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { useGroups } from '@/hooks/useGroups';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls, loadFiltersFromStorage } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';
import { getUserId, saveGroupId } from '@/services/authService';
import { useActiveGroupId } from '@/hooks/useActiveGroupId';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';

// Load filters once at module level for initial state
const initialFilters = loadFiltersFromStorage();

const Index = () => {
  const navigate = useNavigate();
  const activeGroupId = useActiveGroupId();

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
      <ScrollToTopButton />
    </div>
  );
};

export default Index;
