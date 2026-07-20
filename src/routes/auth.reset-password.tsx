import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
});

const passwordSchema = z
  .object({
    password: z.string().min(6).max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

// The emailed reset link redirects here with a recovery token in the URL.
// supabase-js (via detectSessionInUrl, on by default) parses that
// automatically and fires a PASSWORD_RECOVERY auth event once it's
// established a session from it - we just need to wait for that.
type LinkState = "verifying" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>("verifying");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setLinkState("ready");
      }
    });

    // Cover the case where the recovery session was already established
    // (and the event already fired) before this listener was attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!settled && session) {
        settled = true;
        setLinkState("ready");
      }
    });

    // If neither fires within a few seconds, the link is missing, expired,
    // or already used - tell the person plainly instead of hanging on a
    // spinner forever.
    const timeout = setTimeout(() => {
      if (!settled) setLinkState("invalid");
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
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
        <h1 className="text-2xl font-bold mt-3">Set a new password</h1>

        {linkState === "verifying" && (
          <p className="text-sm text-muted-foreground mt-6">Verifying your reset link…</p>
        )}

        {linkState === "invalid" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Reset links are only valid for a limited
              time and can only be used once.
            </p>
            <Button asChild className="w-full bg-gradient-primary">
              <Link to="/auth" search={{ role: "client" }}>
                Request a new link
              </Link>
            </Button>
          </div>
        )}

        {linkState === "ready" && (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <PasswordInput
                id="confirm"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
              {busy ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
