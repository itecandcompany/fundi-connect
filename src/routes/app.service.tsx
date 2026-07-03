import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { SERVICE_META, formatTsh, type ServiceKey } from "@/lib/geo";
import { saveFlow, loadFlow } from "@/lib/bookingFlow";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut, Shield, ArrowRight } from "lucide-react";
import FlowStepper from "@/components/FlowStepper";

export const Route = createFileRoute("/app/service")({
  ssr: false,
  component: ServicePicker,
});

function ServicePicker() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const current = loadFlow().service;

  const pick = (key: ServiceKey) => {
    saveFlow({ service: key });
    navigate({ to: "/app/describe" });
  };

  return (
    <div className="min-h-[100svh] bg-background flex flex-col">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display font-bold leading-tight truncate">FundiFast</div>
            <div className="text-xs text-muted-foreground">Let's find you a fundi</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {profile?.role === "admin" && (
              <Button asChild variant="ghost" size="icon">
                <Link to="/admin"><Shield className="h-4 w-4" /></Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <FlowStepper step={1} />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">What do you need help with?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a category — you'll describe the problem in the next step.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {(Object.keys(SERVICE_META) as ServiceKey[]).map((k) => {
            const s = SERVICE_META[k];
            const active = current === k;
            return (
              <button
                key={k}
                onClick={() => pick(k)}
                className={`group rounded-2xl border p-4 text-left transition-all hover:border-primary hover:shadow-card active:scale-[0.98] ${
                  active ? "border-primary bg-primary/5 shadow-card" : "border-border bg-card"
                }`}
              >
                <div
                  className="h-14 w-14 rounded-2xl grid place-items-center text-3xl mb-3 transition-transform group-hover:scale-105"
                  style={{ background: s.color + "22", color: s.color }}
                >
                  {s.icon}
                </div>
                <div className="font-semibold text-base">{s.label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  from {formatTsh(s.price)}
                </div>
                <div className="mt-3 inline-flex items-center text-xs text-primary font-medium">
                  Continue <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-muted-foreground text-center">
          Fundis nearby will send you quotes. You pick the one you like.
        </p>
      </main>
    </div>
  );
}