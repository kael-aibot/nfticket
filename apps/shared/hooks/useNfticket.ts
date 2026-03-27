import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { defaultEventConfiguration, type AuthMode, type EventAuthRequirements } from '../../../lib/domain';
import { createFulfillmentService } from '../../../lib/fulfillment';
import type { BuyerNotification, FulfillmentOrderRecord, FulfillmentTicketRecord } from '../../../lib/fulfillment';
import type { FulfillmentStatus, NotificationStatus, OrderStatus, TicketStatus } from '../lib/types';
import { evaluateKycGate } from '../../../lib/kyc';
import { buyResaleTicket as settleResalePurchase, createResaleListing } from '../../../lib/marketplace';
import { createMintingService } from '../../../lib/minting';
import { createOperationsService } from '../../../lib/operations';
import { evaluateScanFraud } from '../../../lib/transfers';
import { useHybridAuth } from '../auth/HybridAuthContext';
import { createPaymentService } from '../lib/payments';
import { ensureSeedData } from '../lib/mockData';
import { calculatePrimaryPrice } from '../lib/pricing';
import { toScannerCredential } from '../lib/scannerCredentials';
import { defaultSettings, loadSettings } from '../lib/settings';
import {
  getEvents,
  getFailedFlows,
  getFraudFlags,
  getIncidentAlerts,
  getKycRecords,
  getOrders,
  getPayoutSplits,
  getResaleListings,
  getTickets,
  getTransferAuditLog,
  saveEvents,
  saveFailedFlows,
  saveFraudFlags,
  saveIncidentAlerts,
  saveOrders,
  savePayoutSplits,
  saveResaleListings,
  saveTickets,
  saveTransferAuditLog,
  uid,
} from '../lib/storage';
import type {
  EventRecord,
  FailedFlowRecord,
  IncidentAlertRecord,
  NftMode,
  PaymentMethod,
  PaymentOrder,
  ReceiptRecord,
  TicketRecord,
  AuthUser,
} from '../lib/types';
import type { FulfillmentResult as ApiFulfillmentResult } from '../lib/payments';

export type Event = EventRecord;
export type Ticket = TicketRecord & { event?: EventRecord | null };

const placeholderPublicKey = '11111111111111111111111111111111';
const pendingCheckoutStorageKey = 'nfticket:pendingCheckout';

type PendingCheckoutRecord = {
  orderId: string;
  eventId: string;
  tierIndex: number;
  paymentMethod: PaymentMethod;
  amount: number;
  createdAt: number;
};

function resolveDefaultNftMode(event?: EventRecord): NftMode {
  if (event?.nftMode === 'metadata') {
    return 'metadata';
  }

  return process.env.NEXT_PUBLIC_NFTICKET_NFT_MODE === 'metadata' ? 'metadata' : 'compressed';
}

function canUseWindow() {
  return typeof window !== 'undefined';
}

function readPendingCheckouts(): PendingCheckoutRecord[] {
  if (!canUseWindow()) {
    return [];
  }

  try {
    const value = window.localStorage.getItem(pendingCheckoutStorageKey);
    return value ? (JSON.parse(value) as PendingCheckoutRecord[]) : [];
  } catch {
    return [];
  }
}

function writePendingCheckouts(records: PendingCheckoutRecord[]) {
  if (!canUseWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(pendingCheckoutStorageKey, JSON.stringify(records));
  } catch {
    // Ignore localStorage write failures in browser-only reconciliation state.
  }
}

function upsertPendingCheckout(record: PendingCheckoutRecord) {
  const records = readPendingCheckouts();
  const next = records.filter((entry) => entry.orderId !== record.orderId);
  writePendingCheckouts([record, ...next]);
}

