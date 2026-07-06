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

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: (s.role === "fundi" ? "fundi" : "client") as "client" | "fundi",
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().min(2).max(80),
});

function AuthPage() {
  const { role } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = mode === "signup" ? signUpSchema.safeParse(form) : signInSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
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
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold mt-3">
          {mode === "signup" ? "Join FundiFast" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup"
            ? `Sign up as ${role === "fundi" ? "a Fundi (technician)" : "a Client"}.`
            : "Sign in to continue."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-5 text-sm text-muted-foreground hover:text-foreground block w-full text-center"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </Card>
    </div>
  );
}
