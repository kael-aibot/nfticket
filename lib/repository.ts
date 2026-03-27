import type { Event, Order, Payout, Scan, Ticket, UserIdentity } from './domain';
import {
  validateEvent,
  validateOrder,
  validatePayout,
  validateScan,
  validateTicket,
  validateUserIdentity,
} from './domain';

/**
 * Shared repository contract for persisted aggregates.
 */
export interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(record: T): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Aggregate-specific repository bundle used by application services.
 */
export interface DomainRepository {
  events: Repository<Event>;
  orders: Repository<Order>;
  tickets: Repository<Ticket>;
  payouts: Repository<Payout>;
  scans: Repository<Scan>;
  identities: Repository<UserIdentity>;
}

/**
 * Small persistence contract that Prisma or browser storage adapters can implement.
 */
export interface PersistenceAdapter {
  readAll<T extends { id: string }>(collection: string): Promise<T[]>;
  writeAll<T extends { id: string }>(collection: string, records: T[]): Promise<void>;
}

/**
 * In-memory adapter for tests and local foundations.
 */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly store = new Map<string, Array<{ id: string }>>();

  async readAll<T extends { id: string }>(collection: string): Promise<T[]> {
    return ((this.store.get(collection) ?? []) as T[]).map((record) => ({ ...record }));
  }

  async writeAll<T extends { id: string }>(collection: string, records: T[]): Promise<void> {
    this.store.set(collection, records.map((record) => ({ ...record })));
  }
}

/**
 * Creates repository implementations over a generic persistence adapter.
 */
export function createDomainRepository(adapter: PersistenceAdapter): DomainRepository {
  return {
    events: createCollectionRepository('events', adapter, validateEvent),
    orders: createCollectionRepository('orders', adapter, validateOrder),
    tickets: createCollectionRepository('tickets', adapter, validateTicket),
    payouts: createCollectionRepository('payouts', adapter, validatePayout),
    scans: createCollectionRepository('scans', adapter, validateScan),
    identities: createCollectionRepository('identities', adapter, validateUserIdentity),
  };
}

/**
 * Lists all records matching a predicate.
 */
export async function filterRecords<T extends { id: string }>(
  repository: Repository<T>,
  predicate: (record: T) => boolean,
): Promise<T[]> {
  const records = await repository.list();
  return records.filter(predicate);
}

/**
 * Saves a batch of records using one repository.
 */
export async function saveRecords<T extends { id: string }>(
  repository: Repository<T>,
  records: T[],
): Promise<T[]> {
  return Promise.all(records.map((record) => repository.save(record)));
}

function createCollectionRepository<T extends { id: string }>(
  collection: string,
  adapter: PersistenceAdapter,
  validate: (input: T) => T,
): Repository<T> {
  return {
    async findById(id) {
      const records = await adapter.readAll<T>(collection);
      return records.find((record) => record.id === id) ?? null;
    },
    async list() {
      return adapter.readAll<T>(collection);
    },
    async save(record) {
      const normalized = validate(record);
      const records = await adapter.readAll<T>(collection);
      const nextRecords = upsertById(records, normalized);
      await adapter.writeAll(collection, nextRecords);
      return normalized;
    },
    async delete(id) {
      const records = await adapter.readAll<T>(collection);
      await adapter.writeAll(
        collection,
        records.filter((record) => record.id !== id),
      );
    },
  };
}

function upsertById<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    return [record, ...records];
  }

  return records.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}
