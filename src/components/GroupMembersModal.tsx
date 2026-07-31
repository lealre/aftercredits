import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fetchUsers } from '@/services/backendService';
import { UserResponse } from '@/types/movie';
import { Loader2, Crown } from 'lucide-react';

interface GroupMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  ownerId: string;
}

const displayName = (u: UserResponse) => u.name || u.username || u.email || 'Unknown user';

export const GroupMembersModal = ({
  open,
  onOpenChange,
  groupId,
  groupName,
  ownerId,
}: GroupMembersModalProps) => {
  const { data: members = [], isLoading, isError } = useQuery<UserResponse[]>({
    queryKey: ['groupMembers', groupId],
    queryFn: () => fetchUsers(groupId),
    enabled: open && !!groupId,
    staleTime: 60 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] bg-movie-surface border-border">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription className="truncate" title={groupName}>
            {groupName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <p className="py-4 text-sm text-destructive">Couldn't load members. Please try again.</p>
        ) : members.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No members found.</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{displayName(m)}</p>
                  {m.email && m.email !== displayName(m) && (
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  )}
                </div>
                {m.id === ownerId && (
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
