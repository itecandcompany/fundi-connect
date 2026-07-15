import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_META } from "@/lib/geo";
import { loadFlow, saveFlow } from "@/lib/bookingFlow";
import { uploadJobPhotos } from "@/lib/jobPhotos";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X, AlertCircle } from "lucide-react";
import FlowStepper from "@/components/FlowStepper";
import { toast } from "sonner";

export const Route = createFileRoute("/app/describe")({
  ssr: false,
  component: DescribePage,
});

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function DescribePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [service, setService] = useState<ReturnType<typeof loadFlow>["service"]>(null);

  useEffect(() => {
    const f = loadFlow();
    if (!f.service) {
      navigate({ to: "/app/service", replace: true });
      return;
    }
    setService(f.service);
    setTitle(f.problemTitle);
    setDescription(f.description);
    setExistingPhotos(f.photoUrls);
  }, [navigate]);

  // Autosave while typing so users don't lose progress
  useEffect(() => {
    if (!service) return;
    const id = window.setTimeout(() => {
      saveFlow({ problemTitle: title, description });
    }, 300);
    return () => window.clearTimeout(id);
  }, [title, description, service]);

  if (!service) return null;
  const meta = SERVICE_META[service];

  const totalPhotos = existingPhotos.length + files.length;
  const remaining = Math.max(0, MAX_FILES - totalPhotos);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const f of arr) {
      if (accepted.length >= remaining) {
        errors.push(`Only ${MAX_FILES} photos allowed`);
        break;
      }
      if (!f.type.startsWith("image/") && !ACCEPTED.includes(f.type)) {
        errors.push(`${f.name}: not an image`);
        continue;
      }
      if (f.size > MAX_SIZE_BYTES) {
        errors.push(`${f.name}: over ${MAX_SIZE_MB}MB`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    if (errors.length) {
      const msg = errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : "");
      setPhotoError(msg);
      toast.error(msg);
    } else {
      setPhotoError(null);
    }
  };

  const continueNext = async () => {
    if (!title.trim()) {
      toast.error("Add a short title for the problem");
      return;
    }
    let photoUrls = existingPhotos;
    if (files.length && user) {
      setUploading(true);
      try {
        const uploaded = await uploadJobPhotos(user.id, files);
        photoUrls = [...existingPhotos, ...uploaded];
      } finally {
        setUploading(false);
      }
    }
    saveFlow({
      problemTitle: title.trim(),
      description: description.trim(),
      photoUrls,
    });
    navigate({ to: "/app/find" });
  };

  return (
    <div className="min-h-[100svh] bg-background flex flex-col">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app/service"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="font-display font-bold leading-tight">Describe the problem</div>
            <div className="text-xs text-muted-foreground">Help fundis prepare</div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <FlowStepper step={2} />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-32 space-y-5">
        <Link
          to="/app/service"
          className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary transition-colors"
        >
          <div
            className="h-10 w-10 rounded-lg grid place-items-center text-xl"
            style={{ background: meta.color + "22", color: meta.color }}
          >
            {meta.icon}
          </div>
          <div className="flex-1">
            <div className="font-semibold leading-tight">{meta.label}</div>
            <div className="text-xs text-muted-foreground">Tap to change</div>
          </div>
        </Link>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Short title</label>
              <span className="text-[11px] text-muted-foreground">{title.length}/120</span>
            </div>
            <Input
              className="mt-1"
              placeholder="e.g. Leaking kitchen sink"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Details (optional)</label>
              <span className="text-[11px] text-muted-foreground">{description.length}/1000</span>
            </div>
            <Textarea
              className="mt-1"
              placeholder="Add any details that help the fundi prepare"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Photos (optional)</label>
              <span className="text-[11px] text-muted-foreground">
                {totalPhotos}/{MAX_FILES} · max {MAX_SIZE_MB}MB each
              </span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (remaining > 0) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={[
                "mt-1 rounded-xl border-2 border-dashed p-3 transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 bg-muted/20",
              ].join(" ")}
            >
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {existingPhotos.map((url) => (
                <div key={url} className="relative aspect-square">
                  <img src={url} alt="" className="h-full w-full object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() =>
                      setExistingPhotos((arr) => arr.filter((u) => u !== url))
                    }
                    className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-1 shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square">
                  <img
                    alt=""
                    src={URL.createObjectURL(f)}
                    className="h-full w-full object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((arr) => arr.filter((_, j) => j !== i));
                      setPhotoError(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-1 shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 right-1 text-[9px] bg-black/60 text-white rounded px-1 truncate">
                    {(f.size / 1024 / 1024).toFixed(1)}MB
                  </div>
                </div>
              ))}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed grid place-items-center text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-background/60"
                >
                  <div className="text-center">
                    <ImagePlus className="h-5 w-5 mx-auto" />
                    <div className="text-[10px] mt-1">Add</div>
                  </div>
                </button>
              )}
              </div>
              {totalPhotos === 0 && (
                <p className="text-center text-[11px] text-muted-foreground mt-2">
                  Drag photos here or tap Add
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            {photoError ? (
              <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {photoError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-2">
                Clear photos help fundis quote faster and more accurately.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Sticky continue bar */}
      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <Button
            className="w-full h-12 text-base"
            onClick={continueNext}
            disabled={uploading || !title.trim()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                See fundis near you
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}