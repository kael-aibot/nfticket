import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const testDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [path.resolve(testDir, 'setup.ts')],
    include: [path.resolve(testDir, '**/*.test.ts')],
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@tests': testDir,
    },
  },
});
