import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_CENTER,
  SERVICE_META,
  haversineKm,
  type ServiceKey,
} from "@/lib/geo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import ActiveJobLayer, { type ActiveJob } from "./ActiveJobLayer";
import { sendBrowserNotification, ensureNotificationPermission } from "@/lib/push";
import { pushNotification } from "@/lib/notifications";
import BookingSheet from "./booking/BookingSheet";
import JobChat from "./chat/JobChat";

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

export default function LiveMap({
  service,
  setService,
  hideIdleSheet = false,
  onActiveJobChange,
}: {
  service: ServiceKey;
  setService: (s: ServiceKey) => void;
  hideIdleSheet?: boolean;
  onActiveJobChange?: (job: ActiveJob | null) => void;
}) {
  const { user } = useAuth();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [follow, setFollow] = useState(true);
  const [fundis, setFundis] = useState<Record<string, FundiWithProfile>>({});
  const watchRef = useRef<number | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [reverseTrack, setReverseTrack] = useState(false);
  const [chat, setChat] = useState<{ jobId: string; title: string } | null>(null);

  // Request permission for cancellation/status notifications
  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  // 1. Watch user GPS
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
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
                pushNotification({ kind: "error", title: "Fundi cancelled the job", body: `${reason} · ${when}`, jobId: row.id });
              } else {
                toast.message(`Job cancelled · ${when}`, { description: reason });
                pushNotification({ kind: "warning", title: "Job cancelled", body: `${reason} · ${when}`, jobId: row.id });
              }
            }
            if (row.status === "completed") {
              pushNotification({ kind: "success", title: "Job completed", body: "Thanks for using FundiFast!", jobId: row.id });
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
            if (map[row.status]) {
              toast.message(map[row.status]);
              sendBrowserNotification(map[row.status], "Open the app for details");
              pushNotification({ kind: row.status === "arrived" ? "success" : "info", title: map[row.status], body: "Open the app for details", jobId: row.id });
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Seed from the audit trail, then receive ephemeral fundi GPS over Broadcast.
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
      .channel(`job:${jobId}`, { config: { private: true } })
      .on(
        "broadcast",
        { event: "location" },
        ({ payload }) => {
          const row = payload as { user_id?: string; lat?: number; lng?: number };
          if (row.user_id !== fundiId || row.lat == null || row.lng == null) return;
          const lat = row.lat;
          const lng = row.lng;
          setActiveJob((prev) =>
            prev && prev.id === jobId ? { ...prev, fundi_lat: lat, fundi_lng: lng } : prev,
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
    onActiveJobChange?.(activeJob);
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
            eventHandlers={{ click: () => setFollow(false) }}
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

      {(!hideIdleSheet || activeJob) && (
        <BookingSheet
          service={service}
          setService={setService}
          pos={pos}
          activeJob={activeJob as unknown as Parameters<typeof BookingSheet>[0]["activeJob"]}
          onOpenChat={(jobId, title) => setChat({ jobId, title })}
          onClose={() => {
            setActiveJob(null);
            setReverseTrack(false);
          }}
        />
      )}
      <JobChat
        jobId={chat?.jobId ?? null}
        open={!!chat}
        onOpenChange={(o) => !o && setChat(null)}
        title={chat?.title ?? "Chat"}
      />
    </div>
  );
}