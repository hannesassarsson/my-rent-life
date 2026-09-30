import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    // Nitro builds the deployable server. The preset is auto-detected on
    // Vercel/Netlify/Cloudflare, otherwise Node (override with NITRO_PRESET).
    ...(command === "build"
      ? [
          nitro({
            // Dagligt jobb på Vercel som skickar utskick som blivit liggande
            // (de skickas annars direkt när notiserna skapas).
            vercel: {
              config: { version: 3, crons: [{ path: "/api/utskick", schedule: "0 6 * * *" }] },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
