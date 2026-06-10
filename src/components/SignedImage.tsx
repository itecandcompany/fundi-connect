import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();

function extractPath(stored: string): string | null {
  // Accept either a stored full URL or a raw object path.
  const m = stored.match(/\/object\/(?:public|sign|authenticated)\/job-photos\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (!stored.startsWith("http")) return stored.replace(/^\/+/, "");
  return null;
}

export function useSignedJobPhotoUrl(stored: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!stored) {
      setUrl(null);
      return;
    }
    const path = extractPath(stored);
    if (!path) {
      setUrl(stored);
      return;
    }
    const hit = cache.get(path);
    const now = Date.now();
    if (hit && hit.exp > now + 30_000) {
      setUrl(hit.url);
      return;
    }
    supabase.storage
      .from("job-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(path, { url: data.signedUrl, exp: now + 3600_000 });
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [stored]);
  return url;
}

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src: string };

export default function SignedImage({ src, ...rest }: Props) {
  const signed = useSignedJobPhotoUrl(src);
  return (
    <img
      {...rest}
      src={signed ?? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>"}
    />
  );
}