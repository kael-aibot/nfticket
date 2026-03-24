import { randomBytes } from 'crypto';
import type { AuthMode } from './domain';

/**
 * Minimal identity projection needed by auth orchestration.
 */
export interface AuthIdentityRecord {
  /** Stable user identifier. */
  id: string;
  /** Primary email for email-first auth flows. */
  email: string | null;
  /** Whether the email has been verified through a magic link or recovery flow. */
  emailVerified: boolean;
  /** Linked wallet addresses for wallet or hybrid auth. */
  wallets: string[];
  /** Preferred auth mode for the account. */
  authMode: AuthMode;
}

/**
 * Persisted browser-safe session state.
 */
export interface AuthSession {
  /** Stable session identifier. */
  id: string;
  /** Account attached to the session. */
  userId: string;
  /** Auth mode used to establish the session. */
  authMode: AuthMode;
  /** Wallet used for the session, if any. */
  walletAddress: string | null;
  /** Session creation timestamp. */
  createdAt: number;
  /** Session expiration timestamp. */
  expiresAt: number;
  /** Last access timestamp used for sliding expiration. */
  lastValidatedAt: number;
}

/**
 * Magic-link payload for sign-in, verification, or account recovery.
 */
export interface MagicLinkToken {
  /** Stable token identifier. */
  id: string;
  /** User bound to the token when known. */
  userId: string | null;
  /** Email that will consume the link. */
  email: string;
  /** Flow the token is issued for. */
  purpose: 'sign_in' | 'verify_email' | 'account_recovery';
  /** Opaque token value. */
  token: string;
  /** Issuance timestamp. */
  requestedAt: number;
  /** Expiration timestamp. */
  expiresAt: number;
  /** Consumption timestamp once redeemed. */
  consumedAt: number | null;
}

/**
 * Wallet-signature challenge used for SIWE-style message signing.
 */
export interface WalletChallenge {
  /** Stable challenge identifier. */
  id: string;
  /** User being authenticated or linked when known. */
  userId: string | null;
  /** Wallet expected to sign the challenge. */
  walletAddress: string;
  /** Anti-replay nonce. */
  nonce: string;
  /** Message presented to the wallet for signing. */
  message: string;
  /** Issuance timestamp. */
  issuedAt: number;
  /** Expiration timestamp. */
  expiresAt: number;
  /** Consumption timestamp once verified. */
  consumedAt: number | null;
}

/**
 * Signature submission for a wallet challenge.
 */
export interface WalletVerificationRequest {
  /** Challenge being verified. */
  challenge: WalletChallenge;
  /** Signature encoded as base64, hex, or wallet-specific text. */
  signature: string;
  /** Message the wallet claims to have signed. */
  signedMessage: string;
}

/**
 * Auth service dependencies abstracting persistence and signature verification.
 */
export interface AuthOrchestratorDependencies<TIdentity extends AuthIdentityRecord> {
  /** Returns all identities. */
  listIdentities: () => TIdentity[];
  /** Persists the full identity set. */
  saveIdentities: (identities: TIdentity[]) => void;
  /** Returns all sessions. */
  listSessions: () => AuthSession[];
  /** Persists the full session set. */
  saveSessions: (sessions: AuthSession[]) => void;
  /** Returns all magic-link records. */
  listMagicLinks: () => MagicLinkToken[];
  /** Persists the full magic-link set. */
  saveMagicLinks: (records: MagicLinkToken[]) => void;
  /** Returns all wallet challenges. */
  listWalletChallenges: () => WalletChallenge[];
  /** Persists the full wallet-challenge set. */
  saveWalletChallenges: (records: WalletChallenge[]) => void;
  /** Generates stable ids for new records. */
  uid: (prefix: string) => string;
  /** Supplies current time for deterministic testing. */
  now?: () => number;
  /** Supplies randomness for nonces and opaque tokens. */
  randomToken?: () => string;
  /** Verifies a signed wallet challenge. */
  verifySignature?: (request: WalletVerificationRequest) => Promise<boolean>;
  /** Session duration in milliseconds. */
  sessionTtlMs?: number;
  /** Magic-link duration in milliseconds. */
  magicLinkTtlMs?: number;
  /** Wallet challenge duration in milliseconds. */
  walletChallengeTtlMs?: number;
}

