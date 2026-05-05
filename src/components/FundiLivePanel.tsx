import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { SERVICE_META, ARRIVAL_RADIUS_M, haversineKm, type ServiceKey } from "@/lib/geo";
import { sendBrowserNotification, ensureNotificationPermission } from "@/lib/push";

type JobStatus =
  | "searching"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type Job = {
  id: string;
  client_id: string;
  fundi_id: string | null;
  service: ServiceKey;
  status: JobStatus;
  client_lat: number;
  client_lng: number;
  price: number;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
};

const NEXT: Partial<Record<JobStatus, { next: JobStatus; label: string }>> = {
  accepted: { next: "on_the_way", label: "Start driving" },
  on_the_way: { next: "arrived", label: "I've arrived" },
  arrived: { next: "in_progress", label: "Start job" },
  in_progress: { next: "completed", label: "Complete job" },
};

export default function FundiLivePanel() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [incoming, setIncoming] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const watchRef = useRef<number | null>(null);
  const activeRef = useRef<Job | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Ask for browser notification permission when fundi goes available
  useEffect(() => {
    if (available) ensureNotificationPermission();
  }, [available]);

  // Load fundi row + initial availability
  useEffect(() => {
    if (!user) return;
    supabase
      .from("fundis")
      .select("is_available")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvailable(!!data?.is_available));
  }, [user?.id]);

  // Watch GPS while available or while a job is active
  useEffect(() => {
    if (!available && !active) return;
    if (!("geolocation" in navigator)) {
      toast.error("GPS not available on this device");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (err) => console.warn("geo err", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [available, active?.id]);

  // Push fundi GPS to fundis table + job_locations every 8s
  useEffect(() => {
    if (!user || !pos) return;
    const push = () => {
      supabase
        .from("fundis")
        .update({ current_lat: pos[0], current_lng: pos[1], updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (active && active.status !== "completed" && active.status !== "cancelled") {
        supabase.from("job_locations").insert({
          job_id: active.id,
          user_id: user.id,
          lat: pos[0],
          lng: pos[1],
        });
        supabase
          .from("jobs")
          .update({ fundi_lat: pos[0], fundi_lng: pos[1] })
          .eq("id", active.id);
      }
    };
    push();
    const id = setInterval(push, 8000);
    return () => clearInterval(id);
  }, [pos?.[0], pos?.[1], user?.id, active?.id, active?.status]);

  // Load active job + subscribe
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("fundi_id", user.id)
        .in("status", ["accepted", "on_the_way", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setActive((data as Job) ?? null);
    };
    load();

    const channel = supabase
      .channel(`fundi-jobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `fundi_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Job | undefined;
          if (!row) return;
          if (
            payload.eventType === "DELETE" ||
            row.status === "completed" ||
            row.status === "cancelled"
          ) {
            // Notify the fundi when the *client* cancels an active job
            if (
              row.status === "cancelled" &&
              row.cancelled_by &&
              row.cancelled_by !== user.id
            ) {
              const reason = row.cancellation_reason || "No reason provided";
              const when = row.cancelled_at
                ? new Date(row.cancelled_at).toLocaleTimeString()
                : new Date().toLocaleTimeString();
              toast.error(`Client cancelled the job · ${when}`, { description: reason });
              sendBrowserNotification("Job cancelled by client", `${reason} · ${when}`);
            }
            setActive((prev) => (prev?.id === row.id ? null : prev));
            return;
          }
          setActive(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Subscribe to incoming "searching" jobs for the fundi's service
  useEffect(() => {
    if (!user || !available || active) {
      setIncoming([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data: me } = await supabase
        .from("fundis")
        .select("service")
        .eq("id", user.id)
        .maybeSingle();
      if (!me || cancelled) return;
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "searching")
        .eq("service", me.service)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) setIncoming((data as Job[]) ?? []);
    };
    load();

    const channel = supabase
      .channel(`incoming-jobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: "status=eq.searching" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, available, active?.id]);

  const toggleAvailable = async (v: boolean) => {
    if (!user) return;
    setAvailable(v);
    await supabase.from("fundis").update({ is_available: v }).eq("id", user.id);
  };

  const acceptJob = async (j: Job) => {
    if (!user || !pos) {
      toast.error("Waiting for your GPS…");
      return;
    }
    const { error } = await supabase
      .from("jobs")
      .update({
        fundi_id: user.id,
        status: "accepted",
        fundi_lat: pos[0],
        fundi_lng: pos[1],
      })
      .eq("id", j.id)
      .eq("status", "searching");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Job accepted");
  };

  const advance = async () => {
    if (!active) return;
    const step = NEXT[active.status];
    if (!step) return;
    // Geofence: only allow marking "arrived" if within ARRIVAL_RADIUS_M of client
    if (step.next === "arrived") {
      if (!pos) {
        toast.error("Waiting for your GPS…");
        return;
      }
      const meters =
        haversineKm(
          { lat: pos[0], lng: pos[1] },
          { lat: active.client_lat, lng: active.client_lng },
        ) * 1000;
      if (meters > ARRIVAL_RADIUS_M) {
        toast.error(
          `You're ${Math.round(meters)}m away — get within ${ARRIVAL_RADIUS_M}m of the client to confirm arrival.`,
        );
        return;
      }
    }
    const patch: { status: JobStatus; completed_at?: string; arrived_at?: string } = {
      status: step.next,
    };
    if (step.next === "arrived") patch.arrived_at = new Date().toISOString();
    if (step.next === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("jobs").update(patch).eq("id", active.id);
    if (error) toast.error(error.message);
  };

  const cancelActive = async () => {
    if (!active) return;
    const reason = window.prompt("Why are you cancelling? (shared with the client)", "");
    if (reason === null) return; // user dismissed
    const trimmed = reason.trim() || "Cancelled by fundi";
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        cancellation_reason: trimmed,
        cancelled_at: nowIso,
        cancelled_by: user?.id ?? null,
      })
      .eq("id", active.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Clearing active stops the GPS publishing effect immediately
    setActive(null);
    toast.message("Job cancelled", { description: trimmed });
  };

  const rejectIncoming = async (id: string) => {
    setIncoming((prev) => prev.filter((j) => j.id !== id));
    const reason =
      window.prompt("Reason for rejecting? (shared with the client)", "Fundi unavailable") ?? "";
    const trimmed = reason.trim() || "Fundi unavailable";
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        cancellation_reason: trimmed,
        cancelled_at: nowIso,
        cancelled_by: user?.id ?? null,
      })
      .eq("id", id)
      .eq("status", "searching");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.message("Request rejected", { description: trimmed });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Availability</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {pos ? `${pos[0].toFixed(4)}, ${pos[1].toFixed(4)}` : "Locating…"}
          </div>
        </div>
        <Switch checked={available} onCheckedChange={toggleAvailable} />
      </Card>

      {active ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Active job</div>
              <div className="font-semibold">
                {SERVICE_META[active.service].icon} {SERVICE_META[active.service].label}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
              {active.status.replace("_", " ")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Client at {active.client_lat.toFixed(4)}, {active.client_lng.toFixed(4)}
            {pos && (
              <>
                {" · "}
                {Math.round(
                  haversineKm(
                    { lat: pos[0], lng: pos[1] },
                    { lat: active.client_lat, lng: active.client_lng },
                  ) * 1000,
                )}
                m away
              </>
            )}
          </div>
          <div className="flex gap-2">
            {NEXT[active.status] && (
              <Button className="flex-1" onClick={advance}>
                {NEXT[active.status]!.label}
              </Button>
            )}
            {active.status !== "in_progress" && (
              <Button variant="outline" onClick={cancelActive}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </Card>
      ) : available ? (
        <Card className="p-4">
          <div className="font-semibold mb-2">Incoming requests</div>
          {incoming.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for jobs nearby…
            </div>
          ) : (
            <div className="space-y-2">
              {incoming.map((j) => (
                <div key={j.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">
                      {SERVICE_META[j.service].icon} {SERVICE_META[j.service].label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {j.client_lat.toFixed(3)}, {j.client_lng.toFixed(3)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => rejectIncoming(j.id)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => acceptJob(j)}>
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">
          Turn on availability to start receiving job requests.
        </Card>
      )}
    </div>
  );
}