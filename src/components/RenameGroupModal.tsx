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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { updateGroup } from '@/services/backendService';
import { Loader2 } from 'lucide-react';

interface RenameGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  currentName: string;
  currentDescription?: string;
  onSuccess?: () => void;
}

export const RenameGroupModal = ({
  open,
  onOpenChange,
  groupId,
  currentName,
  currentDescription = '',
  onSuccess,
}: RenameGroupModalProps) => {
  const [groupName, setGroupName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setGroupName(currentName);
      setDescription(currentDescription);
    }
  }, [open, currentName, currentDescription]);

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
      await updateGroup(groupId, { name: trimmedName, description: description.trim() });

      toast({
        title: "Group updated successfully",
        description: `Changes to "${trimmedName}" have been saved.`,
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
    setDescription(currentDescription);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Group</DialogTitle>
          <DialogDescription>
            Update this group's name and description.
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
            <div className="space-y-2">
              <Label htmlFor="rename-group-description">Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="rename-group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group for?"
                disabled={isSubmitting}
                maxLength={300}
                rows={3}
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
