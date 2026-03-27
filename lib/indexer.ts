import type { AcceptedPaymentRail } from './domain';
import type { JobQueue } from './jobs';
import type { DomainRepository } from './repository';

/**
 * Canonical chain event types consumed by the off-chain projector.
 */
export type IndexedChainEventType =
  | 'ticket_minted'
  | 'ticket_transferred'
  | 'ticket_scanned'
  | 'payment_confirmed';

/**
 * Indexer checkpoint used for replayable chain reads.
 */
export interface IndexCheckpoint {
  cursor: string;
  slot: number;
  updatedAt: number;
}

/**
 * Normalized chain event payload consumed by domain projectors.
 */
export interface IndexedChainEvent {
  id: string;
  type: IndexedChainEventType;
  eventId: string;
  ticketId: string | null;
  orderId: string | null;
  ownerId: string | null;
  paymentRail: AcceptedPaymentRail | null;
  slot: number;
  occurredAt: number;
  metadata: Record<string, string>;
}

/**
 * Input contract for reading events from a chain source.
 */
export interface ChainEventSource {
  fetchSince(checkpoint: IndexCheckpoint | null): Promise<{
    checkpoint: IndexCheckpoint;
    events: IndexedChainEvent[];
  }>;
}

/**
 * Projector contract that applies indexed events to the domain read model.
 */
export interface ChainProjector {
  apply(event: IndexedChainEvent, repository: DomainRepository): Promise<void>;
}

/**
 * High-level indexer service that is safe to replay from checkpoints.
 */
export interface ChainIndexer {
  sync(checkpoint: IndexCheckpoint | null): Promise<IndexCheckpoint>;
  scheduleBackfill(cursor: string): Promise<void>;
}

/**
 * Creates the Phase 2 indexer foundation.
 */
export function createChainIndexer(params: {
  source: ChainEventSource;
  projector: ChainProjector;
  repository: DomainRepository;
  jobs: JobQueue;
}): ChainIndexer {
  return {
    async sync(checkpoint) {
      const batch = await params.source.fetchSince(checkpoint);
      for (const event of batch.events) {
        await params.projector.apply(event, params.repository);
      }
      return batch.checkpoint;
    },
    async scheduleBackfill(cursor) {
      await params.jobs.enqueue({
        id: `job_chain_index_${cursor}`,
        type: 'chain_index',
        idempotencyKey: `chain_index:${cursor}`,
        payload: { cursor },
        maxAttempts: 10,
        availableAt: Date.now(),
        lastError: null,
      });
    },
  };
}
