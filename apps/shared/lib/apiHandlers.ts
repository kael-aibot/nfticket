import type { Prisma } from '@prisma/client';
import { ApiError } from './apiErrors';
import type { AuthenticatedRequest } from './auth';
import { getPrismaClient } from './prisma';
import type {
  AppSettings,
  AuthSessionRecord,
  AuthUser,
  EventRecord,
  FailedFlowRecord,
  FraudFlagRecord,
  IncidentAlertRecord,
  KycRecord,
  MagicLinkRecord,
  PaymentOrder,
  PayoutSplitRecord,
  ResaleListingRecord,
  TicketRecord,
  TransferAuditRecord,
  WalletChallengeRecord,
} from './types';
import { hasPlatformAccess, normalizeUserRole } from './types';

// Re-export payment service for API routes
export {
  createStripeCheckout,
  getCryptoCheckoutDetails,
  verifyCryptoPayment,
  getPaymentStatus,
  handleStripeWebhook,
} from './paymentService';
export type { PaymentRequest, PaymentResult } from './paymentService';

const SESSION_COOKIE = 'nfticket_session';

type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
};

type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type AppStateKey =
  | 'settings'
  | 'authSessions'
  | 'magicLinks'
  | 'walletChallenges'
  | 'kycRecords'
  | 'failedFlows'
  | 'incidentAlerts'
  | 'resaleListings'
  | 'payoutSplits'
  | 'transferAudit'
  | 'fraudFlags';

const DEFAULT_SETTINGS: AppSettings = {
  platformFeePercent: 2.5,
  resaleDecay: {
    moreThan60Days: 50,
    between30And60Days: 30,
    between7And30Days: 15,
    under7Days: 5,
    dayOfEvent: 0,
  },
  royaltySplit: {
    organizer: 40,
    originalBuyer: 40,
    charity: 20,
  },
};

export async function handleEventsApi(req: ApiRequest, res: ApiResponse) {
  const prisma = getPrismaClient();

  if (req.method === 'GET') {
    const records = await prisma.event.findMany({ orderBy: { startsAt: 'asc' } });
    return res.status(200).json(records.map(toEventRecord));
  }

  if (req.method === 'POST') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const body = parseBody<{ event?: EventRecord; events?: EventRecord[] }>(req.body);
    const input = body.events ?? (body.event ? [body.event] : []);
    const saved = await Promise.all(
      input.map(async (event) => {
        await verifyEventWriteAccess(authenticatedReq, event);
        return upsertEventRecord(event);
      }),
    );
    return res.status(200).json(body.event ? saved[0] : saved);
  }

  throw ApiError.methodNotAllowed();
}

export async function handleTicketsApi(req: ApiRequest, res: ApiResponse) {
  const prisma = getPrismaClient();

  if (req.method === 'GET') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const eventId = firstQueryValue(req.query?.eventId);
    const ownerId = firstQueryValue(req.query?.ownerId);
    const records = await prisma.ticket.findMany({
      where: await buildTicketReadWhere(authenticatedReq, {
        eventId,
        ownerId,
      }),
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(records.map(toTicketRecord));
  }

  if (req.method === 'POST') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const body = parseBody<{ ticket?: TicketRecord; tickets?: TicketRecord[] }>(req.body);
    const input = body.tickets ?? (body.ticket ? [body.ticket] : []);
    const saved = await Promise.all(
      input.map(async (ticket) => {
        await verifyTicketWriteAccess(authenticatedReq, ticket);
        return upsertTicketRecord(ticket);
      }),
    );
    return res.status(200).json(body.ticket ? saved[0] : saved);
  }

  throw ApiError.methodNotAllowed();
}

export async function handleOrdersApi(req: ApiRequest, res: ApiResponse) {
  const prisma = getPrismaClient();

  if (req.method === 'GET') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const records = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
    const visibleRecords = await filterReadableOrders(prisma, authenticatedReq, records);
    return res.status(200).json(visibleRecords.map(toPaymentOrder));
  }

  if (req.method === 'POST') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const body = parseBody<{ order?: PaymentOrder; orders?: PaymentOrder[] }>(req.body);
    const input = body.orders ?? (body.order ? [body.order] : []);
    const saved = await Promise.all(
      input.map(async (order) => {
        await verifyOrderWriteAccess(authenticatedReq, order);
        return upsertPaymentOrder(order);
      }),
    );
    return res.status(200).json(body.order ? saved[0] : saved);
  }

  throw ApiError.methodNotAllowed();
}

