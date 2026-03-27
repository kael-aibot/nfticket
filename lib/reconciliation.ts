import type { TicketNftMode } from './blockchain';

/**
 * Minimal order snapshot required for payment-to-mint reconciliation.
 */
export interface ReconciliationOrderRecord {
  id: string;
  ticketId: string;
  purchaserId: string;
  paymentReference: string | null;
  idempotencyKey: string;
  nftMode: TicketNftMode;
  fulfillmentStatus: 'pending' | 'processing' | 'completed' | 'partial' | 'retrying' | 'failed';
  assetId: string | null;
  mintAddress: string | null;
  mintSignature: string | null;
  confirmedAt: number | null;
  fulfilledAt: number | null;
  retryCount: number;
}

/**
 * Minimal ticket snapshot required for reconciliation checks.
 */
export interface ReconciliationTicketRecord {
  id: string;
  ownerId: string;
  status: 'reserved' | 'minted' | 'scanned';
  assetId: string | null;
  mintAddress: string | null;
  mintSignature: string | null;
  fulfillmentStatus: 'pending' | 'processing' | 'completed' | 'partial' | 'retrying' | 'failed';
  issuanceAttempts: number;
}

/**
 * Read contract used by reconciliation reports and remediation workers.
 */
export interface ReconciliationStore {
  listOrders(): Promise<ReconciliationOrderRecord[]>;
  getTicket(ticketId: string): Promise<ReconciliationTicketRecord | null>;
}

/**
 * Structured mismatch categories for operational review.
 */
export type ReconciliationIssueCode =
  | 'missing_ticket'
  | 'missing_payment_reference'
  | 'payment_without_mint'
  | 'mint_without_ticket_state'
  | 'asset_mismatch'
  | 'excessive_retries';

/**
 * A single mismatch between payment and mint state.
 */
export interface ReconciliationIssue {
  orderId: string;
  ticketId: string;
  code: ReconciliationIssueCode;
  message: string;
}

/**
 * Normalized match summary for a single order and ticket pair.
 */
export interface PaymentMintMatch {
  orderId: string;
  ticketId: string;
  paymentReference: string | null;
  idempotencyKey: string;
  ticketStatus: ReconciliationTicketRecord['status'] | 'missing';
  fulfillmentStatus: ReconciliationOrderRecord['fulfillmentStatus'];
  nftMode: TicketNftMode;
  assetId: string | null;
  mintAddress: string | null;
  issues: ReconciliationIssue[];
}

/**
 * Aggregate reconciliation report for operational review or automated replay.
 */
export interface ReconciliationReport {
  generatedAt: number;
  totalOrders: number;
  matchedOrders: number;
  unmatchedOrders: number;
  issues: ReconciliationIssue[];
  matches: PaymentMintMatch[];
}

/**
 * Service used to correlate payment confirmations with mint outcomes.
 */
export interface ReconciliationService {
  reconcileAll(): Promise<ReconciliationReport>;
}

/**
 * Creates a reconciliation service for payment, webhook, and mint audit workflows.
 */
export function createReconciliationService(params: {
  store: ReconciliationStore;
  now?: () => number;
  retryWarningThreshold?: number;
}): ReconciliationService {
  const now = params.now ?? (() => Date.now());
  const retryWarningThreshold = params.retryWarningThreshold ?? 3;

  return {
    async reconcileAll() {
      const orders = await params.store.listOrders();
      const matches: PaymentMintMatch[] = [];
      const issues: ReconciliationIssue[] = [];

      for (const order of orders) {
        const ticket = await params.store.getTicket(order.ticketId);
        const entryIssues = buildIssues(order, ticket, retryWarningThreshold);
        const match: PaymentMintMatch = {
          orderId: order.id,
          ticketId: order.ticketId,
          paymentReference: order.paymentReference,
          idempotencyKey: order.idempotencyKey,
          ticketStatus: ticket?.status ?? 'missing',
          fulfillmentStatus: order.fulfillmentStatus,
          nftMode: order.nftMode,
          assetId: order.assetId ?? ticket?.assetId ?? null,
          mintAddress: order.mintAddress ?? ticket?.mintAddress ?? null,
          issues: entryIssues,
        };

        matches.push(match);
        issues.push(...entryIssues);
      }

      return {
        generatedAt: now(),
        totalOrders: orders.length,
        matchedOrders: matches.filter((match) => match.issues.length === 0).length,
        unmatchedOrders: matches.filter((match) => match.issues.length > 0).length,
        issues,
        matches,
      };
    },
  };
}

function buildIssues(
  order: ReconciliationOrderRecord,
  ticket: ReconciliationTicketRecord | null,
  retryWarningThreshold: number,
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  if (!ticket) {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'missing_ticket',
      message: 'Payment exists without a ticket projection.',
    });
    return issues;
  }

  if (!order.paymentReference) {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'missing_payment_reference',
      message: 'Confirmed payment is missing its provider reference.',
    });
  }

  if ((order.fulfillmentStatus === 'completed' || ticket.status === 'minted') && !order.assetId && !ticket.assetId) {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'payment_without_mint',
      message: 'Order appears fulfilled but no minted asset is linked.',
    });
  }

  if ((order.assetId || ticket.assetId) && ticket.status !== 'minted') {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'mint_without_ticket_state',
      message: 'Mint linkage exists but the ticket projection is not marked minted.',
    });
  }

  if (order.assetId && ticket.assetId && order.assetId !== ticket.assetId) {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'asset_mismatch',
      message: 'Order and ticket records disagree on the minted asset id.',
    });
  }

  if (order.retryCount >= retryWarningThreshold || ticket.issuanceAttempts >= retryWarningThreshold) {
    issues.push({
      orderId: order.id,
      ticketId: order.ticketId,
      code: 'excessive_retries',
      message: 'Fulfillment has retried multiple times and may require manual review.',
    });
  }

  return issues;
}
