import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Zap, Wrench, Hammer, Cog, ShieldCheck, Bell, Clock3, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    { icon: Wrench, label: "Plumber", eta: "8 min away" },
    { icon: Zap, label: "Electrician", eta: "12 min away" },
    { icon: Hammer, label: "Carpenter", eta: "15 min away" },
    { icon: Cog, label: "Mechanic", eta: "9 min away" },
  ];

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <header className="sticky top-0 z-20 border-b bg-background/90 px-4 pb-4 pt-5 backdrop-blur supports-[padding:max(0px)]:pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-sm font-bold text-primary-foreground shadow-elegant">
                F
              </div>
              <div>
                <p className="font-display text-lg font-bold">FundiFast</p>
                <p className="text-xs text-muted-foreground">Dar es Salaam</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 space-y-5 px-4 py-4 pb-28">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-hero p-5 text-primary-foreground shadow-elegant">
            <Badge className="mb-4 border-0 bg-background/15 text-primary-foreground hover:bg-background/15">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Trusted nearby fundis
            </Badge>
            <h1 className="max-w-xs text-3xl font-bold leading-tight">Book a fundi like you book a ride.</h1>
            <p className="mt-3 max-w-sm text-sm text-primary-foreground/85">
              Fast requests, live tracking, upfront pricing, and real people ready to help now.
            </p>
            <div className="mt-5 flex gap-3">
              <Link to="/auth" search={{ role: "client" }}>
                <Button size="lg" variant="secondary" className="h-12 rounded-2xl px-5">
                  Request now
                </Button>
              </Link>
              <Link to="/auth" search={{ role: "fundi" }}>
                <Button size="lg" variant="ghost" className="h-12 rounded-2xl border border-primary-foreground/20 bg-background/10 px-5 text-primary-foreground hover:bg-background/15">
                  Drive jobs
                </Button>
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {quickActions.map((item) => (
              <Link key={item.label} to="/auth" search={{ role: "client" }}>
                <Card className="rounded-3xl border-0 bg-card p-4 shadow-card transition-smooth active:scale-[0.98]">
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.eta}</p>
                </Card>
              </Link>
            ))}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live around you</h2>
              <span className="text-xs text-muted-foreground">4 active</span>
            </div>
            <Card className="overflow-hidden rounded-[1.75rem] border-0 p-0 shadow-card">
              <div className="bg-secondary px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" /> Upanga, Dar es Salaam
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock3 className="h-4 w-4" /> 5–15 min
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-4">
                {["Plumber near Kariakoo", "Electrician in Oysterbay", "Mechanic in Kinondoni"].map((label) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">Verified • ETA updates live</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/auth" search={{ role: "client" }}>
              <Button className="h-13 w-full rounded-2xl bg-gradient-primary text-base shadow-elegant">
                Book a fundi
              </Button>
            </Link>
            <Link to="/auth" search={{ role: "fundi" }}>
              <Button variant="outline" className="h-13 w-full rounded-2xl text-base">
                Become a fundi
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
