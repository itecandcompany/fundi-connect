import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERVICE_META, formatTsh, type ServiceKey } from "@/lib/geo";
import { MapPin, X, Repeat2 } from "lucide-react";
import JobDetailsDrawer, { type JobDetailsRow } from "@/components/admin/JobDetailsDrawer";
import { CancelJobDialog, ReassignJobDialog } from "@/components/admin/JobActionDialogs";

export const Route = createFileRoute("/admin/jobs")({ component: AdminJobs });

const STATUSES = [
  "searching",
  "quoting",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;
type JobStatus = (typeof STATUSES)[number];

type Job = {
  id: string;
  client_id: string;
  fundi_id: string | null;
  service: ServiceKey;
  status: JobStatus;
  price: number;
  agreed_price: number | null;
  client_address: string | null;
  problem_title: string | null;
  problem_description: string | null;
  job_photos: string[] | null;
  created_at: string;
  updated_at: string;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
};

const STATUS_COLORS: Record<JobStatus, string> = {
  searching: "bg-blue-100 text-blue-700",
  quoting: "bg-violet-100 text-violet-700",
  accepted: "bg-amber-100 text-amber-700",
  on_the_way: "bg-orange-100 text-orange-700",
  arrived: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"active" | "all" | JobStatus>("active");
  const [selected, setSelected] = useState<JobDetailsRow | null>(null);
  const [open, setOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<{ id: string; service: ServiceKey } | null>(
    null,
  );

  const load = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data as Job[]) ?? [];
    setJobs(rows);
    const ids = Array.from(
      new Set(rows.flatMap((j) => [j.client_id, j.fundi_id].filter(Boolean) as string[])),
    );
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const r of p ?? []) map[r.id] = r.full_name;
      setProfiles(map);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "active")
      return jobs.filter((j) => !(j.status === "completed" || j.status === "cancelled"));
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const openDetails = (j: Job) => {
    setSelected(j as unknown as JobDetailsRow);
    setOpen(true);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Jobs Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Live feed of every job. Auto-updates via realtime.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["active", "all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs border capitalize transition-colors ${
              filter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background"
            }`}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No jobs.</div>
          )}
          {filtered.map((j) => (
            <div
              key={j.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetails(j)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openDetails(j);
              }}
              className="p-3 md:p-4 hover:bg-muted/30 cursor-pointer focus:outline-none focus:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{SERVICE_META[j.service]?.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm">
                      {j.problem_title ?? SERVICE_META[j.service]?.label}
                    </div>
                    <Badge className={`text-[10px] ${STATUS_COLORS[j.status]} border-transparent`}>
                      {j.status.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTsh(Number(j.agreed_price ?? j.price))}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Client: {profiles[j.client_id] ?? "—"} · Fundi:{" "}
                    {j.fundi_id ? (profiles[j.fundi_id] ?? "—") : "unassigned"}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {j.client_address ?? "Pinned location"} ·{" "}
                    {new Date(j.created_at).toLocaleString()}
                  </div>
                  {j.cancellation_reason && (
                    <div className="text-xs text-rose-600 mt-1">
                      Cancelled: {j.cancellation_reason}
                    </div>
                  )}
                </div>
                {!(j.status === "completed" || j.status === "cancelled") && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReassignTarget({ id: j.id, service: j.service });
                      }}
                    >
                      <Repeat2 className="h-4 w-4" /> Reassign
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCancelTarget(j.id);
                      }}
                    >
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <JobDetailsDrawer job={selected} open={open} onOpenChange={setOpen} />
      <CancelJobDialog
        jobId={cancelTarget}
        open={cancelTarget !== null}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        onDone={load}
      />
      <ReassignJobDialog
        jobId={reassignTarget?.id ?? null}
        service={reassignTarget?.service ?? null}
        open={reassignTarget !== null}
        onOpenChange={(v) => !v && setReassignTarget(null)}
        onDone={load}
      />
    </div>
  );
}
