import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getUserId,
  getToken,
  saveGroupId,
  getGroupId,
  clearGroupId,
} from "@/services/authService";
import { deleteGroup, leaveGroup } from "@/services/backendService";
import { GroupResponse } from "@/types/movie";
import { Users, Check, Plus, Edit, Trash2, UserPlus, Loader2, Crown, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreateGroupModal } from "@/components/CreateGroupModal";
import { RenameGroupModal } from "@/components/RenameGroupModal";
import { ConfirmByTypingModal } from "@/components/ConfirmByTypingModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGroups } from "@/hooks/useGroups";

const Groups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(getGroupId());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; description: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const { groups, loading: loadingGroups, hasNoGroups, refreshGroups } = useGroups();

  const token = getToken();
  const userId = getUserId();

  useEffect(() => {
    if (!token || !userId) {
      toast({
        title: "Login required",
        description: "Please sign in to view your groups.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    }
  }, [navigate, toast, token, userId]);

  useEffect(() => {
    setActiveGroupId(getGroupId());
  }, []);

  const handleSelectGroup = (groupId: string) => {
    saveGroupId(groupId);
    setActiveGroupId(groupId);
    toast({
      title: "Group selected",
      description: "Active group has been updated. You can now view its watchlist.",
    });
    navigate("/watchlist");
  };

  const handleGroupCreated = async () => {
    await refreshGroups();
    // Auto-select the newly created group (should be the last one after refresh)
    // We need to wait for the query to settle, so we'll handle it after refresh
    toast({
      title: "Group created",
      description: "Your new group has been created.",
    });
  };

  const handleEditGroup = (groupId: string) => {
    const group = groups.find((g: GroupResponse) => g.id === groupId);
    if (!group) return;
    setRenameTarget({ id: group.id, name: group.name, description: group.description ?? '' });
  };

  const handleGroupRenamed = async () => {
    await refreshGroups();
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find((g: GroupResponse) => g.id === groupId);
    if (!group) return;
    setDeleteTarget({ id: group.id, name: group.name });
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    setIsDeleting(true);
    try {
      await deleteGroup(deletedId);

      if (getGroupId() === deletedId) {
        const remaining = groups.filter((g: GroupResponse) => g.id !== deletedId);
        if (remaining.length > 0) {
          saveGroupId(remaining[0].id);
          setActiveGroupId(remaining[0].id);
        } else {
          clearGroupId();
          setActiveGroupId(null);
        }
      }

      await refreshGroups();

      toast({
        title: "Group deleted",
        description: `"${deleteTarget.name}" has been deleted.`,
      });

      setDeleteTarget(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error deleting group";
      toast({
        title: "Failed to delete group",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveGroup = (groupId: string) => {
    const group = groups.find((g: GroupResponse) => g.id === groupId);
    if (!group) return;
    setLeaveTarget({ id: group.id, name: group.name });
  };

  const handleConfirmLeaveGroup = async () => {
    if (!leaveTarget || !userId) return;
    const leftId = leaveTarget.id;
    setIsLeaving(true);
    try {
      await leaveGroup(leftId, userId);

      if (getGroupId() === leftId) {
        const remaining = groups.filter((g: GroupResponse) => g.id !== leftId);
        if (remaining.length > 0) {
          saveGroupId(remaining[0].id);
          setActiveGroupId(remaining[0].id);
        } else {
          clearGroupId();
          setActiveGroupId(null);
        }
      }

      await refreshGroups();

      toast({
        title: "Left group",
        description: `You have left "${leaveTarget.name}".`,
      });

      setLeaveTarget(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error leaving group";
      toast({
        title: "Failed to leave group",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLeaving(false);
    }
  };

  if (!token || !userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Groups</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your groups and select which one to display in your watchlist
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>

          {loadingGroups ? (
            <Card className="bg-movie-surface/60 border border-border/60">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-movie-blue mb-4" />
                  <p className="text-lg font-medium text-foreground">Loading groups...</p>
                </div>
              </CardContent>
            </Card>
          ) : hasNoGroups ? (
            <Card className="bg-movie-surface/60 border border-border/60">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No groups found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first group to start managing your watchlist together.
                  </p>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((group: GroupResponse) => {
                const isActive = activeGroupId === group.id;
                const isOwner = group.ownerId === userId;
                return (
                  <Card
                    key={group.id}
                    className={`bg-movie-surface/60 border ${
                      isActive
                        ? "border-movie-blue ring-2 ring-movie-blue/20"
                        : "border-border/60"
                    } transition-all hover:shadow-lg`}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-2">
                        <Users className="h-5 w-5 text-movie-blue mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="flex items-center gap-2 flex-wrap">
                            <span className="truncate">{group.name}</span>
                            {isActive && (
                              <Badge className="bg-movie-blue text-movie-blue-foreground flex-shrink-0">
                                <Check className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            )}
                            {isOwner && (
                              <Badge variant="outline" className="flex-shrink-0 border-movie-gold/50 text-movie-gold">
                                <Crown className="mr-1 h-3 w-3" />
                                Owner
                              </Badge>
                            )}
                            {!isOwner && (
                              <Badge variant="outline" className="flex-shrink-0">
                                Participant
                              </Badge>
                            )}
                          </CardTitle>
                          {group.description && (
                            <CardDescription className="mt-1 truncate" title={group.description}>
                              {group.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Members</p>
                          <p className="text-xs font-medium text-foreground">{group.users?.length || 0} member{(group.users?.length || 0) !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm text-foreground">
                          {isActive
                            ? "This is your active group. Movies from this group are shown in your watchlist."
                            : "Select this group to view its watchlist."}
                        </p>
                      </div>

                      <Separator />

                      <div className="flex flex-col gap-2">
                        {!isActive && (
                          <Button
                            onClick={() => handleSelectGroup(group.id)}
                            className="w-full bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Select as Active
                          </Button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditGroup(group.id)}
                            className="text-xs"
                            disabled={!isOwner}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled
                            title="Coming soon"
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            Invite
                          </Button>
                        </div>
                        {isOwner ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteGroup(group.id)}
                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Group
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveGroup(group.id)}
                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Leave Group
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {groups.length > 0 && (
            <Card className="bg-movie-surface/60 border border-border/60">
              <CardHeader>
                <CardTitle>Group Information</CardTitle>
                <CardDescription>
                  Learn more about managing your groups
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • Select a group to make it active. Only movies from the active group will be
                  shown in your watchlist.
                </p>
                <p>• You can switch between groups at any time.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <CreateGroupModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleGroupCreated}
      />
      {renameTarget && (
        <RenameGroupModal
          open={!!renameTarget}
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null);
          }}
          groupId={renameTarget.id}
          currentName={renameTarget.name}
          currentDescription={renameTarget.description}
          onSuccess={handleGroupRenamed}
        />
      )}
      {deleteTarget && (
        <ConfirmByTypingModal
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Delete group"
          description="This will permanently delete this group and cannot be undone."
          confirmPhrase={deleteTarget.name}
          confirmLabel="Delete group"
          onConfirm={handleConfirmDeleteGroup}
          loading={isDeleting}
        />
      )}
      <AlertDialog
        open={!!leaveTarget}
        onOpenChange={(open) => {
          if (!open) setLeaveTarget(null);
        }}
      >
        <AlertDialogContent className="bg-movie-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave group</AlertDialogTitle>
            <AlertDialogDescription>
              {leaveTarget
                ? `Are you sure you want to leave "${leaveTarget.name}"? You will need to be invited again to rejoin.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeaveGroup}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? "Leaving..." : "Leave group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Groups;
