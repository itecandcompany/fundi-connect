import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Check, CheckCheck } from "lucide-react";

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export default function JobChat({
  jobId,
  open,
  onOpenChange,
  title,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
}) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId || !open) return;
    let cancelled = false;
    supabase
      .from("job_messages")
      .select("id, sender_id, body, created_at, read_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .then(({ data }) => !cancelled && setMsgs((data as Msg[]) ?? []));
    const ch = supabase
      .channel(`chat-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_messages", filter: `job_id=eq.${jobId}` },
        (p) => {
          if (p.eventType === "INSERT") {
            setMsgs((prev) =>
              prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg],
            );
          } else if (p.eventType === "UPDATE") {
            const n = p.new as Msg;
            setMsgs((prev) => prev.map((m) => (m.id === n.id ? { ...m, ...n } : m)));
          }
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [jobId, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Mark incoming unread messages as read whenever the sheet is open
  useEffect(() => {
    if (!jobId || !open || !user) return;
    const unread = msgs.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    const stamp = new Date().toISOString();
    supabase
      .from("job_messages")
      .update({ read_at: stamp })
      .in("id", unread)
      .then(({ error }) => {
        if (error) return;
        setMsgs((prev) => prev.map((m) => (unread.includes(m.id) ? { ...m, read_at: stamp } : m)));
      });
  }, [jobId, open, user?.id, msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || !jobId || !user) return;
    setSending(true);
    const { error } = await supabase
      .from("job_messages")
      .insert({ job_id: jobId, sender_id: user.id, body });
    setSending(false);
    if (!error) setText("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[80vh] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Start the conversation — agree on the price and details.
            </div>
          )}
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <div>{m.body}</div>
                  {mine && (
                    <div className="flex justify-end mt-0.5 opacity-80">
                      {m.read_at ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form
          className="p-3 border-t flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
