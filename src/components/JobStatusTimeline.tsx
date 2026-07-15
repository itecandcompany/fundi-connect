import { Check, Loader2 } from "lucide-react";

export type TimelineStatus =
  | "searching"
  | "quoting"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

const STEPS: { key: TimelineStatus; label: string }[] = [
  { key: "searching", label: "Searching" },
  { key: "accepted", label: "Accepted" },
  { key: "on_the_way", label: "On the way" },
  { key: "arrived", label: "Arrived" },
];

const ORDER: Record<TimelineStatus, number> = {
  searching: 0,
  quoting: 0,
  accepted: 1,
  on_the_way: 2,
  arrived: 3,
  in_progress: 3,
  completed: 3,
  cancelled: -1,
};

export default function JobStatusTimeline({
  status,
  compact = false,
}: {
  status: TimelineStatus;
  compact?: boolean;
}) {
  const current = ORDER[status] ?? 0;
  const isCancelled = status === "cancelled";

  return (
    <div className={compact ? "" : "px-1"}>
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = !isCancelled && i < current;
          const active = !isCancelled && i === current;
          return (
            <div key={s.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={[
                    "h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold border-2 transition-colors",
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-muted-foreground/30 text-muted-foreground",
                  ].join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                {!compact && (
                  <div
                    className={[
                      "mt-1 text-[10px] leading-tight text-center max-w-[64px]",
                      active
                        ? "text-foreground font-medium"
                        : done
                          ? "text-foreground/80"
                          : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-1 rounded transition-colors",
                    i < current ? "bg-primary" : "bg-muted-foreground/20",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}