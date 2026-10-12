import {defineConfig} from 'vite';

// Vite is the dev server and bundler.
// CESIUM_BASE_URL tells Cesium where its static files live (see scripts/copy-cesium.mjs).
export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  server: {port: 5173},
  build: {chunkSizeWarningLimit: 4000},
});
