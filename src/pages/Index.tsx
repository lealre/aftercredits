import { useState, useCallback } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls, loadFiltersFromStorage } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';
import { getGroupId, getUserId, saveGroupId } from '@/services/authService';
import { fetchGroupById, fetchUserById } from '@/services/backendService';
import { GroupResponse } from '@/types/movie';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGroupModal } from '@/components/CreateGroupModal';

const Index = () => {
  const navigate = useNavigate();
  
  // Load filters from localStorage on mount (only once)
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>(() => {
    const stored = loadFiltersFromStorage();
    return (stored?.watchedFilter as 'all' | 'watched' | 'unwatched') || 'all';
  });
  const [titleType, setTitleType] = useState<'all' | 'serie' | 'movie' | undefined>(() => {
    const stored = loadFiltersFromStorage();
    const storedTitleType = stored?.titleType;
    if (!storedTitleType || storedTitleType === 'all') {
      return undefined;
    }
    return storedTitleType as 'serie' | 'movie';
  });
  const [groupData, setGroupData] = useState<GroupResponse | null>(null);
  const [allGroups, setAllGroups] = useState<GroupResponse[]>([]);
  const [hasNoGroups, setHasNoGroups] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  // Convert titleType: undefined or 'all' -> undefined, 'serie' or 'movie' -> pass as is
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
  
  // Load orderBy and ascending from localStorage on mount (only once)
  useEffect(() => {
    const stored = loadFiltersFromStorage();
    if (stored) {
      if (stored.orderBy !== undefined) {
        setOrderBy(stored.orderBy);
      }
      if (stored.ascending !== undefined) {
        setAscending(stored.ascending);
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
    // Fetch all user groups and current group information
    const loadGroups = async () => {
      setLoadingGroups(true);
      setHasNoGroups(false);
      
      try {
        const userId = getUserId();
        if (!userId) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch user to get all group IDs
        const user = await fetchUserById(userId);
        if (!user.groups || user.groups.length === 0) {
          setHasNoGroups(true);
          setAllGroups([]);
          setGroupData(null);
          setLoadingGroups(false);
          return;
        }

        // Fetch details for all groups
        const groupPromises = user.groups.map((gId) => fetchGroupById(gId));
        const fetchedGroups = await Promise.all(groupPromises);
        setAllGroups(fetchedGroups);

        // Check if we have a selected group
        let groupId = getGroupId();
        
        // If no group selected, auto-select the first group
        if (!groupId && fetchedGroups.length > 0) {
          groupId = fetchedGroups[0].id;
          saveGroupId(groupId);
        }

        // Set current group data
        if (groupId) {
          const currentGroup = fetchedGroups.find((g) => g.id === groupId);
          if (currentGroup) {
            setGroupData(currentGroup);
          } else {
            // If current group not found, use first group
            if (fetchedGroups.length > 0) {
              saveGroupId(fetchedGroups[0].id);
              setGroupData(fetchedGroups[0]);
              refreshMovies();
            }
          }
        }
      } catch (error) {
        console.error('Error loading groups:', error);
        setHasNoGroups(true);
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const refreshRatingsForTitle = useCallback(async (titleId: string) => {
    // Refresh movies to get updated ratings
    await refreshMovies();
  }, [refreshMovies]);

  const handleGroupChange = async (newGroupId: string) => {
    try {
      saveGroupId(newGroupId);
      const newGroup = allGroups.find((g) => g.id === newGroupId);
      if (newGroup) {
        setGroupData(newGroup);
        await refreshMovies();
      }
    } catch (error) {
      console.error('Error changing group:', error);
    }
  };

  const handleGroupCreated = async () => {
    // Refresh groups list
    try {
      setLoadingGroups(true);
      setHasNoGroups(false);
      
      const userId = getUserId();
      if (!userId) {
        navigate('/login', { replace: true });
        return;
      }

      // Fetch user to get all group IDs
      const user = await fetchUserById(userId);
      if (!user.groups || user.groups.length === 0) {
        setHasNoGroups(true);
        setAllGroups([]);
        setGroupData(null);
        setLoadingGroups(false);
        return;
      }

      // Fetch details for all groups
      const groupPromises = user.groups.map((gId) => fetchGroupById(gId));
      const fetchedGroups = await Promise.all(groupPromises);
      setAllGroups(fetchedGroups);

      // Auto-select the newly created group (should be the last one)
      if (fetchedGroups.length > 0) {
        const newGroup = fetchedGroups[fetchedGroups.length - 1];
        saveGroupId(newGroup.id);
        setGroupData(newGroup);
        await refreshMovies();
      }
    } catch (error) {
      console.error('Error refreshing groups:', error);
      setHasNoGroups(true);
    } finally {
      setLoadingGroups(false);
    }
  };

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
              groups={allGroups}
              currentGroupId={getGroupId()}
              onGroupChange={handleGroupChange}
            />
            
            {loading && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-movie-blue" />
                  <p className="text-lg font-medium text-foreground">Loading movies...</p>
                </div>
              </div>
            )}
            
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
