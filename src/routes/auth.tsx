import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Loader2, User, Wrench, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: (s.role === "fundi" ? "fundi" : "client") as "client" | "fundi",
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(2).max(80).optional(),
});

function AuthPage() {
  const { role: initialRole } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"client" | "fundi">(initialRole);
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: form.full_name, role },
          },
        });
        if (error) throw error;
        toast.success("Welcome to FundiFast!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Auth failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100svh] bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-elegant">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {/* Mode tabs */}
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`h-9 rounded-lg transition-colors ${
              mode === "signup" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`h-9 rounded-lg transition-colors ${
              mode === "signin" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Sign in
          </button>
        </div>

        <h1 className="text-2xl font-display font-bold mt-5">
          {mode === "signup" ? "Join FundiFast" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signup"
            ? "Trusted fundis, live tracking, fair prices."
            : "Sign in to continue."}
        </p>

        {mode === "signup" && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { key: "client", label: "I need a fundi", icon: <User className="h-5 w-5" /> },
              { key: "fundi", label: "I am a fundi", icon: <Wrench className="h-5 w-5" /> },
            ].map((r) => {
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key as "client" | "fundi")}
                  className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className={`h-9 w-9 rounded-lg grid place-items-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {r.icon}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{r.label}</div>
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 mt-5">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" className="h-11 mt-1" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" className="h-11 mt-1" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" className="h-11 mt-1" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            {mode === "signup" && (
              <p className="text-[11px] text-muted-foreground mt-1">At least 6 characters.</p>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full h-12 bg-gradient-primary text-base">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
