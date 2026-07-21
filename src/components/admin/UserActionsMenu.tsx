import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreVertical, Ban, ShieldCheck, UserCog, Wrench } from "lucide-react";
import { adminSetUserSuspended, adminSetUserRole, adminUpdateFundi } from "@/lib/admin.functions";
import { SERVICE_META, type ServiceKey } from "@/lib/geo";

export type AppRole = "client" | "fundi" | "admin";

export type UserActionsFundi = {
  id: string;
  service: ServiceKey;
  hourly_rate: number;
  is_available: boolean;
};

export default function UserActionsMenu({
  userId,
  fullName,
  role,
  isSuspended,
  fundi,
  onChanged,
}: {
  userId: string;
  fullName: string;
  role: AppRole;
  isSuspended: boolean;
  fundi: UserActionsFundi | null;
  onChanged: () => void;
}) {
  const setSuspended = useServerFn(adminSetUserSuspended);
  const setRole = useServerFn(adminSetUserRole);
  const updateFundi = useServerFn(adminUpdateFundi);

  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmRole, setConfirmRole] = useState<AppRole | null>(null);
  const [editFundiOpen, setEditFundiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fundiForm, setFundiForm] = useState(
    fundi ?? { id: userId, service: "plumber" as ServiceKey, hourly_rate: 0, is_available: false },
  );

  const runSuspend = async () => {
    setBusy(true);
    try {
      await setSuspended({ data: { userId, suspended: !isSuspended } });
      toast.success(isSuspended ? `${fullName} unsuspended` : `${fullName} suspended`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update suspension");
    } finally {
      setBusy(false);
      setConfirmSuspend(false);
    }
  };

  const runRoleChange = async (newRole: AppRole) => {
    setBusy(true);
    try {
      await setRole({ data: { userId, role: newRole } });
      toast.success(`${fullName} is now ${newRole}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change role");
    } finally {
      setBusy(false);
      setConfirmRole(null);
    }
  };

  const runFundiUpdate = async () => {
    setBusy(true);
    try {
      await updateFundi({
        data: {
          fundiId: userId,
          service: fundiForm.service,
          hourlyRate: Number(fundiForm.hourly_rate),
          isAvailable: fundiForm.is_available,
        },
      });
      toast.success("Fundi details updated");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update fundi");
    } finally {
      setBusy(false);
      setEditFundiOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Actions for ${fullName}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{fullName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setConfirmSuspend(true)} className="gap-2">
            {isSuspended ? (
              <>
                <ShieldCheck className="h-4 w-4" /> Unsuspend account
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Suspend account</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <UserCog className="h-4 w-4" /> Change role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(["client", "fundi", "admin"] as const).map((r) => (
                <DropdownMenuItem
                  key={r}
                  disabled={r === role}
                  onClick={() => setConfirmRole(r)}
                  className="capitalize"
                >
                  {r}
                  {r === role && (
                    <span className="ml-auto text-xs text-muted-foreground">current</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {role === "fundi" && (
            <DropdownMenuItem onClick={() => setEditFundiOpen(true)} className="gap-2">
              <Wrench className="h-4 w-4" /> Edit fundi details
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Suspend confirmation */}
      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSuspended ? `Unsuspend ${fullName}?` : `Suspend ${fullName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSuspended
                ? "They'll immediately be able to sign in again."
                : "They'll be signed out and blocked from logging back in until you unsuspend them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runSuspend} disabled={busy}>
              {busy ? "Working…" : isSuspended ? "Unsuspend" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role change confirmation */}
      <AlertDialog open={confirmRole !== null} onOpenChange={(v) => !v && setConfirmRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change {fullName}'s role to {confirmRole}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRole === "fundi"
                ? "They'll gain access to the fundi dashboard and need to complete their service setup."
                : confirmRole === "admin"
                  ? "They'll gain full admin access to this dashboard."
                  : "They'll lose fundi access and their fundi profile will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRole && runRoleChange(confirmRole)}
              disabled={busy}
            >
              {busy ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit fundi details */}
      <Dialog open={editFundiOpen} onOpenChange={setEditFundiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit fundi details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service</Label>
              <Select
                value={fundiForm.service}
                onValueChange={(v) => setFundiForm({ ...fundiForm, service: v as ServiceKey })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.icon} {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">Hourly rate (TSh)</Label>
              <Input
                id="rate"
                type="number"
                min={0}
                value={fundiForm.hourly_rate}
                onChange={(e) =>
                  setFundiForm({ ...fundiForm, hourly_rate: Number(e.target.value) })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fundiForm.is_available}
                onChange={(e) => setFundiForm({ ...fundiForm, is_available: e.target.checked })}
              />
              Online / available for jobs
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFundiOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runFundiUpdate} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
