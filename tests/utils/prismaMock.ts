import { vi } from 'vitest';

function createFn() {
  return vi.fn();
}

export function createPrismaMock() {
  const prisma = {
    appState: {
      findUnique: createFn(),
      upsert: createFn(),
    },
    session: {
      findMany: createFn(),
      deleteMany: createFn(),
      create: createFn(),
      findUnique: createFn(),
    },
    userIdentity: {
      findUnique: createFn(),
      findFirst: createFn(),
      create: createFn(),
      update: createFn(),
      upsert: createFn(),
    },
    event: {
      findUnique: createFn(),
      findMany: createFn(),
      upsert: createFn(),
    },
    ticket: {
      findUnique: createFn(),
      findMany: createFn(),
      upsert: createFn(),
      update: createFn(),
    },
    order: {
      findUnique: createFn(),
      findUniqueOrThrow: createFn(),
      findFirst: createFn(),
      findMany: createFn(),
      create: createFn(),
      upsert: createFn(),
      update: createFn(),
      updateMany: createFn(),
    },
    scanAttempt: {
      findUnique: createFn(),
      create: createFn(),
    },
    scan: {
      findFirst: createFn(),
      create: createFn(),
      upsert: createFn(),
    },
    $transaction: createFn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));

  return prisma;
}

export const prismaMock = createPrismaMock();

function visitMocks(value: unknown, visitor: (mock: ReturnType<typeof vi.fn>) => void) {
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const entry of Object.values(value)) {
    if (typeof entry === 'function' && 'mockReset' in entry) {
      visitor(entry as ReturnType<typeof vi.fn>);
      continue;
    }

    visitMocks(entry, visitor);
  }
}

export function resetPrismaMock() {
  visitMocks(prismaMock, (mock) => {
    mock.mockReset();
  });

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
    callback(prismaMock),
  );
}
