import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getToken,
  createUser,
  login,
  saveLoginData,
  clearToken,
  saveGroupId,
} from "@/services/authService";

const SignUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      navigate("/account", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validation: either username or email must not be empty
    if (!username.trim() && !email.trim()) {
      toast({
        title: "Validation error",
        description: "Either username or email must be provided",
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
      await createUser({
        name: name.trim() || undefined,
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        password,
      });
      
      // Automatically log in after successful registration
      const loginData = await login({
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        password,
      });
      
      saveLoginData(loginData);
      const firstGroup = loginData.groups?.[0];
      
      if (firstGroup) {
        // Auto-select the first group
        saveGroupId(firstGroup);
        toast({
          title: "Account created successfully",
          description: "Redirecting to your watchlist",
        });
      } else {
        toast({
          title: "Account created successfully",
          description: "Redirecting to your watchlist",
        });
      }
      // Always navigate to watchlist (it will show no-groups message if needed)
      navigate("/watchlist", { replace: true });
    } catch (error) {
      let errorMessage = "Error creating user";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
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
              <h2 className="text-2xl font-bold text-foreground">Create an account</h2>
              <p className="text-sm text-muted-foreground">
                Sign up to start managing your watchlist.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">
                  Name (optional)
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-foreground">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourusername"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
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
                {submitting ? "Creating account..." : "Sign up"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
                disabled={submitting}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignUp;