export async function handleAuthApi(req: ApiRequest, res: ApiResponse) {
  const prisma = getPrismaClient();

  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const body = parseBody<Record<string, unknown>>(req.body);
  const action = String(body.action ?? '');

  // Public endpoints (no auth required)
  if (action === 'login') {
    const { loginWithPassword } = await import('./secureAuth');
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');

    if (!email || !password) {
      throw ApiError.badRequest('Email and password required', 'MISSING_CREDENTIALS');
    }

    const result = await loginWithPassword(email, password);
    res.setHeader('Set-Cookie', serializeSecureSessionCookie(result.token));
    return res.status(200).json({
      success: true,
      user: result.user,
    });
  }

  if (action === 'register') {
    const { registerUser } = await import('./secureAuth');
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');
    const displayName = String(body.displayName ?? '');

    if (!email || !password) {
      throw ApiError.badRequest('Email and password required', 'MISSING_CREDENTIALS');
    }

    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters', 'WEAK_PASSWORD');
    }

    const result = await registerUser(email, password, displayName || undefined);
    res.setHeader('Set-Cookie', serializeSecureSessionCookie(result.token));
    return res.status(200).json({
      success: true,
      user: result.user,
    });
  }

  if (action === 'logout') {
    const { revokeSession, verifySession } = await import('./secureAuth');
    const token = extractBearerToken(req) || readSessionCookie(req);
    if (token) {
      const session = await verifySession(token);
      if (session) {
        await revokeSession(session.sessionId);
      }
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ success: true });
  }

  if (action === 'wallet:challenge') {
    const { issueWalletChallenge, verifySession } = await import('./secureAuth');
    const walletAddress = String(body.walletAddress ?? '');
    const purpose = body.purpose === 'link_wallet' ? 'link_wallet' : 'sign_in';

    if (!walletAddress) {
      throw ApiError.badRequest('Wallet address required', 'MISSING_WALLET_ADDRESS');
    }

    let userId: string | null = null;
    if (purpose === 'link_wallet') {
      const session = await requireValidSession(req, res);
      userId = session.userId;
    }

    const challenge = await issueWalletChallenge({
      walletAddress,
      purpose,
      userId,
    });
    return res.status(200).json({
      id: challenge.id,
      message: challenge.message,
      walletAddress: challenge.walletAddress,
      expiresAt: challenge.expiresAt,
    });
  }

  if (action === 'wallet:sign-in') {
    const { signInWithWallet } = await import('./secureAuth');
    const walletAddress = String(body.walletAddress ?? '');
    const challengeId = String(body.challengeId ?? '');
    const signature = String(body.signature ?? '');

    if (!walletAddress || !challengeId || !signature) {
      throw ApiError.badRequest(
        'Wallet address, challenge, and signature are required',
        'MISSING_WALLET_SIGN_IN_FIELDS',
      );
    }

    const result = await signInWithWallet(challengeId, walletAddress, signature);
    res.setHeader('Set-Cookie', serializeSecureSessionCookie(result.token));
    return res.status(200).json({
      success: true,
      user: result.user,
    });
  }

  // Authenticated endpoints (require valid session)
  const token = extractBearerToken(req) || readSessionCookie(req);

  if (action === 'session:validate') {
    const session = await requireValidSession(req, res, token, 'MISSING_SESSION_TOKEN');

    return res.status(200).json({
      valid: true,
      user: {
        id: session.userId,
        email: session.email,
        role: session.role,
      },
    });
  }

  if (action === 'user:get') {
    const session = await requireValidSession(req, res);

    const user = await prisma.userIdentity.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, displayName: true, role: true, wallets: true, authMode: true, kycStatus: true, createdAt: true },
    });

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      wallets: user.wallets,
      authMode: user.authMode,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt.getTime(),
    });
  }

  if (action === 'wallet:link') {
    const { verifySession, linkWallet } = await import('./secureAuth');
    const session = await requireValidSession(req, res);

    const walletAddress = String(body.walletAddress ?? '');
    const challengeId = String(body.challengeId ?? '');
    const signature = String(body.signature ?? '');

    if (!walletAddress || !challengeId || !signature) {
      throw ApiError.badRequest(
        'Wallet address, challenge, and signature are required',
        'MISSING_WALLET_LINK_FIELDS',
      );
    }

    const result = await linkWallet(session.userId, challengeId, walletAddress, signature);
    return res.status(200).json({
      success: true,
      wallets: result.wallets,
      primaryWallet: result.primaryWallet,
      authMode: result.authMode,
    });
  }

  // Legacy actions (deprecated, return error)
  const deprecatedActions = [
    'users:list', 'users:save', 'session:set', 'session:get',
    'authSessions:list', 'authSessions:save',
    'magicLinks:list', 'magicLinks:save',
    'walletChallenges:list', 'walletChallenges:save',
    'kycRecords:list', 'kycRecords:save',
  ];

  if (deprecatedActions.includes(action)) {
    throw ApiError.gone(
      'This action is no longer supported. Please use the new secure auth endpoints.',
      'DEPRECATED_AUTH_ACTION',
    );
  }

  throw ApiError.badRequest(`Unsupported auth action: ${action}`, 'UNSUPPORTED_AUTH_ACTION');
}

