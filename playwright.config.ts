import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'cd apps/provider && NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev',
      url: 'http://127.0.0.1:3001',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'cd apps/app && NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev',
      url: 'http://127.0.0.1:3002',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
