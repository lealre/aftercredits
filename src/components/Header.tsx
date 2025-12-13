import { Film, LogOut, Users, User, ChevronDown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { getLoginData, clearToken } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

export interface HeaderProps {}

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const loginData = getLoginData();

  const handleLogout = () => {
    clearToken();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    navigate("/login", { replace: true });
  };

  const getUserInitial = () => {
    if (loginData?.name) {
      return loginData.name.charAt(0).toUpperCase();
    }
    if (loginData?.username) {
      return loginData.username.charAt(0).toUpperCase();
    }
    if (loginData?.email) {
      return loginData.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = () => {
    return loginData?.name || loginData?.username || loginData?.email || 'User';
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-gradient-hero border-b border-border/50">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo placeholder - replace with actual logo image in the future */}
            <Film className="w-8 h-8 text-movie-gold" />
            <div>
              <h1 className="text-2xl font-bold text-movie-gold">BruNans' Watchlist</h1>
            </div>
          </div>

          {loginData && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="relative h-10 w-10 rounded-full border-2 border-movie-blue/30 bg-movie-surface hover:bg-movie-surface/80 focus:outline-none focus:ring-2 focus:ring-movie-blue focus:ring-offset-2 p-0"
                >
                  {loginData.avatarUrl ? (
                    <img
                      src={loginData.avatarUrl}
                      alt={getUserDisplayName()}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-movie-blue flex items-center justify-center text-movie-blue-foreground font-semibold text-sm">
                      {getUserInitial()}
                    </div>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-movie-blue border-2 border-movie-surface flex items-center justify-center">
                    <ChevronDown className="h-2 w-2 text-movie-blue-foreground" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                    {loginData.email && (
                      <p className="text-xs leading-none text-muted-foreground">
                        {loginData.email}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/watchlist')}
                  className={isActive('/watchlist') ? 'bg-accent' : ''}
                >
                  <Film className="mr-2 h-4 w-4" />
                  <span>Watchlist</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/groups')}
                  className={isActive('/groups') ? 'bg-accent' : ''}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>Groups</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/account')}
                  className={isActive('/account') ? 'bg-accent' : ''}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Account</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};