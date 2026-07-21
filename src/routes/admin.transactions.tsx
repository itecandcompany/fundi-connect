import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatTsh } from "@/lib/geo";
import { Wallet, TrendingUp, Percent } from "lucide-react";

export const Route = createFileRoute("/admin/transactions")({ component: AdminTransactions });

type Transaction = {
  id: string;
  job_id: string;
  fundi_id: string;
  amount: number;
  commission: number;
  fundi_earnings: number;
  created_at: string;
};

function AdminTransactions() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [fundiNames, setFundiNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = (data as Transaction[]) ?? [];
      setRows(rows);

      const ids = Array.from(new Set(rows.map((r) => r.fundi_id)));
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map: Record<string, string> = {};
        for (const r of p ?? []) map[r.id] = r.full_name;
        setFundiNames(map);
      }
    };
    load();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        volume: acc.volume + Number(r.amount),
        commission: acc.commission + Number(r.commission),
        payouts: acc.payouts + Number(r.fundi_earnings),
      }),
      { volume: 0, commission: 0, payouts: 0 },
    );
  }, [rows]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        <p className="text-sm text-muted-foreground">Revenue ledger for every completed job.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
            <TrendingUp className="h-3.5 w-3.5" /> Total volume
          </div>
          <div className="text-xl font-bold mt-1">{formatTsh(totals.volume)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
            <Percent className="h-3.5 w-3.5" /> Platform commission
          </div>
          <div className="text-xl font-bold mt-1">{formatTsh(totals.commission)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
            <Wallet className="h-3.5 w-3.5" /> Paid to fundis
          </div>
          <div className="text-xl font-bold mt-1">{formatTsh(totals.payouts)}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y">
          {rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No transactions yet.
            </div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 md:p-4 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{fundiNames[r.fundi_id] ?? "Unknown fundi"}</div>
                <div className="text-xs text-muted-foreground">
                  Job {r.job_id.slice(0, 8)} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{formatTsh(r.amount)}</div>
                <div className="text-xs text-muted-foreground">
                  commission {formatTsh(r.commission)} · payout {formatTsh(r.fundi_earnings)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