/**
 * Public auth orchestration contract used by app-layer adapters.
 */
export interface AuthOrchestrator<TIdentity extends AuthIdentityRecord> {
  /** Issues a magic link for sign-in or recovery. */
  issueMagicLink(params: { email: string; purpose: MagicLinkToken['purpose']; userId?: string | null }): MagicLinkToken;
  /** Redeems a valid magic link. */
  consumeMagicLink(token: string): MagicLinkToken;
  /** Issues a new wallet challenge message. */
  issueWalletChallenge(params: { walletAddress: string; userId?: string | null; domain?: string; uri?: string }): WalletChallenge;
  /** Verifies a wallet challenge response. */
  verifyWalletChallenge(request: WalletVerificationRequest): Promise<WalletChallenge>;
  /** Creates or refreshes a session with sliding expiration. */
  createSession(params: { userId: string; authMode: AuthMode; walletAddress?: string | null }): AuthSession;
  /** Restores a valid session by id. */
  restoreSession(sessionId: string | null): AuthSession | null;
  /** Revokes a session. */
  revokeSession(sessionId: string | null): void;
  /** Links a wallet to an identity. */
  linkWallet(userId: string, walletAddress: string): TIdentity;
  /** Resolves whether an identity can satisfy an auth mode. */
  canSatisfyAuthMode(identity: Pick<AuthIdentityRecord, 'email' | 'emailVerified' | 'wallets'>, mode: AuthMode): boolean;
}

/**
 * Creates the default auth orchestrator used by shared UI flows.
 */
