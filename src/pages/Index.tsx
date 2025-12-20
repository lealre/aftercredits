import { useState, useCallback } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMovies } from '@/hooks/useMovies';
import { useUsers } from '@/hooks/useUsers';
import { Header } from '@/components/Header';
import { AddMovieForm } from '@/components/AddMovieForm';
import { MovieGrid } from '@/components/MovieGrid';
import { FilterControls } from '@/components/FilterControls';
import { Loader2 } from 'lucide-react';
import { getGroupId, getUserId, saveGroupId } from '@/services/authService';
import { fetchGroupById, fetchUserById } from '@/services/backendService';
import { GroupResponse } from '@/types/movie';

const Index = () => {
  const navigate = useNavigate();
  const [watchedFilter, setWatchedFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  const [groupData, setGroupData] = useState<GroupResponse | null>(null);
  const [allGroups, setAllGroups] = useState<GroupResponse[]>([]);
  
  // Convert filter to boolean or undefined for the API
  const watchedFilterValue = watchedFilter === 'all' ? undefined : watchedFilter === 'watched';
  
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
  } = useMovies(watchedFilterValue);
  const { users, getUserNameById } = useUsers();
  
  const getRatingForUser = useCallback((titleId: string, userId: string) => {
    const list = ratingsMap[titleId] || [];
    const r = list.find(x => x.userId === userId);
    return r ? { rating: r.note } : undefined;
  }, [ratingsMap]);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) {
      navigate('/groups', { replace: true });
      return;
    }

    // Fetch all user groups and current group information
    const loadGroups = async () => {
      try {
        const userId = getUserId();
        if (!userId) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch user to get all group IDs
        const user = await fetchUserById(userId);
        if (!user.groups || user.groups.length === 0) {
          navigate('/groups', { replace: true });
          return;
        }

        // Fetch details for all groups
        const groupPromises = user.groups.map((gId) => fetchGroupById(gId));
        const fetchedGroups = await Promise.all(groupPromises);
        setAllGroups(fetchedGroups);

        // Set current group data
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
      } catch (error) {
        console.error('Error loading groups:', error);
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

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <AddMovieForm 
          onRefresh={refreshMovies}
          loading={adding} 
          setLoading={setAdding} 
        />
        
        <FilterControls
          watchedFilter={watchedFilter}
          onWatchedFilterChange={setWatchedFilter}
          movieCount={pagination.totalResults}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
          ascending={ascending}
          onAscendingChange={setAscending}
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
        />
      </main>
    </div>
  );
};

export default Index;
