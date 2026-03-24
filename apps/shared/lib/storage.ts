import type {
  AppSettings,
  AuthUser,
  EventRecord,
  AuthSessionRecord,
  FraudFlagRecord,
  FailedFlowRecord,
  IncidentAlertRecord,
  KycRecord,
  MagicLinkRecord,
  PaymentOrder,
  PayoutSplitRecord,
  ScanQueueItem,
  ScannerSessionToken,
  ResaleListingRecord,
  TicketRecord,
  TransferAuditRecord,
  WalletChallengeRecord,
} from './types';
import { toScannerCredential } from './scannerCredentials';

const AUTH_ENDPOINT = '/api/auth';

function secureRandomString() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const buffer = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer);
    return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function canUseBrowserApi() {
  return typeof window !== 'undefined' && typeof window.XMLHttpRequest !== 'undefined';
}

function requestJson<T>(method: 'GET' | 'POST', path: string, body?: unknown, fallback?: T): T {
  if (!canUseBrowserApi()) {
    return fallback as T;
  }

  try {
    const request = new window.XMLHttpRequest();
    request.open(method, path, false);
    request.setRequestHeader('Content-Type', 'application/json');
    request.send(body ? JSON.stringify(body) : null);

    if (request.status >= 200 && request.status < 300) {
      return request.responseText ? (JSON.parse(request.responseText) as T) : (fallback as T);
    }
  } catch {
    return fallback as T;
  }

  return fallback as T;
}

function getCollection<T>(path: string, fallback: T): T {
  return requestJson<T>('GET', path, undefined, fallback);
}

function postCollection<T>(path: string, body: unknown, fallback: T): T {
  return requestJson<T>('POST', path, body, fallback);
}

export function uid(prefix: string) {
  return `${prefix}_${secureRandomString()}`;
}