export function createAuthOrchestrator<TIdentity extends AuthIdentityRecord>(
  dependencies: AuthOrchestratorDependencies<TIdentity>,
): AuthOrchestrator<TIdentity> {
  const now = dependencies.now ?? (() => Date.now());
  const sessionTtlMs = dependencies.sessionTtlMs ?? 1000 * 60 * 60 * 24 * 30;
  const magicLinkTtlMs = dependencies.magicLinkTtlMs ?? 1000 * 60 * 15;
  const walletChallengeTtlMs = dependencies.walletChallengeTtlMs ?? 1000 * 60 * 5;
  const randomToken = dependencies.randomToken ?? (() => randomBytes(16).toString('hex'));

  function persistIdentity(identity: TIdentity): TIdentity {
    const identities = dependencies.listIdentities();
    const next = upsertRecord(identities, identity);
    dependencies.saveIdentities(next);
    return identity;
  }

  return {
    issueMagicLink(params) {
      const record: MagicLinkToken = {
        id: dependencies.uid('magic'),
        userId: params.userId ?? null,
        email: params.email.trim().toLowerCase(),
        purpose: params.purpose,
        token: `${params.purpose}_${randomToken()}`,
        requestedAt: now(),
        expiresAt: now() + magicLinkTtlMs,
        consumedAt: null,
      };
      dependencies.saveMagicLinks([record, ...dependencies.listMagicLinks()]);
      return record;
    },
    consumeMagicLink(token) {
      const records = dependencies.listMagicLinks();
      const record = records.find((entry) => entry.token === token);
      if (!record) {
        throw new Error('Magic link not found');
      }
      if (record.consumedAt) {
        throw new Error('Magic link has already been used');
      }
      if (record.expiresAt < now()) {
        throw new Error('Magic link has expired');
      }

      const consumed: MagicLinkToken = {
        ...record,
        consumedAt: now(),
      };
      dependencies.saveMagicLinks(upsertRecord(records, consumed));
      return consumed;
    },
    issueWalletChallenge(params) {
      const domain = params.domain ?? 'nfticket.local';
      const uri = params.uri ?? 'https://nfticket.local/auth';
      const nonce = randomToken();
      const issuedAt = now();
      const challenge: WalletChallenge = {
        id: dependencies.uid('challenge'),
        userId: params.userId ?? null,
        walletAddress: params.walletAddress,
        nonce,
        message: buildSiweStyleMessage({
          domain,
          uri,
          walletAddress: params.walletAddress,
          nonce,
          issuedAt,
        }),
        issuedAt,
        expiresAt: issuedAt + walletChallengeTtlMs,
        consumedAt: null,
      };
      dependencies.saveWalletChallenges([challenge, ...dependencies.listWalletChallenges()]);
      return challenge;
    },
    async verifyWalletChallenge(request) {
      if (request.challenge.expiresAt < now()) {
        throw new Error('Wallet challenge has expired');
      }
      if (request.challenge.consumedAt) {
        throw new Error('Wallet challenge has already been used');
      }
      if (request.signedMessage !== request.challenge.message) {
        throw new Error('Signed message does not match challenge');
      }

      const verified = dependencies.verifySignature
        ? await dependencies.verifySignature(request)
        : request.signature.trim().length > 0;
      if (!verified) {
        throw new Error('Wallet signature verification failed');
      }

      const consumed: WalletChallenge = {
        ...request.challenge,
        consumedAt: now(),
      };
      dependencies.saveWalletChallenges(upsertRecord(dependencies.listWalletChallenges(), consumed));
      return consumed;
    },
    createSession(params) {
      const current = now();
      const session: AuthSession = {
        id: dependencies.uid('session'),
        userId: params.userId,
        authMode: params.authMode,
        walletAddress: params.walletAddress ?? null,
        createdAt: current,
        expiresAt: current + sessionTtlMs,
        lastValidatedAt: current,
      };
      dependencies.saveSessions([session, ...dependencies.listSessions().filter((entry) => entry.userId !== params.userId)]);
      return session;
    },
    restoreSession(sessionId) {
      if (!sessionId) {
        return null;
      }
      const session = dependencies.listSessions().find((entry) => entry.id === sessionId);
      if (!session || session.expiresAt < now()) {
        return null;
      }

      const refreshed: AuthSession = {
        ...session,
        expiresAt: now() + sessionTtlMs,
        lastValidatedAt: now(),
      };
      dependencies.saveSessions(upsertRecord(dependencies.listSessions(), refreshed));
      return refreshed;
    },
    revokeSession(sessionId) {
      if (!sessionId) {
        return;
      }
      dependencies.saveSessions(dependencies.listSessions().filter((entry) => entry.id !== sessionId));
    },
    linkWallet(userId, walletAddress) {
      const identity = dependencies.listIdentities().find((entry) => entry.id === userId);
      if (!identity) {
        throw new Error('Identity not found');
      }

      const normalizedWallet = walletAddress.trim();
      if (!normalizedWallet) {
        throw new Error('Wallet address is required');
      }

      const updatedIdentity = {
        ...identity,
        wallets: Array.from(new Set([normalizedWallet, ...(identity.wallets ?? [])])),
        authMode: identity.email ? 'hybrid' : 'wallet',
      };
      return persistIdentity(updatedIdentity);
    },
    canSatisfyAuthMode(identity, mode) {
      if (mode === 'wallet') {
        return (identity.wallets ?? []).length > 0;
      }
      if (mode === 'email') {
        return Boolean(identity.email && identity.emailVerified);
      }
      return Boolean((identity.wallets ?? []).length > 0 || (identity.email && identity.emailVerified));
    },
  };
}

/**
 * Creates a deterministic SIWE-style message for wallet auth.
 */
export function buildSiweStyleMessage(params: {
  /** Domain requesting the signature. */
  domain: string;
  /** URI representing the auth endpoint. */
  uri: string;
  /** Wallet address expected to sign. */
  walletAddress: string;
  /** Anti-replay nonce. */
  nonce: string;
  /** Issuance timestamp in milliseconds. */
  issuedAt: number;
}): string {
  return [
    `${params.domain} wants you to sign in with your Solana account:`,
    params.walletAddress,
    '',
    'Authenticate to NFTicket',
    '',
    `URI: ${params.uri}`,
    'Version: 1',
    'Chain ID: solana:devnet',
    `Nonce: ${params.nonce}`,
    `Issued At: ${new Date(params.issuedAt).toISOString()}`,
  ].join('\n');
}

function upsertRecord<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((entry) => entry.id === record.id);
  if (index === -1) {
    return [record, ...records];
  }

  return records.map((entry, entryIndex) => (entryIndex === index ? record : entry));
}
