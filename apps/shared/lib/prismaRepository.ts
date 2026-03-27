import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { DomainRepository, Repository } from '../../../lib/repository';
import type { Event, Order, Payout, Scan, Ticket, UserIdentity } from '../../../lib/domain';
import {
  defaultEventConfiguration,
  validateEvent,
  validateOrder,
  validatePayout,
  validateScan,
  validateTicket,
  validateUserIdentity,
} from '../../../lib/domain';
import { normalizeUserRole } from './types';
import { getPrismaClient } from './prisma';

export function createPrismaDomainRepository(client: PrismaClient = getPrismaClient()): DomainRepository {
  return {
    events: createEventRepository(client),
    orders: createOrderRepository(client),
    tickets: createTicketRepository(client),
    payouts: createPayoutRepository(client),
    scans: createScanRepository(client),
    identities: createIdentityRepository(client),
  };
}

function createEventRepository(client: PrismaClient): Repository<Event> {
  return {
    async findById(id) {
      const record = await client.event.findUnique({ where: { id } });
      return record ? fromPrismaEvent(record) : null;
    },
    async list() {
      return (await client.event.findMany({ orderBy: { startsAt: 'asc' } })).map(fromPrismaEvent);
    },
    async save(record) {
      const event = validateEvent(record);
      await ensureIdentity(client, event.organizerId);
      const saved = await client.event.upsert({
        where: { id: event.id },
        create: toPrismaEvent(event),
        update: toPrismaEvent(event),
      });
      return fromPrismaEvent(saved);
    },
    async delete(id) {
      await client.event.delete({ where: { id } });
    },
  };
}

function createOrderRepository(client: PrismaClient): Repository<Order> {
  return {
    async findById(id) {
      const record = await client.order.findUnique({ where: { id } });
      return record ? fromPrismaOrder(record) : null;
    },
    async list() {
      return (await client.order.findMany({ orderBy: { createdAt: 'desc' } })).map(fromPrismaOrder);
    },
    async save(record) {
      const order = validateOrder(record);
      await ensureIdentity(client, order.purchaserId);
      const saved = await client.order.upsert({
        where: { id: order.id },
        create: toPrismaOrder(order),
        update: toPrismaOrder(order),
      });
      return fromPrismaOrder(saved);
    },
    async delete(id) {
      await client.order.delete({ where: { id } });
    },
  };
}

function createTicketRepository(client: PrismaClient): Repository<Ticket> {
  return {
    async findById(id) {
      const record = await client.ticket.findUnique({ where: { id } });
      return record ? fromPrismaTicket(record) : null;
    },
    async list() {
      return (await client.ticket.findMany({ orderBy: { createdAt: 'desc' } })).map(fromPrismaTicket);
    },
    async save(record) {
      const ticket = validateTicket(record);
      await ensureIdentity(client, ticket.ownerId);
      const saved = await client.ticket.upsert({
        where: { id: ticket.id },
        create: toPrismaTicket(ticket),
        update: toPrismaTicket(ticket),
      });
      return fromPrismaTicket(saved);
    },
    async delete(id) {
      await client.ticket.delete({ where: { id } });
    },
  };
}

function createPayoutRepository(client: PrismaClient): Repository<Payout> {
  return {
    async findById(id) {
      const record = await client.payout.findUnique({ where: { id } });
      return record ? fromPrismaPayout(record) : null;
    },
    async list() {
      return (await client.payout.findMany({ orderBy: { createdAt: 'desc' } })).map(fromPrismaPayout);
    },
    async save(record) {
      const payout = validatePayout(record);
      const saved = await client.payout.upsert({
        where: { id: payout.id },
        create: toPrismaPayout(payout),
        update: toPrismaPayout(payout),
      });
      return fromPrismaPayout(saved);
    },
    async delete(id) {
      await client.payout.delete({ where: { id } });
    },
  };
}

function createScanRepository(client: PrismaClient): Repository<Scan> {
  return {
    async findById(id) {
      const record = await client.scan.findUnique({ where: { id } });
      return record ? fromPrismaScan(record) : null;
    },
    async list() {
      return (await client.scan.findMany({ orderBy: { scannedAt: 'desc' } })).map(fromPrismaScan);
    },
    async save(record) {
      const scan = validateScan(record);
      const saved = await client.scan.upsert({
        where: { id: scan.id },
        create: toPrismaScan(scan),
        update: toPrismaScan(scan),
      });
      return fromPrismaScan(saved);
    },
    async delete(id) {
      await client.scan.delete({ where: { id } });
    },
  };
}

