import { useEffect } from "react";
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

const UserAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const loginData: LoginSuccess | undefined = getLoginData();
  const token = loginData?.accessToken || getToken();
  const formattedLastLogin = formatDateTime(loginData?.lastLoginAt);

  useEffect(() => {
    const firstGroup = loginData?.groups?.[0];
    if (firstGroup) {
      saveGroupId(firstGroup);
    }
  }, [loginData?.groups]);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Login required",
        description: "Please sign in to view your account.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    }
  }, [navigate, toast, token]);

  const handleLogout = () => {
    clearToken();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header movieCount={0} onLogout={handleLogout} showLogout />
      <main className="container mx-auto px-4 py-10">
        <div className="bg-movie-surface/60 border border-border/60 rounded-lg shadow-xl p-6 sm:p-8 space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Account Details</h2>
            <p className="text-sm text-muted-foreground">Your session information.</p>
          </div>

          {token ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem label="ID" value={loginData?.id ?? "—"} />
                <InfoItem label="Username" value={loginData?.username ?? "—"} />
                <InfoItem label="Email" value={loginData?.email ?? "—"} />
                <InfoItem label="Name" value={loginData?.name || "—"} />
                <InfoItem label="Active Group" value={getGroupId() || "—"} />
                <InfoItem
                  label="Avatar URL"
                  value={loginData?.avatarUrl || "—"}
                  isMono
                />
                <InfoItem
                  label="Last Login At"
                  value={formattedLastLogin || "—"}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Groups</p>
                {loginData?.groups?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {loginData.groups.map((group) => (
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
              No token found. Redirecting to login...
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
            <Button
              onClick={handleLogout}
              className="w-full sm:w-auto bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
            >
              Logout
            </Button>
          </div>
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

