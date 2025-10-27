import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUpDown, Filter } from 'lucide-react';

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
  }, [open]);

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
          
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="ml-2 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                More Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
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
                  <Select 
                    value={pendingOrderBy || '__none__'} 
                    onValueChange={(value) => {
                      setPendingOrderBy(value === '__none__' ? undefined : value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            </PopoverContent>
          </Popover>
        </div>
        <Badge variant="secondary" className="bg-movie-surface border-movie-blue/30">
          {movieCount} movies
        </Badge>
      </div>
    </div>
  );
};
