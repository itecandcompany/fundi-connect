import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, Settings } from "lucide-react";
import FundiLivePanel from "@/components/FundiLivePanel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [fundiChecked, setFundiChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { role: "client" } });
  }, [user, loading, navigate]);

  // For fundis: if no fundis row exists, push to setup
  useEffect(() => {
    if (loading || !user || !profile || profile.role !== "fundi") return;
    supabase
      .from("fundis")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFundiChecked(true);
        if (!data) navigate({ to: "/fundi/setup" });
      });
  }, [user?.id, profile?.role, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const isFundi = profile.role === "fundi";
  const isAdmin = profile.role === "admin";

  if (isFundi) {
    if (!fundiChecked) {
      return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
    }
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="font-display font-bold">FundiFast</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Hi, {profile.full_name.split(" ")[0]}</span>
              <Button asChild variant="ghost" size="icon" title="Edit service / rate">
                <Link to="/fundi/setup"><Settings className="h-4 w-4" /></Link>
              </Button>
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
