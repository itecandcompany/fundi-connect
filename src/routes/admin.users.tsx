import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SERVICE_META, formatTsh, type ServiceKey } from "@/lib/geo";
import { Search, Star } from "lucide-react";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "client" | "fundi" | "admin";
  created_at: string;
};
type Fundi = {
  id: string;
  service: ServiceKey;
  hourly_rate: number;
  is_available: boolean;
  rating: number;
  total_jobs: number;
};

function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fundis, setFundis] = useState<Record<string, Fundi>>({});
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "client" | "fundi" | "admin">("all");

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("fundis").select("*"),
      ]);
      setProfiles((p as Profile[]) ?? []);
      const map: Record<string, Fundi> = {};
      for (const r of (f as Fundi[]) ?? []) map[r.id] = r;
      setFundis(map);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return profiles.filter((p) => {
      if (tab !== "all" && p.role !== tab) return false;
      if (!ql) return true;
      return p.full_name.toLowerCase().includes(ql) || (p.phone ?? "").toLowerCase().includes(ql);
    });
  }, [profiles, q, tab]);

  const counts = useMemo(() => {
    const c = { all: profiles.length, client: 0, fundi: 0, admin: 0 };
    for (const p of profiles) c[p.role]++;
    return c;
  }, [profiles]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Users & Fundis</h1>
        <p className="text-sm text-muted-foreground">Browse everyone on the platform.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "client", "fundi", "admin"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm border transition-colors capitalize ${
              tab === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-background"
            }`}
          >
            {t} <span className="opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No users found.</div>
          )}
          {filtered.map((p) => {
            const f = fundis[p.id];
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 md:p-4 hover:bg-muted/40">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">
                  {p.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{p.full_name}</div>
                    <Badge
                      variant={
                        p.role === "admin"
                          ? "default"
                          : p.role === "fundi"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {p.role}
                    </Badge>
                    {f && (
                      <span className="text-xs text-muted-foreground">
                        {SERVICE_META[f.service]?.icon} {SERVICE_META[f.service]?.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.phone ?? "No phone"} · joined {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                {f && (
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="flex items-center gap-1 text-sm justify-end">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {Number(f.rating).toFixed(1)}
                      <span className="text-muted-foreground">· {f.total_jobs} jobs</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTsh(f.hourly_rate)}/hr ·{" "}
                      <span className={f.is_available ? "text-green-600" : "text-muted-foreground"}>
                        {f.is_available ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
