import { defaultEventConfiguration } from './domain';
import { createPrefixedId } from '../apps/shared/lib/ids';
import type {
  EventMarketplaceSettings,
  EventRecord,
  FraudFlagRecord,
  FraudSeverity,
  MarketplaceResalePolicy,
  TicketRecord,
  TransferAuditAction,
  TransferAuditRecord,
} from '../apps/shared/lib/types';

const DEFAULT_TRANSFER_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_EXCESSIVE_TRANSFER_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXCESSIVE_TRANSFER_THRESHOLD = 5;
const DEFAULT_SCAN_ABUSE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_SCAN_ABUSE_THRESHOLD = 3;

/** Transfer reason driving audit metadata and counter updates. */
export type TransferReason = 'resale_purchase' | 'direct_transfer' | 'support_override';

/** Normalized transfer eligibility result computed before mutating ticket state. */
export interface TransferEligibilityResult {
  /** Whether the transfer can proceed immediately. */
  eligible: boolean;
  /** Whether organizer or support approval is required before execution. */
  requiresApproval: boolean;
  /** Policy resolved for the event after applying defaults and overrides. */
  policy: MarketplaceResalePolicy;
  /** Human-readable reasons that block the transfer. */
  blockedReasons: string[];
  /** Fraud flags raised while evaluating the transfer request. */
  fraudFlags: FraudFlagRecord[];
}

/** Input used to evaluate a transfer request. */
export interface TransferEligibilityInput {
  /** Event owning the ticket. */
  event: EventRecord;
  /** Ticket being transferred or sold. */
  ticket: TicketRecord;
  /** User attempting the transfer action. */
  actorUserId: string | null;
  /** Existing transfer audit records used for fraud detection. */
  auditLog: TransferAuditRecord[];
  /** Existing fraud flags used to preserve context. */
  fraudFlags: FraudFlagRecord[];
  /** Current timestamp for policy and cooldown checks. */
  now?: number;
}

/** Input for building a canonical transfer audit entry. */
export interface CreateTransferAuditInput {
  /** Event owning the ticket. */
  eventId: string;
  /** Ticket associated with the action. */
  ticketId: string;
  /** Audit action performed. */
  action: TransferAuditAction;
  /** Actor responsible for the action. */
  actorUserId: string | null;
  /** User affected by the action. */
  subjectUserId?: string | null;
  /** Listing related to the action, if any. */
  listingId?: string | null;
  /** Linked payout split identifiers for royalty accounting. */
  payoutSplitIds?: string[];
  /** Additional audit metadata. */
  metadata?: Record<string, string>;
  /** Timestamp of the action. */
  now?: number;
}

/** Input for executing a transfer after eligibility has been computed. */
export interface ExecuteTransferInput {
  /** Ticket state before the transfer. */
  ticket: TicketRecord;
  /** New owner user id. */
  nextOwnerId: string;
  /** New owner wallet, if linked. */
  nextOwnerWallet: string | null;
  /** Why the transfer is happening. */
  reason: TransferReason;
  /** Whether the transfer increments the resale counter. */
  incrementResaleCount?: boolean;
  /** Current timestamp for the mutation. */
  now?: number;
}

/** Scan abuse evaluation result used by scanner workflows. */
export interface ScanFraudEvaluation {
  /** Fraud flags raised during scan validation. */
  fraudFlags: FraudFlagRecord[];
  /** Audit records linked to raised scan abuse flags. */
  auditRecords: TransferAuditRecord[];
}

/**
 * Resolves the effective event marketplace settings using defaults and any organizer override.
 */