export async function handleScansApi(req: ApiRequest, res: ApiResponse) {
  const prisma = getPrismaClient();

  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const authenticatedReq = requireAuthenticatedRequest(req);
  verifyScanWriteAccess(authenticatedReq);
  const body = parseBody<{ scan?: { id: string; eventId: string; ticketId: string; scannerUserId?: string | null; checkpoint?: string; result?: 'accepted' | 'rejected' | 'duplicate' | 'manual_review'; scannedAt?: number; notes?: string | null }; scans?: Array<{ id: string; eventId: string; ticketId: string; scannerUserId?: string | null; checkpoint?: string; result?: 'accepted' | 'rejected' | 'duplicate' | 'manual_review'; scannedAt?: number; notes?: string | null }> }>(req.body);
  const input = body.scans ?? (body.scan ? [body.scan] : []);
  const saved = await Promise.all(
    input.map(async (scan) => {
      const scannerUserId = resolveScanWriterId(authenticatedReq, scan.scannerUserId);
      const record = await prisma.scan.upsert({
        where: { id: scan.id },
        create: {
          id: scan.id,
          eventId: scan.eventId,
          ticketId: scan.ticketId,
          scannerUserId,
          checkpoint: scan.checkpoint ?? 'default',
          result: scan.result ?? 'accepted',
          scannedAt: new Date(scan.scannedAt ?? Date.now()),
          notes: scan.notes ?? null,
          metadata: toJson(scan),
        },
        update: {
          scannerUserId,
          checkpoint: scan.checkpoint ?? 'default',
          result: scan.result ?? 'accepted',
          scannedAt: new Date(scan.scannedAt ?? Date.now()),
          notes: scan.notes ?? null,
          metadata: toJson(scan),
        },
      });
      return {
        id: record.id,
        eventId: record.eventId,
        ticketId: record.ticketId,
        scannerUserId: record.scannerUserId,
        checkpoint: record.checkpoint,
        result: record.result,
        scannedAt: record.scannedAt.getTime(),
        notes: record.notes,
      };
    }),
  );

  return res.status(200).json(body.scan ? saved[0] : saved);
}

export async function handleResaleApi(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(await readAppState<ResaleListingRecord[]>('resaleListings', []));
  }

  if (req.method === 'POST') {
    const authenticatedReq = requireAuthenticatedRequest(req);
    const body = parseBody<Record<string, unknown>>(req.body);
    const action = String(body.action ?? 'listings:save');

    if (action === 'listings:save' || action === 'create listing' || action === 'purchase') {
      const listings = Array.isArray(body.listings) ? (body.listings as ResaleListingRecord[]) : [];
      await verifyResaleListingsWriteAccess(authenticatedReq, action, listings);
      await writeAppState('resaleListings', listings);
      return res.status(200).json(listings);
    }

    if (action === 'payoutSplits:list') {
      return res.status(200).json(await readAppState<PayoutSplitRecord[]>('payoutSplits', []));
    }

    if (action === 'payoutSplits:save') {
      const value = Array.isArray(body.records) ? (body.records as PayoutSplitRecord[]) : [];
      verifyPayoutSplitWriteAccess(authenticatedReq, value);
      await writeAppState('payoutSplits', value);
      return res.status(200).json(value);
    }

    if (action === 'transferAudit:list') {
      return res.status(200).json(await readAppState<TransferAuditRecord[]>('transferAudit', []));
    }

    if (action === 'transferAudit:save') {
      const value = Array.isArray(body.records) ? (body.records as TransferAuditRecord[]) : [];
      verifyTransferAuditWriteAccess(authenticatedReq, value);
      await writeAppState('transferAudit', value);
      return res.status(200).json(value);
    }

    if (action === 'fraudFlags:list') {
      return res.status(200).json(await readAppState<FraudFlagRecord[]>('fraudFlags', []));
    }

    if (action === 'fraudFlags:save') {
      const value = Array.isArray(body.records) ? (body.records as FraudFlagRecord[]) : [];
      verifyFraudFlagWriteAccess(authenticatedReq, value);
      await writeAppState('fraudFlags', value);
      return res.status(200).json(value);
    }

    throw ApiError.badRequest(`Unsupported resale action: ${action}`, 'UNSUPPORTED_RESALE_ACTION');
  }

  throw ApiError.methodNotAllowed();
}

type AuthenticatedApiRequest = ApiRequest & {
  user: NonNullable<AuthenticatedRequest['user']>;
  sessionId?: string;
};

function requireAuthenticatedRequest(req: ApiRequest): AuthenticatedApiRequest {
  const authenticatedReq = req as AuthenticatedApiRequest;
  if (!authenticatedReq.user) {
    throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  return authenticatedReq;
}

async function verifyEventWriteAccess(req: AuthenticatedApiRequest, event: EventRecord) {
  if (event.organizerId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only create or update events for your own organizer account',
      'FORBIDDEN',
    );
  }

  const prisma = getPrismaClient();
  const existingEvent = await prisma.event.findUnique({
    where: { id: event.id },
    select: { organizerId: true },
  });

  if (existingEvent && existingEvent.organizerId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only modify events you own',
      'FORBIDDEN',
    );
  }
}

