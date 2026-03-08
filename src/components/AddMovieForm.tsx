import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Loader2, Search, Link, X } from 'lucide-react';
import { addMovieToBackend, searchTitles } from '@/services/backendService';
import { useToast } from '@/hooks/use-toast';
import { getGroupId } from '@/services/authService';
import { SearchTitle } from '@/types/movie';
import { SearchResultsDropdown } from '@/components/SearchResultsDropdown';

const SEARCH_DEBOUNCE_MS = 600;
const SEARCH_LIMIT = 10;

type AddMode = 'search' | 'url';

interface AddMovieFormProps {
  onRefresh: () => Promise<void>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  existingTitleIds?: string[];
}

export const AddMovieForm = ({
  onRefresh,
  loading,
  setLoading,
  existingTitleIds = [],
}: AddMovieFormProps) => {
  const [mode, setMode] = useState<AddMode>('search');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTitle[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchResults([]);
        setSearchLoading(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search: loading shows as soon as user types, request runs after delay
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchTitles(trimmed, SEARCH_LIMIT);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        toast({
          title: 'Search failed',
          description: 'Could not search titles. Please try again.',
          variant: 'destructive',
        });
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    try {
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: 'No group selected',
          description: 'Please select a group to add movies.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      const result = await addMovieToBackend(groupId, url);

      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      await onRefresh();
      setUrl('');
      toast({
        title: 'Movie added successfully!',
        description: 'The movie has been added to your list.',
      });
    } catch (error) {
      console.error('Error adding movie:', error);
      toast({
        title: 'Error',
        description: 'Failed to add movie. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromSearch = useCallback(
    async (id: string) => {
      const groupId = getGroupId();
      if (!groupId) {
        toast({
          title: 'No group selected',
          description: 'Please select a group to add movies.',
          variant: 'destructive',
        });
        return;
      }
      if (existingTitleIds.includes(id)) {
        toast({
          title: 'Already in group',
          description: 'This movie is already in your list.',
        });
        return;
      }

      setAddingId(id);
      const imdbUrl = `https://www.imdb.com/title/${id}/`;
      const result = await addMovieToBackend(groupId, imdbUrl);
      setAddingId(null);

      if (result.error) {
        if (result.error.toLowerCase().includes('already in group')) {
          toast({
            title: 'Already in group',
            description: 'This movie is already in your list.',
          });
        } else {
          toast({
            title: 'Error',
            description: result.error,
            variant: 'destructive',
          });
        }
        return;
      }

      toast({
        title: 'Movie added successfully!',
        description: 'The movie has been added to your list.',
      });
      await onRefresh();
      setSearchResults((prev) => prev.filter((r) => r.id !== id));
    },
    [existingTitleIds, onRefresh, toast]
  );

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl font-semibold text-movie-gold">
            Add New Movie/Series
          </h2>
          <div className="flex rounded-lg border border-border bg-movie-surface/50 p-0.5">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'search'
                  ? 'bg-movie-gold text-movie-gold-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search className="w-4 h-4" />
              Search by name
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'url'
                  ? 'bg-movie-gold text-movie-gold-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Link className="w-4 h-4" />
              Add by URL
            </button>
          </div>
        </div>

        {mode === 'search' ? (
          <div className="relative" ref={searchContainerRef}>
            <p className="text-sm text-muted-foreground mb-2">
              Type a movie or series name to search. Results appear below.
            </p>
            <div className="relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. The Boys, Inception…"
                className="w-full bg-movie-surface border-border pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (searchLoading || searchResults.length > 0) && (
              <SearchResultsDropdown
                results={searchResults}
                loading={searchLoading}
                existingTitleIds={existingTitleIds}
                onAdd={handleAddFromSearch}
                addingId={addingId}
              />
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste an IMDB URL (e.g. https://www.imdb.com/title/tt1234567/)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.imdb.com/title/tt1234567/"
                className="flex-1 bg-movie-surface border-border"
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={!url.trim() || loading}
                className="bg-movie-gold text-movie-gold-foreground hover:bg-movie-gold-light shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {loading ? 'Adding…' : 'Add Movie'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};
