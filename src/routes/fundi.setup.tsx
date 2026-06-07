import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SERVICE_META, type ServiceKey, formatTsh } from "@/lib/geo";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/fundi/setup")({
  ssr: false,
  component: FundiSetup,
});

const SERVICES = Object.entries(SERVICE_META) as [
  ServiceKey,
  (typeof SERVICE_META)[ServiceKey],
][];

function FundiSetup() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceKey | null>(null);
  const [rate, setRate] = useState("15000");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { role: "fundi" } });
      return;
    }
    if (profile && profile.role !== "fundi") {
      navigate({ to: "/app" });
      return;
    }
    supabase
      .from("fundis")
      .select("service, hourly_rate, bio")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setService(data.service as ServiceKey);
          setRate(String(data.hourly_rate));
          setBio(data.bio ?? "");
        }
        setHydrating(false);
      });
  }, [user?.id, profile?.role, loading, navigate]);

  const submit = async () => {
    if (!user || !service) {
      toast.error("Pick a service category");
      return;
    }
    const rateNum = Number(rate);
    if (!(rateNum > 0)) {
      toast.error("Enter a valid hourly rate");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("fundis").upsert({
      id: user.id,
      service,
      hourly_rate: rateNum,
      bio: bio.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You're all set — welcome aboard!");
    navigate({ to: "/app" });
  };

  if (loading || hydrating) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div>
          <h1 className="font-display font-bold text-3xl">Fundi setup</h1>
          <p className="text-muted-foreground mt-1">
            Pick your trade so we can match you with the right jobs.
          </p>
        </div>

        <Card className="p-5 space-y-3">
          <Label className="text-sm font-semibold">Your service category</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SERVICES.map(([key, meta]) => {
              const active = service === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setService(key)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="text-3xl">{meta.icon}</div>
                  <div className="font-semibold mt-2">{meta.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    avg {formatTsh(meta.price)}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="rate">Hourly rate (TSh)</Label>
            <Input
              id="rate"
              type="number"
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="bio">Short bio (optional)</Label>
            <Textarea
              id="bio"
              rows={3}
              placeholder="Years of experience, specialties, languages…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </Card>

        <Button
          onClick={submit}
          disabled={busy || !service}
          className="w-full h-12 bg-gradient-primary"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}