async function verifyTicketWriteAccess(req: AuthenticatedApiRequest, ticket: TicketRecord) {
  if (ticket.ownerId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only create or update tickets you own',
      'FORBIDDEN',
    );
  }

  const prisma = getPrismaClient();
  const existingTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { ownerId: true },
  });

  if (existingTicket && existingTicket.ownerId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only modify tickets you own',
      'FORBIDDEN',
    );
  }
}

async function verifyOrderWriteAccess(req: AuthenticatedApiRequest, order: PaymentOrder) {
  if (order.purchaserId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only create or update orders for yourself',
      'FORBIDDEN',
    );
  }

  const prisma = getPrismaClient();
  const existingOrder = await prisma.order.findUnique({
    where: { id: order.id },
    select: { purchaserId: true },
  });

  if (existingOrder && existingOrder.purchaserId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only modify orders you own',
      'FORBIDDEN',
    );
  }
}

async function buildTicketReadWhere(
  req: AuthenticatedApiRequest,
  filters: { eventId?: string; ownerId?: string },
) {
  const scopedFilters = {
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.ownerId && filters.ownerId === req.user.id ? { ownerId: filters.ownerId } : {}),
  };

  if (hasPlatformAccess(req.user.role)) {
    return {
      ...scopedFilters,
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };
  }

  if (req.user.role === 'provider') {
    const organizerEventIds = await getOrganizerEventIds(req.user.id);
    return {
      ...scopedFilters,
      OR: [
        { ownerId: req.user.id },
        ...(organizerEventIds.length > 0 ? [{ eventId: { in: organizerEventIds } }] : []),
      ],
    };
  }

  return {
    ...scopedFilters,
    ownerId: req.user.id,
  };
}

async function filterReadableOrders(
  prisma: ReturnType<typeof getPrismaClient>,
  req: AuthenticatedApiRequest,
  records: Array<{ id: string; eventId: string; purchaserId: string }>,
) {
  if (hasPlatformAccess(req.user.role)) {
    return records;
  }

  if (req.user.role === 'provider') {
    const organizerEventIds = new Set(await getOrganizerEventIds(req.user.id));
    return records.filter((record) => record.purchaserId === req.user.id || organizerEventIds.has(record.eventId));
  }

  void prisma;
  return records.filter((record) => record.purchaserId === req.user.id);
}

async function getOrganizerEventIds(organizerId: string): Promise<string[]> {
  const prisma = getPrismaClient();
  const events = await prisma.event.findMany({
    where: { organizerId },
    select: { id: true },
  });
  return events.map((event) => event.id);
}

function verifyScanWriteAccess(req: AuthenticatedApiRequest) {
  if (req.user.role !== 'provider' && !hasPlatformAccess(req.user.role)) {
    throw ApiError.forbidden(
      'Only providers or platform operators can record scans',
      'FORBIDDEN',
    );
  }
}

function resolveScanWriterId(
  req: AuthenticatedApiRequest,
  scannerUserId: string | null | undefined,
): string | null {
  if (hasPlatformAccess(req.user.role)) {
    return scannerUserId ?? req.user.id;
  }

  if (scannerUserId && scannerUserId !== req.user.id) {
    throw ApiError.forbidden(
      'You can only write scan records for your own scanner account',
      'FORBIDDEN',
    );
  }

  return req.user.id;
}

async function verifyResaleListingsWriteAccess(
  req: AuthenticatedApiRequest,
  action: string,
  listings: ResaleListingRecord[],
) {
  const existingListings = await readAppState<ResaleListingRecord[]>('resaleListings', []);
  const existingById = new Map(existingListings.map((listing) => [listing.id, listing]));
  const nextById = new Map(listings.map((listing) => [listing.id, listing]));

  for (const [listingId, existingListing] of Array.from(existingById.entries())) {
    if (!nextById.has(listingId) && existingListing.sellerId !== req.user.id) {
      throw ApiError.forbidden(
        'You can only remove resale listings you own',
        'FORBIDDEN',
      );
    }
  }

  for (const listing of listings) {
    const existingListing = existingById.get(listing.id);

    if (!existingListing) {
      if (listing.sellerId !== req.user.id) {
        throw ApiError.forbidden(
          'You can only create resale listings for your own tickets',
          'FORBIDDEN',
        );
      }
      continue;
    }

    if (JSON.stringify(existingListing) === JSON.stringify(listing)) {
      continue;
    }

    if (existingListing.sellerId === req.user.id) {
      if (listing.sellerId !== req.user.id) {
        throw ApiError.forbidden(
          'You cannot transfer resale listing ownership',
          'FORBIDDEN',
        );
      }
      continue;
    }

    if (
      action === 'purchase'
      && listing.buyerId === req.user.id
      && listing.id === existingListing.id
      && listing.ticketId === existingListing.ticketId
      && listing.eventId === existingListing.eventId
      && listing.sellerId === existingListing.sellerId
      && listing.sellerWallet === existingListing.sellerWallet
      && listing.askPrice === existingListing.askPrice
      && listing.currency === existingListing.currency
      && listing.createdAt === existingListing.createdAt
    ) {
      continue;
    }

    throw ApiError.forbidden(
      'You can only modify your own resale listings',
      'FORBIDDEN',
    );
  }
}

