import type {
  AppSettings as DomainAppSettings,
  AuthMode as DomainAuthMode,
  EventAuthRequirements as DomainEventAuthRequirements,
  KycStatus as DomainKycStatus,
  ResalePolicy as DomainResalePolicy,
} from '../../../lib/domain';

/** Supported login providers for the existing shared UI. */
export type AuthProvider = 'credentials' | 'google' | 'github';

/** Supported shared UI roles. */
export const USER_ROLES = ['buyer', 'provider', 'admin', 'platform'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (role === 'user') {
    return 'buyer';
  }

  if ((USER_ROLES as readonly string[]).includes(role ?? '')) {
    return role as UserRole;
  }

  return 'buyer';
}

export function hasPlatformAccess(role: UserRole): boolean {
  return role === 'admin' || role === 'platform';
}

/** Admin access scopes used by Phase 5 operator tooling. */
export type AdminRole = 'support' | 'finance' | 'auth' | 'operations';

/** Shared projection of canonical auth modes. */
export type AuthMode = DomainAuthMode;

/** Shared projection of canonical KYC states. */
export type KycStatus = DomainKycStatus;

/** Legacy UI payment choices projected from canonical rails. */
export type PaymentMethod = 'card' | 'crypto';

/** Legacy UI order lifecycle states. */
export type OrderStatus = 'pending' | 'paid' | 'failed';

/** Legacy UI ticket lifecycle states. */
export type TicketStatus = 'reserved' | 'minted' | 'scanned';

/** Fulfillment lifecycle projected into the legacy browser demo store. */
export type FulfillmentStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'retrying' | 'failed';

/** Notification delivery state tracked for future email or wallet messaging. */
export type NotificationStatus = 'pending' | 'sent' | 'failed';

/** Supported NFT ticket issuance modes exposed to the legacy UI. */
export type NftMode = 'compressed' | 'metadata';

/** Browser receipt record generated during ticket fulfillment. */
export interface ReceiptRecord {
  id: string;
  orderId: string;
  ticketId: string;
  purchaserId: string;
  amount: number;
  currency: string;
  paymentLabel: string;
  paymentReference: string;
  nftMode: NftMode;
  issuedAt: number;
}

/** Shared auth profile used by the browser demo flows. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  provider: AuthProvider;
  role: UserRole;
  emailVerified: boolean;
  wallets: string[];
  linkedWallets: string[];
  authMode: AuthMode;
  kycStatus: KycStatus;
  adminRoles: AdminRole[];
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number | null;
}

/** Session record persisted for email, wallet, or hybrid authentication flows. */
export interface AuthSessionRecord {
  id: string;
  userId: string;
  authMode: AuthMode;
  walletAddress: string | null;
  createdAt: number;
  expiresAt: number;
  lastValidatedAt: number;
}

