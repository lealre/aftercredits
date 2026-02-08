import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Filter, ChevronDown, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupResponse } from '@/types/movie';

interface FilterControlsProps {
  watchedFilter: 'all' | 'watched' | 'unwatched';
  onWatchedFilterChange: (filter: 'all' | 'watched' | 'unwatched') => void;
  movieCount: number;
  orderBy: string | undefined;
  onOrderByChange: (orderBy: string | undefined) => void;
  ascending: boolean;
  onAscendingChange: (ascending: boolean) => void;
  titleType: 'all' | 'serie' | 'movie' | undefined;
  onTitleTypeChange: (titleType: 'all' | 'serie' | 'movie' | undefined) => void;
  groups: GroupResponse[];
  currentGroupId: string | null;
  onGroupChange: (groupId: string) => void;
  onClearFilters?: () => void;
}

const sortOptions = [
  { value: 'primaryTitle', label: 'Title' },
  { value: 'imdbRating', label: 'IMDB Rating' },
  { value: 'startYear', label: 'Year' },
  { value: 'runtimeSeconds', label: 'Duration' },
  { value: 'addedAt', label: 'Added Date' },
  { value: 'watchedAt', label: 'Watched Date' },
];

const STORAGE_KEY = 'movieFilters';

// Helper functions for localStorage
const saveFiltersToStorage = (filters: { watchedFilter: string; orderBy?: string; ascending: boolean; titleType?: string }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters to localStorage:', error);
  }
};

export const loadFiltersFromStorage = (): { watchedFilter: string; orderBy?: string; ascending: boolean; titleType?: string } | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading filters from localStorage:', error);
  }
  return null;
};

const clearFiltersFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing filters from localStorage:', error);
  }
};

export const FilterControls = ({ 
  watchedFilter, 
  onWatchedFilterChange, 
  movieCount,
  orderBy,
  onOrderByChange,
  ascending,
  onAscendingChange,
  titleType,
  onTitleTypeChange,
  groups,
  currentGroupId,
  onGroupChange,
  onClearFilters,
}: FilterControlsProps) => {
  const [open, setOpen] = useState(false);
  const [pendingOrderBy, setPendingOrderBy] = useState<string | undefined>(orderBy);
  const [pendingAscending, setPendingAscending] = useState<boolean>(ascending);
  const [pendingTitleType, setPendingTitleType] = useState<'all' | 'serie' | 'movie' | undefined>(titleType);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Sync pending values when props change
  useEffect(() => {
    setPendingOrderBy(orderBy);
    setPendingAscending(ascending);
    setPendingTitleType(titleType);
  }, [orderBy, ascending, titleType]);

  // Reset pending values when popover opens
  useEffect(() => {
    if (open) {
      setPendingOrderBy(orderBy);
      setPendingAscending(ascending);
      setPendingTitleType(titleType);
    }
  }, [open, orderBy, ascending, titleType]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    saveFiltersToStorage({
      watchedFilter,
      orderBy: orderBy || undefined,
      ascending,
      titleType: titleType === 'all' ? undefined : titleType,
    });
  }, [watchedFilter, orderBy, ascending, titleType]);

  const handleApply = () => {
    onOrderByChange(pendingOrderBy);
    onAscendingChange(pendingAscending);
    onTitleTypeChange(pendingTitleType);
    setOpen(false);
  };

  const handleClearFilters = () => {
    onWatchedFilterChange('all');
    onOrderByChange(undefined);
    onAscendingChange(true);
    onTitleTypeChange(undefined);
    clearFiltersFromStorage();
    if (onClearFilters) {
      onClearFilters();
    }
  };

  // Check if filters are at default values
  const hasNonDefaultFilters = watchedFilter !== 'all' || orderBy !== undefined || titleType !== undefined;

  const handleCancel = () => {
    setPendingOrderBy(orderBy);
    setPendingAscending(ascending);
    setPendingTitleType(titleType);
    setOpen(false);
  };

  return (
    <div className="p-3 sm:p-4 bg-movie-surface/50 rounded-lg border border-border/50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">Filter:</span>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={watchedFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  onWatchedFilterChange('all');
                }}
                className={`text-xs sm:text-sm ${watchedFilter === 'all' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
              >
                All
              </Button>
              <Button
                variant={watchedFilter === 'watched' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onWatchedFilterChange('watched')}
                className={`text-xs sm:text-sm ${watchedFilter === 'watched' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
              >
                Watched
              </Button>
              <Button
                variant={watchedFilter === 'unwatched' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onWatchedFilterChange('unwatched')}
                className={`text-xs sm:text-sm ${watchedFilter === 'unwatched' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
              >
                Unwatched
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs sm:text-sm"
                onClick={() => setOpen(!open)}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">More Filters</span>
                <span className="sm:hidden">Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
              
              {open && (
              <div className="absolute left-0 sm:left-auto right-0 sm:right-auto top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-popover border rounded-md shadow-md p-4 z-50">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium leading-none mb-1 text-sm sm:text-base">Advanced Filters</h4>
                  </div>
                  
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Type</label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={pendingTitleType === undefined || pendingTitleType === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingTitleType(undefined)}
                          className={`text-xs sm:text-sm ${pendingTitleType === undefined || pendingTitleType === 'all' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
                        >
                          All
                        </Button>
                        <Button
                          variant={pendingTitleType === 'serie' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingTitleType('serie')}
                          className={`text-xs sm:text-sm ${pendingTitleType === 'serie' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
                        >
                          Series
                        </Button>
                        <Button
                          variant={pendingTitleType === 'movie' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingTitleType('movie')}
                          className={`text-xs sm:text-sm ${pendingTitleType === 'movie' ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
                        >
                          Movies
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Sort by</label>
                      <div className="flex flex-wrap gap-2">
                        {sortOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant={pendingOrderBy === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPendingOrderBy(option.value)}
                            className={`text-xs sm:text-sm ${pendingOrderBy === option.value ? 'bg-movie-blue text-movie-blue-foreground' : ''}`}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {pendingOrderBy && (
                      <div className="space-y-2">
                        <label className="text-xs sm:text-sm font-medium">Order</label>
                        <Button
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm"
                          onClick={() => setPendingAscending(!pendingAscending)}
                        >
                          <ArrowUpDown className="w-4 h-4" />
                          {pendingAscending ? 'Ascending' : 'Descending'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleApply}
                      className="flex-1 bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90 text-xs sm:text-sm"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1 text-xs sm:text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
              )}
            </div>
            {hasNonDefaultFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                title="Clear all filters"
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-movie-surface border-movie-blue/30 text-xs sm:text-sm w-fit sm:w-auto">
            {movieCount} movies
          </Badge>
          {groups.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">Group:</span>
              <Select
                value={currentGroupId || undefined}
                onValueChange={onGroupChange}
              >
                <SelectTrigger className="h-9 rounded-md px-3 text-xs sm:text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id} className="text-xs sm:text-sm">
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