function verifyPayoutSplitWriteAccess(
  req: AuthenticatedApiRequest,
  records: PayoutSplitRecord[],
) {
  for (const record of records) {
    if (record.recipientUserId !== req.user.id) {
      throw ApiError.forbidden(
        'You can only modify payout split records that belong to you',
        'FORBIDDEN',
      );
    }
  }
}

function verifyTransferAuditWriteAccess(
  req: AuthenticatedApiRequest,
  records: TransferAuditRecord[],
) {
  for (const record of records) {
    const isRelatedToUser = record.actorUserId === req.user.id || record.subjectUserId === req.user.id;
    if (!isRelatedToUser) {
      throw ApiError.forbidden(
        'You can only modify transfer audit records tied to your account',
        'FORBIDDEN',
      );
    }
  }
}

function verifyFraudFlagWriteAccess(
  req: AuthenticatedApiRequest,
  records: FraudFlagRecord[],
) {
  for (const record of records) {
    if (record.userId !== req.user.id) {
      throw ApiError.forbidden(
        'You can only modify fraud flags tied to your account',
        'FORBIDDEN',
      );
    }
  }
}

function verifyPlatformStateAccess(req: AuthenticatedApiRequest) {
  if (!hasPlatformAccess(req.user.role)) {
    throw ApiError.forbidden(
      'Platform operator access is required',
      'FORBIDDEN',
    );
  }
}

export async function handleStateApi(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const body = parseBody<Record<string, unknown>>(req.body);
  const action = String(body.action ?? '');

  if (action === 'settings:get') {
    return res.status(200).json(await readAppState<AppSettings>('settings', DEFAULT_SETTINGS));
  }

  if (action === 'settings:set') {
    verifyPlatformStateAccess(requireAuthenticatedRequest(req));
    const settings = (body.value as AppSettings | undefined) ?? DEFAULT_SETTINGS;
    await writeAppState('settings', settings);
    return res.status(200).json(settings);
  }

  if (action === 'failedFlows:list') {
    verifyPlatformStateAccess(requireAuthenticatedRequest(req));
    return res.status(200).json(await readAppState<FailedFlowRecord[]>('failedFlows', []));
  }

  if (action === 'failedFlows:save') {
    verifyPlatformStateAccess(requireAuthenticatedRequest(req));
    const value = Array.isArray(body.records) ? (body.records as FailedFlowRecord[]) : [];
    await writeAppState('failedFlows', value);
    return res.status(200).json(value);
  }

  if (action === 'incidentAlerts:list') {
    verifyPlatformStateAccess(requireAuthenticatedRequest(req));
    return res.status(200).json(await readAppState<IncidentAlertRecord[]>('incidentAlerts', []));
  }

  if (action === 'incidentAlerts:save') {
    verifyPlatformStateAccess(requireAuthenticatedRequest(req));
    const value = Array.isArray(body.records) ? (body.records as IncidentAlertRecord[]) : [];
    await writeAppState('incidentAlerts', value);
    return res.status(200).json(value);
  }

  throw ApiError.badRequest(`Unsupported state action: ${action}`, 'UNSUPPORTED_STATE_ACTION');
}

