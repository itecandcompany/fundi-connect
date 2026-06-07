import type { ServiceKey } from "./geo";

const KEY = "ff_booking_flow_v1";

export type BookingFlow = {
  service: ServiceKey | null;
  problemTitle: string;
  description: string;
  photoUrls: string[];
};

const empty: BookingFlow = {
  service: null,
  problemTitle: "",
  description: "",
  photoUrls: [],
};

export function loadFlow(): BookingFlow {
  if (typeof window === "undefined") return empty;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function saveFlow(patch: Partial<BookingFlow>) {
  if (typeof window === "undefined") return;
  const next = { ...loadFlow(), ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function clearFlow() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}