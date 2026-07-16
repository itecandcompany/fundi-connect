import { defineConfig, loadEnv, mergeConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Inline VITE_* env vars into import.meta.env so they're available
  // consistently in both client and SSR bundles.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  const config = {
    define: envDefine,
    // Vite uses PostCSS in dev but Lightning CSS at build; forcing Lightning
    // CSS in both keeps dev preview and production output in sync.
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: "::" as const, port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error" as const,
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      viteReact(),
    ],
  };

  return mergeConfig(config, {
    ssr: {
      // Ensure server output lands where Vercel expects
      target: "node",
      noExternal: [],
    },
    build: {
      sourcemap: false,
    },
  });
});
