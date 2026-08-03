import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works whether it is served from a domain
  // root or from a GitHub Pages project subpath (/repo-name/). Absolute paths
  // break the latter, which is the usual cause of a blank deployed page.
  base: './',
  build: {
    chunkSizeWarningLimit: 800
  }
});
