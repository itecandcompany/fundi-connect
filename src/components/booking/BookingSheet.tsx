import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_META,
  formatTsh,
  haversineKm,
  etaMinutes,
  type ServiceKey,
} from "@/lib/geo";
import { uploadJobPhotos } from "@/lib/jobPhotos";
import RadarPulse from "./RadarPulse";
import SignedImage from "@/components/SignedImage";
import {
  Camera,
  ChevronUp,
  ChevronDown,
  Loader2,
  MessageCircle,
  Phone,
  Star,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import JobReceiptDialog from "@/components/JobReceiptDialog";

type ProblemTemplate = {
  id: string;
  service: ServiceKey;
  title: string;
  description: string | null;
  suggested_price: number;
};

type Quote = {
  id: string;
  job_id: string;
  fundi_id: string;
  price: number;
  note: string | null;
  status: string;
  created_at: string;
};

type FundiProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  rating: number;
  total_jobs: number;
  current_lat: number | null;
  current_lng: number | null;
};

type ActiveJob = {
  id: string;
  service: ServiceKey;
  status:
    | "searching"
    | "quoting"
    | "accepted"
    | "on_the_way"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled";
  fundi_id: string | null;
  agreed_price: number | null;
  price: number;
  problem_title: string | null;
  problem_description: string | null;
  job_photos: string[];
  client_lat: number;
  client_lng: number;
  fundi_lat: number | null;
  fundi_lng: number | null;
  started_at?: string | null;
  before_photos?: string[];
  after_photos?: string[];
  signature_url?: string | null;
};

const STAGE_LABEL: Record<ActiveJob["status"], string> = {
  searching: "Finding fundis nearby…",
  quoting: "Review fundi quotes",
  accepted: "Fundi accepted",
  on_the_way: "Fundi is on the way",
  arrived: "Fundi has arrived",
  in_progress: "Job in progress",
  completed: "Job complete",
  cancelled: "Cancelled",
};

