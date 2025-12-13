import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  clearToken,
  getToken,
  login,
  saveLoginData,
} from "@/services/authService";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      navigate("/account", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const errorMessage = searchParams.get("error");
    if (errorMessage) {
      toast({
        title: "Login required",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usernameOrEmail.trim()) {
      toast({
        title: "Username or email is required",
        variant: "destructive",
      });
      return;
    }
    if (!password) {
      toast({
        title: "Password is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const isEmail = usernameOrEmail.includes("@");
      const data = await login({
        username: isEmail ? undefined : usernameOrEmail.trim(),
        email: isEmail ? usernameOrEmail.trim() : undefined,
        password,
      });
      saveLoginData(data);
      const firstGroup = data.groups?.[0];
      if (firstGroup) {
        toast({
          title: "Login successful",
          description: "Redirecting to your watchlist",
        });
        navigate("/watchlist", { replace: true });
      } else {
        toast({
          title: "No groups found",
          description: "Please select or create a group",
        });
        navigate("/groups", { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
      clearToken();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />
      <main className="container mx-auto px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="bg-movie-surface/60 border border-border/60 rounded-lg shadow-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground">
                Use your username or email to sign in.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Username or Email
                </label>
                <Input
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="yourname or you@example.com"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={submitting}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;

