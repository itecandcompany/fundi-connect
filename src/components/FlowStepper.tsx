import { Check } from "lucide-react";

const STEPS = ["Service", "Describe", "Find"] as const;

export default function FlowStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold border transition-colors ${
                done
                  ? "bg-primary text-primary-foreground border-primary"
                  : active
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span
              className={`text-[11px] font-medium truncate hidden sm:inline ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {n < 3 && (
              <div
                className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}