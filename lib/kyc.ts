import type { KycStatus } from './domain';

/**
 * Flow types that can be blocked by KYC.
 */
export type KycGateFlow = 'purchase' | 'transfer';

/**
 * Event or deployment KYC policy.
 */
export interface KycPolicy {
  /** Whether KYC is required at all. */
  required: boolean;
  /** Flow types covered by the policy. */
  appliesTo: KycGateFlow[];
  /** Optional provider label for operator visibility. */
  provider: string | null;
}

/**
 * User KYC state used by gating decisions.
 */
export interface KycSubject {
  /** Stable user identifier. */
  userId: string;
  /** Current KYC status. */
  status: KycStatus;
  /** Event-specific approval when present. */
  eventStatus?: KycStatus | null;
}

/**
 * Result of evaluating a KYC gate.
 */
export interface KycGateDecision {
  /** Whether the flow may continue. */
  allowed: boolean;
  /** Status that drove the decision. */
  status: KycStatus;
  /** Short machine-readable reason. */
  reason: 'not_required' | 'approved' | 'pending' | 'rejected';
  /** Operator-facing explanation. */
  message: string;
}

/**
 * Evaluates whether a purchase or transfer can proceed under the given policy.
 */
export function evaluateKycGate(
  policy: KycPolicy,
  flow: KycGateFlow,
  subject: KycSubject,
): KycGateDecision {
  if (!policy.required || !policy.appliesTo.includes(flow)) {
    return {
      allowed: true,
      status: 'not_required',
      reason: 'not_required',
      message: 'KYC is not required for this flow.',
    };
  }

  const effectiveStatus = subject.eventStatus ?? subject.status;
  if (effectiveStatus === 'approved') {
    return {
      allowed: true,
      status: effectiveStatus,
      reason: 'approved',
      message: 'KYC requirements are satisfied.',
    };
  }

  if (effectiveStatus === 'pending') {
    return {
      allowed: false,
      status: effectiveStatus,
      reason: 'pending',
      message: 'KYC review is still pending.',
    };
  }

  if (effectiveStatus === 'rejected') {
    return {
      allowed: false,
      status: effectiveStatus,
      reason: 'rejected',
      message: 'KYC approval was rejected for this account.',
    };
  }

  return {
    allowed: false,
    status: effectiveStatus,
    reason: 'pending',
    message: 'KYC approval is required before continuing.',
  };
}