function removePendingCheckout(orderId: string) {
  writePendingCheckouts(readPendingCheckouts().filter((entry) => entry.orderId !== orderId));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function syncEventSales(eventId: string, tierIndex: number, amount: number) {
  const events = getEvents();
  saveEvents(events.map((item) => {
    if (item.id !== eventId) {
      return item;
    }

    return {
      ...item,
      tiers: item.tiers.map((tier, index) =>
        index === tierIndex ? { ...tier, sold: tier.sold + 1 } : tier,
      ),
      totalTicketsSold: item.totalTicketsSold + 1,
      totalRevenue: item.totalRevenue + amount,
    };
  }));
}

function syncFulfillmentState(result: ApiFulfillmentResult) {
  const fulfilledTicket = result.ticket as Partial<TicketRecord> | undefined;
  const fulfilledOrder = result.order as Partial<PaymentOrder> | undefined;

  if (fulfilledTicket?.id) {
    const existingTickets = getTickets();
    const current = existingTickets.find((entry) => entry.id === fulfilledTicket.id);
    if (current) {
      saveTickets(existingTickets.map((entry) => (
        entry.id === fulfilledTicket.id
          ? {
              ...entry,
              ...fulfilledTicket,
              assetId: fulfilledTicket.assetId ?? result.mintResult?.assetId ?? entry.assetId ?? null,
              mintAddress: fulfilledTicket.mintAddress ?? result.mintResult?.mintAddress ?? entry.mintAddress ?? null,
              mintSignature: fulfilledTicket.mintSignature ?? result.mintResult?.signature ?? entry.mintSignature ?? null,
              fulfillmentStatus: fulfilledTicket.fulfillmentStatus ?? entry.fulfillmentStatus ?? 'pending',
            }
          : entry
      )));
    }
  }

  if (fulfilledOrder?.id) {
    const existingOrders = getOrders();
    const current = existingOrders.find((entry) => entry.id === fulfilledOrder.id);
    if (current) {
      saveOrders(existingOrders.map((entry) => (
        entry.id === fulfilledOrder.id
          ? {
              ...entry,
              ...fulfilledOrder,
              assetId: fulfilledOrder.assetId ?? result.mintResult?.assetId ?? entry.assetId ?? null,
              mintAddress: fulfilledOrder.mintAddress ?? result.mintResult?.mintAddress ?? entry.mintAddress ?? null,
              mintSignature: fulfilledOrder.mintSignature ?? result.mintResult?.signature ?? entry.mintSignature ?? null,
            }
          : entry
      )));
    }
  }
}

function createBrowserFulfillmentServices() {
  const minting = createMintingService({
    environment: {
      cluster: 'devnet',
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
      commitment: 'confirmed',
      treasuryWallet: placeholderPublicKey,
      usdcMint: placeholderPublicKey,
      merkleTreeAddress: placeholderPublicKey,
      collectionMint: placeholderPublicKey,
      collectionUpdateAuthority: placeholderPublicKey,
      nftMode: resolveDefaultNftMode(),
    },
  });

  const store = {
    async getOrderByIdempotencyKey(idempotencyKey: string) {
      const order = getOrders().find((entry) => entry.idempotencyKey === idempotencyKey);
      return order ? toFulfillmentOrder(order) : null;
    },
    async getOrderByTicketId(ticketId: string) {
      const order = getOrders().find((entry) => entry.ticketId === ticketId);
      return order ? toFulfillmentOrder(order) : null;
    },
    async saveOrder(order: FulfillmentOrderRecord) {
      const next = fromFulfillmentOrder(order);
      saveOrders(upsertRecord(getOrders(), next));
      return order;
    },
    async getTicket(ticketId: string) {
      const ticket = getTickets().find((entry) => entry.id === ticketId);
      return ticket ? toFulfillmentTicket(ticket) : null;
    },
    async saveTicket(ticket: FulfillmentTicketRecord) {
      const next = fromFulfillmentTicket(ticket);
      saveTickets(upsertRecord(getTickets(), next));
      return ticket;
    },
    async saveReceipt(receipt: ReceiptRecord) {
      return receipt;
    },
    async saveNotification(notification: BuyerNotification) {
      const orders = getOrders();
      const order = orders.find((entry) => entry.id === notification.orderId);
      if (order) {
        saveOrders(
          orders.map((entry) =>
            entry.id === order.id
              ? {
                  ...entry,
                  notificationStatus: notification.status as NotificationStatus,
                }
              : entry,
          ),
        );
      }

      return notification;
    },
  };

  return createFulfillmentService({ store, minting });
}

function upsertRecord<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    return [record, ...records];
  }

  return records.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}

function toFulfillmentOrder(order: PaymentOrder): FulfillmentOrderRecord {
  return {
    id: order.id,
    eventId: order.eventId,
    ticketId: order.ticketId,
    purchaserId: order.purchaserId,
    amount: order.amount,
    currency: order.currency ?? 'usd',
    paymentRail: order.method === 'card' ? 'stripe' : 'sol',
    status: order.status as OrderStatus,
    paymentReference: order.paymentReference ?? null,
    idempotencyKey: order.idempotencyKey ?? `${order.processor}:${order.eventId}:${order.ticketId}:${order.purchaserId}`,
    nftMode: (order.nftMode ?? 'compressed') as NftMode,
    receiptId: order.receiptId ?? null,
    receiptLabel: order.receiptLabel ?? (order.method === 'card' ? 'Paid with card via Stripe' : 'Paid with crypto'),
    fulfillmentStatus: (order.fulfillmentStatus ?? 'pending') as FulfillmentStatus,
    notificationStatus: (order.notificationStatus ?? 'pending') as NotificationStatus,
    assetId: order.assetId ?? null,
    mintAddress: order.mintAddress ?? null,
    mintSignature: order.mintSignature ?? null,
    confirmedAt: order.confirmedAt ?? null,
    fulfilledAt: order.fulfilledAt ?? null,
    retryCount: order.retryCount ?? 0,
    lastError: order.lastError ?? null,
    createdAt: order.createdAt,
  };
}

