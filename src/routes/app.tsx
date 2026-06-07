import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield } from "lucide-react";
import FundiLivePanel from "@/components/FundiLivePanel";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { role: "client" } });
  }, [user, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const isFundi = profile.role === "fundi";
  const isAdmin = profile.role === "admin";

  if (isFundi) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-display font-bold">FundiFast</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hi, {profile.full_name.split(" ")[0]}</span>
              {isAdmin && (
                <Button asChild variant="ghost" size="icon">
                  <Link to="/admin"><Shield className="h-4 w-4" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <FundiLivePanel />
        </main>
      </div>
    );
  }

  return <Outlet />;
}