export function getUsers() {
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function saveUsers(users: AuthUser[]) {
  void users;
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function getSessionUserId() {
  const result = postCollection<{ valid?: boolean; user?: { id?: string | null } }>(
    AUTH_ENDPOINT,
    { action: 'session:validate' },
    { valid: false },
  );
  return result.valid ? result.user?.id ?? null : null;
}

export function saveSessionUserId(userId: string | null) {
  void userId;
}

export function getAuthSessions() {
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function saveAuthSessions(sessions: AuthSessionRecord[]) {
  void sessions;
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function getMagicLinks() {
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function saveMagicLinks(records: MagicLinkRecord[]) {
  void records;
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function getWalletChallenges() {
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function saveWalletChallenges(records: WalletChallengeRecord[]) {
  void records;
  throw new Error('Legacy client-side auth storage is disabled. Use the secure session API.');
}

export function getKycRecords() {
  return readLocalStorageJson<KycRecord[]>(KYC_RECORD_STORAGE_KEY, []);
}

export function saveKycRecords(records: KycRecord[]) {
  writeLocalStorageJson(KYC_RECORD_STORAGE_KEY, records);
}

export function getFailedFlows() {
  return postCollection<FailedFlowRecord[]>('/api/state', { action: 'failedFlows:list' }, []);
}

export function saveFailedFlows(records: FailedFlowRecord[]) {
  postCollection<FailedFlowRecord[]>('/api/state', { action: 'failedFlows:save', records }, records);
}

export function getIncidentAlerts() {
  return postCollection<IncidentAlertRecord[]>('/api/state', { action: 'incidentAlerts:list' }, []);
}

export function saveIncidentAlerts(records: IncidentAlertRecord[]) {
  postCollection<IncidentAlertRecord[]>('/api/state', { action: 'incidentAlerts:save', records }, records);
}

export function getEvents() {
  return getCollection<EventRecord[]>('/api/events', []);
}

export function saveEvents(events: EventRecord[]) {
  postCollection<EventRecord[]>('/api/events', { events }, events);
}

export function getTickets() {
  return getCollection<TicketRecord[]>('/api/tickets', []);
}

export function saveTickets(tickets: TicketRecord[]) {
  postCollection<TicketRecord[]>('/api/tickets', { tickets }, tickets);
}

export function getOrders() {
  return getCollection<PaymentOrder[]>('/api/orders', []);
}

export function saveOrders(orders: PaymentOrder[]) {
  postCollection<PaymentOrder[]>('/api/orders', { orders }, orders);
}

export function getSettings() {
  return postCollection<AppSettings | null>('/api/state', { action: 'settings:get' }, null);
}

export function saveSettings(settings: AppSettings) {
  postCollection<AppSettings>('/api/state', { action: 'settings:set', value: settings }, settings);
}

export function getResaleListings() {
  return getCollection<ResaleListingRecord[]>('/api/resale', []);
}

export function saveResaleListings(listings: ResaleListingRecord[]) {
  postCollection<ResaleListingRecord[]>('/api/resale', { action: 'listings:save', listings }, listings);
}

export function getPayoutSplits() {
  return postCollection<PayoutSplitRecord[]>('/api/resale', { action: 'payoutSplits:list' }, []);
}

export function savePayoutSplits(payoutSplits: PayoutSplitRecord[]) {
  postCollection<PayoutSplitRecord[]>('/api/resale', { action: 'payoutSplits:save', records: payoutSplits }, payoutSplits);
}

export function getTransferAuditLog() {
  return postCollection<TransferAuditRecord[]>('/api/resale', { action: 'transferAudit:list' }, []);
}

export function saveTransferAuditLog(records: TransferAuditRecord[]) {
  postCollection<TransferAuditRecord[]>('/api/resale', { action: 'transferAudit:save', records }, records);
}

export function getFraudFlags() {
  return postCollection<FraudFlagRecord[]>('/api/resale', { action: 'fraudFlags:list' }, []);
}

export function saveFraudFlags(flags: FraudFlagRecord[]) {
  postCollection<FraudFlagRecord[]>('/api/resale', { action: 'fraudFlags:save', records: flags }, flags);
}

const SCANNER_TOKEN_STORAGE_KEY = 'nfticket:scannerTokens';
const SCAN_QUEUE_STORAGE_KEY = 'nfticket:scanQueue';
const KYC_RECORD_STORAGE_KEY = 'nfticket:kycRecords';

function readLocalStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorageJson(key: string, value: unknown) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore browser quota or serialization failures for demo persistence.
  }
}

export function getScannerSessions() {
  const sessions = readLocalStorageJson<Record<string, ScannerSessionToken>>(SCANNER_TOKEN_STORAGE_KEY, {});
  return Object.fromEntries(
    Object.entries(sessions).map(([eventId, session]) => [
      eventId,
      {
        ...session,
        scannerLabel: toScannerCredential(session.scannerLabel),
      },
    ]),
  );
}

export function getScannerSession(eventId: string) {
  return getScannerSessions()[eventId] ?? null;
}

export function saveScannerSession(session: ScannerSessionToken) {
  writeLocalStorageJson(SCANNER_TOKEN_STORAGE_KEY, {
    ...getScannerSessions(),
    [session.eventId]: {
      ...session,
      scannerLabel: toScannerCredential(session.scannerLabel),
    },
  });
}

export function clearScannerSession(eventId: string) {
  const sessions = { ...getScannerSessions() };
  delete sessions[eventId];
  writeLocalStorageJson(SCANNER_TOKEN_STORAGE_KEY, sessions);
}

export function getQueuedScans() {
  return readLocalStorageJson<ScanQueueItem[]>(SCAN_QUEUE_STORAGE_KEY, []);
}

export function saveQueuedScans(records: ScanQueueItem[]) {
  writeLocalStorageJson(SCAN_QUEUE_STORAGE_KEY, records);
}

export function queueScan(record: ScanQueueItem) {
  saveQueuedScans([record, ...getQueuedScans().filter((item) => item.idempotencyKey !== record.idempotencyKey)]);
}

export function removeQueuedScan(idempotencyKey: string) {
  saveQueuedScans(getQueuedScans().filter((item) => item.idempotencyKey !== idempotencyKey));
}
