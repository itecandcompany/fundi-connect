import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type JobStatus =
  | "searching"
  | "quoting"
  | "accepted"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

type QueueOperation = {
  id: string;
  jobId: string;
  attempts: number;
  nextAttemptAt: number;
} & (
  | {
      kind: "job-update";
      payload: Database["public"]["Tables"]["jobs"]["Update"];
    }
  | {
      kind: "location-backup";
      userId: string;
      payload: { lat: number; lng: number };
    }
);

type OfflineQueueState = {
  operations: QueueOperation[];
  processing: boolean;
  enqueueJobUpdate: (
    jobId: string,
    payload: Database["public"]["Tables"]["jobs"]["Update"],
  ) => void;
  enqueueLocationBackup: (jobId: string, userId: string, lat: number, lng: number) => void;
  processQueue: () => Promise<void>;
};

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

function operationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function runOperation(operation: QueueOperation) {
  if (operation.kind === "job-update") {
    const { error } = await supabase.from("jobs").update(operation.payload).eq("id", operation.jobId);
    if (error) throw error;
    return;
  }

  const lat = Number(operation.payload.lat);
  const lng = Number(operation.payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const [{ error: locationError }, { error: jobError }] = await Promise.all([
    supabase.from("job_locations").insert({
      job_id: operation.jobId,
      user_id: operation.userId,
      lat,
      lng,
    }),
    supabase.from("jobs").update({ fundi_lat: lat, fundi_lng: lng }).eq("id", operation.jobId),
  ]);
  if (locationError) throw locationError;
  if (jobError) throw jobError;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      operations: [],
      processing: false,
      enqueueJobUpdate: (jobId, payload) => {
        set((state) => ({
          operations: [
            ...state.operations,
            { id: operationId(), kind: "job-update", jobId, payload, attempts: 0, nextAttemptAt: 0 },
          ],
        }));
        void get().processQueue();
      },
      enqueueLocationBackup: (jobId, userId, lat, lng) => {
        set((state) => ({
          operations: [
            ...state.operations.filter(
              (operation) => !(operation.kind === "location-backup" && operation.jobId === jobId),
            ),
            {
              id: operationId(),
              kind: "location-backup",
              jobId,
              userId,
              payload: { lat, lng },
              attempts: 0,
              nextAttemptAt: 0,
            },
          ],
        }));
        void get().processQueue();
      },
      processQueue: async () => {
        if (get().processing || typeof navigator === "undefined" || !navigator.onLine) return;
        set({ processing: true });
        try {
          for (const operation of get().operations) {
            if (operation.nextAttemptAt > Date.now()) continue;
            try {
              await runOperation(operation);
              set((state) => ({
                operations: state.operations.filter((item) => item.id !== operation.id),
              }));
            } catch {
              const attempts = operation.attempts + 1;
              const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.min(attempts, 6));
              set((state) => ({
                operations: state.operations.map((item) =>
                  item.id === operation.id
                    ? { ...item, attempts, nextAttemptAt: Date.now() + delay }
                    : item,
                ),
              }));
            }
          }
        } finally {
          set({ processing: false });
        }
      },
    }),
    {
      name: "fundifast-offline-queue",
      partialize: (state) => ({ operations: state.operations }),
    },
  ),
);

export function startOfflineQueueWorker() {
  const process = () => void useOfflineQueue.getState().processQueue();
  window.addEventListener("online", process);
  const timer = window.setInterval(process, 2_000);
  process();
  return () => {
    window.removeEventListener("online", process);
    window.clearInterval(timer);
  };
}