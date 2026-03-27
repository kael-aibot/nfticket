import type { TicketNftMode } from './blockchain';

/**
 * Canonical payment rails supported by the fulfillment domain.
 */
export type AcceptedPaymentRail = 'stripe' | 'sol' | 'usdc';

/**
 * Identity mode required to purchase, hold, or transfer tickets for an event.
 */
export type AuthMode = 'email' | 'wallet' | 'hybrid';

/**
 * Lifecycle status for an organizer-managed event.
 */
export type EventStatus = 'draft' | 'published' | 'archived' | 'cancelled';

/**
 * Lifecycle status for an off-chain order record.
 */
export type OrderStatus = 'pending' | 'confirmed' | 'failed' | 'refunded' | 'cancelled';

/**
 * Fulfillment status for a ticket record.
 */
export type TicketStatus = 'reserved' | 'issued' | 'minted' | 'transferred' | 'scanned' | 'voided';

/**
 * Status for payout execution and reconciliation.
 */
export type PayoutStatus = 'pending' | 'scheduled' | 'paid' | 'failed' | 'cancelled';

/**
 * Result of an admission scan attempt.
 */
export type ScanResult = 'accepted' | 'rejected' | 'duplicate' | 'manual_review';

/**
 * Known KYC states for a user or event-specific identity context.
 */
export type KycStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

/**
 * Canonical roles used across auth, organizer tooling, and platform operations.
 */
export type UserRole = 'buyer' | 'provider' | 'admin' | 'platform';

/**
 * Event-level configuration that drives payment, minting, transfer, and auth behavior.
 */
export interface EventConfiguration {
  /** NFT ticket issuance mode. */
  nftMode: TicketNftMode;
  /** Payment rails that buyers may use for checkout. */
  acceptedPayments: AcceptedPaymentRail[];
  /** Rules governing resale and transfers. */
  resalePolicy: ResalePolicy;
  /** Auth and compliance requirements for attendance and ownership. */
  auth: EventAuthRequirements;
}

/**
 * Organizer-controlled resale and royalty settings.
 */
export interface ResalePolicy {
  /** Whether peer-to-peer resale is allowed at all. */
  enabled: boolean;
  /** Maximum number of transfers allowed after the primary sale. */
  maxTransfers: number;
  /** Minimum percentage above face value that can be charged on resale. */
  minPriceMultiplier: number;
  /** Maximum percentage above face value that can be charged on resale. */
  maxPriceMultiplier: number;
  /** Basis points paid to the organizer on resale. */
  royaltyBasisPoints: number;
  /** Whether support staff can approve exceptions to transfer rules. */
  approvalRequired: boolean;
}

/**
 * Identity requirements enforced for an event.
 */
export interface EventAuthRequirements {
  /** Default login mode for purchase and ticket access. */
  mode: AuthMode;
  /** Whether an email address must be verified before fulfillment. */
  requireVerifiedEmail: boolean;
  /** Whether a wallet must be linked before mint or transfer. */
  requireWalletLink: boolean;
  /** Whether KYC must be approved before checkout or transfer. */
  requireKyc: boolean;
}

/**
 * Canonical event aggregate persisted off-chain.
 */
