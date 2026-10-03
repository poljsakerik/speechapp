import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import en from "./public/locales/en/common.json" with { type: "json" };

export default defineConfig({
  plugins: [
    {
      name: "localized-html",
      transformIndexHtml: (html) =>
        html
          .replace("%APP_TITLE%", en.metadataTitle)
          .replace("%APP_DESCRIPTION%", en.metadataDescription),
    },
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    // API_PORT lets a second checkout run beside the default one; the backend reads the same port as PORT.
    proxy: { "/trpc": `http://127.0.0.1:${process.env.API_PORT ?? 8000}` },
  },
});
