import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// On GitHub Pages the site lives under /<repo>/ — set BASE_PATH in CI (e.g. /birthday-wish-list/).
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1000 }, // html2pdf is lazy-loaded only on the bill page
});
