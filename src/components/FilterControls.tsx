import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FilterControlsProps {
  watchedFilter: 'all' | 'watched' | 'unwatched';
  onWatchedFilterChange: (filter: 'all' | 'watched' | 'unwatched') => void;
  movieCount: number;
}

export const FilterControls = ({ watchedFilter, onWatchedFilterChange, movieCount }: FilterControlsProps) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-movie-surface/50 rounded-lg border border-border/50">
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
      </div>
      <Badge variant="secondary" className="bg-movie-surface border-movie-blue/30">
        {movieCount} movies
      </Badge>
    </div>
  );
};