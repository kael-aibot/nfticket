import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from './apiErrors';
import { createPrefixedId } from './ids';
import { getPrismaClient } from './prisma';
import {
  matchesAuthorizedScannerLabel,
  normalizeScannerLabel,
} from './scannerCredentials';
import { verifySession } from './secureAuth';
import type {
  EventRecord,
  QrTicketPayload,
  ScannerLocation,
  ScannerValidationResult,
  TicketRecord,
} from './types';

const SESSION_COOKIE = 'nfticket_session';
const SCANNER_TOKEN_COOKIE = 'nfticket_scanner_token';

// Security: Require explicit JWT secret, no default fallback
const SCANNER_JWT_SECRET = process.env.SCANNER_JWT_SECRET;
if (!SCANNER_JWT_SECRET) {
  console.warn('WARNING: SCANNER_JWT_SECRET not set. Scanner tokens will not work until configured.');
}

// Token settings
const SCANNER_TOKEN_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours (shorter for security)
const RATE_LIMIT_WINDOW_MS = 1000 * 60; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // Stricter: 60 requests per minute
const DEVICE_ID_SALT = process.env.DEVICE_ID_SALT || ''; // For hashing device fingerprints

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, number[]>();

// Revoked token store (use Redis in production)
const revokedTokens = new Set<string>();

type ApiRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
};

interface ScannerTokenClaims {
  eventId: string;
  scannerUserId: string | null;
  scannerLabel: string | null;
  deviceHash: string;
  iat: number;
  exp: number;
  jti: string;
}

interface ScannerTokenRequest {
  eventId?: string;
  scannerLabel?: string;
  deviceFingerprint?: string;
}

interface ValidateScanRequest {
  payload?: QrTicketPayload;
  deviceFingerprint?: string;
  checkpoint?: string;
  location?: ScannerLocation | null;
  idempotencyKey?: string;
  scannedAt?: number;
}

function hashDeviceFingerprint(fingerprint: string): string {
  if (!DEVICE_ID_SALT) {
    return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
  }
  return crypto
    .createHmac('sha256', DEVICE_ID_SALT)
    .update(fingerprint)
    .digest('hex')
    .slice(0, 32);
}

function extractClientAddress(req: ApiRequest): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const realIp = req.headers?.['x-real-ip'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : Array.isArray(realIp)
      ? realIp[0]
      : forwarded ?? realIp ?? 'unknown';

  return String(raw).split(',')[0]?.trim() || 'unknown';
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const recentRequests = (rateLimitStore.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw ApiError.forbidden('Too many scanner requests. Please retry shortly.', 'SCANNER_RATE_LIMITED');
  }

  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
}

