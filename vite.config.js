import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works whether it is served from a domain
  // root or from a GitHub Pages project subpath (/repo-name/). Absolute paths
  // break the latter, which is the usual cause of a blank deployed page.
  base: './',
  build: {
    chunkSizeWarningLimit: 800,
    // flag-icons ships ~540 SVGs. Vite inlines any asset under 4 kB into the CSS
    // as a data URI, which put ~400 kB of flags nobody had asked for into the
    // first page load. Kept as files, each flag downloads only when shown.
    assetsInlineLimit: (file) => (file.includes('flag-icons') ? false : undefined)
  }
});
