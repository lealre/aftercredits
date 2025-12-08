import { Film, LogOut } from 'lucide-react';
import { Button } from './ui/button';

export interface HeaderProps {
  movieCount: number;
  showLogout?: boolean;
  onLogout?: () => void;
}

export const Header = ({ movieCount, showLogout = false, onLogout }: HeaderProps) => {
  return (
    <header className="bg-gradient-hero border-b border-border/50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-movie-gold flex items-center justify-center">
              <Film className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-movie-gold">BruNans' Watchlist</h1>
              <p className="text-sm text-muted-foreground">
                {movieCount} movie{movieCount !== 1 ? 's' : ''} in your collection
              </p>
            </div>
          </div>

          {showLogout && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};