function fromFulfillmentOrder(order: FulfillmentOrderRecord): PaymentOrder {
  return {
    id: order.id,
    eventId: order.eventId,
    ticketId: order.ticketId ?? '',
    purchaserId: order.purchaserId,
    amount: order.amount,
    currency: order.currency,
    method: order.paymentRail === 'stripe' ? 'card' : 'crypto',
    status: order.status,
    processor: order.paymentRail === 'stripe' ? 'stripe' : 'solana',
    nftMode: order.nftMode,
    paymentReference: order.paymentReference,
    idempotencyKey: order.idempotencyKey,
    receiptLabel: order.receiptLabel,
    receiptId: order.receiptId,
    fulfillmentStatus: order.fulfillmentStatus as FulfillmentStatus,
    notificationStatus: order.notificationStatus as NotificationStatus,
    assetId: order.assetId,
    mintAddress: order.mintAddress,
    mintSignature: order.mintSignature,
    confirmedAt: order.confirmedAt,
    fulfilledAt: order.fulfilledAt,
    retryCount: order.retryCount,
    lastError: order.lastError,
    createdAt: order.createdAt,
  };
}

function toFulfillmentTicket(ticket: TicketRecord): FulfillmentTicketRecord {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    ownerId: ticket.ownerId,
    ownerEmail: ticket.ownerEmail,
    ownerName: ticket.ownerName,
    ownerWallet: ticket.ownerWallet ?? null,
    tierName: ticket.tierName,
    purchasePrice: ticket.purchasePrice,
    purchaseTime: ticket.purchaseTime,
    status: ticket.status as TicketStatus,
    nftMode: (ticket.nftMode ?? 'compressed') as NftMode,
    assetId: ticket.assetId ?? null,
    mintAddress: ticket.mintAddress ?? null,
    mintSignature: ticket.mintSignature ?? null,
    receiptId: ticket.receiptId ?? null,
    fulfillmentStatus: (ticket.fulfillmentStatus ?? 'pending') as FulfillmentStatus,
    lastFulfillmentError: ticket.lastFulfillmentError ?? null,
    issuanceAttempts: ticket.issuanceAttempts ?? 0,
  };
}

function fromFulfillmentTicket(ticket: FulfillmentTicketRecord): TicketRecord {
  const existing = getTickets().find((entry) => entry.id === ticket.id);

  return {
    ...existing,
    id: ticket.id,
    eventId: ticket.eventId,
    ownerId: ticket.ownerId,
    ownerEmail: ticket.ownerEmail ?? '',
    ownerName: ticket.ownerName ?? '',
    ownerWallet: ticket.ownerWallet ?? null,
    tierIndex: existing?.tierIndex ?? 0,
    tierName: ticket.tierName ?? '',
    seatInfo: existing?.seatInfo ?? null,
    purchasePrice: ticket.purchasePrice ?? 0,
    purchaseTime: ticket.purchaseTime ?? Date.now(),
    paymentMethod: existing?.paymentMethod ?? 'card',
    status: ticket.status as TicketStatus,
    nftMode: ticket.nftMode,
    assetId: ticket.assetId,
    mintAddress: ticket.mintAddress,
    mintSignature: ticket.mintSignature,
    receiptId: ticket.receiptId,
    fulfillmentStatus: ticket.fulfillmentStatus,
    lastFulfillmentError: ticket.lastFulfillmentError,
    issuanceAttempts: ticket.issuanceAttempts,
    isForSale: existing?.isForSale ?? false,
    salePrice: existing?.salePrice ?? null,
    resaleCount: existing?.resaleCount ?? 0,
    lastTransferredAt: existing?.lastTransferredAt ?? null,
    lastScannedAt: existing?.lastScannedAt ?? null,
    pendingTransferApproval: existing?.pendingTransferApproval ?? false,
  };
}

function getMarketplaceState() {
  return {
    listings: getResaleListings(),
    payoutSplits: getPayoutSplits(),
    auditLog: getTransferAuditLog(),
    fraudFlags: getFraudFlags(),
  };
}

function prependRecords<T>(records: T[], nextRecords: T[]): T[] {
  if (nextRecords.length === 0) {
    return records;
  }

  return [...nextRecords, ...records];
}

function resolveEventAuthRequirements(event?: EventRecord): EventAuthRequirements {
  const configuredMode = process.env.NEXT_PUBLIC_NFTICKET_AUTH_MODE as AuthMode | undefined;
  return {
    ...defaultEventConfiguration.auth,
    mode: configuredMode ?? event?.authRequirements?.mode ?? defaultEventConfiguration.auth.mode,
    requireVerifiedEmail: event?.authRequirements?.requireVerifiedEmail ?? defaultEventConfiguration.auth.requireVerifiedEmail,
    requireWalletLink: event?.authRequirements?.requireWalletLink ?? defaultEventConfiguration.auth.requireWalletLink,
    requireKyc: event?.authRequirements?.requireKyc ?? defaultEventConfiguration.auth.requireKyc,
  };
}

function ensureWalletIdentity(walletAddress: string): AuthUser {
  return {
    id: uid('user'),
    name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
    email: `${walletAddress.toLowerCase()}@wallet.nfticket.local`,
    provider: 'credentials',
    role: 'buyer',
    emailVerified: false,
    wallets: [walletAddress],
    linkedWallets: [walletAddress],
    authMode: 'wallet',
    kycStatus: 'not_required',
    adminRoles: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastLoginAt: Date.now(),
  };
}

