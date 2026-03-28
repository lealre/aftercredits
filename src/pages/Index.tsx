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
import { getGroupId, getUserId, saveGroupId } from '@/services/authService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGroupModal } from '@/components/CreateGroupModal';

// Load filters once at module level for initial state
const initialFilters = loadFiltersFromStorage();

const Index = () => {
  const navigate = useNavigate();

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
  } = useMovies(watchedFilterValue, titleTypeValue);

  const { groups, loading: loadingGroups, hasNoGroups, refreshGroups } = useGroups();
  const groupData = useMemo(
    () => groups.find((g) => g.id === getGroupId()) ?? groups[0] ?? null,
    [groups]
  );

  // Load orderBy and ascending from localStorage on mount (only once)
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.orderBy !== undefined) {
        setOrderBy(initialFilters.orderBy);
      }
      if (initialFilters.ascending !== undefined) {
        setAscending(initialFilters.ascending);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleTitleTypeChange = (newTitleType: 'all' | 'serie' | 'movie' | undefined) => {
    setTitleType(newTitleType);
  };
  const { users, getUserNameById } = useUsers();

  const getRatingForUser = useCallback((titleId: string, userId: string) => {
    const list = ratingsMap[titleId] || [];
    const r = list.find(x => x.userId === userId);
    return r ? { rating: r.note, seasonsRatings: r.seasonsRatings } : undefined;
  }, [ratingsMap]);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }
    // Auto-select first group if none selected
    if (!getGroupId() && groups.length > 0) {
      saveGroupId(groups[0].id);
      refreshMovies();
    }
  }, [navigate, groups, refreshMovies]);

  const refreshRatingsForTitle = useCallback(async (_titleId: string) => {
    await refreshMovies();
  }, [refreshMovies]);

  const handleGroupChange = async (newGroupId: string) => {
    saveGroupId(newGroupId);
    await refreshMovies();
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
            <CardContent className="pt-4 space-y-2">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
              >
                Create Group
              </Button>
              <Button
                onClick={() => navigate('/groups')}
                variant="outline"
                className="w-full"
              >
                Go to Groups
              </Button>
            </CardContent>
          </Card>
        </main>
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
              currentGroupId={getGroupId()}
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
    </div>
  );
};

export default Index;
