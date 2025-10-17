import { Movie } from '@/types/movie';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  movie: Movie;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const DeleteConfirmationModal = ({ 
  movie, 
  isOpen, 
  onClose, 
  onConfirm, 
  loading = false 
}: DeleteConfirmationModalProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-movie-surface border-border">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-destructive">
                Delete Movie
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        
        <div className="py-4">
          <div className="flex items-start gap-4 p-4 bg-movie-surface/50 rounded-lg border border-border">
            <img
              src={movie.poster}
              alt={movie.title}
              className="w-16 h-24 object-cover rounded"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-movie.jpg';
              }}
            />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">{movie.title}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {movie.year} • {movie.genre}
              </p>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this movie from your watchlist? 
                All ratings and comments will be permanently removed.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onClose}
            disabled={loading}
            className="bg-movie-surface border-border hover:bg-movie-surface/80"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                Deleting...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Movie
              </div>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
