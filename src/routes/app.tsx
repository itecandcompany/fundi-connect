import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SERVICE_META, type ServiceKey } from "@/lib/geo";
import { LogOut, MapPin } from "lucide-react";
import LiveMap from "@/components/LiveMap";

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

  if (!isFundi) {
    return (
      <div className="h-[100svh] flex flex-col bg-background">
        <header className="bg-background/90 backdrop-blur border-b z-20">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-display font-bold leading-tight">FundiFast</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Live in Dar es Salaam</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-3 pb-3 flex gap-2 overflow-x-auto">
            {(Object.keys(SERVICE_META) as ServiceKey[]).map((k) => {
              const s = SERVICE_META[k];
              const active = service === k;
              return (
                <button
                  key={k}
                  onClick={() => setService(k)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary"}`}
                >
                  <span className="mr-1">{s.icon}</span>{s.label}
                </button>
              );
            })}
          </div>
        </header>
        <div className="flex-1 relative">
          <LiveMap service={service} />
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
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-6">
            <h2 className="font-semibold mb-2">Fundi Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Complete your technician profile and toggle availability to start receiving job requests. The full live-tracking dashboard is coming next.
            </p>
            <Link to="/" className="inline-block mt-4"><Button variant="outline">View profile setup</Button></Link>
        </Card>
      </main>
    </div>
  );
}
