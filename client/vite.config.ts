import { defineConfig, type ViteDevServer, type WebSocketClient } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "my-plugin",
      configureServer(server: ViteDevServer) {
        server.ws.on("my:log", (data: any, _client: WebSocketClient) => {
          console.log("my:log from client vite config", data);
        });
      },
      transformIndexHtml(_html: string) {
        // Can transform HTML here if needed
        // For example, injecting scripts
      },
    },
  ],
});
