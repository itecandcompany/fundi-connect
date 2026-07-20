import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/")({
  loader: () => redirect({ to: "/blog/index.html" }),
});

export const Route2 = createFileRoute("/blog/index.html")({
  component: () => {
    if (typeof window !== "undefined") {
      window.location.href = "/blog/index.html";
    }
    return null;
  },
});
