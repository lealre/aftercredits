import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  clearToken,
  getLoginData,
  getToken,
  LoginSuccess,
  saveGroupId,
  getGroupId,
} from "@/services/authService";
import { Users, Check, Plus, Edit, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const Groups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const loginData: LoginSuccess | undefined = getLoginData();
  const token = loginData?.accessToken || getToken();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(getGroupId());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Login required",
        description: "Please sign in to view your groups.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    }
  }, [navigate, toast, token]);

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

  if (!token || !loginData) {
    return null;
  }

  const groups = loginData.groups || [];

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

          {groups.length === 0 ? (
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
              {groups.map((groupId) => {
                const isActive = activeGroupId === groupId;
                return (
                  <Card
                    key={groupId}
                    className={`bg-movie-surface/60 border ${
                      isActive
                        ? "border-movie-blue ring-2 ring-movie-blue/20"
                        : "border-border/60"
                    } transition-all hover:shadow-lg`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-movie-blue" />
                            {groupId}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Group ID: {groupId}
                          </CardDescription>
                        </div>
                        {isActive && (
                          <Badge className="bg-movie-blue text-movie-blue-foreground">
                            <Check className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
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
                            onClick={() => handleSelectGroup(groupId)}
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
                            onClick={() => handleEditGroup(groupId)}
                            className="text-xs"
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInviteToGroup(groupId)}
                            className="text-xs"
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            Invite
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGroup(groupId)}
                          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Group
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