/** Magic-link or recovery token tracked for production-style email auth workflows. */
export interface MagicLinkRecord {
  id: string;
  userId: string | null;
  email: string;
  token: string;
  purpose: 'sign_in' | 'verify_email' | 'account_recovery';
  requestedAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

/** Wallet challenge record used for SIWE-style sign-in and wallet linking. */
export interface WalletChallengeRecord {
  id: string;
  userId: string | null;
  walletAddress: string;
  nonce: string;
  message: string;
  issuedAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

/** Event or deployment KYC decision persisted for purchase and transfer gating. */
export interface KycRecord {
  id: string;
  userId: string;
  eventId: string | null;
  status: KycStatus;
  providerReference: string | null;
  submittedAt: number;
  reviewedAt?: number | null;
  notes?: string | null;
}

/** Failed flow record shown to operators for replay and incident resolution. */
export interface FailedFlowRecord {
  id: string;
  type: 'payment' | 'minting' | 'auth';
  status: 'open' | 'replaying' | 'resolved';
  eventId: string | null;
  orderId: string | null;
  ticketId: string | null;
  userId: string | null;
  idempotencyKey: string;
  errorMessage: string;
  payload: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
}

/** Alert record emitted when a payment, minting, or auth incident needs attention. */
export interface IncidentAlertRecord {
  id: string;
  channel: 'dashboard' | 'email' | 'webhook';
  incidentType: 'payment' | 'minting' | 'auth';
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  relatedFlowId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Ticket inventory displayed in the current create-event UI. */
export interface TicketTier {
  name: string;
  price: number;
  supply: number;
  sold: number;
  benefits: string;
}

/** Re-exported Phase 2 resale decay settings for UI compatibility. */
export type ResaleDecaySettings = DomainAppSettings['resaleDecay'];

/** Re-exported Phase 2 royalty split settings for UI compatibility. */
export type RoyaltySplitSettings = DomainAppSettings['royaltySplit'];

/** Shared settings shape retained for the current pricing and settings UI. */
export type AppSettings = DomainAppSettings;

/** Organizer-configurable resale policy persisted alongside legacy event records. */
export interface MarketplaceResalePolicy
  extends Pick<
    DomainResalePolicy,
    | 'enabled'
    | 'maxTransfers'
    | 'minPriceMultiplier'
    | 'maxPriceMultiplier'
    | 'royaltyBasisPoints'
    | 'approvalRequired'
  > {
  /** Cooldown window enforced between transfer-related actions. */
  transferCooldownMs: number;
  /** Rolling window used to detect suspicious transfer velocity. */
  excessiveTransferWindowMs: number;
  /** Maximum allowed transfers in the suspicious activity window before flagging. */
  excessiveTransferThreshold: number;
  /** Rolling window used to detect repeated scans after admission. */
  scanAbuseWindowMs: number;
  /** Maximum duplicate scans allowed in the scan abuse window before flagging. */
  scanAbuseThreshold: number;
}

/** Event-level marketplace settings resolved from defaults and organizer overrides. */
export interface EventMarketplaceSettings {
  /** Canonical resale and transfer policy enforced for the event. */
  policy: MarketplaceResalePolicy;
}

/** Legacy event read model kept stable while Phase 2 canonical models roll out underneath it. */
export interface EventRecord {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerWallet?: string | null;
  name: string;
  description: string;
  eventDate: number;
  venue: string;
  tiers: TicketTier[];
  acceptedPayments: PaymentMethod[];
  nftMode?: NftMode;
  isActive: boolean;
  totalTicketsSold: number;
  totalRevenue: number;
  authorizedScanners: string[];
  authRequirements?: DomainEventAuthRequirements;
  resaleConfig: AppSettings;
  marketplaceSettings?: EventMarketplaceSettings;
  createdAt: number;
}

/** Legacy ticket read model kept stable for the current ticket pages. */
export interface TicketRecord {
  id: string;
  eventId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  ownerWallet?: string | null;
  tierIndex: number;
  tierName: string;
  seatInfo: string | null;
  purchasePrice: number;
  purchaseTime: number;
  paymentMethod: PaymentMethod;
  status: TicketStatus;
  nftMode?: NftMode;
  assetId?: string | null;
  mintAddress?: string | null;
  mintSignature?: string | null;
  receiptId?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
  lastFulfillmentError?: string | null;
  issuanceAttempts?: number;
  isForSale: boolean;
  salePrice: number | null;
  resaleCount: number;
  lastTransferredAt?: number | null;
  lastScannedAt?: number | null;
  pendingTransferApproval?: boolean;
}

/** Canonical QR payload encoded into attendee ticket QR codes for admission. */
export interface QrTicketPayload {
  type: 'nfticket';
  version: 2;
  ticketId: string;
  eventId: string;
  issuedAt: number;
}

/** Best-effort location snapshot captured by the scanner device. */
export interface ScannerLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

/** Device-bound JWT token used by provider scanners. */
export interface ScannerSessionToken {
  token: string;
  eventId: string;
  scannerUserId: string | null;
  scannerLabel: string | null;
  deviceFingerprint: string;
  expiresAt: number;
}

/** Server validation result for a scan attempt. */
export interface ScannerValidationResult {
  success: boolean;
  status: 'accepted' | 'duplicate' | 'rejected' | 'manual_review' | 'offline_queued';
  message: string;
  scannedAt: number;
  checkpoint?: string;
  event?: Pick<EventRecord, 'id' | 'name' | 'venue' | 'eventDate'>;
  ticket?: TicketRecord;
  scanId?: string | null;
  duplicateOfScanId?: string | null;
  alreadyScannedAt?: number | null;
  offline: boolean;
}

/** Pending scan attempt stored locally when the scanner is offline. */
export interface ScanQueueItem {
  idempotencyKey: string;
  payload: QrTicketPayload;
  deviceFingerprint: string;
  checkpoint?: string;
  location?: ScannerLocation | null;
  scannedAt: number;
  queuedAt: number;
}

/** Supported marketplace listing states. */
export type ResaleListingStatus = 'active' | 'sold' | 'cancelled' | 'rejected';

/** Approval workflow state for organizer-controlled resale exceptions. */
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

/** Marketplace listing persisted for auditable resale activity. */
export interface ResaleListingRecord {
  id: string;
  ticketId: string;
  eventId: string;
  sellerId: string;
  sellerWallet: string | null;
  askPrice: number;
  currency: string;
  status: ResaleListingStatus;
  approvalStatus: ApprovalStatus;
  createdAt: number;
  updatedAt: number;
  soldAt?: number | null;
  buyerId?: string | null;
}

/** Beneficiary type for payout split accounting. */
export type PayoutRecipientType = 'seller' | 'organizer_royalty' | 'platform_fee';

/** Auditable payout split generated during resale settlement. */
export interface PayoutSplitRecord {
  id: string;
  listingId: string;
  ticketId: string;
  eventId: string;
  recipientType: PayoutRecipientType;
  recipientUserId: string | null;
  recipientWallet: string | null;
  grossAmount: number;
  amount: number;
  currency: string;
  basisPoints: number;
  createdAt: number;
}

/** Audit action types captured for resale, transfers, fraud, and support workflows. */
export type TransferAuditAction =
  | 'resale_listed'
  | 'resale_purchased'
  | 'transfer_executed'
  | 'transfer_blocked'
  | 'support_override'
  | 'royalty_recorded'
  | 'fraud_flagged'
  | 'scan_abuse_flagged';

/** Immutable audit record for transfer-related workflows. */
export interface TransferAuditRecord {
  id: string;
  ticketId: string;
  eventId: string;
  action: TransferAuditAction;
  actorUserId: string | null;
  subjectUserId: string | null;
  listingId: string | null;
  payoutSplitIds: string[];
  metadata: Record<string, string>;
  createdAt: number;
}

/** Fraud categories tracked for marketplace and scanner abuse controls. */
export type FraudCategory = 'excessive_transfer_activity' | 'cooldown_violation' | 'scan_abuse';

/** Fraud severity level stored with each fraud flag. */
export type FraudSeverity = 'low' | 'medium' | 'high';

/** Suspicious activity record emitted before or alongside blocked state transitions. */
export interface FraudFlagRecord {
  id: string;
  eventId: string;
  ticketId: string | null;
  userId: string | null;
  category: FraudCategory;
  severity: FraudSeverity;
  description: string;
  metadata: Record<string, string>;
  createdAt: number;
  resolvedAt?: number | null;
}

/** Legacy payment order record used by the browser payment mock. */
export interface PaymentOrder {
  id: string;
  eventId: string;
  ticketId: string;
  purchaserId: string;
  amount: number;
  method: PaymentMethod;
  status: OrderStatus;
  processor: 'stripe' | 'solana';
  currency?: string;
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
  createdAt: number;
}
