import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:8080";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 3000,
        strictPort: true, // Optional: fails instead of auto-switching if port 3000 is busy
        host: true, // listen on the network, not just localhost — needed to
        // reach the dev server from a phone on the same WiFi
        allowedHosts: [
            "bulgur-kindred-groove.ngrok-free.dev",
            // Add any other ngrok/tunnel hostnames here if the reserved
            // domain ever changes, or use true to allow any host (less safe,
            // fine for short-lived team testing, not for anything public-facing
            // long-term).
        ],
        proxy: {
            // Forward API calls and the socket.io handshake to the backend
            // running on 8080. This means only ONE public URL (this Vite dev
            // server's) needs to be exposed via ngrok/tunnel — the browser
            // talks to this same origin for everything, and Vite quietly
            // relays it to the backend behind the scenes.
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
                ws: true, // required for Socket.IO's websocket upgrade
                changeOrigin: true,
            },
        },
    },
});
