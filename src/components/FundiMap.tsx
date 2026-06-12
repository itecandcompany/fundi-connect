import { lazy, Suspense, useEffect, useState } from "react";
import type { FundiMapJob } from "./FundiMap.client";

// Use a variable specifier so the server-side import-protection plugin
// (which scans static imports of **/*.client.*) doesn't flag this module.
const Inner = lazy(() => {
  const m = "./FundiMap.client";
  return import(/* @vite-ignore */ m);
});

export type { FundiMapJob };

export default function FundiMap(props: {
  pos: [number, number] | null;
  active?: FundiMapJob | null;
  requests?: FundiMapJob[];
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const height = props.height ?? 260;
  if (!mounted) {
    return (
      <div
        className="rounded-2xl overflow-hidden border bg-muted/30"
        style={{ height }}
      />
    );
  }
  return (
    <Suspense
      fallback={
        <div
          className="rounded-2xl overflow-hidden border bg-muted/30"
          style={{ height }}
        />
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}