import type { Prisma } from '@prisma/client';
import { createPrefixedId } from '../apps/shared/lib/ids';
import { getPrismaClient } from '../apps/shared/lib/prisma';
import { ApiError } from '../apps/shared/lib/apiErrors';
import type { MintTicketRequest, MintedTicketAsset } from './minting';
import { createMintingService } from './minting';
import type { BlockchainEnvironment, TicketNftMode } from './blockchain';
import { normalizeTicketMetadata } from './blockchain';
import type { OrderStatus, TicketStatus, FulfillmentStatus, NotificationStatus, NftMode } from '../apps/shared/lib/types';
import {
  createMetaplexTransport,
  getMintConfigurationIssues,
  loadMintConfigFromEnv,
} from '../apps/shared/lib/metaplexMinting';

const MAX_MINT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_250;
const DEFAULT_IMAGE_URI = 'https://placehold.co/1200x630/png?text=NFTicket';

type FulfillmentMetadata = {
  nftMode?: TicketNftMode;
  ticketArtworkUri?: string;
  ticketImageUri?: string;
  ticketMetadataUri?: string;
  mintSignature?: string;
  mintAddress?: string | null;
  assetId?: string | null;
  fulfilledAt?: string;
  fulfilledBy?: string;
  mintFinality?: string;
  mintAttempts?: number;
  mintError?: string;
  tierName?: string;
};

export interface FulfillmentResult {
  success: boolean;
  alreadyFulfilled?: boolean;
  ticket?: {
    id: string;
    eventId: string;
    ownerId: string;
    assetId: string | null;
    nftMode: 'compressed' | 'metadata';
    status: string;
  };
  mintResult?: {
    signature: string;
    assetId: string;
    mintAddress: string | null;
    finality: string;
  };
  error?: string;
}

