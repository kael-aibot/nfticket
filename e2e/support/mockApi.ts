import type { BrowserContext, Route } from '@playwright/test';

type UserRole = 'buyer' | 'provider';
type PaymentMethod = 'card' | 'crypto';
type TicketStatus = 'reserved' | 'minted' | 'scanned';

export type MockUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  wallets: string[];
  authMode: 'email' | 'hybrid';
  kycStatus: 'not_required';
};

export type MockEvent = {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerWallet: string | null;
  name: string;
  description: string;
  eventDate: number;
  venue: string;
  tiers: Array<{
    name: string;
    price: number;
    supply: number;
    sold: number;
    benefits: string;
  }>;
  acceptedPayments: PaymentMethod[];
  isActive: boolean;
  totalTicketsSold: number;
  totalRevenue: number;
  authorizedScanners: string[];
  authRequirements: {
    mode: 'email' | 'hybrid' | 'wallet';
    requireVerifiedEmail: boolean;
    requireWalletLink: boolean;
    requireKyc: boolean;
  };
  resaleConfig: {
    platformFeePercent: number;
    resaleDecay: Record<string, number>;
    royaltySplit: Record<string, number>;
  };
  createdAt: number;
};

export type MockTicket = {
  id: string;
  eventId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  ownerWallet: string | null;
  tierIndex: number;
  tierName: string;
  seatInfo: string | null;
  purchasePrice: number;
  purchaseTime: number;
  paymentMethod: PaymentMethod;
  status: TicketStatus;
  nftMode: 'compressed';
  assetId: string | null;
  mintAddress: string | null;
  mintSignature: string | null;
  receiptId: string | null;
  fulfillmentStatus: 'pending' | 'completed';
  lastFulfillmentError: string | null;
  issuanceAttempts: number;
  isForSale: boolean;
  salePrice: number | null;
  resaleCount: number;
  lastTransferredAt: number | null;
  lastScannedAt: number | null;
  pendingTransferApproval: boolean;
};

export type MockOrder = {
  id: string;
  eventId: string;
  ticketId: string | null;
  purchaserId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'pending' | 'confirmed';
  processor: 'stripe' | 'solana';
  paymentReference: string | null;
  idempotencyKey: string;
  nftMode: 'compressed';
  receiptLabel: string;
  receiptId: string | null;
  fulfillmentStatus: 'pending' | 'completed';
  notificationStatus: 'pending';
  assetId: string | null;
  mintAddress: string | null;
  mintSignature: string | null;
  confirmedAt: number | null;
  fulfilledAt: number | null;
  retryCount: number;
  lastError: string | null;
  createdAt: number;
};

export type MockListing = {
  id: string;
  ticketId: string;
  eventId: string;
  sellerId: string;
  sellerWallet: string | null;
  askPrice: number;
  currency: 'usd';
  status: 'active' | 'sold';
  approvalStatus: 'not_required' | 'pending' | 'approved';
  createdAt: number;
  updatedAt: number;
  soldAt: number | null;
  buyerId: string | null;
};

export type MockState = {
  users: MockUser[];
  currentUser: MockUser | null;
  events: MockEvent[];
  tickets: MockTicket[];
  orders: MockOrder[];
  resaleListings: MockListing[];
  payoutSplits: Array<Record<string, unknown>>;
  transferAudit: Array<Record<string, unknown>>;
  fraudFlags: Array<Record<string, unknown>>;
  failedFlows: Array<Record<string, unknown>>;
  incidentAlerts: Array<Record<string, unknown>>;
  sequence: number;
};

const now = Date.now();

export function createMockState(overrides: Partial<MockState> = {}): MockState {
  const users = overrides.users ?? [
    {
      id: 'user_buyer_demo',
      email: 'buyer@nfticket.app',
      name: 'Buyer Demo',
      role: 'buyer',
      wallets: [],
      authMode: 'email',
      kycStatus: 'not_required',
    },
    {
      id: 'user_provider_demo',
      email: 'provider@nfticket.app',
      name: 'Provider Demo',
      role: 'provider',
      wallets: [],
      authMode: 'email',
      kycStatus: 'not_required',
    },
  ];

  return {
    users,
    currentUser: overrides.currentUser ?? null,
    events: overrides.events ?? [
      createMockEvent(),
    ],
    tickets: overrides.tickets ?? [],
    orders: overrides.orders ?? [],
    resaleListings: overrides.resaleListings ?? [],
    payoutSplits: overrides.payoutSplits ?? [],
    transferAudit: overrides.transferAudit ?? [],
    fraudFlags: overrides.fraudFlags ?? [],
    failedFlows: overrides.failedFlows ?? [],
    incidentAlerts: overrides.incidentAlerts ?? [],
    sequence: overrides.sequence ?? 1,
  };
}

