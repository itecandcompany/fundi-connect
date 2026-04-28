// Haversine distance in km
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough ETA assuming 30 km/h urban avg
export function etaMinutes(km: number, avgKmh = 30) {
  return Math.max(1, Math.round((km / avgKmh) * 60));
}

export const SERVICE_META = {
  plumber: { label: "Plumber", icon: "🔧", price: 25000, color: "#2563eb" },
  electrician: { label: "Electrician", icon: "⚡", price: 30000, color: "#eab308" },
  carpenter: { label: "Carpenter", icon: "🪚", price: 20000, color: "#b45309" },
  mechanic: { label: "Mechanic", icon: "🔩", price: 35000, color: "#64748b" },
} as const;

export type ServiceKey = keyof typeof SERVICE_META;

// Dar es Salaam default
export const DEFAULT_CENTER = { lat: -6.7924, lng: 39.2083 };

export function formatTsh(n: number) {
  return new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(n) + " TSh";
}
