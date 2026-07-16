import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { loadFlow } from "@/lib/bookingFlow";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/")({
  ssr: false,
  component: AppIndex,
});

function AppIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      // If there's already an active job, go straight to find/tracking
      const { data: active } = await supabase
        .from("jobs")
        .select("id")
        .eq("client_id", user.id)
        .in("status", ["searching", "quoting", "accepted", "on_the_way", "arrived", "in_progress"])
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (active) {
        navigate({ to: "/app/find", replace: true });
        return;
      }
      const flow = loadFlow();
      if (!flow.service) navigate({ to: "/app/service", replace: true });
      else if (!flow.problemTitle.trim()) navigate({ to: "/app/describe", replace: true });
      else navigate({ to: "/app/find", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
