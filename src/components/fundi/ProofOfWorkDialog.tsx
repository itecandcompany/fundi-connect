import { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProofMode = "start" | "complete";

export type ProofResult = {
  photoUrls: string[];
  signatureUrl?: string | null;
};

async function uploadFile(userId: string, jobId: string, kind: string, file: Blob, ext: string) {
  const path = `${userId}/${jobId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await supabase.storage.from("job-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });
  if (error) throw error;
  return supabase.storage.from("job-photos").getPublicUrl(path).data.publicUrl;
}

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!dirty.current) return onChange(null);
    ref.current!.toBlob((b) => onChange(b), "image/png");
  };

  const clear = () => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    dirty.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-white touch-none">
        <canvas
          ref={ref}
          className="w-full h-32 block rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Client signs here</span>
        <button type="button" onClick={clear} className="text-muted-foreground inline-flex items-center gap-1">
          <RotateCcw className="h-3 w-3" /> Clear
        </button>
      </div>
    </div>
  );
}

export default function ProofOfWorkDialog({
  open,
  mode,
  userId,
  jobId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: ProofMode;
  userId: string;
  jobId: string;
  onClose: () => void;
  onSubmit: (r: ProofResult) => Promise<void> | void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [sigBlob, setSigBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setSigBlob(null);
      setBusy(false);
    }
  }, [open]);

  const requiresSignature = mode === "complete";
  const canSubmit =
    files.length > 0 && (!requiresSignature || sigBlob !== null) && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const kind = mode === "start" ? "before" : "after";
      const photoUrls: string[] = [];
      for (const f of files.slice(0, 5)) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const url = await uploadFile(userId, jobId, kind, f, ext);
        photoUrls.push(url);
      }
      let signatureUrl: string | null = null;
      if (sigBlob) {
        signatureUrl = await uploadFile(userId, jobId, "signature", sigBlob, "png");
      }
      await onSubmit({ photoUrls, signatureUrl });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "start" ? "Before-work photos" : "Job completion proof"}
          </DialogTitle>
          <DialogDescription>
            {mode === "start"
              ? "Take at least one photo of the problem before you start. The client will see these."
              : "Take at least one 'after' photo and have the client sign to confirm completion."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">
              {mode === "start" ? "Before photos" : "After photos"}
              <span className="text-muted-foreground"> (up to 5)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-20 w-20 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {files.length < 5 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border-2 border-dashed grid place-items-center text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Camera className="h-5 w-5" />
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list) return;
                  setFiles((cur) => [...cur, ...Array.from(list)].slice(0, 5));
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {requiresSignature && (
            <div>
              <div className="text-sm font-medium mb-2">Client signature</div>
              <SignaturePad onChange={setSigBlob} />
            </div>
          )}

          <Button className="w-full h-11" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "start" ? (
              "Start the job"
            ) : (
              "Submit & complete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}