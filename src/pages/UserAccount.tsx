import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  getUserId,
  getToken,
  getGroupId,
  handleUnauthorized,
} from "@/services/authService";
import { fetchUserById } from "@/services/backendService";
import { UserResponse } from "@/types/movie";

const UserAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userId = getUserId();
  const token = getToken();
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) {
      toast({
        title: "Login required",
        description: "Please sign in to view your account.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    const loadUserData = async () => {
      setLoading(true);
      try {
        const user = await fetchUserById(userId);
        setUserData(user);
      } catch (error) {
        console.error("Error loading user data:", error);
        toast({
          title: "Error",
          description: "Failed to load user data. Please try again.",
          variant: "destructive",
        });
        handleUnauthorized("Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [navigate, toast, token, userId]);

  const formattedLastLogin = formatDateTime(userData?.lastLoginAt);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="bg-movie-surface/60 border border-border/60 rounded-lg shadow-xl p-6 sm:p-8 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Account Details</h2>
            <p className="text-sm text-muted-foreground">Your session information.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-movie-blue" />
                <p className="text-lg font-medium text-foreground">Loading account details...</p>
              </div>
            </div>
          ) : userData ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="ID" value={userData.id ?? "—"} />
                <InfoItem label="Username" value={userData.username ?? "—"} />
                <InfoItem label="Email" value={userData.email ?? "—"} />
                <InfoItem label="Name" value={userData.name || "—"} />
                <InfoItem label="Active Group" value={getGroupId() || "—"} />
                <InfoItem
                  label="Avatar URL"
                  value={userData.avatarUrl || "—"}
                  isMono
                />
                <InfoItem
                  label="Last Login At"
                  value={formattedLastLogin || "—"}
                />
                <InfoItem
                  label="Created At"
                  value={formatDateTime(userData.createdAt) || "—"}
                />
                <InfoItem
                  label="Updated At"
                  value={formatDateTime(userData.updatedAt) || "—"}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Groups</p>
                {userData.groups?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {userData.groups.map((group) => (
                      <span
                        key={group}
                        className="px-3 py-1 rounded-full bg-movie-blue/20 text-movie-blue-foreground text-xs"
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No groups</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Failed to load user data. Please try again.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserAccount;

interface InfoItemProps {
  label: string;
  value: string;
  isMono?: boolean;
}

const InfoItem = ({ label, value, isMono = false }: InfoItemProps) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className={`text-sm ${isMono ? "font-mono break-words" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day} ${hours}:${minutes}h`;
};