export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    id: overrides.id ?? 'event_demo_summit',
    organizerId: overrides.organizerId ?? 'user_provider_demo',
    organizerName: overrides.organizerName ?? 'Demo Organizer',
    organizerWallet: overrides.organizerWallet ?? null,
    name: overrides.name ?? 'Future of Ticketing Summit',
    description: overrides.description ?? 'Panels, demos, and partner networking for modern event operators.',
    eventDate: overrides.eventDate ?? now + 14 * 24 * 60 * 60 * 1000,
    venue: overrides.venue ?? 'Pier 48, San Francisco',
    tiers: overrides.tiers ?? [
      { name: 'General', price: 89, supply: 250, sold: 12, benefits: 'Main floor access' },
      { name: 'VIP', price: 229, supply: 40, sold: 4, benefits: 'Speaker dinner' },
    ],
    acceptedPayments: overrides.acceptedPayments ?? ['card', 'crypto'],
    isActive: overrides.isActive ?? true,
    totalTicketsSold: overrides.totalTicketsSold ?? 16,
    totalRevenue: overrides.totalRevenue ?? 1984,
    authorizedScanners: overrides.authorizedScanners ?? ['scanner:front-gate'],
    authRequirements: overrides.authRequirements ?? {
      mode: 'hybrid',
      requireVerifiedEmail: true,
      requireWalletLink: false,
      requireKyc: false,
    },
    resaleConfig: overrides.resaleConfig ?? {
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
    },
    createdAt: overrides.createdAt ?? now - 2 * 24 * 60 * 60 * 1000,
  };
}

export function createMockTicket(overrides: Partial<MockTicket> = {}): MockTicket {
  return {
    id: overrides.id ?? 'ticket_demo_1',
    eventId: overrides.eventId ?? 'event_demo_summit',
    ownerId: overrides.ownerId ?? 'user_buyer_demo',
    ownerEmail: overrides.ownerEmail ?? 'buyer@nfticket.app',
    ownerName: overrides.ownerName ?? 'Buyer Demo',
    ownerWallet: overrides.ownerWallet ?? null,
    tierIndex: overrides.tierIndex ?? 0,
    tierName: overrides.tierName ?? 'General',
    seatInfo: overrides.seatInfo ?? null,
    purchasePrice: overrides.purchasePrice ?? 89,
    purchaseTime: overrides.purchaseTime ?? now - 60_000,
    paymentMethod: overrides.paymentMethod ?? 'card',
    status: overrides.status ?? 'reserved',
    nftMode: 'compressed',
    assetId: overrides.assetId ?? null,
    mintAddress: overrides.mintAddress ?? null,
    mintSignature: overrides.mintSignature ?? null,
    receiptId: overrides.receiptId ?? null,
    fulfillmentStatus: overrides.fulfillmentStatus ?? 'pending',
    lastFulfillmentError: overrides.lastFulfillmentError ?? null,
    issuanceAttempts: overrides.issuanceAttempts ?? 0,
    isForSale: overrides.isForSale ?? false,
    salePrice: overrides.salePrice ?? null,
    resaleCount: overrides.resaleCount ?? 0,
    lastTransferredAt: overrides.lastTransferredAt ?? null,
    lastScannedAt: overrides.lastScannedAt ?? null,
    pendingTransferApproval: overrides.pendingTransferApproval ?? false,
  };
}

export function createMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  return {
    id: overrides.id ?? 'order_demo_1',
    eventId: overrides.eventId ?? 'event_demo_summit',
    ticketId: overrides.ticketId ?? null,
    purchaserId: overrides.purchaserId ?? 'user_buyer_demo',
    amount: overrides.amount ?? 91.23,
    currency: overrides.currency ?? 'USD',
    method: overrides.method ?? 'card',
    status: overrides.status ?? 'confirmed',
    processor: overrides.processor ?? 'stripe',
    paymentReference: overrides.paymentReference ?? 'cs_demo_1',
    idempotencyKey: overrides.idempotencyKey ?? 'purchase:card:event_demo_summit:ticket_demo_1:user_buyer_demo',
    nftMode: 'compressed',
    receiptLabel: overrides.receiptLabel ?? 'Paid with card via Stripe',
    receiptId: overrides.receiptId ?? null,
    fulfillmentStatus: overrides.fulfillmentStatus ?? 'pending',
    notificationStatus: overrides.notificationStatus ?? 'pending',
    assetId: overrides.assetId ?? null,
    mintAddress: overrides.mintAddress ?? null,
    mintSignature: overrides.mintSignature ?? null,
    confirmedAt: overrides.confirmedAt ?? now - 60_000,
    fulfilledAt: overrides.fulfilledAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? now - 60_000,
  };
}

