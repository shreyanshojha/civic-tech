import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Static-site build. The output of `npm run build` is a folder of files that
 * can be opened from disk, served by `python3 -m http.server`, or dropped on any
 * static host. There is no server-side rendering, no API routes, and no runtime
 * that anyone has to operate.
 *
 * `base: './'` makes every asset path relative, which is what allows the built
 * site to work from a file:// URL and from a project subpath on GitHub Pages
 * without configuration.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    /**
     * TypeScript first, deliberately.
     *
     * Vite's default order puts `.js` ahead of `.tsx`, so a stray `Home.js`
     * left over from an old `tsc` emit sitting next to `Home.tsx` silently
     * becomes the module that ships — the build succeeds, the typecheck
     * passes, and the running site is compiled from source nobody is editing.
     * That happened in this repo. This ordering makes it impossible.
     */
    extensions: ['.tsx', '.ts', '.mts', '.jsx', '.js', '.mjs', '.json'],
    alias: {
      '@ftm/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
