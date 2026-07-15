// Lightweight in-app notifications store, backed by localStorage so the
// notifications center survives reloads within the same browser.
import { useEffect, useState } from "react";

export type NotifKind = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  kind: NotifKind;
  createdAt: number;
  read: boolean;
  jobId?: string;
};

const KEY = "ff_notifications_v1";
const MAX = 50;

type Listener = (n: AppNotification[]) => void;
const listeners = new Set<Listener>();

function read(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function write(items: AppNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  listeners.forEach((l) => l(items));
}

export function pushNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">) {
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    read: false,
    ...n,
  };
  const next = [item, ...read()];
  write(next);
  return item;
}

export function markAllRead() {
  write(read().map((n) => ({ ...n, read: true })));
}

export function markRead(id: string) {
  write(read().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function removeNotification(id: string) {
  write(read().filter((n) => n.id !== id));
}

export function clearAll() {
  write([]);
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>(() => read());
  useEffect(() => {
    const l: Listener = (n) => setItems(n);
    listeners.add(l);
    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return items;
}