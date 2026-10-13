import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

// Vite is the dev server and bundler.
// CESIUM_BASE_URL tells Cesium where its static files live (see scripts/copy-cesium.mjs).
const root = fileURLToPath(new URL('.', import.meta.url)).replaceAll('\\', '/');
export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  // Do not watch raw downloads (the top-level data folder, not src/data) or the
  // generated map data (13,000+ files). After a data rebuild, reload the page
  // yourself with Ctrl + Shift + R.
  server: {
    port: 5173,
    watch: {ignored: [path => path.replaceAll('\\', '/').startsWith(root + 'data/'), '**/screenshots/**', '**/public/basemap/**', '**/public/tileset/**', '**/public/trees/**', '**/public/cesium/**']},
  },
  build: {chunkSizeWarningLimit: 4000},
});
