/**
 * Flow types monitored by operator tooling.
 */
export type OperationsFlowType = 'payment' | 'minting' | 'auth';

/**
 * Failure state for a tracked flow.
 */
export type FailedFlowStatus = 'open' | 'replaying' | 'resolved';

/**
 * Incident severity used for routing alerts.
 */
export type IncidentSeverity = 'low' | 'medium' | 'high';

/**
 * Failed flow record used for replay and support actions.
 */
export interface FailedFlow {
  /** Stable record identifier. */
  id: string;
  /** Flow category. */
  type: OperationsFlowType;
  /** Current support status. */
  status: FailedFlowStatus;
  /** Event connected to the failure, if any. */
  eventId: string | null;
  /** Order connected to the failure, if any. */
  orderId: string | null;
  /** Ticket connected to the failure, if any. */
  ticketId: string | null;
  /** User connected to the failure, if any. */
  userId: string | null;
  /** Idempotency key used to safely replay the flow. */
  idempotencyKey: string;
  /** Latest error message. */
  errorMessage: string;
  /** Serializable payload needed for replay or diagnosis. */
  payload: Record<string, string>;
  /** Record creation time. */
  createdAt: number;
  /** Record update time. */
  updatedAt: number;
  /** Resolution time when closed. */
  resolvedAt: number | null;
}

/**
 * Alert emitted for operators or future integrations.
 */
export interface OperationsAlert {
  /** Stable alert identifier. */
  id: string;
  /** Delivery channel placeholder. */
  channel: 'dashboard' | 'email' | 'webhook';
  /** Incident type that raised the alert. */
  incidentType: OperationsFlowType;
  /** Severity used by routing policy. */
  severity: IncidentSeverity;
  /** Alert lifecycle state. */
  status: 'active' | 'acknowledged' | 'resolved';
  /** Short alert title. */
  title: string;
  /** Longer operator-facing description. */
  description: string;
  /** Related failed-flow id when applicable. */
  relatedFlowId: string | null;
  /** Record creation time. */
  createdAt: number;
  /** Record update time. */
  updatedAt: number;
}

/**
 * Persistence contract for operations tooling.
 */
export interface OperationsStore {
  /** Lists failed flows. */
  listFailedFlows(): FailedFlow[];
  /** Saves failed flows. */
  saveFailedFlows(records: FailedFlow[]): void;
  /** Lists alerts. */
  listAlerts(): OperationsAlert[];
  /** Saves alerts. */
  saveAlerts(records: OperationsAlert[]): void;
  /** Generates stable ids. */
  uid(prefix: string): string;
  /** Supplies current time for deterministic testing. */
  now?: () => number;
}

/**
 * Operator tooling foundation for visibility, replay, and resolution.
 */
export interface OperationsService {
  /** Records a failed flow and emits an alert. */
  recordFailure(input: Omit<FailedFlow, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'resolvedAt'> & { severity?: IncidentSeverity }): FailedFlow;
  /** Lists failed flows, newest first. */
  listFailures(): FailedFlow[];
  /** Marks a flow as replaying. */
  markReplaying(failureId: string): FailedFlow;
  /** Resolves a flow and related alerts. */
  resolveFailure(failureId: string, resolutionNote?: string): FailedFlow;
  /** Lists alerts, newest first. */
  listAlerts(): OperationsAlert[];
}

/**
 * Creates the default operations tooling service.
 */
export function createOperationsService(store: OperationsStore): OperationsService {
  const now = store.now ?? (() => Date.now());

  return {
    recordFailure(input) {
      const timestamp = now();
      const failure: FailedFlow = {
        id: store.uid('flow'),
        type: input.type,
        status: 'open',
        eventId: input.eventId,
        orderId: input.orderId,
        ticketId: input.ticketId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        errorMessage: input.errorMessage,
        payload: input.payload,
        createdAt: timestamp,
        updatedAt: timestamp,
        resolvedAt: null,
      };
      store.saveFailedFlows([failure, ...store.listFailedFlows()]);

      const alert: OperationsAlert = {
        id: store.uid('alert'),
        channel: 'dashboard',
        incidentType: failure.type,
        severity: input.severity ?? inferSeverity(failure.type),
        status: 'active',
        title: `${capitalize(failure.type)} incident`,
        description: failure.errorMessage,
        relatedFlowId: failure.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.saveAlerts([alert, ...store.listAlerts()]);
      return failure;
    },
    listFailures() {
      return store.listFailedFlows().slice().sort((a, b) => b.createdAt - a.createdAt);
    },
    markReplaying(failureId) {
      const failure = requireFailure(store.listFailedFlows(), failureId);
      const updated: FailedFlow = {
        ...failure,
        status: 'replaying',
        updatedAt: now(),
      };
      store.saveFailedFlows(upsertRecord(store.listFailedFlows(), updated));
      return updated;
    },
    resolveFailure(failureId, resolutionNote) {
      const timestamp = now();
      const failure = requireFailure(store.listFailedFlows(), failureId);
      const updated: FailedFlow = {
        ...failure,
        status: 'resolved',
        errorMessage: resolutionNote ? `${failure.errorMessage} | ${resolutionNote}` : failure.errorMessage,
        updatedAt: timestamp,
        resolvedAt: timestamp,
      };
      store.saveFailedFlows(upsertRecord(store.listFailedFlows(), updated));
      const alerts = store.listAlerts().map((alert) =>
        alert.relatedFlowId === failureId
          ? {
              ...alert,
              status: 'resolved' as const,
              updatedAt: timestamp,
            }
          : alert,
      );
      store.saveAlerts(alerts);
      return updated;
    },
    listAlerts() {
      return store.listAlerts().slice().sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}

function requireFailure(records: FailedFlow[], failureId: string): FailedFlow {
  const failure = records.find((record) => record.id === failureId);
  if (!failure) {
    throw new Error('Failed flow not found');
  }

  return failure;
}

function inferSeverity(type: OperationsFlowType): IncidentSeverity {
  if (type === 'payment') {
    return 'high';
  }
  if (type === 'minting') {
    return 'medium';
  }
  return 'medium';
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

function upsertRecord<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    return [record, ...records];
  }

  return records.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}
