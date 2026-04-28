import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SERVICE_META, formatTsh } from "@/lib/geo";
import { Wrench, Zap, Hammer, Cog, LogOut, MapPin } from "lucide-react";

export const Route = createFileRoute("/app")({ component: AppHome });

const ICONS = { plumber: Wrench, electrician: Zap, carpenter: Hammer, mechanic: Cog };

function AppHome() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  const isFundi = profile.role === "fundi";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-display font-bold">FundiFast</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hi, {profile.full_name.split(" ")[0]}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-gradient-hero text-primary-foreground rounded-3xl p-6 shadow-elegant">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <MapPin className="h-4 w-4" /> Dar es Salaam
          </div>
          <h1 className="text-2xl font-bold mt-2">
            {isFundi ? "Ready to take jobs?" : "What do you need today?"}
          </h1>
          <p className="opacity-90 text-sm mt-1">
            {isFundi
              ? "Toggle availability to start receiving nearby requests."
              : "Tap a service to request a nearby fundi."}
          </p>
        </div>

        {!isFundi && (
          <div>
            <h2 className="font-semibold mb-3">Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(SERVICE_META) as Array<keyof typeof SERVICE_META>).map((k) => {
                const Icon = ICONS[k];
                const s = SERVICE_META[k];
                return (
                  <Card key={k} className="p-5 hover:shadow-elegant transition-smooth cursor-pointer border-2 hover:border-primary">
                    <Icon className="h-8 w-8 text-primary mb-3" />
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">from {formatTsh(s.price)}</div>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Live map & request flow coming next — database and auth are ready.
            </p>
          </div>
        )}

        {isFundi && (
          <Card className="p-6">
            <h2 className="font-semibold mb-2">Fundi Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Complete your technician profile and toggle availability to start receiving job requests. The full live-tracking dashboard is coming next.
            </p>
            <Link to="/" className="inline-block mt-4"><Button variant="outline">View profile setup</Button></Link>
          </Card>
        )}
      </main>
    </div>
  );
}
