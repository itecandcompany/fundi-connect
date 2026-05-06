import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { type ServiceKey } from "@/lib/geo";
import { LogOut, Shield } from "lucide-react";
import LiveMap from "@/components/LiveMap";
import FundiLivePanel from "@/components/FundiLivePanel";

export const Route = createFileRoute("/app")({ component: AppHome });

function AppHome() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceKey>("plumber");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { role: "client" } });
  }, [user, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const isFundi = profile.role === "fundi";
  const isAdmin = profile.role === "admin";

  if (!isFundi) {
    return (
      <div className="h-[100svh] flex flex-col bg-background">
        <header className="bg-background/90 backdrop-blur border-b z-20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-display font-bold leading-tight">FundiFast</div>
              <div className="text-xs text-muted-foreground">Live in Dar es Salaam</div>
            </div>
            <div className="flex items-center gap-1">
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
        <div className="flex-1 relative">
          <LiveMap service={service} setService={setService} />
        </div>
      </div>
    );
  }

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
