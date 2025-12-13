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
  handleUnauthorized,
} from "@/services/authService";
import { fetchUserById, fetchGroupById } from "@/services/backendService";
import { UserResponse, GroupResponse } from "@/types/movie";
import { Users, Check, Plus, Edit, Trash2, UserPlus, Loader2, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Groups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(getGroupId());
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [userData, setUserData] = useState<UserResponse | null>(null);

  useEffect(() => {
    // Check if we have token and userId
    const currentToken = getToken();
    const currentUserId = getUserId();
    
    if (!currentToken || !currentUserId) {
      console.log("Groups page: Missing token or userId", { token: currentToken, userId: currentUserId });
      toast({
        title: "Login required",
        description: "Please sign in to view your groups.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    const loadGroups = async () => {
      setLoadingGroups(true);
      try {
        // First fetch user data to get list of group IDs
        const user = await fetchUserById(currentUserId);
        setUserData(user);

        if (!user.groups || user.groups.length === 0) {
          setGroups([]);
          setLoadingGroups(false);
          return;
        }

        // Fetch details for each group
        const groupPromises = user.groups.map((groupId) => fetchGroupById(groupId));
        const fetchedGroups = await Promise.all(groupPromises);
        setGroups(fetchedGroups);
      } catch (error) {
        console.error("Error loading groups:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load groups";
        
        // Check if we're already being redirected (authFetch handles 401 redirects)
        if (window.location.pathname === '/login') {
          // Already redirected, don't do anything
          return;
        }
        
        // Only redirect to login if it's an authentication error
        if (errorMessage.includes("Login required") || errorMessage.includes("Session expired") || errorMessage.includes("401")) {
          // authFetch already handles 401 redirects, but if we get here with a "Login required" error,
          // it means getTokenOrRedirect() was called and redirected, so we should just return
          return;
        }
        
        // For other errors, just show a toast
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, [navigate, toast]);

  useEffect(() => {
    const currentGroupId = getGroupId();
    setActiveGroupId(currentGroupId);
  }, []);

  const handleSelectGroup = (groupId: string) => {
    setLoading(true);
    try {
      saveGroupId(groupId);
      setActiveGroupId(groupId);
      toast({
        title: "Group selected",
        description: "Active group has been updated. You can now view its watchlist.",
      });
      // Optionally redirect to watchlist
      setTimeout(() => {
        navigate("/watchlist");
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = () => {
    // TODO: Implement when backend endpoint is available
    toast({
      title: "Coming soon",
      description: "Group creation will be available soon.",
    });
  };

  const handleEditGroup = (groupId: string) => {
    // TODO: Implement when backend endpoint is available
    toast({
      title: "Coming soon",
      description: "Group editing will be available soon.",
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    // TODO: Implement when backend endpoint is available
    toast({
      title: "Coming soon",
      description: "Group deletion will be available soon.",
    });
  };

  const handleInviteToGroup = (groupId: string) => {
    // TODO: Implement when backend endpoint is available
    toast({
      title: "Coming soon",
      description: "Inviting members will be available soon.",
    });
  };

  // Check authentication status
  const token = getToken();
  const userId = getUserId();
  
  if (!token || !userId) {
    // This will be handled by the useEffect, but we need to return early to prevent rendering
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
              onClick={handleCreateGroup}
              className="bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>

          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-movie-blue" />
                <p className="text-lg font-medium text-foreground">Updating group...</p>
              </div>
            </div>
          )}

          {loadingGroups ? (
            <Card className="bg-movie-surface/60 border border-border/60">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-movie-blue mb-4" />
                  <p className="text-lg font-medium text-foreground">Loading groups...</p>
                </div>
              </CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card className="bg-movie-surface/60 border border-border/60">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No groups found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first group to start managing your watchlist together.
                  </p>
                  <Button
                    onClick={handleCreateGroup}
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
              {groups.map((group) => {
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
                          <CardDescription className="mt-1 truncate" title={group.id}>
                            ID: {group.id}
                          </CardDescription>
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
                            disabled={loading}
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
                            onClick={() => handleInviteToGroup(group.id)}
                            className="text-xs"
                            disabled={!isOwner}
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            Invite
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={!isOwner}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isOwner ? "Delete Group" : "Leave Group"}
                        </Button>
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
                <p>• Group management features (create, edit, delete, invite) are coming soon.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Groups;