export function resolveEventMarketplaceSettings(event: EventRecord): EventMarketplaceSettings {
  const override = event.marketplaceSettings?.policy;

  return {
    policy: {
      enabled: override?.enabled ?? defaultEventConfiguration.resalePolicy.enabled,
      maxTransfers: override?.maxTransfers ?? defaultEventConfiguration.resalePolicy.maxTransfers,
      minPriceMultiplier:
        override?.minPriceMultiplier ?? defaultEventConfiguration.resalePolicy.minPriceMultiplier,
      maxPriceMultiplier:
        override?.maxPriceMultiplier ?? defaultEventConfiguration.resalePolicy.maxPriceMultiplier,
      royaltyBasisPoints:
        override?.royaltyBasisPoints ?? defaultEventConfiguration.resalePolicy.royaltyBasisPoints,
      approvalRequired:
        override?.approvalRequired ?? defaultEventConfiguration.resalePolicy.approvalRequired,
      transferCooldownMs: override?.transferCooldownMs ?? DEFAULT_TRANSFER_COOLDOWN_MS,
      excessiveTransferWindowMs:
        override?.excessiveTransferWindowMs ?? DEFAULT_EXCESSIVE_TRANSFER_WINDOW_MS,
      excessiveTransferThreshold:
        override?.excessiveTransferThreshold ?? DEFAULT_EXCESSIVE_TRANSFER_THRESHOLD,
      scanAbuseWindowMs: override?.scanAbuseWindowMs ?? DEFAULT_SCAN_ABUSE_WINDOW_MS,
      scanAbuseThreshold: override?.scanAbuseThreshold ?? DEFAULT_SCAN_ABUSE_THRESHOLD,
    },
  };
}

/**
 * Computes transfer eligibility before any ticket ownership or listing state changes.
 */
export function computeTransferEligibility(
  input: TransferEligibilityInput,
): TransferEligibilityResult {
  const now = input.now ?? Date.now();
  const policy = resolveEventMarketplaceSettings(input.event).policy;
  const blockedReasons: string[] = [];
  const nextFraudFlags: FraudFlagRecord[] = [];

  if (!policy.enabled) {
    blockedReasons.push('Resale and transfers are disabled for this event');
  }

  if (input.ticket.resaleCount >= policy.maxTransfers) {
    blockedReasons.push('Ticket has reached the maximum allowed transfers');
  }

  if (input.event.eventDate <= now) {
    blockedReasons.push('Transfers are closed after the event start time');
  }

  if (input.ticket.status === 'scanned') {
    blockedReasons.push('Scanned tickets cannot be transferred');
  }

  if (
    input.ticket.lastTransferredAt != null &&
    now - input.ticket.lastTransferredAt < policy.transferCooldownMs
  ) {
    blockedReasons.push('Transfer cooldown is still active');
    nextFraudFlags.push(
      createFraudFlag({
        eventId: input.event.id,
        ticketId: input.ticket.id,
        userId: input.actorUserId,
        category: 'cooldown_violation',
        severity: 'medium',
        description: 'Transfer attempted during the cooldown window',
        metadata: {
          cooldownMs: String(policy.transferCooldownMs),
          lastTransferredAt: String(input.ticket.lastTransferredAt),
        },
        now,
      }),
    );
  }

  const recentTransferActions = input.auditLog.filter((record) => {
    if (record.ticketId !== input.ticket.id) {
      return false;
    }

    if (record.createdAt < now - policy.excessiveTransferWindowMs) {
      return false;
    }

    return (
      record.action === 'resale_purchased' ||
      record.action === 'transfer_executed' ||
      record.action === 'resale_listed'
    );
  });

  if (recentTransferActions.length >= policy.excessiveTransferThreshold) {
    blockedReasons.push('Transfer temporarily blocked due to excessive activity');
    nextFraudFlags.push(
      createFraudFlag({
        eventId: input.event.id,
        ticketId: input.ticket.id,
        userId: input.actorUserId,
        category: 'excessive_transfer_activity',
        severity: 'high',
        description: 'Transfer volume exceeded the configured risk threshold',
        metadata: {
          activityCount: String(recentTransferActions.length),
          threshold: String(policy.excessiveTransferThreshold),
          windowMs: String(policy.excessiveTransferWindowMs),
        },
        now,
      }),
    );
  }

  return {
    eligible: blockedReasons.length === 0 && !policy.approvalRequired,
    requiresApproval: policy.approvalRequired,
    policy,
    blockedReasons,
    fraudFlags: mergeFraudFlags(input.fraudFlags, nextFraudFlags),
  };
}

/**
 * Applies a validated ticket ownership transfer.
 */
