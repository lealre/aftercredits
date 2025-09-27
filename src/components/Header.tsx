import { Button } from '@/components/ui/button';
import { Download, Film } from 'lucide-react';

interface HeaderProps {
  onExport: () => void;
  movieCount: number;
}

export const Header = ({ onExport, movieCount }: HeaderProps) => {
  return (
    <header className="bg-gradient-hero border-b border-border/50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-movie-gold flex items-center justify-center">
              <Film className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-movie-gold">Renan & Bruna's Movies</h1>
              <p className="text-sm text-muted-foreground">
                {movieCount} movie{movieCount !== 1 ? 's' : ''} in your collection
              </p>
            </div>
          </div>
          
          <Button
            onClick={onExport}
            variant="outline"
            className="border-movie-gold/30 text-movie-gold hover:bg-movie-gold hover:text-background"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </header>
  );
};