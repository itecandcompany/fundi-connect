import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { SERVICE_META, type ServiceKey } from "@/lib/geo";

function meIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative"><div style="position:absolute;inset:-12px;background:#22c55e;opacity:.25;border-radius:50%;animation:pulse 2s infinite"></div><div style="background:#16a34a;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,.3);position:relative"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function clientIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;border:2px solid white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,.25)">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!points.length) return;
    const key = points.map((p) => p.join(",")).join("|");
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export type FundiMapJob = {
  id: string;
  service: ServiceKey;
  client_lat: number;
  client_lng: number;
  problem_title?: string | null;
};

export default function FundiMap({
  pos,
  active,
  requests = [],
  height = 260,
}: {
  pos: [number, number] | null;
  active?: FundiMapJob | null;
  requests?: FundiMapJob[];
  height?: number;
}) {
  const center: [number, number] = pos ?? [-6.7924, 39.2083];

  const bounds = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (pos) pts.push(pos);
    if (active) pts.push([active.client_lat, active.client_lng]);
    else for (const r of requests) pts.push([r.client_lat, r.client_lng]);
    return pts;
  }, [pos, active?.id, active?.client_lat, active?.client_lng, requests]);

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#0b1220" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={bounds} />

        {pos && (
          <Marker position={pos} icon={meIcon()}>
            <Popup>You</Popup>
          </Marker>
        )}

        {active && (
          <>
            <Marker
              position={[active.client_lat, active.client_lng]}
              icon={clientIcon(SERVICE_META[active.service].color, "📍")}
            >
              <Popup>{active.problem_title || "Client"}</Popup>
            </Marker>
            {pos && (
              <Polyline
                positions={[pos, [active.client_lat, active.client_lng]]}
                pathOptions={{
                  color: SERVICE_META[active.service].color,
                  weight: 4,
                  opacity: 0.7,
                  dashArray: "8 8",
                }}
              />
            )}
          </>
        )}

        {!active &&
          requests.map((r) => (
            <Marker
              key={r.id}
              position={[r.client_lat, r.client_lng]}
              icon={clientIcon(SERVICE_META[r.service].color, SERVICE_META[r.service].icon)}
            >
              <Popup>{r.problem_title || SERVICE_META[r.service].label}</Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