function signScannerJwt(claims: ScannerTokenClaims): string {
  if (!SCANNER_JWT_SECRET) {
    throw ApiError.serviceUnavailable(
      'Scanner authentication is not configured',
      'SCANNER_AUTH_NOT_CONFIGURED',
    );
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', SCANNER_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyScannerJwt(token: string): ScannerTokenClaims | null {
  if (!SCANNER_JWT_SECRET) {
    return null;
  }

  if (revokedTokens.has(token)) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  
  const expectedSignature = crypto
    .createHmac('sha256', SCANNER_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload as ScannerTokenClaims;
  } catch {
    return null;
  }
}

function extractScannerClaims(req: ApiRequest): {
  claims: ScannerTokenClaims | null;
  error?: string;
  status?: number;
} {
  const token = readScannerToken(req);
  const scannerClaims = token ? verifyScannerJwt(token) : null;

  if (!scannerClaims) {
    return { claims: null, error: 'Invalid or expired scanner token', status: 401 };
  }

  return { claims: scannerClaims };
}

async function authorizeScanRequest(input: {
  req: ApiRequest;
  payload: QrTicketPayload;
  deviceFingerprint: string;
}): Promise<{
  claims: ScannerTokenClaims | null;
  error?: string;
  status?: number;
}> {
  const { claims, error, status } = extractScannerClaims(input.req);
  if (!claims) {
    return { claims: null, error, status };
  }

  if (claims.eventId !== input.payload.eventId) {
    return { claims: null, error: 'Token not valid for this event', status: 403 };
  }

  const deviceHash = hashDeviceFingerprint(input.deviceFingerprint);
  if (claims.deviceHash !== deviceHash) {
    return { claims: null, error: 'Device mismatch', status: 403 };
  }

  const prisma = getPrismaClient();
  const event = await prisma.event.findUnique({
    where: { id: input.payload.eventId },
    select: {
      organizerId: true,
      authorizedScanners: true,
    },
  });

  if (!event) {
    return { claims: null, error: 'Event not found for scan', status: 404 };
  }

  const authorization = await isScannerAuthorized(
    event,
    input.deviceFingerprint,
    claims.scannerUserId,
    claims.scannerLabel,
  );

  if (!authorization.authorized) {
    return {
      claims: null,
      error: authorization.reason ?? 'Scanner not registered for this event. Contact the event organizer.',
      status: 403,
    };
  }

  return { claims };
}

async function isScannerAuthorized(
  event: { authorizedScanners: string[]; organizerId: string },
  deviceFingerprint: string,
  sessionUserId: string | null,
  scannerLabel: string | null
): Promise<{ authorized: boolean; reason?: string }> {
  const deviceHash = hashDeviceFingerprint(deviceFingerprint);
  const normalizedScannerLabel = normalizeScannerLabel(scannerLabel);

  if (event.authorizedScanners.includes(deviceHash)) {
    return { authorized: true };
  }

  if (sessionUserId === event.organizerId) {
    return { authorized: true };
  }

  if (sessionUserId && event.authorizedScanners.includes(`user:${sessionUserId}`)) {
    return { authorized: true };
  }

  if (
    normalizedScannerLabel
    && event.authorizedScanners.some((authorizedScanner) =>
      matchesAuthorizedScannerLabel(authorizedScanner, normalizedScannerLabel))
  ) {
    return { authorized: true };
  }

  return { 
    authorized: false, 
    reason: 'Scanner not registered for this event. Contact the event organizer.' 
  };
}

export async function handleScannerTokenApi(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  if (!SCANNER_JWT_SECRET) {
    throw ApiError.serviceUnavailable(
      'Scanner authentication is not configured',
      'SCANNER_AUTH_NOT_CONFIGURED',
    );
  }

  const body = parseBody<ScannerTokenRequest>(req.body);
  const eventId = requiredString(body.eventId);
  const deviceFingerprint = requiredString(body.deviceFingerprint);
  const scannerLabel = normalizeScannerLabel(optionalString(body.scannerLabel));

  if (!eventId || !deviceFingerprint) {
    throw ApiError.badRequest(
      'eventId and deviceFingerprint are required',
      'MISSING_SCANNER_TOKEN_FIELDS',
    );
  }

  enforceRateLimit(`scanner-token:${eventId}:${extractClientAddress(req)}:${hashDeviceFingerprint(deviceFingerprint)}`);

  const prisma = getPrismaClient();
  const event = await prisma.event.findUnique({ 
    where: { id: eventId },
    select: { 
      id: true, 
      authorizedScanners: true, 
      organizerId: true,
      name: true 
    }
  });

  if (!event) {
    throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  }

  const session = await getAuthenticatedSession(req);
  const sessionUserId = session?.userId ?? null;
  
  const auth = await isScannerAuthorized(
    event,
    deviceFingerprint,
    sessionUserId,
    scannerLabel
  );

  if (!auth.authorized) {
    throw ApiError.forbidden(
      auth.reason || 'Scanner not registered for this event. Contact the event organizer.',
      'SCANNER_NOT_AUTHORIZED',
    );
  }

  const deviceHash = hashDeviceFingerprint(deviceFingerprint);
  const now = Date.now();
  const jti = crypto.randomUUID();
  
  const claims: ScannerTokenClaims = {
    eventId,
    scannerUserId: sessionUserId,
    scannerLabel: scannerLabel ?? null,
    deviceHash,
    iat: now,
    exp: now + SCANNER_TOKEN_TTL_MS,
    jti,
  };

  const token = signScannerJwt(claims);
  
  return res.status(200).json({
    token,
    eventId,
    eventName: event.name,
    scannerUserId: claims.scannerUserId,
    scannerLabel: claims.scannerLabel,
    expiresAt: claims.exp,
  });
}

export async function handleValidateScanApi(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  if (!SCANNER_JWT_SECRET) {
    throw ApiError.serviceUnavailable(
      'Scanner authentication is not configured',
      'SCANNER_AUTH_NOT_CONFIGURED',
    );
  }

  const body = parseBody<ValidateScanRequest>(req.body);
  const payload = parseQrPayload(body.payload);
  const deviceFingerprint = requiredString(body.deviceFingerprint);
  const checkpoint = optionalString(body.checkpoint) ?? 'default';
  const scannedAt = typeof body.scannedAt === 'number' ? body.scannedAt : Date.now();
  const idempotencyKey =
    optionalString(body.idempotencyKey)
    ?? createPrefixedId(`scan_${payload?.ticketId ?? 'unknown'}`);
  const location = body.location ?? null;

  if (!payload || !deviceFingerprint) {
    throw ApiError.badRequest('Invalid scan payload', 'INVALID_SCAN_PAYLOAD');
  }

  enforceRateLimit(`validate-scan:${payload.eventId}:${extractClientAddress(req)}:${hashDeviceFingerprint(deviceFingerprint)}`);

  const prisma = getPrismaClient();
  const existingAttempt = await prisma.scanAttempt.findUnique({
    where: { idempotencyKey },
  });
  if (existingAttempt) {
    const metadata = objectOrNull<{ response?: ScannerValidationResult | { error?: string; message?: string }; httpStatus?: number }>(existingAttempt.metadata);
    const existingResponse = metadata?.response;
    if (existingResponse && typeof existingResponse === 'object') {
      const httpStatus = typeof metadata?.httpStatus === 'number' ? metadata?.httpStatus : 200;
      return res.status(httpStatus).json(existingResponse);
    }
  }

  const { claims: scannerClaims, error: authError, status: authStatus } = await authorizeScanRequest({
    req,
    payload,
    deviceFingerprint,
  });

  if (!scannerClaims) {
    await createScanAttempt(prisma, {
      idempotencyKey,
      deviceFingerprint,
      checkpoint,
      payload: body.payload ?? {},
      location,
      scannedAt,
      result: 'rejected',
      failureReason: authError ?? 'Invalid or expired scanner token',
      response: {
        error: authError ?? 'Invalid or expired scanner token',
        message: authError ?? 'Invalid or expired scanner token',
      },
      httpStatus: authStatus ?? 401,
    });
    return res.status(authStatus ?? 401).json({ error: authError ?? 'Invalid or expired scanner token' });
  }

  const deviceHash = hashDeviceFingerprint(deviceFingerprint);

  const result = await prisma.$transaction(async (tx) => {
    const [event, ticket, priorAcceptedScan] = await Promise.all([
      tx.event.findUnique({
        where: { id: payload.eventId },
        select: {
          id: true,
          name: true,
          venue: true,
          startsAt: true,
          status: true,
          organizerId: true,
          authorizedScanners: true,
          metadata: true,
          createdAt: true,
          nftMode: true,
          description: true,
        },
      }),
      tx.ticket.findUnique({
        where: { id: payload.ticketId },
        include: {
          order: { select: { status: true } },
        },
      }),
      tx.scan.findFirst({
        where: { ticketId: payload.ticketId, result: 'accepted' },
        orderBy: { scannedAt: 'desc' },
      }),
    ]);

    if (!event) {
      const response = buildRejectedResult({
        message: 'Event not found for scan',
        scannedAt,
        checkpoint,
        offline: false,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'rejected',
        failureReason: 'Event not found',
        response,
      });
      return response;
    }

    if (!ticket) {
      const response = buildRejectedResult({
        message: 'Ticket not found',
        scannedAt,
        checkpoint,
        offline: false,
        event,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'rejected',
        failureReason: 'Ticket not found',
        response,
        eventId: event.id,
      });
      return response;
    }

    if (ticket.eventId !== payload.eventId) {
      const response = buildRejectedResult({
        message: 'Ticket does not belong to this event',
        scannedAt,
        checkpoint,
        offline: false,
        event,
        ticket,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'rejected',
        failureReason: 'Ticket event mismatch',
        response,
        eventId: event.id,
        ticketId: ticket.id,
        scannerUserId: scannerClaims.scannerUserId,
        scannerLabel: scannerClaims.scannerLabel,
      });
      return response;
    }

    if (ticket.status === 'voided') {
      const response = buildRejectedResult({
        message: 'Ticket is cancelled',
        scannedAt,
        checkpoint,
        offline: false,
        event,
        ticket,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'rejected',
        failureReason: 'Ticket cancelled',
        response,
        eventId: event.id,
        ticketId: ticket.id,
        scannerUserId: scannerClaims.scannerUserId,
        scannerLabel: scannerClaims.scannerLabel,
      });
      return response;
    }

    if (ticket.order?.status === 'refunded' || ticket.order?.status === 'cancelled') {
      const response = buildRejectedResult({
        message: `Ticket order ${ticket.order.status}`,
        scannedAt,
        checkpoint,
        offline: false,
        event,
        ticket,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'rejected',
        failureReason: `Order ${ticket.order.status}`,
        response,
        eventId: event.id,
        ticketId: ticket.id,
        scannerUserId: scannerClaims.scannerUserId,
        scannerLabel: scannerClaims.scannerLabel,
      });
      return response;
    }

    if (ticket.status === 'scanned' || priorAcceptedScan) {
      const alreadyScannedAt = priorAcceptedScan?.scannedAt?.getTime()
        ?? extractLastScannedAt(ticket.metadata)
        ?? null;
      const response = buildDuplicateResult({
        message: 'Ticket already scanned',
        scannedAt,
        checkpoint,
        offline: false,
        event,
        ticket,
        duplicateOfScanId: priorAcceptedScan?.id ?? null,
        alreadyScannedAt,
      });
      await createScanAttempt(tx, {
        idempotencyKey,
        deviceFingerprint,
        checkpoint,
        payload,
        location,
        scannedAt,
        result: 'duplicate',
        failureReason: 'Already scanned',
        response,
        eventId: event.id,
        ticketId: ticket.id,
        scannerUserId: scannerClaims.scannerUserId,
        scannerLabel: scannerClaims.scannerLabel,
        scanId: priorAcceptedScan?.id ?? null,
      });
      return response;
    }

    const scanId = createId('scan');
    const nextMetadata = {
      ...(objectOrNull<Record<string, unknown>>(ticket.metadata) ?? {}),
      lastScannedAt: scannedAt,
    };

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'scanned',
        metadata: toJson(nextMetadata),
      },
    });

    await tx.scan.create({
      data: {
        id: scanId,
        eventId: event.id,
        ticketId: ticket.id,
        scannerUserId: scannerClaims.scannerUserId,
        checkpoint,
        result: 'accepted',
        scannedAt: new Date(scannedAt),
        notes: null,
        metadata: toJson({
          checkpoint,
          deviceHash,
          scannerLabel: scannerClaims.scannerLabel,
        }),
      },
    });

    const ticketRecord = toTicketRecord(ticket);
    ticketRecord.status = 'scanned';
    ticketRecord.lastScannedAt = scannedAt;

    const response = buildAcceptedResult({
      message: 'Ticket accepted',
      scannedAt,
      checkpoint,
      offline: false,
      event,
      ticket: ticketRecord,
      scanId,
    });

    await createScanAttempt(tx, {
      idempotencyKey,
      deviceFingerprint,
      checkpoint,
      payload,
      location,
      scannedAt,
      result: 'accepted',
      failureReason: null,
      response,
      eventId: event.id,
      ticketId: ticket.id,
      scannerUserId: scannerClaims.scannerUserId,
      scannerLabel: scannerClaims.scannerLabel,
      scanId,
    });

    return response;
  });

  return res.status(200).json(result);
}

