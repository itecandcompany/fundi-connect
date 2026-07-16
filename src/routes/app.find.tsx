import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SERVICE_META, formatTsh } from "@/lib/geo";
import { clearFlow, loadFlow } from "@/lib/bookingFlow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import LiveMap from "@/components/LiveMap";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { ServiceKey } from "@/lib/geo";

export const Route = createFileRoute("/app/find")({
  ssr: false,
  component: FindPage,
});

function FindPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState<ServiceKey | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  // Load flow + check for existing active job
  useEffect(() => {
    const f = loadFlow();
    if (!f.service) {
      navigate({ to: "/app/service", replace: true });
      return;
    }
    setService(f.service);
    setTitle(f.problemTitle);
    setDescription(f.description);
    setPhotoUrls(f.photoUrls);
  }, [navigate]);

  // Track user position for the request payload
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const submitRequest = async () => {
    if (!service) return;
    if (!user) {
      toast.error("You need to sign in first");
      return;
    }
    if (!pos) {
      toast.error("Waiting for your GPS…");
      return;
    }
    if (!title.trim()) {
      navigate({ to: "/app/describe" });
      return;
    }
    setSubmitting(true);
    const startingPrice = SERVICE_META[service].price;
    const commission = Math.round(startingPrice * 0.1);
    const { error } = await supabase.from("jobs").insert({
      client_id: user.id,
      service,
      price: startingPrice,
      commission,
      status: "searching",
      client_lat: pos[0],
      client_lng: pos[1],
      problem_title: title.trim(),
      problem_description: description.trim() || null,
      job_photos: photoUrls,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent — fundis are sending quotes");
    clearFlow();
  };

  if (!service) return null;
  const meta = SERVICE_META[service];

  return (
    <div className="h-[100svh] flex flex-col bg-background">
      <header className="bg-background/90 backdrop-blur border-b z-20">
        <div className="px-4 py-3 flex items-center gap-3">
          {!hasActive && (
            <Button asChild variant="ghost" size="icon">
              <Link to="/app/describe">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold leading-tight truncate">Fundis near you</div>
            <div className="text-xs text-muted-foreground truncate">
              {meta.icon} {meta.label}
              {title ? ` · ${title}` : ""}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 relative">
        <LiveMap
          service={service}
          setService={(s) => setService(s)}
          hideIdleSheet
          onActiveJobChange={(j) => setHasActive(!!j)}
        />

        {hasActive === false && (
          <div className="absolute inset-x-0 bottom-0 z-[1100] p-3 pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border bg-background/95 backdrop-blur shadow-xl p-4">
              <div className="flex items-start gap-3">
                <div
                  className="h-10 w-10 rounded-lg grid place-items-center text-xl shrink-0"
                  style={{ background: meta.color + "22", color: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight truncate">
                    {title || `Request a ${meta.label.toLowerCase()}`}
                  </div>
                  {description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Starting price {formatTsh(meta.price)} · fundis quote back
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/app/describe">Edit</Link>
                </Button>
                <Button
                  className="flex-[2] h-11"
                  onClick={submitRequest}
                  disabled={submitting || !pos}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Request fundi
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
