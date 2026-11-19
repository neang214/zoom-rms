import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:8080"
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: devProxyTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: devProxyTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