// Helper functions
async function getAuthenticatedSession(req: ApiRequest) {
  const token = readSessionToken(req) ?? extractBearerToken(req);
  if (!token) {
    return null;
  }

  return verifySession(token);
}

function readSessionToken(req: ApiRequest): string | null {
  if (req.cookies?.[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE] ?? null;
  }

  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookieStr = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  const match = cookieStr.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function extractBearerToken(req: ApiRequest): string | null {
  const authHeader = req.headers?.authorization;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function readScannerToken(req: ApiRequest): string | null {
  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    return bearerToken;
  }

  if (req.cookies?.[SCANNER_TOKEN_COOKIE]) {
    return req.cookies[SCANNER_TOKEN_COOKIE] ?? null;
  }

  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookieStr = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  const match = cookieStr.match(new RegExp(`${SCANNER_TOKEN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function requiredString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function parseBody<T>(body: unknown): T {
  if (!body) {
    return {} as T;
  }

  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }

  return body as T;
}

function parseQrPayload(payload: unknown): QrTicketPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (
    p.type === 'nfticket'
    && p.version === 2
    && typeof p.ticketId === 'string'
    && typeof p.eventId === 'string'
    && typeof p.issuedAt === 'number'
  ) {
    return {
      type: 'nfticket',
      version: 2,
      ticketId: p.ticketId,
      eventId: p.eventId,
      issuedAt: p.issuedAt,
    };
  }
  return null;
}

function buildAcceptedResult(input: {
  message: string;
  scannedAt: number;
  checkpoint: string;
  offline: boolean;
  event: Prisma.EventGetPayload<{ select: { id: true; name: true; venue: true; startsAt: true } }>;
  ticket: TicketRecord;
  scanId: string;
}): ScannerValidationResult {
  return {
    success: true,
    status: 'accepted',
    message: input.message,
    scannedAt: input.scannedAt,
    checkpoint: input.checkpoint,
    event: toEventRecord(input.event),
    ticket: input.ticket,
    scanId: input.scanId,
    duplicateOfScanId: null,
    alreadyScannedAt: null,
    offline: input.offline,
  };
}

function buildDuplicateResult(input: {
  message: string;
  scannedAt: number;
  checkpoint: string;
  offline: boolean;
  event: Prisma.EventGetPayload<{ select: { id: true; name: true; venue: true; startsAt: true } }>;
  ticket: Prisma.TicketGetPayload<{ include: { order: { select: { status: true } } } }>;
  duplicateOfScanId: string | null;
  alreadyScannedAt: number | null;
}): ScannerValidationResult {
  return {
    success: false,
    status: 'duplicate',
    message: input.message,
    scannedAt: input.scannedAt,
    checkpoint: input.checkpoint,
    event: toEventRecord(input.event),
    ticket: toTicketRecord(input.ticket),
    scanId: null,
    duplicateOfScanId: input.duplicateOfScanId,
    alreadyScannedAt: input.alreadyScannedAt ?? null,
    offline: input.offline,
  };
}

function buildRejectedResult(input: {
  message: string;
  scannedAt: number;
  checkpoint: string;
  offline: boolean;
  event?: Prisma.EventGetPayload<{ select: { id: true; name: true; venue: true; startsAt: true } }> | null;
  ticket?: Prisma.TicketGetPayload<{ include: { order: { select: { status: true } } } }> | null;
}): ScannerValidationResult {
  return {
    success: false,
    status: 'rejected',
    message: input.message,
    scannedAt: input.scannedAt,
    checkpoint: input.checkpoint,
    event: input.event ? toEventRecord(input.event) : undefined,
    ticket: input.ticket ? toTicketRecord(input.ticket) : undefined,
    scanId: null,
    duplicateOfScanId: null,
    alreadyScannedAt: null,
    offline: input.offline,
  };
}

function toEventRecord(record: { id: string; name: string; venue: string; startsAt: Date }): Pick<EventRecord, 'id' | 'name' | 'venue' | 'eventDate'> {
  return {
    id: record.id,
    name: record.name,
    venue: record.venue,
    eventDate: record.startsAt.getTime(),
  };
}

function toTicketRecord(record: Prisma.TicketGetPayload<{ include: { order: { select: { status: true } } } }>): TicketRecord {
  const metadata = objectOrNull<Partial<TicketRecord>>(record.metadata);
  return {
    id: record.id,
    eventId: record.eventId,
    ownerId: record.ownerId,
    ownerEmail: metadata?.ownerEmail ?? '',
    ownerName: metadata?.ownerName ?? '',
    ownerWallet: metadata?.ownerWallet ?? null,
    tierIndex: 0,
    tierName: record.tierName,
    seatInfo: record.seatLabel,
    purchasePrice: Number(record.faceValue),
    purchaseTime: record.createdAt.getTime(),
    paymentMethod: 'card',
    status: record.status === 'scanned' ? 'scanned' : record.status === 'minted' || record.status === 'issued' ? 'minted' : 'reserved',
    nftMode: record.nftMode,
    assetId: record.assetId ?? metadata?.assetId ?? null,
    mintAddress: metadata?.mintAddress ?? null,
    mintSignature: metadata?.mintSignature ?? null,
    receiptId: metadata?.receiptId ?? null,
    fulfillmentStatus: metadata?.fulfillmentStatus ?? (record.status === 'minted' ? 'completed' : 'pending'),
    lastFulfillmentError: metadata?.lastFulfillmentError ?? null,
    issuanceAttempts: metadata?.issuanceAttempts ?? 0,
    isForSale: metadata?.isForSale ?? false,
    salePrice: metadata?.salePrice ?? null,
    resaleCount: record.transferCount,
    lastTransferredAt: metadata?.lastTransferredAt ?? null,
    lastScannedAt: metadata?.lastScannedAt ?? null,
    pendingTransferApproval: metadata?.pendingTransferApproval ?? false,
  };
}

function extractLastScannedAt(metadata: Prisma.JsonValue | null): number | null {
  const parsed = objectOrNull<{ lastScannedAt?: number | null }>(metadata);
  if (typeof parsed?.lastScannedAt === 'number') {
    return parsed.lastScannedAt;
  }
  return null;
}

function createId(prefix: string) {
  return createPrefixedId(prefix);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function objectOrNull<T>(value: Prisma.JsonValue | null) {
  return (value && typeof value === 'object' ? (value as T) : null);
}

async function createScanAttempt(
  prisma: Prisma.TransactionClient | PrismaClient,
  input: {
    idempotencyKey: string;
    deviceFingerprint: string;
    checkpoint: string;
    payload: unknown;
    location: ScannerLocation | null;
    scannedAt: number;
    result: 'accepted' | 'rejected' | 'duplicate' | 'manual_review';
    failureReason: string | null;
    response: ScannerValidationResult | { error?: string; message?: string };
    httpStatus?: number;
    eventId?: string;
    ticketId?: string;
    scanId?: string | null;
    scannerUserId?: string | null;
    scannerLabel?: string | null;
  },
) {
  await prisma.scanAttempt.create({
    data: {
      id: createId('scan_attempt'),
      eventId: input.eventId ?? null,
      ticketId: input.ticketId ?? null,
      scanId: input.scanId ?? null,
      scannerUserId: input.scannerUserId ?? null,
      scannerLabel: input.scannerLabel ?? null,
      deviceFingerprint: input.deviceFingerprint,
      idempotencyKey: input.idempotencyKey,
      checkpoint: input.checkpoint,
      result: input.result,
      failureReason: input.failureReason,
      payload: toJson(input.payload),
      location: input.location ? toJson(input.location) : Prisma.JsonNull,
      scannedAt: new Date(input.scannedAt),
      metadata: toJson({
        response: input.response,
        httpStatus: input.httpStatus ?? 200,
      }),
    },
  });
}