async function upsertEventRecord(event: EventRecord) {
  const prisma = getPrismaClient();
  await upsertAuthUser({
    id: event.organizerId,
    name: event.organizerName,
    email: `${event.organizerId}@nfticket.local`,
    provider: 'credentials',
    role: 'provider',
    emailVerified: true,
    wallets: event.organizerWallet ? [event.organizerWallet] : [],
    linkedWallets: event.organizerWallet ? [event.organizerWallet] : [],
    authMode: event.authRequirements?.mode ?? 'hybrid',
    kycStatus: 'approved',
    adminRoles: [],
    createdAt: event.createdAt,
    updatedAt: Date.now(),
  });

  const capacity = event.tiers.reduce((sum, tier) => sum + tier.supply, 0);
  const acceptedPayments = legacyPaymentsToRails(event.acceptedPayments);

  const record = await prisma.event.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      organizerId: event.organizerId,
      name: event.name,
      description: event.description,
      venue: event.venue,
      startsAt: new Date(event.eventDate),
      endsAt: null,
      timeZone: 'UTC',
      status: event.isActive ? 'published' : 'draft',
      capacity,
      nftMode: event.nftMode ?? 'compressed',
      acceptedPayments,
      resaleEnabled: event.marketplaceSettings?.policy.enabled ?? true,
      resaleMaxTransfers: event.marketplaceSettings?.policy.maxTransfers ?? 4,
      resaleMinMultiplier: event.marketplaceSettings?.policy.minPriceMultiplier ?? 1,
      resaleMaxMultiplier: event.marketplaceSettings?.policy.maxPriceMultiplier ?? 1.5,
      royaltyBasisPoints: event.marketplaceSettings?.policy.royaltyBasisPoints ?? 1000,
      resaleApprovalNeeded: event.marketplaceSettings?.policy.approvalRequired ?? false,
      authMode: event.authRequirements?.mode ?? 'hybrid',
      requireVerifiedEmail: event.authRequirements?.requireVerifiedEmail ?? true,
      requireWalletLink: event.authRequirements?.requireWalletLink ?? false,
      requireKyc: event.authRequirements?.requireKyc ?? false,
      authorizedScanners: event.authorizedScanners,
      metadata: toJson(event),
      createdAt: new Date(event.createdAt),
      updatedAt: new Date(),
    },
    update: {
      name: event.name,
      description: event.description,
      venue: event.venue,
      startsAt: new Date(event.eventDate),
      status: event.isActive ? 'published' : 'draft',
      capacity,
      nftMode: event.nftMode ?? 'compressed',
      acceptedPayments,
      resaleEnabled: event.marketplaceSettings?.policy.enabled ?? true,
      resaleMaxTransfers: event.marketplaceSettings?.policy.maxTransfers ?? 4,
      resaleMinMultiplier: event.marketplaceSettings?.policy.minPriceMultiplier ?? 1,
      resaleMaxMultiplier: event.marketplaceSettings?.policy.maxPriceMultiplier ?? 1.5,
      royaltyBasisPoints: event.marketplaceSettings?.policy.royaltyBasisPoints ?? 1000,
      resaleApprovalNeeded: event.marketplaceSettings?.policy.approvalRequired ?? false,
      authMode: event.authRequirements?.mode ?? 'hybrid',
      requireVerifiedEmail: event.authRequirements?.requireVerifiedEmail ?? true,
      requireWalletLink: event.authRequirements?.requireWalletLink ?? false,
      requireKyc: event.authRequirements?.requireKyc ?? false,
      authorizedScanners: event.authorizedScanners,
      metadata: toJson(event),
      updatedAt: new Date(),
    },
  });

  return toEventRecord(record);
}

async function upsertTicketRecord(ticket: TicketRecord) {
  const prisma = getPrismaClient();
  await upsertAuthUser({
    id: ticket.ownerId,
    name: ticket.ownerName,
    email: ticket.ownerEmail,
    provider: 'credentials',
    role: 'buyer',
    emailVerified: true,
    wallets: ticket.ownerWallet ? [ticket.ownerWallet] : [],
    linkedWallets: ticket.ownerWallet ? [ticket.ownerWallet] : [],
    authMode: ticket.ownerWallet ? 'hybrid' : 'email',
    kycStatus: 'approved',
    adminRoles: [],
    createdAt: ticket.purchaseTime,
    updatedAt: Date.now(),
  });

  const record = await prisma.ticket.upsert({
    where: { id: ticket.id },
    create: {
      id: ticket.id,
      eventId: ticket.eventId,
      orderId: null,
      ownerId: ticket.ownerId,
      inventoryKey: `${ticket.eventId}:${ticket.tierIndex}:${ticket.id}`,
      tierName: ticket.tierName,
      seatLabel: ticket.seatInfo,
      faceValue: ticket.purchasePrice,
      currency: 'usd',
      assetId: ticket.assetId ?? null,
      nftMode: ticket.nftMode ?? 'compressed',
      status: legacyTicketStatus(ticket.status),
      transferCount: ticket.resaleCount,
      metadata: toJson(ticket),
      createdAt: new Date(ticket.purchaseTime),
      updatedAt: new Date(),
    },
    update: {
      ownerId: ticket.ownerId,
      tierName: ticket.tierName,
      seatLabel: ticket.seatInfo,
      faceValue: ticket.purchasePrice,
      assetId: ticket.assetId ?? null,
      nftMode: ticket.nftMode ?? 'compressed',
      status: legacyTicketStatus(ticket.status),
      transferCount: ticket.resaleCount,
      metadata: toJson(ticket),
      updatedAt: new Date(),
    },
  });

  return toTicketRecord(record);
}

async function upsertPaymentOrder(order: PaymentOrder) {
  const prisma = getPrismaClient();
  await prisma.order.upsert({
    where: { id: order.id },
    create: {
      id: order.id,
      eventId: order.eventId,
      purchaserId: order.purchaserId,
      ticketId: order.ticketId,
      paymentRail: order.method === 'card' ? 'stripe' : 'sol',
      amount: order.amount,
      currency: (order.currency ?? 'usd').toLowerCase(),
      status: legacyOrderStatus(order.status),
      paymentReference: order.paymentReference ?? null,
      idempotencyKey: order.idempotencyKey ?? `${order.eventId}:${order.ticketId}:${order.purchaserId}`,
      metadata: toJson(order),
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(),
    },
    update: {
      ticketId: order.ticketId,
      paymentRail: order.method === 'card' ? 'stripe' : 'sol',
      amount: order.amount,
      currency: (order.currency ?? 'usd').toLowerCase(),
      status: legacyOrderStatus(order.status),
      paymentReference: order.paymentReference ?? null,
      metadata: toJson(order),
      updatedAt: new Date(),
    },
  });

  const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  return toPaymentOrder(saved);
}

