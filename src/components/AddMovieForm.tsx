import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Loader2 } from 'lucide-react';
import { addMovieToBackend } from '@/services/backendService';
import { useToast } from '@/hooks/use-toast';
import { getGroupId, handleUnauthorized } from '@/services/authService';

interface AddMovieFormProps {
  onRefresh: () => Promise<void>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const AddMovieForm = ({ onRefresh, loading, setLoading }: AddMovieFormProps) => {
  const [url, setUrl] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    
    try {
      const groupId = getGroupId();
      if (!groupId) {
        handleUnauthorized("No group selected. Please log in again.");
        return;
      }
      const result = await addMovieToBackend(groupId, url);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      // Success - refresh the movies list with current filters
      await onRefresh();
      setUrl('');
      
      toast({
        title: "Movie added successfully!",
        description: "The movie has been added to your list.",
      });
      
    } catch (error) {
      console.error('Error adding movie:', error);
      toast({
        title: "Error",
        description: "Failed to add movie. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-movie-gold">Add New Movie/Series</h2>
          <p className="text-sm text-muted-foreground">
            {/* Paste an IMDB URL or ID (e.g., https://www.imdb.com/title/tt1234567/ or tt1234567) */}
            Paste an IMDB URL (e.g., https://www.imdb.com/title/tt1234567/)
          </p>
        </div>
        
        <div className="flex gap-2">
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
            {loading ? 'Adding...' : 'Add Movie'}
          </Button>
        </div>
      </form>
    </Card>
  );
};