// Legacy types for backward compatibility
export interface FulfillmentOrderRecord {
  id: string;
  eventId: string;
  ticketId?: string;
  purchaserId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentRail: string;
  nftMode?: NftMode;
  paymentReference?: string | null;
  idempotencyKey?: string;
  receiptLabel?: string;
  receiptId?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
  notificationStatus?: NotificationStatus;
  assetId?: string | null;
  mintAddress?: string | null;
  mintSignature?: string | null;
  confirmedAt?: number | null;
  fulfilledAt?: number | null;
  retryCount?: number;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface FulfillmentTicketRecord {
  id: string;
  eventId: string;
  orderId?: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerWallet?: string | null;
  tierName?: string;
  purchasePrice?: number;
  purchaseTime?: number;
  assetId?: string | null;
  status: TicketStatus;
  nftMode: NftMode;
  mintAddress?: string | null;
  mintSignature?: string | null;
  receiptId?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
  lastFulfillmentError?: string | null;
  issuanceAttempts?: number;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export interface BuyerNotification {
  id: string;
  userId: string;
  type: 'purchase_complete' | 'mint_complete' | 'transfer_in' | 'transfer_out' | 'scan' | 'resale_sold';
  title: string;
  message: string;
  read: boolean;
  orderId?: string;
  status?: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

// Legacy fulfillment service factory for backward compatibility
interface FulfillmentStore {
  saveOrder(order: FulfillmentOrderRecord): Promise<FulfillmentOrderRecord>;
  saveTicket(ticket: FulfillmentTicketRecord): Promise<FulfillmentTicketRecord>;
  saveNotification(notification: BuyerNotification): Promise<BuyerNotification>;
  getOrderByIdempotencyKey?(idempotencyKey: string): Promise<FulfillmentOrderRecord | null | undefined>;
  getOrderByTicketId?(ticketId: string): Promise<FulfillmentOrderRecord | null | undefined>;
  getTicket?(ticketId: string): Promise<FulfillmentTicketRecord | null | undefined>;
  getNotifications?(userId: string): Promise<BuyerNotification[]>;
}

interface FulfillmentMinting {
  mintTicket(request: { ticketId: string; owner: string; eventId: string; ownerWallet?: string; metadata?: unknown }): Promise<{ signature: string; assetId: string }>;
}

interface FulfillmentServiceConfig {
  store: FulfillmentStore;
  minting: FulfillmentMinting;
}

export function createFulfillmentService(config: FulfillmentServiceConfig) {
  return {
    async processOrder(order: FulfillmentOrderRecord): Promise<FulfillmentTicketRecord | null> {
      await config.store.saveOrder(order);

      if (order.status === 'paid') {
        const ticketId = createPrefixedId('tkt');
        const mintResult = await config.minting.mintTicket({
          ticketId,
          owner: order.purchaserId,
          eventId: order.eventId,
        });

        const ticket: FulfillmentTicketRecord = {
          id: ticketId,
          eventId: order.eventId,
          orderId: order.id,
          ownerId: order.purchaserId,
          assetId: mintResult.assetId,
          status: 'minted',
          nftMode: order.nftMode ?? 'compressed',
          createdAt: Date.now(),
        };

        await config.store.saveTicket(ticket);

        const notification: BuyerNotification = {
          id: createPrefixedId('notif'),
          userId: order.purchaserId,
          type: 'mint_complete',
          title: 'Your ticket is ready!',
          message: `Your ticket for event ${order.eventId} has been minted.`,
          read: false,
          createdAt: Date.now(),
        };

        await config.store.saveNotification(notification);
        return ticket;
      }

      return null;
    },

    async notifyBuyer(notification: BuyerNotification): Promise<void> {
      await config.store.saveNotification(notification);
    },

    async retryTicketIssuance(params: string | { ticketId: string; ownerWallet?: string; metadata?: Record<string, unknown> }): Promise<FulfillmentTicketRecord | null> {
      const ticketId = typeof params === 'string' ? params : params.ticketId;
      const ticket = await config.store.getTicket?.(ticketId);
      if (!ticket) return null;

      const order = await config.store.getOrderByTicketId?.(ticketId);
      if (!order) return null;

      // Retry minting
      const mintResult = await config.minting.mintTicket({
        ticketId,
        owner: ticket.ownerId,
        eventId: ticket.eventId,
        ownerWallet: typeof params === 'object' ? params.ownerWallet : undefined,
        metadata: typeof params === 'object' ? params.metadata : undefined,
      });

      const updatedTicket: FulfillmentTicketRecord = {
        ...ticket,
        assetId: mintResult.assetId,
        status: 'minted',
        issuanceAttempts: (ticket.issuanceAttempts ?? 0) + 1,
      };

      await config.store.saveTicket(updatedTicket);
      return updatedTicket;
    },
  };
}

/**
 * Fulfill an order by minting an NFT ticket
 * This is the core fulfillment logic used by both the webhook and API endpoints
 */
export async function fulfillOrder(
  orderId: string,
  options: {
    ownerWallet?: string | null;
    fulfilledBy?: string;
  } = {}
): Promise<FulfillmentResult> {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      event: true,
      ticket: true,
      purchaser: {
        select: {
          id: true,
          primaryWallet: true,
          wallets: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'confirmed') {
    throw ApiError.badRequest(
      `Payment not confirmed. Status: ${order.status}`,
      'PAYMENT_NOT_CONFIRMED',
    );
  }

  const orderMetadata = toFulfillmentMetadata(order.metadata);

  // Check if already fulfilled
  if (order.ticketId && order.ticket && orderMetadata.assetId && orderMetadata.mintSignature) {
    return {
      success: true,
      alreadyFulfilled: true,
      ticket: {
        id: order.ticket.id,
        eventId: order.ticket.eventId,
        ownerId: order.ticket.ownerId,
        assetId: order.ticket.assetId,
        nftMode: order.ticket.nftMode,
        status: order.ticket.status,
      },
      mintResult: {
        signature: orderMetadata.mintSignature,
        assetId: orderMetadata.assetId,
        mintAddress: orderMetadata.mintAddress ?? null,
        finality: orderMetadata.mintFinality ?? 'finalized',
      },
    };
  }

  const mode = resolveNftMode(orderMetadata, order.event.nftMode);
  const environment = buildBlockchainEnvironment(mode);
  const configIssues = getMintConfigurationIssues({ environment, mode });
  if (configIssues.length > 0) {
    throw ApiError.badRequest(
      `Minting configuration is incomplete: ${configIssues.map((issue) => issue.message).join(' ')}`,
      'MINT_CONFIG_MISSING',
    );
  }

  const { config: mintConfig } = loadMintConfigFromEnv();
  if (!mintConfig) {
    throw ApiError.badRequest(
      'Minting configuration is incomplete: missing valid SOLANA_PAYER_SECRET or SOLANA_RPC_URL.',
      'MINT_CONFIG_MISSING',
    );
  }

  const mintOwner = await resolveMintOwner({
    ownerWallet: options.ownerWallet,
    purchaserId: order.purchaserId,
    purchaserPrimaryWallet: order.purchaser.primaryWallet,
    purchaserWallets: order.purchaser.wallets,
  });

  const ticketId = order.ticketId ?? createPrefixedId('tkt');
  const ticketArtworkUri = resolveTicketArtworkUri(orderMetadata);
  const mintRequest: MintTicketRequest = {
    eventId: order.eventId,
    ticketId,
    owner: mintOwner,
    delegate: environment.collectionUpdateAuthority,
    mode,
    metadata: normalizeTicketMetadata({
      name: `${order.event.name} - ${ticketId}`,
      symbol: 'NFTIX',
      uri: ticketArtworkUri,
      sellerFeeBasisPoints: order.event.royaltyBasisPoints,
      attributes: [
        { trait_type: 'event_id', value: order.eventId },
        { trait_type: 'event_name', value: order.event.name },
        { trait_type: 'ticket_id', value: ticketId },
        { trait_type: 'venue', value: order.event.venue },
        { trait_type: 'starts_at', value: order.event.startsAt.toISOString() },
        { trait_type: 'payment_rail', value: order.paymentRail },
        { trait_type: 'currency', value: order.currency },
      ],
    }),
  };

  const mintingService = createMintingService({
    environment,
    transport: createMetaplexTransport(mintConfig),
  });

  const mintResult = await mintWithRetries(() => mintingService.mintTicket(mintRequest));
  const ticketMetadata = {
    ownerEmail: order.purchaser.email ?? '',
    ownerName: order.purchaser.displayName ?? '',
    ownerWallet: mintOwner,
    mintAddress: mintResult.mintAddress,
    mintSignature: mintResult.signature,
    mintFinality: mintResult.finality,
    assetId: mintResult.assetId,
    fulfilledAt: new Date().toISOString(),
    mintMode: mintResult.mode,
    ticketArtworkUri,
  };

  const ticket = order.ticketId
    ? await prisma.ticket.update({
        where: { id: order.ticketId },
        data: {
          ownerId: order.purchaserId,
          assetId: mintResult.assetId,
          nftMode: mintResult.mode,
          status: 'minted',
          metadata: mergeMetadata(order.ticket?.metadata, ticketMetadata),
        },
      })
    : await prisma.ticket.create({
        data: {
          id: ticketId,
          eventId: order.eventId,
          orderId: order.id,
          ownerId: order.purchaserId,
          inventoryKey: `inv_${order.eventId}`,
          tierName: resolveTierName(orderMetadata),
          faceValue: order.amount,
          currency: order.currency,
          assetId: mintResult.assetId,
          nftMode: mintResult.mode,
          status: 'minted',
          transferCount: 0,
          metadata: ticketMetadata,
        },
      });

  const nextOrderMetadata = mergeMetadata(order.metadata, {
    ...orderMetadata,
    nftMode: mintResult.mode,
    ticketArtworkUri,
    mintSignature: mintResult.signature,
    mintAddress: mintResult.mintAddress,
    assetId: mintResult.assetId,
    mintFinality: mintResult.finality,
    mintAttempts: MAX_MINT_ATTEMPTS,
    fulfilledAt: new Date().toISOString(),
    fulfilledBy: options.fulfilledBy ?? 'webhook',
    mintError: null,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ticketId: ticket.id,
      metadata: nextOrderMetadata,
    },
  });

  return {
    success: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.eventId,
      ownerId: ticket.ownerId,
      assetId: ticket.assetId,
      nftMode: ticket.nftMode,
      status: ticket.status,
    },
    mintResult: {
      signature: mintResult.signature,
      assetId: mintResult.assetId,
      mintAddress: mintResult.mintAddress,
      finality: mintResult.finality,
    },
  };
}

async function mintWithRetries(
  mint: () => Promise<MintedTicketAsset>,
): Promise<MintedTicketAsset> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_MINT_ATTEMPTS; attempt += 1) {
    try {
      return await mint();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_MINT_ATTEMPTS || !isRetryableMintError(error)) {
        break;
      }
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new ApiError(`Minting failed after ${MAX_MINT_ATTEMPTS} attempts: ${message}`, 502, 'MINT_FAILED');
}

async function resolveMintOwner(params: {
  ownerWallet?: string | null;
  purchaserId: string;
  purchaserPrimaryWallet: string | null;
  purchaserWallets: string[];
}): Promise<string> {
  const requestedWallet = params.ownerWallet?.trim();
  if (requestedWallet) {
    if (!params.purchaserWallets.includes(requestedWallet)) {
      throw ApiError.badRequest(
        'Provided wallet is not linked to the purchaser account',
        'INVALID_WALLET',
      );
    }
    return requestedWallet;
  }

  if (params.purchaserPrimaryWallet?.trim()) {
    return params.purchaserPrimaryWallet.trim();
  }

  throw ApiError.badRequest(
    `Purchaser ${params.purchaserId} does not have a linked wallet for minting.`,
    'MISSING_OWNER_WALLET',
  );
}

function buildBlockchainEnvironment(mode: TicketNftMode): BlockchainEnvironment {
  const merkleTreeAddress =
    process.env.SOLANA_MERKLE_TREE_ADDRESS?.trim()
    || process.env.SOLANA_MERKLE_TREE?.trim()
    || '';
  const collectionUpdateAuthority =
    process.env.SOLANA_COLLECTION_UPDATE_AUTHORITY?.trim()
    || process.env.SOLANA_COLLECTION_AUTHORITY?.trim()
    || '';

  return {
    cluster: (process.env.SOLANA_CLUSTER as BlockchainEnvironment['cluster'] | undefined) ?? 'devnet',
    rpcUrl: process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com',
    commitment: 'confirmed',
    treasuryWallet: process.env.SOLANA_TREASURY_WALLET?.trim() || '',
    usdcMint: process.env.SOLANA_USDC_MINT?.trim() || '',
    merkleTreeAddress,
    collectionMint: process.env.SOLANA_COLLECTION_MINT?.trim() || '',
    collectionUpdateAuthority,
    nftMode: mode,
  };
}

function resolveNftMode(
  metadata: FulfillmentMetadata,
  eventMode: TicketNftMode,
): TicketNftMode {
  return metadata.nftMode === 'metadata' ? 'metadata' : eventMode;
}

function resolveTicketArtworkUri(metadata: FulfillmentMetadata): string {
  return (
    metadata.ticketArtworkUri?.trim()
    || metadata.ticketImageUri?.trim()
    || metadata.ticketMetadataUri?.trim()
    || process.env.NFTICKET_DEFAULT_IMAGE_URI?.trim()
    || DEFAULT_IMAGE_URI
  );
}

function resolveTierName(metadata: FulfillmentMetadata): string {
  const tierName = typeof (metadata as Record<string, unknown>).tierName === 'string'
    ? String((metadata as Record<string, unknown>).tierName)
    : '';
  return tierName.trim() || 'General Admission';
}

function toFulfillmentMetadata(value: unknown): FulfillmentMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as FulfillmentMetadata;
}

function mergeMetadata(
  existing: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonObject {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? (existing as Record<string, unknown>)
    : {};
  return {
    ...base,
    ...patch,
  } as Prisma.InputJsonObject;
}

function isRetryableMintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('429')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('blockhash not found')
    || message.includes('node is behind')
    || message.includes('gateway')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
