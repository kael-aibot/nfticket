import { beforeEach, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './utils/prismaMock';

vi.mock('../apps/shared/lib/prisma', () => ({
  getPrismaClient: () => prismaMock,
}));

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.nfticket.test';
  process.env.SCANNER_JWT_SECRET = 'test-scanner-secret';
  process.env.DEVICE_ID_SALT = 'test-device-salt';

  resetPrismaMock();
});