async function upsertAuthUser(user: AuthUser) {
  const prisma = getPrismaClient();
  const record = await prisma.userIdentity.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.name,
      primaryWallet: user.linkedWallets[0] ?? user.wallets[0] ?? null,
      wallets: uniqueStrings([...user.wallets, ...user.linkedWallets]),
      authMode: user.authMode,
      role: user.role,
      kycStatus: user.kycStatus,
      metadata: toJson(user),
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    },
    update: {
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.name,
      primaryWallet: user.linkedWallets[0] ?? user.wallets[0] ?? null,
      wallets: uniqueStrings([...user.wallets, ...user.linkedWallets]),
      authMode: user.authMode,
      role: user.role,
      kycStatus: user.kycStatus,
      metadata: toJson(user),
      updatedAt: new Date(user.updatedAt),
    },
  });

  return toAuthUser(record);
}

function toEventRecord(record: { id: string; organizerId: string; name: string; description: string; venue: string; startsAt: Date; nftMode: 'compressed' | 'metadata'; status: string; authorizedScanners?: string[]; metadata: Prisma.JsonValue | null; createdAt: Date }) {
  const metadata = objectOrNull<EventRecord>(record.metadata);
  if (metadata) {
    return metadata;
  }

  return {
    id: record.id,
    organizerId: record.organizerId,
    organizerName: 'Organizer',
    organizerWallet: null,
    name: record.name,
    description: record.description,
    eventDate: record.startsAt.getTime(),
    venue: record.venue,
    tiers: [],
    acceptedPayments: ['card'],
    nftMode: record.nftMode,
    isActive: record.status === 'published',
    totalTicketsSold: 0,
    totalRevenue: 0,
    authorizedScanners: record.authorizedScanners ?? [],
    resaleConfig: DEFAULT_SETTINGS,
    createdAt: record.createdAt.getTime(),
  };
}

function toTicketRecord(record: { id: string; eventId: string; ownerId: string; tierName: string; seatLabel: string | null; faceValue: Prisma.Decimal; status: string; nftMode: 'compressed' | 'metadata'; assetId: string | null; transferCount: number; createdAt: Date; metadata: Prisma.JsonValue | null }) {
  const metadata = objectOrNull<Partial<TicketRecord>>(record.metadata);
  const ticketMetadata: Partial<TicketRecord> = metadata ?? {};

  return {
    id: record.id,
    eventId: record.eventId,
    ownerId: record.ownerId,
    ownerEmail: ticketMetadata.ownerEmail ?? '',
    ownerName: ticketMetadata.ownerName ?? '',
    ownerWallet: ticketMetadata.ownerWallet ?? null,
    tierIndex: 0,
    tierName: record.tierName,
    seatInfo: record.seatLabel,
    purchasePrice: Number(record.faceValue),
    purchaseTime: record.createdAt.getTime(),
    paymentMethod: 'card',
    status: record.status === 'scanned' ? 'scanned' : record.status === 'minted' ? 'minted' : 'reserved',
    nftMode: record.nftMode,
    assetId: record.assetId ?? ticketMetadata.assetId ?? null,
    mintAddress: ticketMetadata.mintAddress ?? null,
    mintSignature: ticketMetadata.mintSignature ?? null,
    receiptId: ticketMetadata.receiptId ?? null,
    fulfillmentStatus: ticketMetadata.fulfillmentStatus ?? (record.status === 'minted' ? 'completed' : 'pending'),
    lastFulfillmentError: ticketMetadata.lastFulfillmentError ?? null,
    issuanceAttempts: ticketMetadata.issuanceAttempts ?? 0,
    isForSale: ticketMetadata.isForSale ?? false,
    salePrice: ticketMetadata.salePrice ?? null,
    resaleCount: record.transferCount,
    lastTransferredAt: ticketMetadata.lastTransferredAt ?? null,
    lastScannedAt: ticketMetadata.lastScannedAt ?? null,
    pendingTransferApproval: ticketMetadata.pendingTransferApproval ?? false,
  };
}

