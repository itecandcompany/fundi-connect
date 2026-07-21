import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteRating } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/ratings")({ component: AdminRatings });

type Rating = {
  id: string;
  job_id: string;
  client_id: string;
  fundi_id: string;
  stars: number;
  review: string | null;
  created_at: string;
};

function AdminRatings() {
  const [rows, setRows] = useState<Rating[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deleteRating = useServerFn(adminDeleteRating);

  const load = async () => {
    const { data } = await supabase
      .from("ratings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data as Rating[]) ?? [];
    setRows(rows);

    const ids = Array.from(new Set(rows.flatMap((r) => [r.client_id, r.fundi_id])));
    if (ids.length) {
      const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      for (const r of p ?? []) map[r.id] = r.full_name;
      setNames(map);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteRating({ data: { ratingId: deleteTarget } });
      toast.success("Review removed");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Ratings & Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Moderate reviews left by clients after job completion.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No reviews yet.</div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="p-3 md:p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < r.stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="font-medium">{names[r.client_id] ?? "Unknown client"}</span>{" "}
                    <span className="text-muted-foreground">rated</span>{" "}
                    <span className="font-medium">{names[r.fundi_id] ?? "Unknown fundi"}</span>
                  </div>
                  {r.review && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {r.review}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 shrink-0"
                  onClick={() => setDeleteTarget(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the rating and review. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              {busy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