export function executeTransfer(input: ExecuteTransferInput): TicketRecord {
  const now = input.now ?? Date.now();

  return {
    ...input.ticket,
    ownerId: input.nextOwnerId,
    ownerWallet: input.nextOwnerWallet,
    isForSale: false,
    salePrice: null,
    status: input.nextOwnerWallet ? 'minted' : 'reserved',
    resaleCount:
      input.incrementResaleCount === false
        ? input.ticket.resaleCount
        : input.ticket.resaleCount + 1,
    lastTransferredAt: now,
    pendingTransferApproval: false,
  };
}

/**
 * Creates an immutable audit record for a transfer-related action.
 */
export function createTransferAudit(input: CreateTransferAuditInput): TransferAuditRecord {
  return {
    id: createPrefixedId('audit'),
    ticketId: input.ticketId,
    eventId: input.eventId,
    action: input.action,
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId ?? null,
    listingId: input.listingId ?? null,
    payoutSplitIds: input.payoutSplitIds ?? [],
    metadata: input.metadata ?? {},
    createdAt: input.now ?? Date.now(),
  };
}

/**
 * Creates an auditable fraud flag for marketplace or scanner abuse.
 */
export function createFraudFlag(input: {
  eventId: string;
  ticketId: string | null;
  userId: string | null;
  category: FraudFlagRecord['category'];
  severity: FraudSeverity;
  description: string;
  metadata?: Record<string, string>;
  now?: number;
}): FraudFlagRecord {
  return {
    id: createPrefixedId('fraud'),
    eventId: input.eventId,
    ticketId: input.ticketId,
    userId: input.userId,
    category: input.category,
    severity: input.severity,
    description: input.description,
    metadata: input.metadata ?? {},
    createdAt: input.now ?? Date.now(),
    resolvedAt: null,
  };
}

/**
 * Emits scan-abuse flags and audit records for repeated admission attempts.
 */
export function evaluateScanFraud(input: {
  event: EventRecord;
  ticket: TicketRecord;
  scannerUserId: string | null;
  auditLog: TransferAuditRecord[];
  now?: number;
}): ScanFraudEvaluation {
  const now = input.now ?? Date.now();
  const policy = resolveEventMarketplaceSettings(input.event).policy;
  const duplicateScans = input.auditLog.filter(
    (record) =>
      record.ticketId === input.ticket.id &&
      record.action === 'scan_abuse_flagged' &&
      record.createdAt >= now - policy.scanAbuseWindowMs,
  );

  if (input.ticket.status !== 'scanned') {
    return {
      fraudFlags: [],
      auditRecords: [],
    };
  }

  if (duplicateScans.length + 1 < policy.scanAbuseThreshold) {
    return {
      fraudFlags: [],
      auditRecords: [],
    };
  }

  const fraudFlag = createFraudFlag({
    eventId: input.event.id,
    ticketId: input.ticket.id,
    userId: input.scannerUserId,
    category: 'scan_abuse',
    severity: 'medium',
    description: 'Repeated scans exceeded the configured scan abuse threshold',
    metadata: {
      duplicateScans: String(duplicateScans.length + 1),
      threshold: String(policy.scanAbuseThreshold),
      windowMs: String(policy.scanAbuseWindowMs),
    },
    now,
  });

  return {
    fraudFlags: [fraudFlag],
    auditRecords: [
      createTransferAudit({
        eventId: input.event.id,
        ticketId: input.ticket.id,
        action: 'scan_abuse_flagged',
        actorUserId: input.scannerUserId,
        metadata: {
          fraudFlagId: fraudFlag.id,
          duplicateScans: String(duplicateScans.length + 1),
        },
        now,
      }),
    ],
  };
}

/**
 * Emits a support audit record documenting a manual override or exception handling action.
 */
export function createSupportAuditRecord(input: {
  eventId: string;
  ticketId: string;
  actorUserId: string | null;
  notes: string;
  now?: number;
}): TransferAuditRecord {
  return createTransferAudit({
    eventId: input.eventId,
    ticketId: input.ticketId,
    action: 'support_override',
    actorUserId: input.actorUserId,
    metadata: {
      notes: input.notes,
    },
    now: input.now,
  });
}

function mergeFraudFlags(
  existingFlags: FraudFlagRecord[],
  newFlags: FraudFlagRecord[],
): FraudFlagRecord[] {
  if (newFlags.length === 0) {
    return existingFlags;
  }

  return [...existingFlags, ...newFlags];
}
