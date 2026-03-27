import type { Repository } from './repository';

/**
 * Background job types required by Phase 2.
 */
export type JobType = 'chain_index' | 'stripe_webhook' | 'ticket_fulfillment';

/**
 * Job lifecycle states.
 */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

/**
 * Serializable background job record.
 */
export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  idempotencyKey: string;
  payload: Record<string, string | number | boolean | null>;
  attempts: number;
  maxAttempts: number;
  availableAt: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Job repository contract that can be backed by Prisma or in-memory storage.
 */
export interface JobRepository extends Repository<JobRecord> {}

/**
 * Worker handler for a specific job type.
 */
export type JobHandler = (job: JobRecord) => Promise<void>;

/**
 * Small job queue foundation with idempotent enqueue semantics.
 */
export interface JobQueue {
  enqueue(job: Omit<JobRecord, 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): Promise<JobRecord>;
  claimReadyJob(type: JobType, now?: number): Promise<JobRecord | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: Error, retryDelayMs?: number): Promise<void>;
}

/**
 * Creates the default queue implementation over a repository.
 */
export function createJobQueue(repository: JobRepository): JobQueue {
  return {
    async enqueue(job) {
      const existing = (await repository.list()).find(
        (record) => record.idempotencyKey === job.idempotencyKey,
      );
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const record: JobRecord = {
        ...job,
        status: 'queued',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };

      return repository.save(validateJobRecord(record));
    },
    async claimReadyJob(type, now = Date.now()) {
      const record = (await repository.list()).find(
        (job) => job.type === type && job.status === 'queued' && job.availableAt <= now,
      );
      if (!record) {
        return null;
      }

      return repository.save({
        ...record,
        status: 'running',
        attempts: record.attempts + 1,
        updatedAt: Date.now(),
      });
    },
    async complete(jobId) {
      const record = await repository.findById(jobId);
      if (!record) {
        return;
      }

      await repository.save({
        ...record,
        status: 'completed',
        lastError: null,
        updatedAt: Date.now(),
      });
    },
    async fail(jobId, error, retryDelayMs = 30_000) {
      const record = await repository.findById(jobId);
      if (!record) {
        return;
      }

      const shouldRetry = record.attempts < record.maxAttempts;
      await repository.save({
        ...record,
        status: shouldRetry ? 'queued' : 'failed',
        availableAt: shouldRetry ? Date.now() + retryDelayMs : record.availableAt,
        lastError: error.message,
        updatedAt: Date.now(),
      });
    },
  };
}

/**
 * Executes one available job for a given type.
 */
export async function runNextJob(
  queue: JobQueue,
  type: JobType,
  handler: JobHandler,
): Promise<JobRecord | null> {
  const job = await queue.claimReadyJob(type);
  if (!job) {
    return null;
  }

  try {
    await handler(job);
    await queue.complete(job.id);
  } catch (error) {
    await queue.fail(job.id, error instanceof Error ? error : new Error(String(error)));
  }

  return job;
}

function validateJobRecord(input: JobRecord): JobRecord {
  if (!input.id.trim()) {
    throw new Error('job.id is required');
  }

  if (!input.idempotencyKey.trim()) {
    throw new Error('job.idempotencyKey is required');
  }

  if (input.maxAttempts < 1) {
    throw new Error('job.maxAttempts must be at least 1');
  }

  return input;
}
