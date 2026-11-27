import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Deployed to GitHub Pages under /<repo>/shop/ — set BASE_PATH in CI.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