function createIdentityRepository(client: PrismaClient): Repository<UserIdentity> {
  return {
    async findById(id) {
      const record = await client.userIdentity.findUnique({ where: { id } });
      return record ? fromPrismaIdentity(record) : null;
    },
    async list() {
      return (await client.userIdentity.findMany({ orderBy: { createdAt: 'desc' } })).map(fromPrismaIdentity);
    },
    async save(record) {
      const identity = validateUserIdentity(record);
      const saved = await client.userIdentity.upsert({
        where: { id: identity.id },
        create: toPrismaIdentity(identity),
        update: toPrismaIdentity(identity),
      });
      return fromPrismaIdentity(saved);
    },
    async delete(id) {
      await client.userIdentity.delete({ where: { id } });
    },
  };
}

async function ensureIdentity(client: PrismaClient, id: string) {
  await client.userIdentity.upsert({
    where: { id },
    create: {
      id,
      email: null,
      emailVerified: false,
      displayName: null,
      primaryWallet: null,
      wallets: [],
      authMode: 'email',
      role: 'buyer',
      kycStatus: 'not_required',
    },
    update: {},
  });
}

function toPrismaEvent(event: Event): Prisma.EventUncheckedCreateInput {
  return {
    id: event.id,
    organizerId: event.organizerId,
    name: event.name,
    description: event.description,
    venue: event.venue,
    startsAt: new Date(event.startsAt),
    endsAt: event.endsAt ? new Date(event.endsAt) : null,
    timeZone: event.timeZone,
    status: event.status,
    capacity: event.capacity,
    nftMode: event.configuration.nftMode,
    acceptedPayments: event.configuration.acceptedPayments,
    resaleEnabled: event.configuration.resalePolicy.enabled,
    resaleMaxTransfers: event.configuration.resalePolicy.maxTransfers,
    resaleMinMultiplier: event.configuration.resalePolicy.minPriceMultiplier,
    resaleMaxMultiplier: event.configuration.resalePolicy.maxPriceMultiplier,
    royaltyBasisPoints: event.configuration.resalePolicy.royaltyBasisPoints,
    resaleApprovalNeeded: event.configuration.resalePolicy.approvalRequired,
    authMode: event.configuration.auth.mode,
    requireVerifiedEmail: event.configuration.auth.requireVerifiedEmail,
    requireWalletLink: event.configuration.auth.requireWalletLink,
    requireKyc: event.configuration.auth.requireKyc,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  };
}

