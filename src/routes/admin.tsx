import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_META, type ServiceKey, formatTsh } from "@/lib/geo";
import { toast } from "sonner";
import { Loader2, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Template = {
  id: string;
  service: ServiceKey;
  title: string;
  description: string | null;
  suggested_price: number;
  is_active: boolean;
};

function AdminPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Template[]>([]);
  const [service, setService] = useState<ServiceKey>("plumber");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { role: "client" } });
    else if (profile && profile.role !== "admin") navigate({ to: "/app" });
  }, [user, profile, loading, navigate]);

  const load = async () => {
    const { data } = await supabase
      .from("problem_templates")
      .select("*")
      .order("service")
      .order("suggested_price");
    setRows((data as Template[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!title.trim() || !Number(price)) {
      toast.error("Title and price are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("problem_templates").insert({
      service,
      title: title.trim(),
      description: description.trim() || null,
      suggested_price: Number(price),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Problem template added");
    setTitle("");
    setDescription("");
    setPrice("");
    load();
  };

  const toggle = async (r: Template) => {
    await supabase
      .from("problem_templates")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("problem_templates").delete().eq("id", id);
    load();
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <div className="font-display font-bold">Admin · Problem catalog</div>
          <div />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-4 space-y-3">
          <div className="font-display font-semibold">Add a problem template</div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {(Object.keys(SERVICE_META) as ServiceKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setService(k)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  service === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border"
                }`}
              >
                {SERVICE_META[k].icon} {SERVICE_META[k].label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Problem title (e.g. Leaking pipe)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Suggested base price (TSh)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button onClick={add} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add template"}
          </Button>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-display font-semibold">Existing templates</div>
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">No templates yet.</div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border rounded-xl p-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {SERVICE_META[r.service].icon} {r.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.description || "—"} · {formatTsh(r.suggested_price)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant={r.is_active ? "outline" : "secondary"} onClick={() => toggle(r)}>
                  {r.is_active ? "Active" : "Hidden"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}