export async function attachMockApi(context: BrowserContext, state: MockState) {
  await context.route('**/api/**', async (route) => {
    await handleRoute(route, state);
  });
}

async function handleRoute(route: Route, state: MockState) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const body = parseJson(request.postData());

  if (url.pathname.endsWith('/api/auth')) {
    await fulfillJson(route, 200, handleAuthAction(state, body));
    return;
  }

  if (url.pathname.endsWith('/api/events')) {
    if (method === 'GET') {
      await fulfillJson(route, 200, state.events);
      return;
    }
    if (method === 'POST') {
      const nextEvents = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
      state.events = nextEvents;
      await fulfillJson(route, 200, nextEvents);
      return;
    }
  }

  if (url.pathname.endsWith('/api/tickets')) {
    if (method === 'GET') {
      const visible = state.currentUser
        ? state.tickets.filter((ticket) => ticket.ownerId === state.currentUser?.id)
        : [];
      await fulfillJson(route, 200, visible);
      return;
    }

    if (method === 'POST') {
      const nextTickets = Array.isArray(body.tickets) ? body.tickets : body.ticket ? [body.ticket] : [];
      for (const ticket of nextTickets) {
        upsertById(state.tickets, ticket);
      }
      await fulfillJson(route, 200, nextTickets);
      return;
    }
  }

  if (url.pathname.endsWith('/api/orders')) {
    if (method === 'GET') {
      const visible = state.currentUser
        ? state.orders.filter((order) => order.purchaserId === state.currentUser?.id)
        : [];
      await fulfillJson(route, 200, visible);
      return;
    }

    if (method === 'POST') {
      const nextOrders = Array.isArray(body.orders) ? body.orders : body.order ? [body.order] : [];
      for (const order of nextOrders) {
        upsertById(state.orders, order);
      }
      await fulfillJson(route, 200, nextOrders);
      return;
    }
  }

  if (url.pathname.endsWith('/api/resale')) {
    await fulfillJson(route, 200, handleResaleAction(state, body, method));
    return;
  }

  if (url.pathname.endsWith('/api/state')) {
    await fulfillJson(route, 200, handleStateAction(state, body));
    return;
  }

  if (url.pathname.endsWith('/api/checkout')) {
    if (method === 'GET') {
      await fulfillJson(route, 200, { status: 'confirmed', paymentReference: url.searchParams.get('orderId') });
      return;
    }

    if (method === 'POST') {
      const origin = `${url.protocol}//${url.host}`;
      const order = createMockOrder({
        id: `order_e2e_${state.sequence++}`,
        eventId: String(body.eventId),
        purchaserId: state.currentUser?.id ?? 'user_buyer_demo',
        amount: Number(body.amount),
        method: body.method === 'crypto' ? 'crypto' : 'card',
        status: 'pending',
        processor: body.method === 'crypto' ? 'solana' : 'stripe',
        paymentReference: `payment_${state.sequence}`,
        idempotencyKey: String(body.idempotencyKey ?? `purchase:${state.sequence}`),
      });
      state.orders.unshift(order);
      await fulfillJson(route, 200, {
        order,
        checkoutUrl: `${origin}/my-tickets?success=true&orderId=${order.id}`,
      });
      return;
    }
  }

  if (url.pathname.endsWith('/api/fulfill')) {
    const order = state.orders.find((entry) => entry.id === body.orderId);
    if (!order || !state.currentUser) {
      await fulfillJson(route, 404, { message: 'Order not found' });
      return;
    }

    const event = state.events.find((entry) => entry.id === order.eventId) ?? createMockEvent({ id: order.eventId });
    const ownerWallet = typeof body.ownerWallet === 'string' && body.ownerWallet.length > 0 ? body.ownerWallet : null;
    let ticket = order.ticketId
      ? state.tickets.find((entry) => entry.id === order.ticketId) ?? null
      : null;

    if (!ticket) {
      ticket = createMockTicket({
        id: `ticket_e2e_${state.sequence++}`,
        eventId: order.eventId,
        ownerId: state.currentUser.id,
        ownerEmail: state.currentUser.email,
        ownerName: state.currentUser.name,
        ownerWallet,
        tierName: event.tiers[0]?.name ?? 'General',
        purchasePrice: event.tiers[0]?.price ?? order.amount,
        status: ownerWallet ? 'minted' : 'reserved',
        fulfillmentStatus: 'completed',
        issuanceAttempts: ownerWallet ? 1 : 0,
      });
      state.tickets.unshift(ticket);
    } else {
      ticket = {
        ...ticket,
        ownerWallet,
        status: ownerWallet ? 'minted' : ticket.status,
        fulfillmentStatus: 'completed',
        issuanceAttempts: ownerWallet ? Math.max(1, ticket.issuanceAttempts) : ticket.issuanceAttempts,
      };
      upsertById(state.tickets, ticket);
    }

    const mintResult = ownerWallet
      ? {
          signature: `mint_sig_${ticket.id}`,
          assetId: `asset_${ticket.id}`,
          mintAddress: `mint_${ticket.id}`,
          finality: 'finalized',
        }
      : undefined;

    const finalizedOrder: MockOrder = {
      ...order,
      ticketId: ticket.id,
      status: 'confirmed',
      fulfillmentStatus: 'completed',
      assetId: mintResult?.assetId ?? order.assetId,
      mintAddress: mintResult?.mintAddress ?? order.mintAddress,
      mintSignature: mintResult?.signature ?? order.mintSignature,
      fulfilledAt: Date.now(),
    };
    upsertById(state.orders, finalizedOrder);

    const finalizedTicket: MockTicket = {
      ...ticket,
      assetId: mintResult?.assetId ?? ticket.assetId,
      mintAddress: mintResult?.mintAddress ?? ticket.mintAddress,
      mintSignature: mintResult?.signature ?? ticket.mintSignature,
    };
    upsertById(state.tickets, finalizedTicket);

    await fulfillJson(route, 200, {
      success: true,
      order: finalizedOrder,
      ticket: finalizedTicket,
      mintResult,
    });
    return;
  }

  await fulfillJson(route, 404, { message: `Unhandled API route: ${url.pathname}` });
}