function toPaymentOrder(record: { id: string; eventId: string; ticketId: string | null; purchaserId: string; amount: Prisma.Decimal; paymentRail: string; status: string; currency: string; paymentReference: string | null; idempotencyKey: string; createdAt: Date; metadata: Prisma.JsonValue | null }) {
  const metadata = objectOrNull<Partial<PaymentOrder>>(record.metadata);
  const orderMetadata: Partial<PaymentOrder> = metadata ?? {};

  return {
    id: record.id,
    eventId: record.eventId,
    ticketId: record.ticketId ?? '',
    purchaserId: record.purchaserId,
    amount: Number(record.amount),
    method: record.paymentRail === 'stripe' ? 'card' : 'crypto',
    status: record.status === 'confirmed' ? 'paid' : record.status === 'failed' ? 'failed' : 'pending',
    processor: record.paymentRail === 'stripe' ? 'stripe' : 'solana',
    currency: record.currency,
    paymentReference: record.paymentReference,
    idempotencyKey: record.idempotencyKey,
    nftMode: orderMetadata.nftMode,
    receiptLabel: orderMetadata.receiptLabel,
    receiptId: orderMetadata.receiptId ?? null,
    fulfillmentStatus: orderMetadata.fulfillmentStatus
      ?? (orderMetadata.assetId ? 'completed' : 'pending'),
    notificationStatus: orderMetadata.notificationStatus ?? 'pending',
    assetId: orderMetadata.assetId ?? null,
    mintAddress: orderMetadata.mintAddress ?? null,
    mintSignature: orderMetadata.mintSignature ?? null,
    confirmedAt: orderMetadata.confirmedAt ?? null,
    fulfilledAt: orderMetadata.fulfilledAt ?? null,
    retryCount: orderMetadata.retryCount ?? 0,
    lastError: orderMetadata.lastError ?? null,
    createdAt: record.createdAt.getTime(),
  };
}

function toAuthUser(record: { id: string; email: string | null; emailVerified: boolean; displayName: string | null; primaryWallet: string | null; wallets: string[]; authMode: 'email' | 'wallet' | 'hybrid'; role: string; kycStatus: 'not_required' | 'pending' | 'approved' | 'rejected'; createdAt: Date; updatedAt: Date; metadata: Prisma.JsonValue | null }) {
  const metadata = objectOrNull<AuthUser>(record.metadata);
  if (metadata) {
    return {
      ...metadata,
      role: normalizeUserRole(metadata.role),
    };
  }

  return {
    id: record.id,
    name: record.displayName ?? 'NFTicket User',
    email: record.email ?? `${record.id}@nfticket.local`,
    provider: 'credentials',
    role: normalizeUserRole(record.role),
    emailVerified: record.emailVerified,
    wallets: record.wallets,
    linkedWallets: record.primaryWallet ? [record.primaryWallet] : [],
    authMode: record.authMode,
    kycStatus: record.kycStatus,
    adminRoles: [],
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
    lastLoginAt: null,
  };
}

async function readAppState<T>(key: AppStateKey, fallback: T): Promise<T> {
  const prisma = getPrismaClient();
  const state = await prisma.appState.findUnique({ where: { key } });
  return state?.value ? (state.value as T) : fallback;
}

async function writeAppState(key: AppStateKey, value: unknown) {
  const prisma = getPrismaClient();
  await prisma.appState.upsert({
    where: { key },
    create: { key, value: toJson(value) },
    update: { value: toJson(value) },
  });
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

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readSessionCookie(req: ApiRequest) {
  if (req.cookies?.[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE] ?? null;
  }

  const cookieHeader = req.headers?.cookie;
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  if (!raw) {
    return null;
  }

  const cookies = raw.split(';').map((entry) => entry.trim());
  const match = cookies.find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

function extractBearerToken(req: ApiRequest): string | null {
  const authHeader = req.headers?.authorization;
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function serializeSecureSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`;
}

function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProd ? '; Secure' : ''}`;
}

async function requireValidSession(
  req: ApiRequest,
  res: ApiResponse,
  token = extractBearerToken(req) || readSessionCookie(req),
  missingCode = 'AUTH_REQUIRED',
) {
  const { verifySession } = await import('./secureAuth');

  if (!token) {
    throw ApiError.unauthorized(
      missingCode === 'MISSING_SESSION_TOKEN' ? 'No session token' : 'Authentication required',
      missingCode,
    );
  }

  try {
    const session = await verifySession(token);
    if (!session) {
      res.setHeader('Set-Cookie', clearSessionCookie());
      throw ApiError.unauthorized('Invalid session', 'INVALID_SESSION');
    }
    return session;
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'SESSION_EXPIRED' || error.code === 'INVALID_SESSION')) {
      res.setHeader('Set-Cookie', clearSessionCookie());
    }
    throw error;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function objectOrNull<T>(value: Prisma.JsonValue | null) {
  return (value && typeof value === 'object' ? (value as T) : null);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function legacyPaymentsToRails(payments: EventRecord['acceptedPayments']) {
  const rails = new Set<'stripe' | 'sol' | 'usdc'>();
  payments.forEach((payment) => {
    if (payment === 'card') {
      rails.add('stripe');
    } else {
      rails.add('sol');
      rails.add('usdc');
    }
  });
  return Array.from(rails);
}

function legacyTicketStatus(status: TicketRecord['status']) {
  if (status === 'minted') {
    return 'minted' as const;
  }
  if (status === 'scanned') {
    return 'scanned' as const;
  }
  return 'reserved' as const;
}

function legacyOrderStatus(status: PaymentOrder['status']) {
  if (status === 'paid') {
    return 'confirmed' as const;
  }
  if (status === 'failed') {
    return 'failed' as const;
  }
  return 'pending' as const;
}
