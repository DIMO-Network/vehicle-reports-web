import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: {
    port: 5173,
    https: true,
    host: true, // Allow external connections
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  resolve: {
    alias: {
      // When code asks for the Node built-in "events",
      // it will resolve to the npm "events" package.
      events: 'events'
    }
  },
  build: {
    chunkSizeWarningLimit: 1000
  },
  plugins: [mkcert()],
  define: {
    global: 'globalThis',
  }
})