function handleAuthAction(state: MockState, body: Record<string, unknown>) {
  const action = String(body.action ?? '');

  if (action === 'login') {
    const email = String(body.email ?? '');
    const user = state.users.find((entry) => entry.email === email) ?? state.users[0];
    state.currentUser = user ?? null;
    return { success: true, user };
  }

  if (action === 'register') {
    const user: MockUser = {
      id: `user_e2e_${state.sequence++}`,
      email: String(body.email ?? `user${state.sequence}@nfticket.app`),
      name: String(body.displayName ?? 'NFTicket User'),
      role: 'buyer',
      wallets: [],
      authMode: 'email',
      kycStatus: 'not_required',
    };
    state.users.push(user);
    state.currentUser = user;
    return { success: true, user };
  }

  if (action === 'logout') {
    state.currentUser = null;
    return { success: true };
  }

  if (action === 'session:validate') {
    return state.currentUser
      ? {
          valid: true,
          user: {
            id: state.currentUser.id,
            email: state.currentUser.email,
            role: state.currentUser.role,
          },
        }
      : {
          valid: false,
        };
  }

  if (action === 'user:get') {
    return state.currentUser
      ? {
          id: state.currentUser.id,
          email: state.currentUser.email,
          displayName: state.currentUser.name,
          role: state.currentUser.role,
          wallets: state.currentUser.wallets,
          authMode: state.currentUser.authMode,
          kycStatus: state.currentUser.kycStatus,
          createdAt: now,
        }
      : {
          error: 'Not signed in',
        };
  }

  return { success: true };
}

function handleResaleAction(state: MockState, body: Record<string, unknown>, method: string) {
  if (method === 'GET') {
    return state.resaleListings;
  }

  const action = String(body.action ?? 'listings:save');
  if (action === 'listings:save' || action === 'create listing' || action === 'purchase') {
    state.resaleListings = Array.isArray(body.listings) ? body.listings as MockListing[] : [];
    return state.resaleListings;
  }

  if (action === 'payoutSplits:list') {
    return state.payoutSplits;
  }

  if (action === 'payoutSplits:save') {
    state.payoutSplits = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
    return state.payoutSplits;
  }

  if (action === 'transferAudit:list') {
    return state.transferAudit;
  }

  if (action === 'transferAudit:save') {
    state.transferAudit = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
    return state.transferAudit;
  }

  if (action === 'fraudFlags:list') {
    return state.fraudFlags;
  }

  if (action === 'fraudFlags:save') {
    state.fraudFlags = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
    return state.fraudFlags;
  }

  return [];
}

function handleStateAction(state: MockState, body: Record<string, unknown>) {
  const action = String(body.action ?? '');
  if (action === 'failedFlows:list') {
    return state.failedFlows;
  }
  if (action === 'failedFlows:save') {
    state.failedFlows = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
    return state.failedFlows;
  }
  if (action === 'incidentAlerts:list') {
    return state.incidentAlerts;
  }
  if (action === 'incidentAlerts:save') {
    state.incidentAlerts = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
    return state.incidentAlerts;
  }
  if (action === 'settings:get') {
    return null;
  }
  if (action === 'settings:set') {
    return body.value ?? null;
  }
  return [];
}

function upsertById<T extends { id: string }>(records: T[], value: T) {
  const index = records.findIndex((entry) => entry.id === value.id);
  if (index === -1) {
    records.unshift(value);
    return;
  }

  records[index] = value;
}

function parseJson(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