function recordFailure(
  type: FailedFlowRecord['type'],
  input: {
    error: Error;
    eventId?: string | null;
    orderId?: string | null;
    ticketId?: string | null;
    userId?: string | null;
    idempotencyKey: string;
    payload: Record<string, string>;
  },
) {
  const operations = createOperationsService({
    listFailedFlows: getFailedFlows,
    saveFailedFlows,
    listAlerts: getIncidentAlerts,
    saveAlerts: saveIncidentAlerts,
    uid,
  });
  operations.recordFailure({
    type,
    eventId: input.eventId ?? null,
    orderId: input.orderId ?? null,
    ticketId: input.ticketId ?? null,
    userId: input.userId ?? null,
    idempotencyKey: input.idempotencyKey,
    errorMessage: input.error.message,
    payload: input.payload,
  });
}

export const useNfticket = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const auth = useHybridAuth();

  const ensureAuthenticatedCheckoutSession = useCallback(async () => {
    if (!auth.user) {
      throw new Error('Sign in with email to continue');
    }

    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        action: 'session:validate',
      }),
    });

    const payload = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() as { valid?: boolean; user?: { id?: string | null } }
      : null;

    if (!response.ok || !payload?.valid || !payload.user?.id) {
      throw new Error('Your session has expired. Sign in again to continue');
    }

    if (payload.user.id !== auth.user.id) {
      throw new Error('The active session does not match the current user. Sign in again to continue');
    }
  }, [auth.user]);

  const resolveActorForEvent = useCallback((event?: EventRecord) => {
    ensureSeedData();
    const authRequirements = resolveEventAuthRequirements(event);
    const walletAddress = wallet.publicKey?.toBase58() ?? null;
    const sessionUser = auth.user;

    if (authRequirements.mode === 'wallet') {
      if (!walletAddress) {
        throw new Error('Connect a wallet to continue');
      }
      const walletUser = ensureWalletIdentity(walletAddress);
      return {
        userId: walletUser.id,
        user: walletUser,
        walletAddress,
        authRequirements,
      };
    }

    if (authRequirements.mode === 'email') {
      if (!sessionUser) {
        throw new Error('Sign in with email to continue');
      }
      if (authRequirements.requireVerifiedEmail && !sessionUser.emailVerified) {
        throw new Error('Verify your email to continue');
      }
      return {
        userId: sessionUser.id,
        user: sessionUser,
        walletAddress,
        authRequirements,
      };
    }

    if (sessionUser) {
      return {
        userId: sessionUser.id,
        user: sessionUser,
        walletAddress,
        authRequirements,
      };
    }

    if (walletAddress) {
      const walletUser = ensureWalletIdentity(walletAddress);
      return {
        userId: walletUser.id,
        user: walletUser,
        walletAddress,
        authRequirements,
      };
    }

    throw new Error('Sign in or connect a wallet to continue');
  }, [auth.user, wallet.publicKey]);

  const enforceKycGate = useCallback((event: EventRecord, user: AuthUser, flow: 'purchase' | 'transfer') => {
    const authRequirements = resolveEventAuthRequirements(event);
    const eventKycRecord = getKycRecords().find((record) => record.userId === user.id && record.eventId === event.id);
    const decision = evaluateKycGate({
      required: authRequirements.requireKyc,
      appliesTo: ['purchase', 'transfer'],
      provider: eventKycRecord?.providerReference ?? null,
    }, flow, {
      userId: user.id,
      status: user.kycStatus,
      eventStatus: eventKycRecord?.status ?? null,
    });
    if (!decision.allowed) {
      throw new Error(decision.message);
    }
  }, []);

  const operations = useCallback(() => createOperationsService({
    listFailedFlows: getFailedFlows,
    saveFailedFlows,
    listAlerts: getIncidentAlerts,
    saveAlerts: saveIncidentAlerts,
    uid,
  }), []);

  const submitUsdcPayment = useCallback(async (amount: number, recipientWallet: string, usdcMint: string) => {
    if (!wallet.publicKey) {
      throw new Error('Connect a wallet to pay with crypto');
    }
    if (!wallet.sendTransaction) {
      throw new Error('Connected wallet does not support transactions');
    }

    const payer = wallet.publicKey;
    const mint = new PublicKey(usdcMint);
    const recipient = new PublicKey(recipientWallet);
    const sourceAta = getAssociatedTokenAddressSync(mint, payer);
    const destinationAta = getAssociatedTokenAddressSync(mint, recipient);
    const amountRaw = BigInt(Math.round(amount * 1_000_000));

    if (amountRaw <= BigInt(0)) {
      throw new Error('Crypto payment amount must be greater than zero');
    }

    const transaction = new Transaction();
    const destinationInfo = await connection.getAccountInfo(destinationAta);
    if (!destinationInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer,
          destinationAta,
          recipient,
          mint,
        ),
      );
    }

    transaction.add(
      createTransferInstruction(
        sourceAta,
        destinationAta,
        payer,
        amountRaw,
      ),
    );

    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }, [connection, wallet]);

  const reconcilePendingPurchases = useCallback(async () => {
    if (!canUseWindow()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === 'true') {
      writePendingCheckouts(
        readPendingCheckouts().filter((entry) => entry.paymentMethod !== 'card'),
      );
      return;
    }

    const paymentService = createPaymentService();
    const pending = readPendingCheckouts();

    for (const entry of pending) {
      if (entry.paymentMethod !== 'card') {
        continue;
      }

      const status = await paymentService.getPaymentStatus(entry.orderId);
      if (status.status === 'confirmed') {
        await paymentService.fulfillOrder(entry.orderId, wallet.publicKey?.toBase58() ?? null);
        syncEventSales(entry.eventId, entry.tierIndex, entry.amount);
        removePendingCheckout(entry.orderId);
        continue;
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        removePendingCheckout(entry.orderId);
      }
    }
  }, [wallet.publicKey]);

  const ensureFulfillmentFinalized = useCallback(async (
    orderId: string,
    ownerWallet: string | null,
  ) => {
    const paymentService = createPaymentService();
    let result = await paymentService.fulfillOrder(orderId, ownerWallet);
    syncFulfillmentState(result);

    if (result.mintResult?.finality !== 'pending') {
      return result;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await delay(1_500 * (attempt + 1));
      result = await paymentService.fulfillOrder(orderId, ownerWallet);
      syncFulfillmentState(result);
      if (result.mintResult?.finality !== 'pending') {
        return result;
      }
    }

    return result;
  }, []);

  const fetchEvents = useCallback(async (): Promise<Event[]> => {
    ensureSeedData();
    return getEvents().sort((a, b) => a.eventDate - b.eventDate);
  }, []);

  const fetchMyEvents = useCallback(async (): Promise<Event[]> => {
    ensureSeedData();
    const sessionUserId = auth.user?.id ?? null;
    if (!sessionUserId) return [];
    return getEvents().filter((event) => event.organizerId === sessionUserId);
  }, [auth.user?.id]);

  const createEvent = useCallback(async (params: {
    name: string;
    description: string;
    eventDate: Date;
    venue: string;
    tiers: { name: string; price: number; supply: number; benefits: string }[];
    acceptedPayments?: PaymentMethod[];
    organizerName?: string;
    authMode?: AuthMode;
    requireKyc?: boolean;
    walletOnly?: boolean;
  }) => {
    ensureSeedData();
    const sessionUserId = auth.user?.id ?? null;
    if (!sessionUserId) {
      throw new Error('Sign in to create an event');
    }

    const events = getEvents();
    const settings = loadSettings();
    const authMode = params.walletOnly ? 'wallet' : (params.authMode ?? process.env.NEXT_PUBLIC_NFTICKET_AUTH_MODE as AuthMode | undefined ?? defaultEventConfiguration.auth.mode);
    const nextEvent: EventRecord = {
      id: uid('event'),
      organizerId: sessionUserId,
      organizerName: params.organizerName ?? 'Organizer',
      organizerWallet: wallet.publicKey?.toBase58() ?? null,
      name: params.name,
      description: params.description,
      eventDate: params.eventDate.getTime(),
      venue: params.venue,
      tiers: params.tiers.map((tier) => ({ ...tier, sold: 0 })),
      acceptedPayments: params.acceptedPayments ?? ['card', 'crypto'],
      nftMode: resolveDefaultNftMode(),
      isActive: true,
      totalTicketsSold: 0,
      totalRevenue: 0,
      authorizedScanners: [],
      authRequirements: {
        mode: authMode,
        requireVerifiedEmail: authMode !== 'wallet',
        requireWalletLink: authMode === 'wallet',
        requireKyc: Boolean(params.requireKyc),
      },
      resaleConfig: settings,
      createdAt: Date.now(),
    };

    saveEvents([nextEvent, ...events]);

    return {
      signature: `local_${nextEvent.id}`,
      eventPublicKey: nextEvent.id,
    };
  }, [auth.user?.id, wallet.publicKey]);

  const purchaseTicket = useCallback(async (
    eventId: string,
    tierIndex: number,
    paymentMethod: PaymentMethod
  ) => {
    ensureSeedData();
    const events = getEvents();
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    const actor = resolveActorForEvent(event);
    enforceKycGate(event, actor.user, 'purchase');

    const tier = event.tiers[tierIndex];
    if (!tier) {
      throw new Error('Ticket tier not found');
    }
    if (tier.sold >= tier.supply) {
      throw new Error('Ticket tier is sold out');
    }

    const nftMode = resolveDefaultNftMode(event);
    const ticketId = uid('ticket');
    const paymentService = createPaymentService();
    const idempotencyKey = `purchase:${paymentMethod}:${eventId}:${ticketId}:${actor.userId}`;
    const settings = loadSettings();
    const { total: totalPrice } = calculatePrimaryPrice(tier.price, settings);

    try {
      await ensureAuthenticatedCheckoutSession();

      if (paymentMethod === 'card') {
        const paymentResult = await paymentService.submitPayment({
          amount: totalPrice,
          currency: 'usd',
          eventId,
          purchaserId: actor.userId,
          ticketId,
          method: paymentMethod,
          nftMode,
          idempotencyKey,
          returnUrl: canUseWindow() ? `${window.location.origin}` : undefined,
        });

        if (!paymentResult.order?.id || !paymentResult.checkoutUrl) {
          throw new Error('Stripe checkout could not be created');
        }

        upsertPendingCheckout({
          orderId: paymentResult.order.id,
          eventId,
          tierIndex,
          paymentMethod,
          amount: totalPrice,
          createdAt: Date.now(),
        });

        if (canUseWindow()) {
          window.location.assign(paymentResult.checkoutUrl);
          return new Promise<TicketRecord>(() => {});
        }

        throw new Error('Stripe checkout requires a browser environment');
      }

      const paymentIntent = await paymentService.submitPayment({
        amount: totalPrice,
        currency: 'USDC',
        eventId,
        purchaserId: actor.userId,
        ticketId,
        method: paymentMethod,
        nftMode,
        idempotencyKey,
      });

      if (!paymentIntent.requiresPayment || !paymentIntent.crypto) {
        throw new Error('Crypto payment details are unavailable');
      }

      const transactionSignature = await submitUsdcPayment(
        totalPrice,
        paymentIntent.crypto.recipientWallet,
        paymentIntent.crypto.usdcMint,
      );

      const paymentResult = await paymentService.submitPayment({
        amount: totalPrice,
        currency: paymentIntent.crypto.currency,
        eventId,
        purchaserId: actor.userId,
        ticketId,
        method: paymentMethod,
        nftMode,
        idempotencyKey,
        payerWallet: wallet.publicKey?.toBase58(),
        transactionSignature,
      });

      if (!paymentResult.order?.id) {
        throw new Error('Crypto payment verification did not return an order');
      }

      const fulfillmentResult = await ensureFulfillmentFinalized(
        paymentResult.order.id,
        wallet.publicKey?.toBase58() ?? actor.walletAddress ?? null,
      );

      syncEventSales(eventId, tierIndex, totalPrice);

      const fulfilledTicket = fulfillmentResult.ticket as {
        id: string;
        assetId?: string | null;
        nftMode?: NftMode;
        status?: TicketRecord['status'];
        createdAt?: string | Date;
      } | undefined;

      if (!fulfilledTicket?.id) {
        throw new Error('Ticket fulfillment did not persist');
      }

      return {
        id: fulfilledTicket.id,
        eventId,
        ownerId: actor.userId,
        ownerEmail: actor.user.email,
        ownerName: actor.user.name,
        ownerWallet: wallet.publicKey?.toBase58() ?? actor.walletAddress,
        tierIndex,
        tierName: tier.name,
        seatInfo: null,
        purchasePrice: tier.price,
        purchaseTime: fulfilledTicket.createdAt ? new Date(fulfilledTicket.createdAt).getTime() : Date.now(),
        paymentMethod,
        status: fulfilledTicket.status ?? 'minted',
        nftMode: fulfilledTicket.nftMode ?? nftMode,
        assetId: fulfilledTicket.assetId ?? fulfillmentResult.mintResult?.assetId ?? null,
        mintAddress: fulfillmentResult.mintResult?.mintAddress ?? null,
        mintSignature: fulfillmentResult.mintResult?.signature ?? null,
        receiptId: null,
        fulfillmentStatus: 'completed',
        lastFulfillmentError: null,
        issuanceAttempts: 1,
        isForSale: false,
        salePrice: null,
        resaleCount: 0,
        lastTransferredAt: null,
        lastScannedAt: null,
        pendingTransferApproval: false,
      };
    } catch (error) {
      recordFailure('payment', {
        error: error instanceof Error ? error : new Error(String(error)),
        eventId,
        ticketId,
        userId: actor.userId,
        idempotencyKey,
        payload: {
          eventId,
          tierIndex: String(tierIndex),
          paymentMethod,
          ticketId,
        },
      });
      throw error;
    }
  }, [enforceKycGate, ensureFulfillmentFinalized, resolveActorForEvent, submitUsdcPayment, wallet.publicKey]);

  const mintTicket = useCallback(async (ticketId: string) => {
    ensureSeedData();
    if (!wallet.publicKey) {
      throw new Error('Connect a wallet to mint tickets');
    }
    const ticket = getTickets().find((entry) => entry.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status === 'minted') {
      if (ticket.mintSignature && (ticket.mintAddress || ticket.assetId)) {
        return {
          signature: ticket.mintSignature,
          ticketPublicKey: ticket.mintAddress ?? ticket.assetId ?? ticketId,
        };
      }
    }

    const order = getOrders().find((entry) => entry.ticketId === ticketId);
    if (!order?.id) {
      throw new Error('Ticket is not linked to a paid order that can be minted on-chain');
    }

    saveTickets(getTickets().map((entry) => entry.id === ticketId ? {
      ...entry,
      ownerWallet: wallet.publicKey?.toBase58() ?? null,
    } : entry));

    try {
      const result = await ensureFulfillmentFinalized(order.id, wallet.publicKey.toBase58());
      if (!result.mintResult?.signature || !(result.mintResult.mintAddress ?? result.mintResult.assetId)) {
        throw new Error('Minting did not return on-chain asset details');
      }

      return {
        signature: result.mintResult.signature,
        ticketPublicKey: result.mintResult.mintAddress ?? result.mintResult.assetId,
      };
    } catch (error) {
      recordFailure('minting', {
        error: error instanceof Error ? error : new Error(String(error)),
        eventId: ticket.eventId,
        ticketId,
        userId: ticket.ownerId,
        idempotencyKey: `mint:${ticketId}:${wallet.publicKey.toBase58()}`,
        payload: {
          eventId: ticket.eventId,
          ownerWallet: wallet.publicKey.toBase58(),
          ticketId,
        },
      });
      throw error;
    }
  }, [ensureFulfillmentFinalized, wallet.publicKey]);

  const fetchMyTickets = useCallback(async (): Promise<Ticket[]> => {
    ensureSeedData();
    const sessionUserId = auth.user?.id ?? null;
    if (!sessionUserId) return [];

    await reconcilePendingPurchases();

    const events = getEvents();
    return getTickets()
      .filter((ticket) => ticket.ownerId === sessionUserId)
      .map((ticket) => ({
        ...ticket,
        event: events.find((event) => event.id === ticket.eventId) ?? null,
      }));
  }, [auth.user?.id, reconcilePendingPurchases]);

  const fetchTicket = useCallback(async (ticketId: string): Promise<Ticket | null> => {
    ensureSeedData();
    const ticket = getTickets().find((item) => item.id === ticketId);
    if (!ticket) return null;
    return {
      ...ticket,
      event: getEvents().find((event) => event.id === ticket.eventId) ?? null,
    };
  }, []);

  const listTicketForResale = useCallback(async (ticketId: string, salePrice: number) => {
    ensureSeedData();
    if (!wallet.publicKey) {
      throw new Error('Connect a wallet to resell tickets');
    }

    const sessionUserId = auth.user?.id ?? null;
    if (!sessionUserId) {
      throw new Error('Sign in to resell tickets');
    }

    const tickets = getTickets();
    const ticket = tickets.find((item) => item.id === ticketId);
    const event = getEvents().find((item) => item.id === ticket?.eventId);
    if (!ticket || !event) {
      throw new Error('Ticket not found');
    }
    const actor = resolveActorForEvent(event);
    enforceKycGate(event, actor.user, 'transfer');

    const marketplaceResult = createResaleListing({
      event,
      ticket,
      sellerId: actor.userId,
      sellerWallet: wallet.publicKey.toBase58(),
      salePrice,
      marketplace: getMarketplaceState(),
    });

    saveTickets(
      tickets.map((item) => (item.id === ticketId ? marketplaceResult.ticket : item)),
    );
    saveResaleListings(prependRecords(getResaleListings(), [marketplaceResult.listing]));
    saveTransferAuditLog(
      prependRecords(getTransferAuditLog(), marketplaceResult.auditRecords),
    );
    saveFraudFlags(marketplaceResult.fraudFlags);

    return { signature: `resale_${ticketId}` };
  }, [auth.user?.id, enforceKycGate, ensureAuthenticatedCheckoutSession, resolveActorForEvent, wallet.publicKey]);

  const buyResaleTicket = useCallback(async (ticketId: string) => {
    ensureSeedData();
    const tickets = getTickets();
    const ticket = tickets.find((item) => item.id === ticketId);
    const event = getEvents().find((item) => item.id === ticket?.eventId);
    const listing = getResaleListings().find(
      (item) => item.ticketId === ticketId && item.status === 'active',
    );
    if (!ticket || !event || !listing) {
      throw new Error('Resale listing not found');
    }
    const actor = resolveActorForEvent(event);
    enforceKycGate(event, actor.user, 'transfer');

    const marketplaceResult = settleResalePurchase({
      event,
      ticket,
      listing,
      buyerId: actor.userId,
      buyerWallet: actor.walletAddress,
      marketplace: getMarketplaceState(),
    });

    saveTickets(
      tickets.map((item) => (item.id === ticketId ? marketplaceResult.ticket : item)),
    );
    saveResaleListings(
      getResaleListings().map((item) =>
        item.id === listing.id ? marketplaceResult.listing : item,
      ),
    );
    savePayoutSplits(prependRecords(getPayoutSplits(), marketplaceResult.payoutSplits));
    saveTransferAuditLog(
      prependRecords(getTransferAuditLog(), marketplaceResult.auditRecords),
    );
    saveFraudFlags(marketplaceResult.fraudFlags);

    return { signature: `buy_resale_${ticketId}` };
  }, [enforceKycGate, resolveActorForEvent, wallet.publicKey]);

  const scanTicket = useCallback(async (eventId: string, ticketId: string) => {
    ensureSeedData();
    const tickets = getTickets();
    const ticket = tickets.find((item) => item.id === ticketId && item.eventId === eventId);
    const event = getEvents().find((item) => item.id === eventId);
    if (!ticket || !event) {
      throw new Error('Ticket not found');
    }

    const scanFraud = evaluateScanFraud({
      event,
      ticket,
      scannerUserId: auth.user?.id ?? null,
      auditLog: getTransferAuditLog(),
    });

    if (scanFraud.fraudFlags.length > 0) {
      saveFraudFlags(prependRecords(getFraudFlags(), scanFraud.fraudFlags));
      saveTransferAuditLog(prependRecords(getTransferAuditLog(), scanFraud.auditRecords));
      return { signature: `scan_${ticketId}` };
    }

    saveTickets(
      tickets.map((item) =>
        item.id === ticketId && item.eventId === eventId
          ? {
              ...item,
              status: 'scanned' as const,
              lastScannedAt: Date.now(),
            }
          : item,
      ),
    );
    return { signature: `scan_${ticketId}` };
  }, [auth.user?.id]);

  const addScanner = useCallback(async (eventId: string, scannerId: string) => {
    ensureSeedData();
    const normalizedScannerId = toScannerCredential(scannerId);
    if (!normalizedScannerId) {
      throw new Error('Scanner credential is required');
    }
    saveEvents(getEvents().map((event) => event.id === eventId ? {
      ...event,
      authorizedScanners: Array.from(new Set([...event.authorizedScanners, normalizedScannerId])),
    } : event));
    return { signature: `scanner_${eventId}` };
  }, []);

  const getTicketQRData = useCallback((ticketId: string) => {
    ensureSeedData();
    const ticket = getTickets().find((item) => item.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return JSON.stringify({
      type: 'nfticket',
      version: 2,
      ticketId,
      eventId: ticket.eventId,
      issuedAt: Date.now(),
    });
  }, []);

  const parseScannedQRData = useCallback((qrData: string) => {
    try {
      const parsed = JSON.parse(qrData);
      return (
        parsed.type === 'nfticket' &&
        parsed.version === 2 &&
        typeof parsed.ticketId === 'string' &&
        typeof parsed.eventId === 'string' &&
        typeof parsed.issuedAt === 'number'
      ) ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  const fetchFailedFlows = useCallback(async (): Promise<FailedFlowRecord[]> => {
    if (!auth.hasAdminAccess('operations')) {
      throw new Error('Admin operations access is required');
    }
    return operations().listFailures();
  }, [auth, operations]);

  const fetchIncidentAlerts = useCallback(async (): Promise<IncidentAlertRecord[]> => {
    if (!auth.hasAdminAccess('operations')) {
      throw new Error('Admin operations access is required');
    }
    return operations().listAlerts();
  }, [auth, operations]);

  const replayFailedFlow = useCallback(async (failureId: string) => {
    if (!auth.hasAdminAccess('operations')) {
      throw new Error('Admin operations access is required');
    }
    const service = operations();
    const failure = service.markReplaying(failureId);
    if (failure.type === 'minting' && failure.ticketId) {
      const ticket = getTickets().find((entry) => entry.id === failure.ticketId);
      if (ticket?.ownerWallet) {
        const fulfillmentService = createBrowserFulfillmentServices();
        await fulfillmentService.retryTicketIssuance({
          ticketId: failure.ticketId,
          ownerWallet: ticket.ownerWallet,
          metadata: {
            eventName: failure.payload.eventId ?? ticket.eventId,
            tierName: ticket.tierName,
            venue: '',
            startsAt: ticket.purchaseTime,
          },
        });
      }
    }
    if (failure.type === 'payment' && failure.ticketId && failure.eventId) {
      const order = getOrders().find((entry) => entry.ticketId === failure.ticketId);
      if (order?.id) {
        const paymentService = createPaymentService();
        await paymentService.fulfillOrder(order.id, wallet.publicKey?.toBase58() ?? null);
      }
    }
    return service.resolveFailure(failureId, 'Replay completed');
  }, [auth, operations, wallet.publicKey]);

  const resolveIncident = useCallback(async (failureId: string, resolutionNote?: string) => {
    if (!auth.hasAdminAccess('operations')) {
      throw new Error('Admin operations access is required');
    }
    return operations().resolveFailure(failureId, resolutionNote);
  }, [auth, operations]);

  return {
    connected: Boolean(wallet.publicKey),
    publicKey: wallet.publicKey,
    activeUser: auth.user,
    session: auth.session,
    authMode: auth.authMode,
    fetchEvents,
    fetchMyEvents,
    createEvent,
    purchaseTicket,
    mintTicket,
    fetchMyTickets,
    fetchTicket,
    listTicketForResale,
    buyResaleTicket,
    scanTicket,
    addScanner,
    getTicketQRData,
    parseScannedQRData,
    requestMagicLink: auth.requestMagicLink,
    consumeMagicLink: auth.consumeMagicLink,
    requestAccountRecovery: auth.requestAccountRecovery,
    signInWithWallet: auth.signInWithWallet,
    linkWallet: auth.linkWallet,
    fetchFailedFlows,
    fetchIncidentAlerts,
    replayFailedFlow,
    resolveIncident,
  };
};
