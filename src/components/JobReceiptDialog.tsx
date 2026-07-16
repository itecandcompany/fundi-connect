import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatTsh, SERVICE_META, type ServiceKey } from "@/lib/geo";
import { CheckCircle2, Loader2, Receipt as ReceiptIcon, Star } from "lucide-react";

type Role = "client" | "fundi";

type Job = {
  id: string;
  service: ServiceKey;
  problem_title: string | null;
  client_id: string;
  fundi_id: string | null;
  price: number;
  agreed_price: number | null;
  completed_at: string | null;
  client_address: string | null;
};

type Tx = { amount: number; commission: number; fundi_earnings: number; created_at: string };
type Rating = { stars: number; review: string | null };

export default function JobReceiptDialog({
  jobId,
  open,
  onOpenChange,
  role,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: Role;
}) {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [tx, setTx] = useState<Tx | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [counterparty, setCounterparty] = useState<string>("");

  useEffect(() => {
    if (!jobId || !open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: j }, { data: t }, { data: r }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).maybeSingle(),
        supabase
          .from("transactions")
          .select("amount, commission, fundi_earnings, created_at")
          .eq("job_id", jobId)
          .maybeSingle(),
        supabase.from("ratings").select("stars, review").eq("job_id", jobId).maybeSingle(),
      ]);
      if (cancelled) return;
      setJob((j as Job) ?? null);
      setTx((t as Tx) ?? null);
      setRating((r as Rating) ?? null);
      const otherId = role === "client" ? (j as Job)?.fundi_id : (j as Job)?.client_id;
      if (otherId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", otherId)
          .maybeSingle();
        if (!cancelled) setCounterparty(p?.full_name ?? (role === "client" ? "Fundi" : "Client"));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, open, role]);

  const total = Number(tx?.amount ?? job?.agreed_price ?? job?.price ?? 0);
  const commission = Number(tx?.commission ?? Math.round(total * 0.1));
  const earnings = Number(tx?.fundi_earnings ?? total - commission);
  const when = tx?.created_at ?? job?.completed_at ?? null;
  const meta = job ? SERVICE_META[job.service] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5" /> Receipt
          </DialogTitle>
        </DialogHeader>

        {loading || !job ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 grid place-items-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="mt-2 font-display font-bold text-xl">Job complete</div>
              <div className="text-xs text-muted-foreground">
                {when ? new Date(when).toLocaleString() : ""}
              </div>
            </div>

            <div className="rounded-2xl border p-4 space-y-2 bg-card">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full grid place-items-center text-base"
                  style={{ background: meta?.color, color: "white" }}
                >
                  {meta?.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold leading-tight truncate">
                    {job.problem_title || meta?.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {role === "client" ? "Fundi" : "Client"}: {counterparty}
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                <Row label="Service total" value={formatTsh(total)} />
                {role === "fundi" && (
                  <>
                    <Row label="Platform fee (10%)" value={`− ${formatTsh(commission)}`} muted />
                    <Row label="Your earnings" value={formatTsh(earnings)} bold />
                  </>
                )}
                {role === "client" && <Row label="Paid" value={formatTsh(total)} bold />}
              </div>

              <div className="text-[10px] text-muted-foreground pt-2 border-t mt-2">
                Reference · {job.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {rating && (
              <div className="rounded-2xl border p-3">
                <div className="text-xs uppercase text-muted-foreground mb-1">Rating</div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${
                        n <= rating.stars
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                {rating.review && <div className="text-sm mt-1 italic">"{rating.review}"</div>}
              </div>
            )}

            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? "text-muted-foreground" : ""} ${
        bold ? "font-bold text-base pt-1" : ""
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
