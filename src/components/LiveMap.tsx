import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DEFAULT_CENTER, SERVICE_META, haversineKm, etaMinutes, formatTsh, type ServiceKey } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Star, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ActiveJobLayer, { type ActiveJob } from "./ActiveJobLayer";
import { sendBrowserNotification, ensureNotificationPermission } from "@/lib/push";

type FundiRow = {
  id: string;
  service: ServiceKey;
  hourly_rate: number;
  bio: string | null;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  total_jobs: number;
};

type FundiWithProfile = FundiRow & { full_name: string; phone: string | null };

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;border:2px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,.25)">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function userIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative"><div style="position:absolute;inset:-12px;background:#3b82f6;opacity:.25;border-radius:50%;animation:pulse 2s infinite"></div><div style="background:#2563eb;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,.3);position:relative"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function Recenter({ center, follow }: { center: [number, number]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow) map.setView(center, map.getZoom());
  }, [center, follow, map]);
  return null;
}

function CenterOn({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, map.getZoom());
  }, [pos?.[0], pos?.[1], map]);
  return null;
}

export default function LiveMap({ service }: { service: ServiceKey }) {
  const { user } = useAuth();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [follow, setFollow] = useState(true);
  const [fundis, setFundis] = useState<Record<string, FundiWithProfile>>({});
  const [selected, setSelected] = useState<FundiWithProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const watchRef = useRef<number | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [reverseTrack, setReverseTrack] = useState(false);

  // Request permission for cancellation/status notifications
  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  // 1. Watch user GPS
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      toast.error("GPS not available; using Dar es Salaam");
      setPos([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]);
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (err) => {
        console.warn("geo error", err);
        toast.error("Couldn't get your location — using default");
        setPos([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // Stream client GPS into job_locations while a job is active
  useEffect(() => {
    if (!activeJob || !user || !pos) return;
    if (activeJob.status === "completed" || activeJob.status === "cancelled") return;
    const id = setInterval(() => {
      supabase.from("job_locations").insert({
        job_id: activeJob.id,
        user_id: user.id,
        lat: pos[0],
        lng: pos[1],
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [activeJob?.id, activeJob?.status, user?.id, pos?.[0], pos?.[1]]);

  // 2. Initial fundi fetch + realtime subscription
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      const { data: rows } = await supabase
        .from("fundis")
        .select("*")
        .eq("service", service)
        .eq("is_available", true)
        .not("current_lat", "is", null)
        .not("current_lng", "is", null);

      if (!rows || cancelled) return;
      const ids = rows.map((r) => r.id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      const next: Record<string, FundiWithProfile> = {};
      for (const r of rows) {
        const p = profMap.get(r.id);
        next[r.id] = {
          ...(r as FundiRow),
          full_name: p?.full_name ?? "Fundi",
          phone: p?.phone ?? null,
        };
      }
      if (!cancelled) setFundis(next);
    };

    fetchAll();

    const channel = supabase
      .channel(`fundis-live-${service}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fundis", filter: `service=eq.${service}` },
        async (payload) => {
          const row = (payload.new ?? payload.old) as FundiRow | undefined;
          if (!row) return;
          if (payload.eventType === "DELETE") {
            setFundis((prev) => {
              const cp = { ...prev };
              delete cp[row.id];
              return cp;
            });
            return;
          }
          const visible =
            row.is_available && row.current_lat != null && row.current_lng != null;
          if (!visible) {
            setFundis((prev) => {
              const cp = { ...prev };
              delete cp[row.id];
              return cp;
            });
            return;
          }
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .eq("id", row.id)
            .maybeSingle();
          setFundis((prev) => ({
            ...prev,
            [row.id]: {
              ...(row as FundiRow),
              full_name: prof?.full_name ?? "Fundi",
              phone: prof?.phone ?? null,
            },
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [service]);

  // Subscribe to the user's active job + status changes in realtime
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadActive = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("client_id", user.id)
        .in("status", ["searching", "accepted", "on_the_way", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setActiveJob((data as ActiveJob) ?? null);
    };
    loadActive();

    const channel = supabase
      .channel(`client-jobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `client_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as ActiveJob | undefined;
          if (!row) return;
          if (payload.eventType === "DELETE") {
            setActiveJob((prev) => (prev?.id === row.id ? null : prev));
            return;
          }
          const prevStatus = activeJobRef.current?.status;
          if (row.status === "completed" || row.status === "cancelled") {
            setActiveJob(row);
            if (row.status === "completed") toast.success("Job completed 🎉");
            if (row.status === "cancelled") {
              const r = (row as ActiveJob & { cancellation_reason?: string | null; cancelled_by?: string | null; cancelled_at?: string | null });
              const byOther = r.cancelled_by && r.cancelled_by !== user.id;
              const reason = r.cancellation_reason || "No reason provided";
              const when = r.cancelled_at
                ? new Date(r.cancelled_at).toLocaleTimeString()
                : new Date().toLocaleTimeString();
              if (byOther) {
                toast.error(`Fundi cancelled the job · ${when}`, { description: reason });
                sendBrowserNotification("Job cancelled by fundi", `${reason} · ${when}`);
              } else {
                toast.message(`Job cancelled · ${when}`, { description: reason });
              }
            }
            return;
          }
          setActiveJob(row);
          if (prevStatus && prevStatus !== row.status) {
            const map: Record<string, string> = {
              accepted: "Fundi accepted your request",
              on_the_way: "Fundi is on the way",
              arrived: "Fundi has arrived",
              in_progress: "Job started",
            };
            if (map[row.status]) toast.message(map[row.status]);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Subscribe to live fundi GPS stream from job_locations for the active job
  useEffect(() => {
    if (!activeJob || !activeJob.fundi_id) return;
    const jobId = activeJob.id;
    const fundiId = activeJob.fundi_id;
    let cancelled = false;

    // Seed with the most recent fundi location for this job
    supabase
      .from("job_locations")
      .select("lat, lng, created_at")
      .eq("job_id", jobId)
      .eq("user_id", fundiId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setActiveJob((prev) =>
          prev && prev.id === jobId ? { ...prev, fundi_lat: data.lat, fundi_lng: data.lng } : prev,
        );
      });

    const channel = supabase
      .channel(`job-loc-${jobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_locations", filter: `job_id=eq.${jobId}` },
        (payload) => {
          const row = payload.new as { user_id: string; lat: number; lng: number };
          if (row.user_id !== fundiId) return;
          setActiveJob((prev) =>
            prev && prev.id === jobId ? { ...prev, fundi_lat: row.lat, fundi_lng: row.lng } : prev,
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id, activeJob?.fundi_id]);

  // keep ref in sync for status transition detection
  const activeJobRef = useRef<ActiveJob | null>(null);
  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

  // Look up fundi profile for active job
  const [activeFundi, setActiveFundi] = useState<{ name: string; phone: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (!activeJob?.fundi_id) {
      setActiveFundi(null);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", activeJob.fundi_id)
      .maybeSingle()
      .then(({ data }) =>
        setActiveFundi({ name: data?.full_name ?? "Fundi", phone: data?.phone ?? null }),
      );
  }, [activeJob?.fundi_id]);

  const meta = SERVICE_META[service];
  const list = useMemo(() => {
    const arr = Object.values(fundis);
    if (!pos) return arr.map((f) => ({ f, km: 0 }));
    return arr
      .map((f) => ({
        f,
        km: haversineKm({ lat: pos[0], lng: pos[1] }, { lat: f.current_lat!, lng: f.current_lng! }),
      }))
      .sort((a, b) => a.km - b.km);
  }, [fundis, pos]);

  const requestFundi = async () => {
    if (!selected || !user || !pos) return;
    setSubmitting(true);
    const price = SERVICE_META[service].price;
    const commission = Math.round(price * 0.15);
    const { error } = await supabase.from("jobs").insert({
      client_id: user.id,
      fundi_id: selected.id,
      service,
      price,
      commission,
      status: "searching",
      client_lat: pos[0],
      client_lng: pos[1],
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Request sent to ${selected.full_name}`);
    setSelected(null);
  };

  if (!pos) {
    return (
      <div className="h-full grid place-items-center text-muted-foreground">
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Locating you…</div>
      </div>
    );
  }

  // While reverse-tracking, the map should follow the FUNDI marker, not the user.
  const fundiPos: [number, number] | null =
    activeJob && activeJob.fundi_lat != null && activeJob.fundi_lng != null
      ? [activeJob.fundi_lat, activeJob.fundi_lng]
      : null;

  const hasActive = !!activeJob;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={pos}
        zoom={15}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#0b1220" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!hasActive && <Recenter center={pos} follow={follow} />}
        {hasActive && reverseTrack && fundiPos && <CenterOn pos={fundiPos} />}

        <Marker position={pos} icon={userIcon()}>
          <Popup>You are here</Popup>
        </Marker>

        {!hasActive && list.map(({ f }) => (
          <Marker
            key={f.id}
            position={[f.current_lat!, f.current_lng!]}
            icon={pinIcon(meta.color, meta.icon)}
            eventHandlers={{ click: () => { setFollow(false); setSelected(f); } }}
          />
        ))}

        {activeJob && (
          <ActiveJobLayer
            job={activeJob}
            userPos={pos}
            fundiName={activeFundi?.name ?? "Fundi"}
            fundiPhone={activeFundi?.phone ?? null}
            reverseTrack={reverseTrack}
            onReverseTrackChange={setReverseTrack}
            onClose={() => {
              setActiveJob(null);
              setReverseTrack(false);
            }}
          />
        )}
      </MapContainer>

      {/* Top stats */}
      {!hasActive && <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2 pointer-events-none">
        <div className="bg-background/95 backdrop-blur rounded-full px-4 py-2 shadow-elegant text-sm font-medium pointer-events-auto">
          <span className="text-primary">{list.length}</span> {meta.label.toLowerCase()}s nearby
        </div>
        <Button
          size="sm"
          variant={follow ? "default" : "outline"}
          className="ml-auto rounded-full pointer-events-auto"
          onClick={() => setFollow((v) => !v)}
        >
          <MapPin className="h-4 w-4" /> {follow ? "Following" : "Recenter"}
        </Button>
      </div>}

      {/* Bottom carousel of nearest */}
      {!hasActive && list.length > 0 && (
        <div className="absolute bottom-3 left-0 right-0 z-[1000] px-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {list.slice(0, 8).map(({ f, km }) => (
              <button
                key={f.id}
                onClick={() => { setFollow(false); setSelected(f); }}
                className="shrink-0 bg-background/95 backdrop-blur rounded-2xl px-4 py-3 shadow-elegant text-left min-w-[180px] border hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full grid place-items-center text-base" style={{ background: meta.color, color: "white" }}>{meta.icon}</div>
                  <div>
                    <div className="font-semibold text-sm leading-tight">{f.full_name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {f.rating.toFixed(1)} · {etaMinutes(km)} min
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full grid place-items-center text-lg" style={{ background: meta.color, color: "white" }}>{meta.icon}</div>
                  {selected.full_name}
                </SheetTitle>
                <SheetDescription>
                  {meta.label} · ⭐ {selected.rating.toFixed(1)} · {selected.total_jobs} jobs done
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                {selected.bio && <p className="text-sm text-muted-foreground">{selected.bio}</p>}
                <div className="flex justify-between text-sm bg-muted rounded-xl p-3">
                  <div>
                    <div className="text-muted-foreground text-xs">Distance</div>
                    <div className="font-semibold">
                      {pos ? haversineKm({ lat: pos[0], lng: pos[1] }, { lat: selected.current_lat!, lng: selected.current_lng! }).toFixed(1) : "—"} km
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">ETA</div>
                    <div className="font-semibold">
                      {pos ? etaMinutes(haversineKm({ lat: pos[0], lng: pos[1] }, { lat: selected.current_lat!, lng: selected.current_lng! })) : "—"} min
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Price</div>
                    <div className="font-semibold">{formatTsh(meta.price)}</div>
                  </div>
                </div>
                <Button className="w-full h-12 text-base" onClick={requestFundi} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Request ${selected.full_name.split(" ")[0]}`}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}