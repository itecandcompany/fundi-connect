import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { startOfflineQueueWorker } from "@/lib/offlineQueue";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FundiFast — Hire trusted local fundis in Tanzania" },
      {
        name: "description",
        content:
          "FundiFast connects you with verified plumbers, electricians, carpenters and mechanics nearby in real time. Request a fundi, track them live, pay a fair price.",
      },
      { property: "og:title", content: "FundiFast — Hire trusted local fundis in Tanzania" },
      {
        property: "og:description",
        content:
          "FundiFast connects you with verified plumbers, electricians, carpenters and mechanics nearby in real time. Request a fundi, track them live, pay a fair price.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "FundiFast — Hire trusted local fundis in Tanzania" },
      {
        name: "twitter:description",
        content:
          "FundiFast connects you with verified plumbers, electricians, carpenters and mechanics nearby in real time. Request a fundi, track them live, pay a fair price.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => startOfflineQueueWorker(), []);

  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
