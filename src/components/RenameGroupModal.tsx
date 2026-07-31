import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateGroup } from '@/services/backendService';
import { Loader2 } from 'lucide-react';

interface RenameGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  currentName: string;
  onSuccess?: () => void;
}

export const RenameGroupModal = ({
  open,
  onOpenChange,
  groupId,
  currentName,
  onSuccess,
}: RenameGroupModalProps) => {
  const [groupName, setGroupName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setGroupName(currentName);
    }
  }, [open, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = groupName.trim();
    if (!trimmedName) {
      toast({
        title: "Validation error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateGroup(groupId, { name: trimmedName });

      toast({
        title: "Group renamed successfully",
        description: `Group has been renamed to "${trimmedName}".`,
      });

      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      let errorMessage = "Error renaming group";

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Failed to rename group",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setGroupName(currentName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Group</DialogTitle>
          <DialogDescription>
            Enter a new name for this group.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-group-name">Group Name</Label>
              <Input
                id="rename-group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="My Watchlist Group"
                disabled={isSubmitting}
                autoFocus
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !groupName.trim()}
              className="bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