export interface Event {
  id: string;
  organizerId: string;
  name: string;
  description: string;
  venue: string;
  startsAt: number;
  endsAt: number | null;
  timeZone: string;
  status: EventStatus;
  capacity: number;
  configuration: EventConfiguration;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canonical order aggregate shared across fiat and on-chain settlement.
 */
export interface Order {
  id: string;
  eventId: string;
  purchaserId: string;
  ticketId: string | null;
  paymentRail: AcceptedPaymentRail;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentReference: string | null;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canonical ticket read model for fulfillment and support workflows.
 */
export interface Ticket {
  id: string;
  eventId: string;
  orderId: string | null;
  ownerId: string;
  inventoryKey: string;
  tierName: string;
  seatLabel: string | null;
  faceValue: number;
  currency: string;
  assetId: string | null;
  nftMode: TicketNftMode;
  status: TicketStatus;
  transferCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canonical payout record for organizer and royalty disbursement.
 */
export interface Payout {
  id: string;
  eventId: string;
  orderId: string | null;
  beneficiaryUserId: string | null;
  beneficiaryWallet: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  reason: 'primary_sale' | 'resale_royalty' | 'refund' | 'manual_adjustment';
  payoutReference: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canonical scan audit record for entry operations.
 */
export interface Scan {
  id: string;
  eventId: string;
  ticketId: string;
  scannerUserId: string | null;
  checkpoint: string;
  result: ScanResult;
  scannedAt: number;
  notes: string | null;
}

/**
 * Canonical user identity model decoupled from wallet linkage.
 */
export interface UserIdentity {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  primaryWallet: string | null;
  wallets: string[];
  authMode: AuthMode;
  role: UserRole;
  kycStatus: KycStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Shared app-level resale settings used by the existing UI.
 */
export interface ResaleDecaySettings {
  moreThan60Days: number;
  between30And60Days: number;
  between7And30Days: number;
  under7Days: number;
  dayOfEvent: number;
}

/**
 * Shared app-level royalty settings used by the existing UI.
 */
export interface RoyaltySplitSettings {
  organizer: number;
  originalBuyer: number;
  charity: number;
}

/**
 * Backward-compatible settings structure used by the current web UI.
 */
export interface AppSettings {
  platformFeePercent: number;
  resaleDecay: ResaleDecaySettings;
  royaltySplit: RoyaltySplitSettings;
}

const acceptedPaymentRails: AcceptedPaymentRail[] = ['stripe', 'sol', 'usdc'];
const authModes: AuthMode[] = ['email', 'wallet', 'hybrid'];
const eventStatuses: EventStatus[] = ['draft', 'published', 'archived', 'cancelled'];
const orderStatuses: OrderStatus[] = ['pending', 'confirmed', 'failed', 'refunded', 'cancelled'];
const ticketStatuses: TicketStatus[] = ['reserved', 'issued', 'minted', 'transferred', 'scanned', 'voided'];
const payoutStatuses: PayoutStatus[] = ['pending', 'scheduled', 'paid', 'failed', 'cancelled'];
const scanResults: ScanResult[] = ['accepted', 'rejected', 'duplicate', 'manual_review'];
const kycStatuses: KycStatus[] = ['not_required', 'pending', 'approved', 'rejected'];
const nftModes: TicketNftMode[] = ['compressed', 'metadata'];
const userRoles: UserRole[] = ['buyer', 'provider', 'admin', 'platform'];

/**
 * Conservative default resale settings for the current demo UI.
 */
export const defaultAppSettings: AppSettings = {
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

/**
 * Default normalized event configuration for gradual rollout.
 */
export const defaultEventConfiguration: EventConfiguration = {
  nftMode: 'compressed',
  acceptedPayments: ['stripe', 'sol', 'usdc'],
  resalePolicy: {
    enabled: true,
    maxTransfers: 4,
    minPriceMultiplier: 1,
    maxPriceMultiplier: 1.5,
    royaltyBasisPoints: 1000,
    approvalRequired: false,
  },
  auth: {
    mode: 'hybrid',
    requireVerifiedEmail: true,
    requireWalletLink: false,
    requireKyc: false,
  },
};

/**
 * Validates and normalizes an event configuration payload.
 */
export function validateEventConfiguration(input: EventConfiguration): EventConfiguration {
  return {
    nftMode: enumValue(input.nftMode, nftModes, 'configuration.nftMode'),
    acceptedPayments: uniqueValues(
      input.acceptedPayments.map((value) =>
        enumValue(value, acceptedPaymentRails, 'configuration.acceptedPayments'),
      ),
      'configuration.acceptedPayments',
    ),
    resalePolicy: validateResalePolicy(input.resalePolicy),
    auth: validateEventAuthRequirements(input.auth),
  };
}

/**
 * Validates a resale policy payload.
 */
export function validateResalePolicy(input: ResalePolicy): ResalePolicy {
  return {
    enabled: Boolean(input.enabled),
    maxTransfers: integerValue(input.maxTransfers, 'resalePolicy.maxTransfers', 0),
    minPriceMultiplier: numberValue(input.minPriceMultiplier, 'resalePolicy.minPriceMultiplier', 0),
    maxPriceMultiplier: numberValue(input.maxPriceMultiplier, 'resalePolicy.maxPriceMultiplier', 0),
    royaltyBasisPoints: integerValue(
      input.royaltyBasisPoints,
      'resalePolicy.royaltyBasisPoints',
      0,
      10_000,
    ),
    approvalRequired: Boolean(input.approvalRequired),
  };
}

/**
 * Validates an auth requirements payload.
 */
export function validateEventAuthRequirements(
  input: EventAuthRequirements,
): EventAuthRequirements {
  return {
    mode: enumValue(input.mode, authModes, 'auth.mode'),
    requireVerifiedEmail: Boolean(input.requireVerifiedEmail),
    requireWalletLink: Boolean(input.requireWalletLink),
    requireKyc: Boolean(input.requireKyc),
  };
}

/**
 * Validates and normalizes a canonical event aggregate.
 */
export function validateEvent(input: Event): Event {
  return {
    id: requiredString(input.id, 'event.id'),
    organizerId: requiredString(input.organizerId, 'event.organizerId'),
    name: requiredString(input.name, 'event.name'),
    description: requiredString(input.description, 'event.description'),
    venue: requiredString(input.venue, 'event.venue'),
    startsAt: timestampValue(input.startsAt, 'event.startsAt'),
    endsAt: optionalTimestampValue(input.endsAt, 'event.endsAt'),
    timeZone: requiredString(input.timeZone, 'event.timeZone'),
    status: enumValue(input.status, eventStatuses, 'event.status'),
    capacity: integerValue(input.capacity, 'event.capacity', 0),
    configuration: validateEventConfiguration(input.configuration),
    createdAt: timestampValue(input.createdAt, 'event.createdAt'),
    updatedAt: timestampValue(input.updatedAt, 'event.updatedAt'),
  };
}

/**
 * Validates and normalizes a canonical order aggregate.
 */
export function validateOrder(input: Order): Order {
  return {
    id: requiredString(input.id, 'order.id'),
    eventId: requiredString(input.eventId, 'order.eventId'),
    purchaserId: requiredString(input.purchaserId, 'order.purchaserId'),
    ticketId: optionalString(input.ticketId),
    paymentRail: enumValue(input.paymentRail, acceptedPaymentRails, 'order.paymentRail'),
    amount: numberValue(input.amount, 'order.amount', 0),
    currency: requiredString(input.currency, 'order.currency').toLowerCase(),
    status: enumValue(input.status, orderStatuses, 'order.status'),
    paymentReference: optionalString(input.paymentReference),
    idempotencyKey: requiredString(input.idempotencyKey, 'order.idempotencyKey'),
    createdAt: timestampValue(input.createdAt, 'order.createdAt'),
    updatedAt: timestampValue(input.updatedAt, 'order.updatedAt'),
  };
}

/**
 * Validates and normalizes a canonical ticket aggregate.
 */
export function validateTicket(input: Ticket): Ticket {
  return {
    id: requiredString(input.id, 'ticket.id'),
    eventId: requiredString(input.eventId, 'ticket.eventId'),
    orderId: optionalString(input.orderId),
    ownerId: requiredString(input.ownerId, 'ticket.ownerId'),
    inventoryKey: requiredString(input.inventoryKey, 'ticket.inventoryKey'),
    tierName: requiredString(input.tierName, 'ticket.tierName'),
    seatLabel: optionalString(input.seatLabel),
    faceValue: numberValue(input.faceValue, 'ticket.faceValue', 0),
    currency: requiredString(input.currency, 'ticket.currency').toLowerCase(),
    assetId: optionalString(input.assetId),
    nftMode: enumValue(input.nftMode, nftModes, 'ticket.nftMode'),
    status: enumValue(input.status, ticketStatuses, 'ticket.status'),
    transferCount: integerValue(input.transferCount, 'ticket.transferCount', 0),
    createdAt: timestampValue(input.createdAt, 'ticket.createdAt'),
    updatedAt: timestampValue(input.updatedAt, 'ticket.updatedAt'),
  };
}

/**
 * Validates and normalizes a canonical payout aggregate.
 */
export function validatePayout(input: Payout): Payout {
  return {
    id: requiredString(input.id, 'payout.id'),
    eventId: requiredString(input.eventId, 'payout.eventId'),
    orderId: optionalString(input.orderId),
    beneficiaryUserId: optionalString(input.beneficiaryUserId),
    beneficiaryWallet: optionalString(input.beneficiaryWallet),
    amount: numberValue(input.amount, 'payout.amount', 0),
    currency: requiredString(input.currency, 'payout.currency').toLowerCase(),
    status: enumValue(input.status, payoutStatuses, 'payout.status'),
    reason: input.reason,
    payoutReference: optionalString(input.payoutReference),
    createdAt: timestampValue(input.createdAt, 'payout.createdAt'),
    updatedAt: timestampValue(input.updatedAt, 'payout.updatedAt'),
  };
}

/**
 * Validates and normalizes a scan audit record.
 */
export function validateScan(input: Scan): Scan {
  return {
    id: requiredString(input.id, 'scan.id'),
    eventId: requiredString(input.eventId, 'scan.eventId'),
    ticketId: requiredString(input.ticketId, 'scan.ticketId'),
    scannerUserId: optionalString(input.scannerUserId),
    checkpoint: requiredString(input.checkpoint, 'scan.checkpoint'),
    result: enumValue(input.result, scanResults, 'scan.result'),
    scannedAt: timestampValue(input.scannedAt, 'scan.scannedAt'),
    notes: optionalString(input.notes),
  };
}

/**
 * Validates and normalizes a user identity record.
 */
export function validateUserIdentity(input: UserIdentity): UserIdentity {
  return {
    id: requiredString(input.id, 'identity.id'),
    email: optionalString(input.email),
    emailVerified: Boolean(input.emailVerified),
    displayName: optionalString(input.displayName),
    primaryWallet: optionalString(input.primaryWallet),
    wallets: uniqueValues(
      input.wallets.map((wallet) => requiredString(wallet, 'identity.wallets')),
      'identity.wallets',
    ),
    authMode: enumValue(input.authMode, authModes, 'identity.authMode'),
    role: enumValue(input.role, userRoles, 'identity.role'),
    kycStatus: enumValue(input.kycStatus, kycStatuses, 'identity.kycStatus'),
    createdAt: timestampValue(input.createdAt, 'identity.createdAt'),
    updatedAt: timestampValue(input.updatedAt, 'identity.updatedAt'),
  };
}

/**
 * Maps legacy UI payment options to canonical payment rails.
 */
export function normalizeLegacyAcceptedPayments(
  payments: Array<'card' | 'crypto'>,
): AcceptedPaymentRail[] {
  const rails = new Set<AcceptedPaymentRail>();

  for (const payment of payments) {
    if (payment === 'card') {
      rails.add('stripe');
      continue;
    }

    rails.add('sol');
    rails.add('usdc');
  }

  return Array.from(rails);
}

/**
 * Maps canonical payment rails to the legacy UI payment choices.
 */
export function projectAcceptedPaymentsToLegacy(
  payments: AcceptedPaymentRail[],
): Array<'card' | 'crypto'> {
  const legacy = new Set<'card' | 'crypto'>();

  for (const payment of payments) {
    if (payment === 'stripe') {
      legacy.add('card');
      continue;
    }

    legacy.add('crypto');
  }

  return Array.from(legacy);
}

function requiredString(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function optionalString(value: string | null): string | null {
  if (value == null) {
    return null;
  }

  return requiredString(value, 'value');
}

function numberValue(value: number, label: string, min?: number, max?: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  if (min != null && value < min) {
    throw new Error(`${label} must be at least ${min}`);
  }

  if (max != null && value > max) {
    throw new Error(`${label} must be at most ${max}`);
  }

  return value;
}

function integerValue(value: number, label: string, min?: number, max?: number): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }

  return numberValue(value, label, min, max);
}

function timestampValue(value: number, label: string): number {
  return integerValue(value, label, 0);
}

function optionalTimestampValue(value: number | null, label: string): number | null {
  if (value == null) {
    return null;
  }

  return timestampValue(value, label);
}

function enumValue<T extends string>(value: T, allowed: T[], label: string): T {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}`);
  }

  return value;
}

function uniqueValues<T>(values: T[], label: string): T[] {
  if (values.length === 0) {
    throw new Error(`${label} must contain at least one value`);
  }

  return Array.from(new Set(values));
}
