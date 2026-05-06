import { supabase } from "@/integrations/supabase/client";

export async function uploadJobPhotos(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files.slice(0, 5)) {
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("job-photos").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || "image/jpeg",
    });
    if (error) continue;
    const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}