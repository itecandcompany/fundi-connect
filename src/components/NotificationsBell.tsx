import { useMemo, useState } from "react";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotifications,
  markAllRead,
  markRead,
  removeNotification,
  clearAll,
  type AppNotification,
} from "@/lib/notifications";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

const KIND_DOT: Record<AppNotification["kind"], string> = {
  info: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export default function NotificationsBell() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white font-semibold text-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={markAllRead}
                  title="Mark all read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearAll}
                  title="Clear all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              You're all caught up
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={[
                    "px-3 py-2.5 flex gap-2 items-start group",
                    n.read ? "" : "bg-muted/40",
                  ].join(" ")}
                  onClick={() => !n.read && markRead(n.id)}
                >
                  <span
                    className={[
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      KIND_DOT[n.kind],
                    ].join(" ")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{n.title}</div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}