import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatTsh } from "@/lib/geo";
import { Briefcase, Users, Wrench, DollarSign, Activity, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

type Kpis = {
  totalUsers: number;
  totalFundis: number;
  fundisOnline: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  revenue: number;
  commission: number;
};

function AdminOverview() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [users, fundis, online, jobsAll, jobsActive, jobsDone, tx] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("fundis").select("id", { count: "exact", head: true }),
        supabase.from("fundis").select("id", { count: "exact", head: true }).eq("is_available", true),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["searching", "quoting", "accepted", "on_the_way", "arrived", "in_progress"]),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("transactions").select("amount, commission"),
      ]);

      if (cancelled) return;
      const revenue = (tx.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const commission = (tx.data ?? []).reduce((s, r) => s + Number(r.commission ?? 0), 0);
      setKpis({
        totalUsers: users.count ?? 0,
        totalFundis: fundis.count ?? 0,
        fundisOnline: online.count ?? 0,
        totalJobs: jobsAll.count ?? 0,
        activeJobs: jobsActive.count ?? 0,
        completedJobs: jobsDone.count ?? 0,
        revenue,
        commission,
      });
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const cards = [
    { label: "Total users", value: kpis?.totalUsers ?? "—", icon: Users, color: "text-blue-600" },
    { label: "Registered fundis", value: kpis?.totalFundis ?? "—", icon: Wrench, color: "text-amber-600" },
    { label: "Fundis online now", value: kpis?.fundisOnline ?? "—", icon: Activity, color: "text-green-600" },
    { label: "Total jobs", value: kpis?.totalJobs ?? "—", icon: Briefcase, color: "text-indigo-600" },
    { label: "Active jobs", value: kpis?.activeJobs ?? "—", icon: Activity, color: "text-orange-600" },
    { label: "Completed jobs", value: kpis?.completedJobs ?? "—", icon: CheckCircle2, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Live snapshot of the platform. Refreshes every 15s.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
                <div className="font-display text-2xl font-bold mt-1">{c.value}</div>
              </div>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Gross revenue</div>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="font-display text-3xl font-bold">
            {kpis ? formatTsh(kpis.revenue) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Sum of all completed jobs</div>
        </Card>
        <Card className="p-5 bg-primary text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium opacity-90">Platform commission (10%)</div>
            <DollarSign className="h-4 w-4 opacity-90" />
          </div>
          <div className="font-display text-3xl font-bold">
            {kpis ? formatTsh(kpis.commission) : "—"}
          </div>
          <div className="text-xs opacity-90 mt-1">Total earned by FundiFast</div>
        </Card>
      </div>
    </div>
  );
}