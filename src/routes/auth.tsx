import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

const signupSchema = signinSchema.extend({
  full_name: z.string().min(2).max(80),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

function AuthPage() {
  const { role } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot") {
      const parsed = forgotSchema.safeParse({ email: form.email });
      if (!parsed.success) return toast.error(parsed.error.issues[0].message);
      setBusy(true);
      try {
        // Supabase doesn't error here even if the email doesn't have an
        // account attached to it - that's intentional (prevents leaking
        // which emails are registered). Always show the same message.
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
      } finally {
        setBusy(false);
      }
      return;
    }

    const parsed = mode === "signup" ? signupSchema.safeParse(form) : signinSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: form.full_name, role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is required on this project: the account
          // was created, but there's no active session yet. Sending
          // them to /app here would just bounce them straight back to
          // /auth with no explanation, since the route guard checks for
          // a logged-in user. Tell them what's actually happening instead.
          toast.success("Account created! Check your email to confirm before signing in.");
          setMode("signin");
          return;
        }
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
      let msg = err instanceof Error ? err.message : "Auth failed";
      // A bare "Failed to fetch" means the browser couldn't reach Supabase
      // at all — either no network connectivity, or SUPABASE_URL isn't
      // configured correctly. Give people something actionable instead of
      // the raw browser error text.
      if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
        msg =
          "Couldn't reach the server. Check your internet connection, or that this app's Supabase credentials are configured correctly (see .env.example).";
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold mt-3">
          {mode === "signup"
            ? "Join FundiFast"
            : mode === "forgot"
              ? "Reset your password"
              : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signup"
            ? `Sign up as ${role === "fundi" ? "a Fundi (technician)" : "a Client"}.`
            : mode === "forgot"
              ? "Enter your email and we'll send you a link to reset your password."
              : "Sign in to continue."}
        </p>

        {mode === "forgot" && resetSent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{form.email}</span>, we've sent a link
              to reset your password. Check your inbox (and spam folder).
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMode("signin");
                setResetSent(false);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <Label htmlFor="pw">Password</Label>
                <PasswordInput
                  id="pw"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-muted-foreground hover:text-foreground -mt-2 block"
              >
                Forgot password?
              </button>
            )}
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
              {busy
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
            </Button>
          </form>
        )}

        {!(mode === "forgot" && resetSent) && (
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-5 text-sm text-muted-foreground hover:text-foreground block w-full text-center"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : mode === "forgot"
                ? "Remembered it? Sign in"
                : "New here? Create an account"}
          </button>
        )}
      </Card>
    </div>
  );
}
