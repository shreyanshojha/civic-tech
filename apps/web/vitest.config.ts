import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Unit tests for the web app.
 *
 * Deliberately node-only: nothing here needs a DOM. The logic worth testing in
 * this app is pure (ranking, text fitting, formatting), and keeping the
 * environment plain node means `npm test` stays fast and has no jsdom to keep
 * in step with the real browser. Anything that genuinely needs a browser is
 * verified in one, not simulated.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@ftm/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
