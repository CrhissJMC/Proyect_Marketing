import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api se redirige a la API local. En Docker lo hace nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4000" },
  },
});
