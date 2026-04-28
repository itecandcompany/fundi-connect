import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MapPin, Zap, Wrench, Hammer, Cog, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="bg-gradient-primary w-8 h-8 rounded-lg grid place-items-center text-primary-foreground">F</span>
          FundiFast
        </div>
        <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-8 pb-24 md:pt-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-3 py-1 text-xs font-medium text-secondary-foreground mb-5">
            <MapPin className="h-3.5 w-3.5" /> Real-time. Nearby. Trusted.
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Hire a <span className="text-primary">fundi</span> in minutes.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-lg">
            FundiFast connects you to verified plumbers, electricians, carpenters and mechanics across Tanzania — with live tracking, fixed prices, and fair commissions.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth" search={{ role: "client" }}>
              <Button size="lg" className="bg-gradient-primary shadow-elegant">Request a fundi</Button>
            </Link>
            <Link to="/auth" search={{ role: "fundi" }}>
              <Button size="lg" variant="outline">Become a fundi</Button>
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Verified fundis</div>
            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> Live tracking</div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-primary rounded-3xl opacity-20 blur-3xl" />
          <div className="relative bg-card rounded-3xl p-6 shadow-elegant border grid grid-cols-2 gap-4">
            {[
              { icon: Wrench, label: "Plumber", price: "25,000 TSh" },
              { icon: Zap, label: "Electrician", price: "30,000 TSh" },
              { icon: Hammer, label: "Carpenter", price: "20,000 TSh" },
              { icon: Cog, label: "Mechanic", price: "35,000 TSh" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/50 rounded-2xl p-4 transition-smooth hover:shadow-card">
                <s.icon className="h-6 w-6 text-primary mb-3" />
                <div className="font-semibold">{s.label}</div>
                <div className="text-xs text-muted-foreground">from {s.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
