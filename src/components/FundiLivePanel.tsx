import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin, X, MessageCircle, Phone, Wallet, Star } from "lucide-react";
import { toast } from "sonner";
import JobReceiptDialog from "@/components/JobReceiptDialog";
import { SERVICE_META, ARRIVAL_RADIUS_M, haversineKm, formatTsh, type ServiceKey } from "@/lib/geo";
import { sendBrowserNotification, ensureNotificationPermission } from "@/lib/push";
import JobChat from "./chat/JobChat";
import ProofOfWorkDialog, { type ProofMode, type ProofResult } from "./fundi/ProofOfWorkDialog";
import SignedImage from "@/components/SignedImage";
import FundiMap from "@/components/FundiMap";
import { getOpenJobsForFundi } from "@/lib/openJobs.functions";
import { useOfflineQueue } from "@/lib/offlineQueue";
import type { RealtimeChannel } from "@supabase/supabase-js";

type JobStatus =
  | "searching"
  | "quoting"
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
  agreed_price: number | null;
  problem_title: string | null;
  problem_description: string | null;
  job_photos: string[];
  before_photos?: string[];
  after_photos?: string[];
  started_at?: string | null;
  signature_url?: string | null;
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
  const loadOpenJobs = useServerFn(getOpenJobsForFundi);
  const [available, setAvailable] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [incoming, setIncoming] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const [clientName, setClientName] = useState<string>("Client");
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatJobId, setChatJobId] = useState<string | null>(null);
  const [earnings, setEarnings] = useState({ today: 0, week: 0 });
  const [quoteFor, setQuoteFor] = useState<Job | null>(null);
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [myQuoteIds, setMyQuoteIds] = useState<Record<string, string>>({});
  const [proofMode, setProofMode] = useState<ProofMode | null>(null);
  const [receiptJobId, setReceiptJobId] = useState<string | null>(null);
  const enqueueJobUpdate = useOfflineQueue((state) => state.enqueueJobUpdate);
  const enqueueLocationBackup = useOfflineQueue((state) => state.enqueueLocationBackup);
  const watchRef = useRef<number | null>(null);
  const locationChannelRef = useRef<RealtimeChannel | null>(null);
  const latestPosRef = useRef<[number, number] | null>(null);
  const incomingIdsRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (available) ensureNotificationPermission();
  }, [available]);

  // Load fundi initial state
  useEffect(() => {
    if (!user) return;
    supabase
      .from("fundis")
      .select("is_available")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvailable(!!data?.is_available));
  }, [user?.id]);

  // Load earnings
  const loadEarnings = async () => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("transactions")
      .select("fundi_earnings, created_at")
      .eq("fundi_id", user.id)
      .gte("created_at", since.toISOString());
    let today = 0;
    let week = 0;
    for (const t of data ?? []) {
      const e = Number(t.fundi_earnings ?? 0);
      week += e;
      if (new Date(t.created_at) >= todayStart) today += e;
    }
    setEarnings({ today, week });
  };
  useEffect(() => {
    loadEarnings();
  }, [user?.id]);

  // GPS watch
  useEffect(() => {
    if (!available && !active) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      (err) => console.warn("geo err", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [available, active?.id]);

  useEffect(() => {
    latestPosRef.current = pos;
  }, [pos]);

  // Open one private Broadcast channel for the active job.
  useEffect(() => {
    if (!active || !user || active.status === "completed" || active.status === "cancelled") return;
    const channel = supabase.channel(`job:${active.id}`, {
      config: { private: true, broadcast: { ack: true } },
    });
    locationChannelRef.current = channel;
    channel.subscribe((status) => {
      const latest = latestPosRef.current;
      if (status !== "SUBSCRIBED" || !latest) return;
      void channel.send({
        type: "broadcast",
        event: "location",
        payload: { user_id: user.id, lat: latest[0], lng: latest[1], sent_at: Date.now() },
      });
    });
    return () => {
      locationChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [active?.id, active?.status, user?.id]);

  // Broadcast every fresh GPS fix without touching Postgres.
  useEffect(() => {
    if (!active || !user || !pos || !locationChannelRef.current) return;
    void locationChannelRef.current.send({
      type: "broadcast",
      event: "location",
      payload: { user_id: user.id, lat: pos[0], lng: pos[1], sent_at: Date.now() },
    });
  }, [pos?.[0], pos?.[1], active?.id, user?.id]);

  // Keep a sparse audit trail and discovery location every 45 seconds.
  useEffect(() => {
    if (!user || (!available && !active)) return;
    const backup = () => {
      const latest = latestPosRef.current;
      if (!latest) return;
      void supabase
        .from("fundis")
        .update({
          current_lat: latest[0],
          current_lng: latest[1],
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (active && active.status !== "completed" && active.status !== "cancelled") {
        enqueueLocationBackup(active.id, user.id, latest[0], latest[1]);
      }
    };
    backup();
    const id = window.setInterval(backup, 45_000);
    return () => window.clearInterval(id);
  }, [available, active?.id, active?.status, user?.id, enqueueLocationBackup]);

  // Active job
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
    const ch = supabase
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
            if (row.status === "cancelled" && row.cancelled_by && row.cancelled_by !== user.id) {
              const reason = row.cancellation_reason || "No reason provided";
              toast.error(`Client cancelled the job`, { description: reason });
              sendBrowserNotification("Job cancelled by client", reason);
            }
            if (row.status === "completed") {
              loadEarnings();
              toast.success("Job complete — earnings updated");
              sendBrowserNotification("Job completed", "Earnings have been updated");
              setReceiptJobId(row.id);
            }
            setActive((prev) => (prev?.id === row.id ? null : prev));
            return;
          }
          // Detect newly assigned job
          if (!activeIdRef.current || activeIdRef.current !== row.id) {
            if (row.status === "accepted") {
              toast.success("Client accepted your quote 🎉");
              sendBrowserNotification(
                "Quote accepted",
                `${row.problem_title || "New job"} is yours — head over!`,
              );
            }
          }
          setActive(row);
          activeIdRef.current = row.id;
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Active client profile
  useEffect(() => {
    if (!active?.client_id) return;
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", active.client_id)
      .maybeSingle()
      .then(({ data }) => {
        setClientName(data?.full_name ?? "Client");
        setClientPhone(data?.phone ?? null);
      });
  }, [active?.client_id]);

  // Incoming searching jobs for our service
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
      const data = await loadOpenJobs();
      if (cancelled) return;
      const rows = (data as Job[]) ?? [];
      // Detect new incoming requests since last poll
      const prev = incomingIdsRef.current;
      if (prev.size > 0) {
        const fresh = rows.filter((r) => !prev.has(r.id));
        if (fresh.length > 0) {
          const f = fresh[0];
          toast.message("New job request nearby", {
            description: f.problem_title || SERVICE_META[f.service].label,
          });
          sendBrowserNotification(
            `New ${SERVICE_META[f.service].label} request`,
            f.problem_title || "Tap to send a quote",
          );
        }
      }
      incomingIdsRef.current = new Set(rows.map((r) => r.id));
      setIncoming(rows);
      // Also load my own quote ids per job
      const ids = (data ?? []).map((d) => d.id);
      if (ids.length) {
        const { data: qs } = await supabase
          .from("job_quotes")
          .select("id, job_id")
          .eq("fundi_id", user.id)
          .in("job_id", ids);
        const map: Record<string, string> = {};
        for (const q of qs ?? []) map[q.job_id] = q.id;
        setMyQuoteIds(map);
      } else {
        setMyQuoteIds({});
      }
    };
    load();
    const ch = supabase
      .channel(`incoming-jobs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id, available, active?.id, loadOpenJobs]);

  const toggleAvailable = async (v: boolean) => {
    if (!user) return;
    setAvailable(v);
    await supabase.from("fundis").update({ is_available: v }).eq("id", user.id);
  };

  const sendQuote = async () => {
    if (!user || !quoteFor) return;
    const price = Number(quotePrice);
    if (!(price > 0)) {
      toast.error("Enter a valid price");
      return;
    }
    setSubmittingQuote(true);
    const { error } = await supabase.from("job_quotes").upsert(
      {
        job_id: quoteFor.id,
        fundi_id: user.id,
        price,
        note: quoteNote.trim() || null,
        status: "pending",
      },
      { onConflict: "job_id,fundi_id" },
    );
    setSubmittingQuote(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Quote sent");
    setQuoteFor(null);
    setQuotePrice("");
    setQuoteNote("");
  };

  const advance = async () => {
    if (!active) return;
    const step = NEXT[active.status];
    if (!step) return;
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
          `You're ${Math.round(meters)}m away — get within ${ARRIVAL_RADIUS_M}m to confirm arrival.`,
        );
        return;
      }
    }
    // Proof-of-work gates
    if (step.next === "in_progress") {
      setProofMode("start");
      return;
    }
    if (step.next === "completed") {
      setProofMode("complete");
      return;
    }
    const patch: { status: JobStatus; arrived_at?: string } = { status: step.next };
    if (step.next === "arrived") patch.arrived_at = new Date().toISOString();
    setActive((current) => (current ? { ...current, ...patch } : current));
    enqueueJobUpdate(active.id, patch);
    if (pos && user) enqueueLocationBackup(active.id, user.id, pos[0], pos[1]);
  };

  const submitProof = async (result: ProofResult) => {
    if (!active || !proofMode) return;
    const now = new Date().toISOString();
    const patch =
      proofMode === "start"
        ? {
            status: "in_progress" as JobStatus,
            started_at: now,
            before_photos: [...(active.before_photos ?? []), ...result.photoUrls],
          }
        : {
            status: "completed" as JobStatus,
            completed_at: now,
            after_photos: [...(active.after_photos ?? []), ...result.photoUrls],
            signature_url: result.signatureUrl ?? null,
          };
    setActive((current) => (current ? { ...current, ...patch } : current));
    enqueueJobUpdate(active.id, patch);
    if (pos && user) enqueueLocationBackup(active.id, user.id, pos[0], pos[1]);
    setProofMode(null);
    toast.success(proofMode === "start" ? "Job started" : "Job completed");
  };

  const cancelActive = async () => {
    if (!active) return;
    const reason = window.prompt("Why are you cancelling? (shared with the client)", "");
    if (reason === null) return;
    const trimmed = reason.trim() || "Cancelled by fundi";
    await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        cancellation_reason: trimmed,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
      })
      .eq("id", active.id);
    setActive(null);
    toast.message("Job cancelled");
  };

  const openChat = (jobId: string) => {
    setChatJobId(jobId);
    setChatOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Online toggle */}
      <Card className="p-4 flex items-center justify-between bg-gradient-to-br from-card to-secondary/30 border-2">
        <div>
          <div className="font-display font-bold text-lg">
            {available ? "You're online" : "You're offline"}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {pos ? "GPS active" : "Locating…"}
          </div>
        </div>
        <Switch checked={available} onCheckedChange={toggleAvailable} className="scale-125" />
      </Card>

      {/* Live map */}
      {(available || active) && (
        <FundiMap pos={pos} active={active} requests={incoming} height={active ? 280 : 220} />
      )}

      {/* Earnings chip */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-success/15 text-success grid place-items-center">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Today</div>
            <div className="font-bold text-sm">{formatTsh(earnings.today)}</div>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Past 7 days</div>
            <div className="font-bold text-sm">{formatTsh(earnings.week)}</div>
          </div>
        </Card>
      </div>

      {/* Active job */}
      {active ? (
        <Card className="p-4 space-y-3 border-2 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-muted-foreground">Active job</div>
              <div className="font-display font-bold leading-tight truncate">
                {SERVICE_META[active.service].icon}{" "}
                {active.problem_title || SERVICE_META[active.service].label}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize whitespace-nowrap">
              {active.status.replace("_", " ")}
            </span>
          </div>

          {active.problem_description && (
            <p className="text-sm text-muted-foreground">{active.problem_description}</p>
          )}

          {active.job_photos?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {active.job_photos.map((url, i) => (
                <SignedImage
                  key={i}
                  src={url}
                  alt=""
                  className="h-20 w-20 object-cover rounded-lg border"
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Client</div>
              <div className="font-medium">{clientName}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Earnings (90%)</div>
              <div className="font-bold">
                {formatTsh(Math.round((active.agreed_price ?? active.price) * 0.9))}
              </div>
            </div>
          </div>

          {pos && (
            <div className="text-xs text-muted-foreground">
              {Math.round(
                haversineKm(
                  { lat: pos[0], lng: pos[1] },
                  { lat: active.client_lat, lng: active.client_lng },
                ) * 1000,
              )}
              m to client
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => openChat(active.id)}>
              <MessageCircle className="h-4 w-4" /> Chat
            </Button>
            <Button asChild variant="outline" disabled={!clientPhone}>
              <a href={clientPhone ? `tel:${clientPhone}` : "#"}>
                <Phone className="h-4 w-4" /> Call
              </a>
            </Button>
            <Button variant="destructive" onClick={cancelActive}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>

          {NEXT[active.status] && (
            <Button className="w-full h-11" onClick={advance}>
              {NEXT[active.status]!.label}
            </Button>
          )}
        </Card>
      ) : available ? (
        <Card className="p-4">
          <div className="font-display font-semibold mb-3">Open requests</div>
          {incoming.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for jobs nearby…
            </div>
          ) : (
            <div className="space-y-3">
              {incoming.map((j) => {
                const km =
                  pos &&
                  haversineKm(
                    { lat: pos[0], lng: pos[1] },
                    { lat: j.client_lat, lng: j.client_lng },
                  );
                const myQuote = myQuoteIds[j.id];
                return (
                  <div key={j.id} className="border rounded-2xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight">
                          {j.problem_title || SERVICE_META[j.service].label}
                        </div>
                        {j.problem_description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {j.problem_description}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Budget {formatTsh(j.price)} · {km ? `${km.toFixed(1)} km away` : "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase text-muted-foreground">After 10%</div>
                        <div className="font-bold text-sm">
                          {formatTsh(Math.round(j.price * 0.9))}
                        </div>
                      </div>
                    </div>
                    {j.job_photos?.length > 0 && (
                      <div className="flex gap-1 overflow-x-auto scrollbar-none">
                        {j.job_photos.map((u, i) => (
                          <SignedImage
                            key={i}
                            src={u}
                            alt=""
                            className="h-14 w-14 object-cover rounded-md border"
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openChat(j.id)}
                      >
                        <MessageCircle className="h-3 w-3" /> Chat
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setQuoteFor(j);
                          setQuotePrice(String(j.price));
                          setQuoteNote("");
                        }}
                      >
                        {myQuote ? "Update quote" : "Send quote"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted grid place-items-center mb-2">
            <Star className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="font-medium">Go online to receive jobs</div>
          <div className="text-xs text-muted-foreground mt-1">
            We'll show open requests nearby with photos and budgets.
          </div>
        </Card>
      )}

      {/* Quote modal */}
      {quoteFor && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4"
          onClick={() => setQuoteFor(null)}
        >
          <div
            className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-lg">Send your quote</div>
              <Button variant="ghost" size="icon" onClick={() => setQuoteFor(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {quoteFor.problem_title} · client budget {formatTsh(quoteFor.price)}
            </div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Your price (TSh)"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
              className="h-12 text-base"
            />
            <Textarea
              placeholder="Note for the client (optional)"
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              rows={2}
            />
            <div className="text-xs text-muted-foreground">
              You'll keep <span className="font-semibold text-foreground">90%</span> · platform fee
              10%
            </div>
            <Button
              className="w-full h-12"
              onClick={sendQuote}
              disabled={submittingQuote || !quotePrice}
            >
              {submittingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send quote"}
            </Button>
          </div>
        </div>
      )}

      <JobChat
        jobId={chatJobId}
        open={chatOpen}
        onOpenChange={(o) => {
          setChatOpen(o);
          if (!o) setChatJobId(null);
        }}
        title={active && chatJobId === active.id ? clientName : "Chat with client"}
      />
      {active && proofMode && user && (
        <ProofOfWorkDialog
          open
          mode={proofMode}
          userId={user.id}
          jobId={active.id}
          onClose={() => setProofMode(null)}
          onSubmit={submitProof}
        />
      )}
      <JobReceiptDialog
        jobId={receiptJobId}
        open={!!receiptJobId}
        onOpenChange={(o) => !o && setReceiptJobId(null)}
        role="fundi"
      />
    </div>
  );
}