export default function BookingSheet({
  service,
  setService,
  pos,
  activeJob,
  onOpenChat,
  onClose,
  onPickQuoteFundi,
}: {
  service: ServiceKey;
  setService: (s: ServiceKey) => void;
  pos: [number, number] | null;
  activeJob: ActiveJob | null;
  onOpenChat: (jobId: string, title: string) => void;
  onClose: () => void;
  onPickQuoteFundi?: (fundiId: string) => void;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [templates, setTemplates] = useState<ProblemTemplate[]>([]);
  const [pickedTemplate, setPickedTemplate] = useState<ProblemTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [fundiProfiles, setFundiProfiles] = useState<Record<string, FundiProfile>>({});
  const [activeFundi, setActiveFundi] = useState<FundiProfile | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates for current service
  useEffect(() => {
    if (activeJob) return;
    supabase
      .from("problem_templates")
      .select("*")
      .eq("service", service)
      .eq("is_active", true)
      .order("suggested_price", { ascending: true })
      .then(({ data }) => setTemplates((data as ProblemTemplate[]) ?? []));
    setPickedTemplate(null);
    setTitle("");
    setBudget("");
  }, [service, activeJob?.id]);

  // Subscribe to quotes for the active job
  useEffect(() => {
    if (!activeJob || !["searching", "quoting"].includes(activeJob.status)) {
      setQuotes([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("job_quotes")
        .select("*")
        .eq("job_id", activeJob.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const qs = (data as Quote[]) ?? [];
      setQuotes(qs);
      const ids = Array.from(new Set(qs.map((q) => q.fundi_id)));
      if (ids.length) {
        const [{ data: profs }, { data: fs }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, phone").in("id", ids),
          supabase
            .from("fundis")
            .select("id, rating, total_jobs, current_lat, current_lng")
            .in("id", ids),
        ]);
        const next: Record<string, FundiProfile> = {};
        for (const id of ids) {
          const p = profs?.find((x) => x.id === id);
          const f = fs?.find((x) => x.id === id);
          next[id] = {
            id,
            full_name: p?.full_name ?? "Fundi",
            phone: p?.phone ?? null,
            rating: f?.rating ?? 5,
            total_jobs: f?.total_jobs ?? 0,
            current_lat: f?.current_lat ?? null,
            current_lng: f?.current_lng ?? null,
          };
        }
        setFundiProfiles(next);
      }
    };
    load();
    const ch = supabase
      .channel(`quotes-${activeJob.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_quotes", filter: `job_id=eq.${activeJob.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeJob?.id, activeJob?.status]);

  // Active fundi profile
  useEffect(() => {
    if (!activeJob?.fundi_id) {
      setActiveFundi(null);
      return;
    }
    const id = activeJob.fundi_id;
    Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", id).maybeSingle(),
      supabase
        .from("fundis")
        .select("rating, total_jobs, current_lat, current_lng")
        .eq("id", id)
        .maybeSingle(),
    ]).then(([{ data: p }, { data: f }]) =>
      setActiveFundi({
        id,
        full_name: p?.full_name ?? "Fundi",
        phone: p?.phone ?? null,
        rating: f?.rating ?? 5,
        total_jobs: f?.total_jobs ?? 0,
        current_lat: f?.current_lat ?? null,
        current_lng: f?.current_lng ?? null,
      }),
    );
  }, [activeJob?.fundi_id]);

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).slice(0, 5);
    setFiles(arr);
  };

  const submitRequest = async () => {
    if (!user || !pos) {
      toast.error("Waiting for your GPS…");
      return;
    }
    const finalTitle = pickedTemplate?.title || title.trim();
    if (!finalTitle) {
      toast.error("Describe the problem in a short title");
      return;
    }
    const numericBudget = Number(budget);
    const suggested = pickedTemplate?.suggested_price ?? SERVICE_META[service].price;
    const startingPrice = numericBudget > 0 ? numericBudget : suggested;
    setSubmitting(true);
    let photoUrls: string[] = [];
    if (files.length) {
      photoUrls = await uploadJobPhotos(user.id, files);
    }
    const commission = Math.round(startingPrice * 0.1);
    const { error } = await supabase.from("jobs").insert({
      client_id: user.id,
      service,
      price: startingPrice,
      commission,
      status: "searching",
      client_lat: pos[0],
      client_lng: pos[1],
      problem_title: finalTitle,
      problem_description: description.trim() || null,
      job_photos: photoUrls,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent — fundis are sending quotes");
    setFiles([]);
    setDescription("");
  };

  const cancel = async (reason?: string) => {
    if (!activeJob) return;
    const r =
      reason ?? (window.prompt("Why are you cancelling? (shared with the fundi)", "") || "Cancelled by client");
    await supabase
      .from("jobs")
      .update({
        status: "cancelled",
        cancellation_reason: r,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id ?? null,
      })
      .eq("id", activeJob.id);
    onClose();
  };

  const acceptQuote = async (q: Quote) => {
    if (!activeJob) return;
    const { error } = await supabase
      .from("jobs")
      .update({
        fundi_id: q.fundi_id,
        agreed_price: q.price,
        price: q.price,
        status: "accepted",
      })
      .eq("id", activeJob.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("job_quotes").update({ status: "accepted" }).eq("id", q.id);
    await supabase
      .from("job_quotes")
      .update({ status: "declined" })
      .eq("job_id", activeJob.id)
      .neq("id", q.id);
    onPickQuoteFundi?.(q.fundi_id);
    toast.success("Fundi confirmed — they're on the way");
  };

  const submitRating = async () => {
    if (!activeJob || !user || !activeJob.fundi_id || rating === 0) return;
    await supabase.from("ratings").insert({
      job_id: activeJob.id,
      client_id: user.id,
      fundi_id: activeJob.fundi_id,
      stars: rating,
      review: review.trim() || null,
    });
    toast.success("Thanks for the feedback");
    setReceiptOpen(true);
  };

  // ----- RENDER -----

  // Stage 0 — Idle: service picker + custom problem form
  if (!activeJob) {
    return (
      <Shell expanded={expanded} setExpanded={setExpanded}>
        <div className="px-4">
          <h2 className="text-2xl font-display font-bold leading-tight">
            What needs fixing?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Describe it, set your budget, fundis will quote you back.
          </p>
        </div>

        {/* Service chips */}
        <div className="px-4 mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          {(Object.keys(SERVICE_META) as ServiceKey[]).map((k) => {
            const s = SERVICE_META[k];
            const active = service === k;
            return (
              <button
                key={k}
                onClick={() => setService(k)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary"
                }`}
              >
                <span className="mr-1">{s.icon}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        {expanded && (
          <div className="px-4 mt-4 space-y-4 pb-6">
            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">
                  Common problems
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => {
                    const active = pickedTemplate?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setPickedTemplate(active ? null : t);
                          if (!active) {
                            setTitle(t.title);
                            setBudget(String(t.suggested_price));
                          }
                        }}
                        className={`text-left rounded-xl px-3 py-2 border text-sm transition-colors ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        <div className="font-medium">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          from {formatTsh(t.suggested_price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Input
                placeholder="What's the problem? (e.g. Leaking kitchen sink)"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setPickedTemplate(null);
                }}
              />
              <Textarea
                placeholder="More details (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={`Budget (TSh) — suggested ${
                    pickedTemplate?.suggested_price ?? SERVICE_META[service].price
                  }`}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0"
                >
                  <Camera className="h-4 w-4" />
                  {files.length ? `${files.length}` : "Photos"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </div>
              {files.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {files.map((f, i) => (
                    <img
                      key={i}
                      alt=""
                      src={URL.createObjectURL(f)}
                      className="h-16 w-16 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full h-12 text-base"
              onClick={submitRequest}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Request a {SERVICE_META[service].label.toLowerCase()}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </Shell>
    );
  }

  // Stage: Searching / Quoting
  if (activeJob.status === "searching" || activeJob.status === "quoting") {
    return (
      <Shell expanded={expanded} setExpanded={setExpanded}>
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                {STAGE_LABEL[activeJob.status]}
              </div>
              <div className="font-display font-bold text-lg leading-tight">
                {activeJob.problem_title}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => cancel()}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {quotes.length === 0 ? (
            <div className="grid place-items-center py-6">
              <RadarPulse />
              <div className="mt-3 text-sm text-muted-foreground">
                Searching for available fundis nearby…
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                {quotes.length} fundi{quotes.length > 1 ? "s" : ""} responded
              </div>
              {quotes.map((q) => {
                const fp = fundiProfiles[q.fundi_id];
                const km =
                  pos && fp?.current_lat && fp.current_lng
                    ? haversineKm(
                        { lat: pos[0], lng: pos[1] },
                        { lat: fp.current_lat, lng: fp.current_lng },
                      )
                    : 0;
                return (
                  <div key={q.id} className="border rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
                      {(fp?.full_name ?? "F").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {fp?.full_name ?? "Fundi"}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {(fp?.rating ?? 5).toFixed(1)} · {km.toFixed(1)} km ·{" "}
                        {etaMinutes(km || 1)} min
                      </div>
                      {q.note && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          “{q.note}”
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base">{formatTsh(q.price)}</div>
                      <div className="flex gap-1 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => onOpenChat(activeJob.id, fp?.full_name ?? "Fundi")}
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" className="h-7 px-2" onClick={() => acceptQuote(q)}>
                          <Check className="h-3 w-3" /> Accept
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // Stage: completed — rate
  if (activeJob.status === "completed") {
    return (
      <Shell expanded={expanded} setExpanded={setExpanded}>
        <div className="px-4 pb-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-success/15 text-success grid place-items-center text-2xl">
            ✓
          </div>
          <div className="mt-2 font-display font-bold text-xl">Job complete</div>
          <div className="text-sm text-muted-foreground">
            Total paid · {formatTsh(activeJob.agreed_price ?? activeJob.price)}
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">How was {activeFundi?.full_name ?? "the fundi"}?</div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`}>
                  <Star
                    className={`h-7 w-7 ${
                      n <= rating
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Leave a short review (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={2}
              className="mt-3"
            />
            <div className="flex gap-2 mt-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Skip
              </Button>
              <Button className="flex-1" onClick={submitRating} disabled={rating === 0}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // Stage: accepted / on_the_way / arrived / in_progress — fundi card
  const fundiPos =
    activeJob.fundi_lat != null && activeJob.fundi_lng != null
      ? { lat: activeJob.fundi_lat, lng: activeJob.fundi_lng }
      : null;
  const km = pos && fundiPos ? haversineKm({ lat: pos[0], lng: pos[1] }, fundiPos) : 0;

  return (
    <Shell expanded={expanded} setExpanded={setExpanded}>
      <div className="px-4 pb-6">
        <div className="text-xs uppercase text-muted-foreground">
          {STAGE_LABEL[activeJob.status]}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-semibold">
            {(activeFundi?.full_name ?? "F").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight truncate">
              {activeFundi?.full_name ?? "Fundi"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {(activeFundi?.rating ?? 5).toFixed(1)} · {activeFundi?.total_jobs ?? 0} jobs ·{" "}
              {SERVICE_META[activeJob.service].label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">ETA</div>
            <div className="font-bold">{etaMinutes(km || 1)} min</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-muted rounded-xl py-2">
            <div className="text-[10px] uppercase text-muted-foreground">Distance</div>
            <div className="font-semibold text-sm">{km.toFixed(1)} km</div>
          </div>
          <div className="bg-muted rounded-xl py-2">
            <div className="text-[10px] uppercase text-muted-foreground">Price</div>
            <div className="font-semibold text-sm">
              {formatTsh(activeJob.agreed_price ?? activeJob.price)}
            </div>
          </div>
          <div className="bg-muted rounded-xl py-2">
            <div className="text-[10px] uppercase text-muted-foreground">Status</div>
            <div className="font-semibold text-sm capitalize">
              {activeJob.status.replace("_", " ")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChat(activeJob.id, activeFundi?.full_name ?? "Fundi")}
          >
            <MessageCircle className="h-4 w-4" /> Chat
          </Button>
          <Button asChild variant="outline" disabled={!activeFundi?.phone}>
            <a href={activeFundi?.phone ? `tel:${activeFundi.phone}` : "#"}>
              <Phone className="h-4 w-4" /> Call
            </a>
          </Button>
          <Button variant="destructive" onClick={() => cancel()}>
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>

        {(activeJob.before_photos?.length || activeJob.after_photos?.length || activeJob.started_at) && (
          <div className="mt-4 rounded-xl border bg-muted/30 p-3 space-y-3">
            {activeJob.started_at && (
              <WorkTimer startedAt={activeJob.started_at} />
            )}
            {activeJob.before_photos && activeJob.before_photos.length > 0 && (
              <ProofRow label="Before" urls={activeJob.before_photos} />
            )}
            {activeJob.after_photos && activeJob.after_photos.length > 0 && (
              <ProofRow label="After" urls={activeJob.after_photos} />
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function WorkTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (
    <div className="text-xs text-muted-foreground">
      Work in progress · {h > 0 ? `${h}h ` : ""}{m}m elapsed
    </div>
  );
}

function ProofRow({ label, urls }: { label: string; urls: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {urls.map((u, i) => (
          <SignedImage key={i} src={u} alt="" className="h-16 w-16 object-cover rounded-lg border" />
        ))}
      </div>
    </div>
  );
}

function Shell({
  children,
  expanded,
  setExpanded,
}: {
  children: React.ReactNode;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] bolt-sheet pointer-events-auto">
      <button
        className="w-full"
        aria-label={expanded ? "Collapse" : "Expand"}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="bolt-handle" />
      </button>
      <div className="pb-3 max-h-[78vh] overflow-y-auto">{children}</div>
    </div>
  );
}