import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QrTicketPayload } from '../apps/shared/lib/types';
import { createMockResponse } from './utils/http';
import { prismaMock } from './utils/prismaMock';

const verifySessionMock = vi.fn();

vi.mock('../apps/shared/lib/secureAuth', async () => {
  const actual = await vi.importActual<typeof import('../apps/shared/lib/secureAuth')>('../apps/shared/lib/secureAuth');
  return {
    ...actual,
    verifySession: verifySessionMock,
  };
});

describe('scannerValidation security paths', () => {
  beforeEach(() => {
    verifySessionMock.mockReset();

    prismaMock.event.findUnique.mockResolvedValue({
      id: 'evt_1',
      name: 'Security Conference',
      organizerId: 'organizer_1',
      authorizedScanners: ['user:scanner_1'],
    });
    prismaMock.scanAttempt.findUnique.mockResolvedValue(null);
    prismaMock.scanAttempt.create.mockResolvedValue(undefined);
    prismaMock.scan.findFirst.mockResolvedValue(null);
    prismaMock.scan.create.mockResolvedValue(undefined);
    prismaMock.ticket.update.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it('issues a scanner token only for an authorized scanner session', async () => {
    verifySessionMock.mockResolvedValue({
      userId: 'scanner_1',
      sessionId: 'session_1',
      role: 'provider',
      email: 'scanner@example.com',
    });

    const { handleScannerTokenApi, handleValidateScanApi } = await loadScannerModule();
    const tokenRes = createMockResponse();

    await handleScannerTokenApi(
      {
        method: 'POST',
        cookies: { nfticket_session: 'session-token' },
        body: {
          eventId: 'evt_1',
          deviceFingerprint: 'device-abc',
        },
      },
      tokenRes,
    );

    expect(tokenRes.statusCode).toBe(200);
    expect(tokenRes.body).toMatchObject({
      eventId: 'evt_1',
      scannerUserId: 'scanner_1',
    });

    const detailedEvent = {
      id: 'evt_1',
      name: 'Security Conference',
      venue: 'Main Hall',
      startsAt: new Date('2026-04-01T10:00:00Z'),
      status: 'published',
      organizerId: 'organizer_1',
      authorizedScanners: ['user:scanner_1'],
      metadata: null,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      nftMode: 'compressed',
      description: 'desc',
    };
    prismaMock.event.findUnique
      .mockResolvedValueOnce(detailedEvent)
      .mockResolvedValueOnce(detailedEvent);
    prismaMock.ticket.findUnique.mockResolvedValueOnce({
      id: 'ticket_1',
      eventId: 'evt_1',
      ownerId: 'buyer_1',
      tierName: 'GA',
      seatLabel: null,
      faceValue: 100,
      status: 'minted',
      nftMode: 'compressed',
      assetId: null,
      transferCount: 0,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      metadata: null,
      order: { status: 'confirmed' },
    });

    const validateRes = createMockResponse();
    await handleValidateScanApi(
      {
        method: 'POST',
        headers: { authorization: `Bearer ${(tokenRes.body as { token: string }).token}` },
        body: {
          payload: buildQrPayload(),
          deviceFingerprint: 'device-abc',
          checkpoint: 'north-gate',
        },
      },
      validateRes,
    );

    expect(validateRes.statusCode).toBe(200);
    expect(validateRes.body).toMatchObject({
      success: true,
      status: 'accepted',
    });
  });

  it('rejects scan validation when the scanner token is replayed from a different device', async () => {
    verifySessionMock.mockResolvedValue({
      userId: 'scanner_1',
      sessionId: 'session_1',
      role: 'provider',
      email: 'scanner@example.com',
    });

    const { handleScannerTokenApi, handleValidateScanApi } = await loadScannerModule();
    const tokenRes = createMockResponse();

    await handleScannerTokenApi(
      {
        method: 'POST',
        cookies: { nfticket_session: 'session-token' },
        body: {
          eventId: 'evt_1',
          deviceFingerprint: 'device-abc',
        },
      },
      tokenRes,
    );

    const validateRes = createMockResponse();
    await handleValidateScanApi(
      {
        method: 'POST',
        headers: { authorization: `Bearer ${(tokenRes.body as { token: string }).token}` },
        body: {
          payload: buildQrPayload(),
          deviceFingerprint: 'different-device',
          checkpoint: 'north-gate',
        },
      },
      validateRes,
    );

    expect(validateRes.statusCode).toBe(403);
    expect(validateRes.body).toEqual({
      error: 'Device mismatch',
    });
    expect(prismaMock.scanAttempt.create).toHaveBeenCalledTimes(1);
  });
});

function buildQrPayload(overrides: Partial<QrTicketPayload> = {}): QrTicketPayload {
  return {
    type: 'nfticket',
    version: 2,
    ticketId: 'ticket_1',
    eventId: 'evt_1',
    issuedAt: Date.now(),
    ...overrides,
  };
}

async function loadScannerModule() {
  vi.resetModules();
  process.env.SCANNER_JWT_SECRET = 'test-scanner-secret';
  process.env.DEVICE_ID_SALT = 'test-device-salt';
  return import('../apps/shared/lib/scannerValidation');
}