function fromPrismaEvent(record: PrismaEventLike): Event {
  return validateEvent({
    id: record.id,
    organizerId: record.organizerId,
    name: record.name,
    description: record.description,
    venue: record.venue,
    startsAt: record.startsAt.getTime(),
    endsAt: record.endsAt?.getTime() ?? null,
    timeZone: record.timeZone,
    status: record.status,
    capacity: record.capacity,
    configuration: {
      ...defaultEventConfiguration,
      nftMode: record.nftMode,
      acceptedPayments: record.acceptedPayments,
      resalePolicy: {
        enabled: record.resaleEnabled,
        maxTransfers: record.resaleMaxTransfers,
        minPriceMultiplier: record.resaleMinMultiplier,
        maxPriceMultiplier: record.resaleMaxMultiplier,
        royaltyBasisPoints: record.royaltyBasisPoints,
        approvalRequired: record.resaleApprovalNeeded,
      },
      auth: {
        mode: record.authMode,
        requireVerifiedEmail: record.requireVerifiedEmail,
        requireWalletLink: record.requireWalletLink,
        requireKyc: record.requireKyc,
      },
    },
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function toPrismaOrder(order: Order): Prisma.OrderUncheckedCreateInput {
  return {
    id: order.id,
    eventId: order.eventId,
    purchaserId: order.purchaserId,
    ticketId: order.ticketId,
    paymentRail: order.paymentRail,
    amount: decimal(order.amount),
    currency: order.currency,
    status: order.status,
    paymentReference: order.paymentReference,
    idempotencyKey: order.idempotencyKey,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
  };
}

function fromPrismaOrder(record: PrismaOrderLike): Order {
  return validateOrder({
    id: record.id,
    eventId: record.eventId,
    purchaserId: record.purchaserId,
    ticketId: record.ticketId,
    paymentRail: record.paymentRail,
    amount: Number(record.amount),
    currency: record.currency,
    status: record.status,
    paymentReference: record.paymentReference,
    idempotencyKey: record.idempotencyKey,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function toPrismaTicket(ticket: Ticket): Prisma.TicketUncheckedCreateInput {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    orderId: ticket.orderId,
    ownerId: ticket.ownerId,
    inventoryKey: ticket.inventoryKey,
    tierName: ticket.tierName,
    seatLabel: ticket.seatLabel,
    faceValue: decimal(ticket.faceValue),
    currency: ticket.currency,
    assetId: ticket.assetId,
    nftMode: ticket.nftMode,
    status: ticket.status,
    transferCount: ticket.transferCount,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
  };
}

function fromPrismaTicket(record: PrismaTicketLike): Ticket {
  return validateTicket({
    id: record.id,
    eventId: record.eventId,
    orderId: record.orderId,
    ownerId: record.ownerId,
    inventoryKey: record.inventoryKey,
    tierName: record.tierName,
    seatLabel: record.seatLabel,
    faceValue: Number(record.faceValue),
    currency: record.currency,
    assetId: record.assetId,
    nftMode: record.nftMode,
    status: record.status,
    transferCount: record.transferCount,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function toPrismaPayout(payout: Payout): Prisma.PayoutUncheckedCreateInput {
  return {
    id: payout.id,
    eventId: payout.eventId,
    orderId: payout.orderId,
    beneficiaryUserId: payout.beneficiaryUserId,
    beneficiaryWallet: payout.beneficiaryWallet,
    amount: decimal(payout.amount),
    currency: payout.currency,
    status: payout.status,
    reason: payout.reason,
    payoutReference: payout.payoutReference,
    createdAt: new Date(payout.createdAt),
    updatedAt: new Date(payout.updatedAt),
  };
}

function fromPrismaPayout(record: PrismaPayoutLike): Payout {
  return validatePayout({
    id: record.id,
    eventId: record.eventId,
    orderId: record.orderId,
    beneficiaryUserId: record.beneficiaryUserId,
    beneficiaryWallet: record.beneficiaryWallet,
    amount: Number(record.amount),
    currency: record.currency,
    status: record.status,
    reason: record.reason as Payout['reason'],
    payoutReference: record.payoutReference,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function toPrismaScan(scan: Scan): Prisma.ScanUncheckedCreateInput {
  return {
    id: scan.id,
    eventId: scan.eventId,
    ticketId: scan.ticketId,
    scannerUserId: scan.scannerUserId,
    checkpoint: scan.checkpoint,
    result: scan.result,
    scannedAt: new Date(scan.scannedAt),
    notes: scan.notes,
  };
}

function fromPrismaScan(record: PrismaScanLike): Scan {
  return validateScan({
    id: record.id,
    eventId: record.eventId,
    ticketId: record.ticketId,
    scannerUserId: record.scannerUserId,
    checkpoint: record.checkpoint,
    result: record.result,
    scannedAt: record.scannedAt.getTime(),
    notes: record.notes,
  });
}

function toPrismaIdentity(identity: UserIdentity): Prisma.UserIdentityUncheckedCreateInput {
  return {
    id: identity.id,
    email: identity.email,
    emailVerified: identity.emailVerified,
    displayName: identity.displayName,
    primaryWallet: identity.primaryWallet,
    wallets: identity.wallets,
    authMode: identity.authMode,
    role: identity.role,
    kycStatus: identity.kycStatus,
    createdAt: new Date(identity.createdAt),
    updatedAt: new Date(identity.updatedAt),
  };
}

function fromPrismaIdentity(record: PrismaIdentityLike): UserIdentity {
  return validateUserIdentity({
    id: record.id,
    email: record.email,
    emailVerified: record.emailVerified,
    displayName: record.displayName,
    primaryWallet: record.primaryWallet,
    wallets: record.wallets,
    authMode: record.authMode,
    role: normalizeUserRole(record.role),
    kycStatus: record.kycStatus,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  });
}

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

type PrismaEventLike = Awaited<ReturnType<PrismaClient['event']['findFirstOrThrow']>>;
type PrismaOrderLike = Awaited<ReturnType<PrismaClient['order']['findFirstOrThrow']>>;
type PrismaTicketLike = Awaited<ReturnType<PrismaClient['ticket']['findFirstOrThrow']>>;
type PrismaPayoutLike = Awaited<ReturnType<PrismaClient['payout']['findFirstOrThrow']>>;
type PrismaScanLike = Awaited<ReturnType<PrismaClient['scan']['findFirstOrThrow']>>;
type PrismaIdentityLike = Awaited<ReturnType<PrismaClient['userIdentity']['findFirstOrThrow']>>;
