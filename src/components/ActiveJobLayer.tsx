import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { fetchRoute, SERVICE_META, type RouteResult, type ServiceKey } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Phone, Navigation2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type JobStatus =
  "searching" | "accepted" | "on_the_way" | "arrived" | "in_progress" | "completed" | "cancelled";

export type ActiveJob = {
  id: string;
  client_id: string;
  fundi_id: string | null;
  service: ServiceKey;
  status: JobStatus;
  client_lat: number;
  client_lng: number;
  fundi_lat: number | null;
  fundi_lng: number | null;
  price: number;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  searching: "Searching for fundi…",
  accepted: "Fundi accepted — preparing",
  on_the_way: "Fundi is on the way",
  arrived: "Fundi has arrived",
  in_progress: "Job in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function fundiPin(color: string, icon: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;border:2px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 6px 16px rgba(0,0,0,.35)">${icon}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function FitBoundsOnce({
  a,
  b,
  trigger,
}: {
  a: [number, number];
  b: [number, number];
  trigger: string;
}) {
  const map = useMap();
  const last = useRef<string>("");
  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    map.fitBounds([a, b], { padding: [60, 60], maxZoom: 16 });
  }, [trigger, a, b, map]);
  return null;
}

export default function ActiveJobLayer({
  job,
  userPos,
  fundiName,
  fundiPhone,
  reverseTrack,
  onReverseTrackChange,
  onClose,
}: {
  job: ActiveJob;
  userPos: [number, number];
  fundiName: string;
  fundiPhone: string | null;
  reverseTrack: boolean;
  onReverseTrackChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const meta = SERVICE_META[job.service];

  const fundiPos: [number, number] | null =
    job.fundi_lat != null && job.fundi_lng != null ? [job.fundi_lat, job.fundi_lng] : null;

  // When reverseTrack is enabled, route from user → fundi (client going to fundi).
  // Otherwise route from fundi → client (default — fundi coming to client).
  useEffect(() => {
    if (!fundiPos) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const from = reverseTrack
      ? { lat: userPos[0], lng: userPos[1] }
      : { lat: fundiPos[0], lng: fundiPos[1] };
    const to = reverseTrack
      ? { lat: fundiPos[0], lng: fundiPos[1] }
      : { lat: userPos[0], lng: userPos[1] };
    fetchRoute(from, to, ctrl.signal).then((r) => {
      if (!cancelled && r) setRoute(r);
    });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // recompute when either endpoint moves meaningfully or direction toggles
  }, [
    reverseTrack,
    fundiPos?.[0]?.toFixed(4),
    fundiPos?.[1]?.toFixed(4),
    userPos[0].toFixed(4),
    userPos[1].toFixed(4),
  ]);

  // Auto-clear reverse track when pickup completed
  useEffect(() => {
    if (reverseTrack && (job.status === "in_progress" || job.status === "completed")) {
      onReverseTrackChange(false);
      toast.success("Pickup complete");
    }
  }, [job.status, reverseTrack, onReverseTrackChange]);

  const cancel = async () => {
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
    onClose();
  };

  const showRoute =
    fundiPos &&
    job.status !== "completed" &&
    job.status !== "cancelled" &&
    job.status !== "in_progress";

  const distanceTxt = route ? `${route.km.toFixed(1)} km` : "…";
  const etaTxt = route ? `${route.minutes} min` : "…";

  return (
    <>
      {fundiPos && (
        <Marker position={fundiPos} icon={fundiPin(meta.color, meta.icon)}>
          <Popup>{fundiName}</Popup>
        </Marker>
      )}
      {showRoute && fundiPos && route && (
        <Polyline
          positions={route.coords}
          pathOptions={{ color: meta.color, weight: 5, opacity: 0.85 }}
        />
      )}
      {fundiPos && (
        <FitBoundsOnce
          a={userPos}
          b={fundiPos}
          trigger={`${job.id}-${job.status}-${reverseTrack ? "rev" : "fwd"}`}
        />
      )}

      {/* Status panel */}
      <div className="absolute top-16 left-3 right-3 z-[1000] pointer-events-none">
        <div className="bg-background/95 backdrop-blur rounded-2xl shadow-elegant p-3 border pointer-events-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full grid place-items-center text-lg shrink-0"
              style={{ background: meta.color, color: "white" }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight truncate">{fundiName}</div>
              <div className="text-xs text-muted-foreground">{STATUS_LABEL[job.status]}</div>
            </div>
            {job.status === "completed" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <Button size="icon" variant="ghost" onClick={cancel} aria-label="Cancel">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {fundiPos && job.status !== "completed" && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-lg p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Distance</div>
                <div className="text-sm font-semibold">{distanceTxt}</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="text-[10px] text-muted-foreground uppercase">ETA</div>
                <div className="text-sm font-semibold">{etaTxt}</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="text-[10px] text-muted-foreground uppercase">Mode</div>
                <div className="text-sm font-semibold">{reverseTrack ? "You go" : "Fundi"}</div>
              </div>
            </div>
          )}
          {fundiPos && (job.status === "accepted" || job.status === "on_the_way") && (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant={reverseTrack ? "default" : "outline"}
                className="flex-1"
                onClick={() => onReverseTrackChange(!reverseTrack)}
              >
                <Navigation2 className="h-4 w-4" />
                {reverseTrack ? "Following fundi" : "I'll go to fundi"}
              </Button>
              {fundiPhone && (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${fundiPhone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          )}
          {job.status === "completed" && (
            <Button className="w-full mt-2" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
