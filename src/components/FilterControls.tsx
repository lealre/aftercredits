import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Filter, ChevronDown } from 'lucide-react';

interface FilterControlsProps {
  watchedFilter: 'all' | 'watched' | 'unwatched';
  onWatchedFilterChange: (filter: 'all' | 'watched' | 'unwatched') => void;
  movieCount: number;
  orderBy: string | undefined;
  onOrderByChange: (orderBy: string | undefined) => void;
  ascending: boolean;
  onAscendingChange: (ascending: boolean) => void;
}

const sortOptions = [
  { value: 'primaryTitle', label: 'Title' },
  { value: 'imdbRating', label: 'IMDB Rating' },
  { value: 'startYear', label: 'Year' },
  { value: 'runtimeSeconds', label: 'Duration' },
  { value: 'addedAt', label: 'Added Date' },
  { value: 'watchedAt', label: 'Watched Date' },
];

export const FilterControls = ({ 
  watchedFilter, 
  onWatchedFilterChange, 
  movieCount,
  orderBy,
  onOrderByChange,
  ascending,
  onAscendingChange,
}: FilterControlsProps) => {
  const [open, setOpen] = useState(false);
  const [pendingOrderBy, setPendingOrderBy] = useState<string | undefined>(orderBy);
  const [pendingAscending, setPendingAscending] = useState<boolean>(ascending);
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
  }, [orderBy, ascending]);

  // Reset pending values when popover opens
  useEffect(() => {
    if (open) {
      setPendingOrderBy(orderBy);
      setPendingAscending(ascending);
    }
  }, [open, orderBy, ascending]);

  const handleApply = () => {
    onOrderByChange(pendingOrderBy);
    onAscendingChange(pendingAscending);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingOrderBy(orderBy);
    setPendingAscending(ascending);
    setOpen(false);
  };

  return (
    <div className="p-4 bg-movie-surface/50 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Filter:</span>
          <div className="flex gap-2">
            <Button
              variant={watchedFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onWatchedFilterChange('all')}
              className={watchedFilter === 'all' ? 'bg-movie-blue text-movie-blue-foreground' : ''}
            >
              All
            </Button>
            <Button
              variant={watchedFilter === 'watched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onWatchedFilterChange('watched')}
              className={watchedFilter === 'watched' ? 'bg-movie-blue text-movie-blue-foreground' : ''}
            >
              Watched
            </Button>
            <Button
              variant={watchedFilter === 'unwatched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onWatchedFilterChange('unwatched')}
              className={watchedFilter === 'unwatched' ? 'bg-movie-blue text-movie-blue-foreground' : ''}
            >
              Unwatched
            </Button>
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 flex items-center gap-2"
              onClick={() => setOpen(!open)}
            >
              <Filter className="w-4 h-4" />
              More Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
            
            {open && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-popover border rounded-md shadow-md p-4 z-50">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium leading-none mb-1">Advanced Filters</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure how movies are sorted and filtered
                    </p>
                  </div>
                  
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sort by</label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={pendingOrderBy === undefined ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPendingOrderBy(undefined)}
                          className={pendingOrderBy === undefined ? 'bg-movie-blue text-movie-blue-foreground' : ''}
                        >
                          None
                        </Button>
                        {sortOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant={pendingOrderBy === option.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPendingOrderBy(option.value)}
                            className={pendingOrderBy === option.value ? 'bg-movie-blue text-movie-blue-foreground' : ''}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {pendingOrderBy && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Order</label>
                        <Button
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2"
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
                      className="flex-1 bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="bg-movie-surface border-movie-blue/30">
          {movieCount} movies
        </Badge>
      </div>
    </div>
  );
};
