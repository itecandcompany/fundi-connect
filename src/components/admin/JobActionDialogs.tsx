import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminCancelJob, adminReassignJob } from "@/lib/admin.functions";
import type { ServiceKey } from "@/lib/geo";

type FundiOption = { id: string; full_name: string };

const UNASSIGN = "__unassign__";

export function CancelJobDialog({
  jobId,
  open,
  onOpenChange,
  onDone,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const cancelJob = useServerFn(adminCancelJob);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!jobId) return;
    setBusy(true);
    try {
      await cancelJob({ data: { jobId, reason: reason.trim() || "Cancelled by admin" } });
      toast.success("Job cancelled");
      setReason("");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel job");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this job?</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="cancel-reason">Reason (shown to both client and fundi)</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate request, fraud, client requested via support…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReassignJobDialog({
  jobId,
  service,
  open,
  onOpenChange,
  onDone,
}: {
  jobId: string | null;
  service: ServiceKey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const reassignJob = useServerFn(adminReassignJob);
  const [fundis, setFundis] = useState<FundiOption[]>([]);
  const [selectedFundi, setSelectedFundi] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadFundis = async () => {
    if (!service) return;
    const { data: fundiRows } = await supabase.from("fundis").select("id").eq("service", service);
    const ids = (fundiRows ?? []).map((f) => f.id);
    if (ids.length === 0) {
      setFundis([]);
      setLoaded(true);
      return;
    }
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    setFundis(profileRows ?? []);
    setLoaded(true);
  };

  const submit = async () => {
    if (!jobId) return;
    setBusy(true);
    try {
      const fundiId = selectedFundi === UNASSIGN ? null : selectedFundi || null;
      await reassignJob({ data: { jobId, fundiId } });
      toast.success(fundiId ? "Job reassigned" : "Job unassigned and reopened");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reassign job");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v && !loaded) loadFundis();
        if (!v) {
          setLoaded(false);
          setSelectedFundi("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign job</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Assign to</Label>
          <Select value={selectedFundi} onValueChange={setSelectedFundi}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a fundi…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGN}>Unassign (back to searching)</SelectItem>
              {fundis.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No fundis registered for this service
                </div>
              )}
              {fundis.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
