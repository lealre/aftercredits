import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  loadFiltersFromStorage,
  saveFiltersToStorage,
  clearFiltersFromStorage,
} from '@/lib/filterStorage';
import { ArrowUpDown, Filter, ChevronDown, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupResponse } from '@/types/movie';
import { sortOptions } from '@/lib/constants';

interface FilterControlsProps {
  watchedFilter: 'all' | 'watched' | 'unwatched';
  onWatchedFilterChange: (filter: 'all' | 'watched' | 'unwatched') => void;
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


export const FilterControls = ({ 
  watchedFilter, 
  onWatchedFilterChange, 
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
        {/*
          One row on every width, not a column on mobile: the chips and the
          filter button together are one control group, and stacking them cost a
          whole line on a 375px screen while the group selector took a third.
          The button collapses to its icon below sm to make the row fit.
        */}
        <div className="flex flex-row items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap">
            <span className="sr-only sm:not-sr-only text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">Filter:</span>
            <div className="flex gap-1.5 sm:gap-2">
              <Button
                variant={watchedFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  onWatchedFilterChange('all');
                }}
                className={`px-2.5 sm:px-3 text-xs sm:text-sm ${watchedFilter === 'all' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
              >
                All
              </Button>
              <Button
                variant={watchedFilter === 'watched' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onWatchedFilterChange('watched')}
                className={`px-2.5 sm:px-3 text-xs sm:text-sm ${watchedFilter === 'watched' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
              >
                Watched
              </Button>
              <Button
                variant={watchedFilter === 'unwatched' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onWatchedFilterChange('unwatched')}
                className={`px-2.5 sm:px-3 text-xs sm:text-sm ${watchedFilter === 'unwatched' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
              >
                Unwatched
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs sm:text-sm"
                aria-label="More filters"
              >
                <Filter className="w-4 h-4" />
                {/* Label drops below sm so the row fits beside the chips. */}
                <span className="hidden sm:inline">More Filters</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
              </PopoverTrigger>

              {/*
                Radix measures the trigger and the viewport at open time and
                shifts the panel to fit, so the width no longer has to be capped
                against the worst case position of a button that moves with the
                chips beside it. collisionPadding keeps a margin when it does
                shift; it renders in a portal, so no ancestor can clip it.
              */}
              {/*
                * Pinned below the trigger. Radix's default collision handling
                * flips a panel to the opposite side when it does not fit, so on
                * a short viewport this opened UPWARD over the toolbar — which
                * reads as the panel appearing in the wrong place rather than as
                * a considered fallback. `avoidCollisions={false}` keeps it down;
                * the height cap is what makes that safe, since the panel then
                * scrolls internally instead of running off the bottom.
                */}
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                avoidCollisions={false}
                className="w-[calc(100vw-1.5rem)] sm:w-80 p-4 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto scrollbar-subtle"
              >
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
                          className={`text-xs sm:text-sm ${pendingTitleType === undefined || pendingTitleType === 'all' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
                        >
                          All
                        </Button>
                        <Button
                          variant={pendingTitleType === 'serie' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingTitleType('serie')}
                          className={`text-xs sm:text-sm ${pendingTitleType === 'serie' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
                        >
                          Series
                        </Button>
                        <Button
                          variant={pendingTitleType === 'movie' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingTitleType('movie')}
                          className={`text-xs sm:text-sm ${pendingTitleType === 'movie' ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
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
                            className={`text-xs sm:text-sm ${pendingOrderBy === option.value ? 'bg-movie-blue text-primary-foreground hover:bg-movie-blue/90' : ''}`}
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
              </PopoverContent>
            </Popover>
            {hasNonDefaultFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                title="Clear all filters"
              >
                <X className="h-3 w-3 sm:mr-1" />
                <span className="sr-only sm:not-sr-only">Clear filters</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
