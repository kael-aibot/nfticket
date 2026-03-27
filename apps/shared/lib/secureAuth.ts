import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { buildSiweStyleMessage } from '../../../lib/auth';
import type { AuthMode, UserRole, WalletChallengeRecord } from './types';
import { normalizeUserRole } from './types';
import { getPrismaClient } from './prisma';
import { ApiError } from './apiErrors';

// Security configuration
const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_HOURS = 24 * 7; // 7 days
const MAX_SESSIONS_PER_USER = 5;
const WALLET_CHALLENGE_DURATION_MS = 5 * 60 * 1000;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

// JWT-like token structure: base64(header).base64(payload).signature
// Using a simple signed token approach instead of full JWT for simplicity

interface SessionToken {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

type WalletChallengePurpose = 'sign_in' | 'link_wallet';

interface StoredWalletChallenge extends WalletChallengeRecord {
  purpose: WalletChallengePurpose;
}

interface WalletChallengeOptions {
  walletAddress: string;
  purpose: WalletChallengePurpose;
  userId?: string | null;
  domain?: string;
  uri?: string;
}

interface VerifyWalletChallengeOptions {
  challengeId: string;
  walletAddress: string;
  signature: string;
  purpose: WalletChallengePurpose;
  userId?: string | null;
}

/**
 * Hash a password using PBKDF2 (native Node.js, no external deps)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(':');
  if (!salt || !storedHash) return false;
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash));
}

function isPasswordHash(value: string): boolean {
  const [salt, storedHash] = value.split(':');
  return Boolean(salt && storedHash && /^[a-f0-9]+$/i.test(storedHash));
}

async function verifyStoredPassword(password: string, storedPassword: string): Promise<boolean> {
  if (isPasswordHash(storedPassword)) {
    return verifyPassword(password, storedPassword);
  }

  const passwordBuffer = Buffer.from(password);
  const storedBuffer = Buffer.from(storedPassword);
  return passwordBuffer.length === storedBuffer.length && crypto.timingSafeEqual(passwordBuffer, storedBuffer);
}

function readStoredPassword(metadata: { passwordHash?: string; password?: string } | null): string | null {
  return metadata?.passwordHash ?? metadata?.password ?? null;
}

function normalizeWalletAddress(walletAddress: string): string {
  try {
    return new PublicKey(walletAddress).toBase58();
  } catch {
    throw ApiError.badRequest('Invalid wallet address', 'INVALID_WALLET_ADDRESS');
  }
}

function decodeWalletSignature(signature: string): Uint8Array {
  const trimmed = signature.trim();
  if (!trimmed) {
    throw ApiError.unauthorized('Wallet signature required', 'INVALID_WALLET_SIGNATURE');
  }

  const looksBase64 = /[+/=]/.test(trimmed);
  const decoders = looksBase64
    ? [
        () => Buffer.from(trimmed, 'base64'),
        () => Buffer.from(bs58.decode(trimmed)),
      ]
    : [
        () => Buffer.from(bs58.decode(trimmed)),
        () => Buffer.from(trimmed, 'base64'),
      ];

  for (const decode of decoders) {
    try {
      const decoded = decode();
      if (decoded.length === 64) {
        return new Uint8Array(decoded);
      }
    } catch {
      // Ignore and try the next supported encoding.
    }
  }

  throw ApiError.unauthorized('Invalid wallet signature', 'INVALID_WALLET_SIGNATURE');
}

function publicKeyToSpki(publicKeyBytes: Uint8Array): Buffer {
  return Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]);
}

async function readWalletChallenges(): Promise<StoredWalletChallenge[]> {
  const prisma = getPrismaClient();
  const state = await prisma.appState.findUnique({
    where: { key: 'walletChallenges' },
  });

  if (!state?.value || !Array.isArray(state.value)) {
    return [];
  }

  return state.value as unknown as StoredWalletChallenge[];
}

async function writeWalletChallenges(challenges: StoredWalletChallenge[]): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.appState.upsert({
    where: { key: 'walletChallenges' },
    create: { key: 'walletChallenges', value: challenges as unknown as Prisma.InputJsonValue },
    update: { value: challenges as unknown as Prisma.InputJsonValue },
  });
}

function resolveWalletChallengeContext(options?: Pick<WalletChallengeOptions, 'domain' | 'uri'>): {
  domain: string;
  uri: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (options?.domain && options.uri) {
    return { domain: options.domain, uri: options.uri };
  }

  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      return {
        domain: options?.domain ?? parsed.host,
        uri: options?.uri ?? `${parsed.origin}/api/auth`,
      };
    } catch {
      // Fall through to defaults below.
    }
  }

  return {
    domain: options?.domain ?? 'nfticket.local',
    uri: options?.uri ?? 'https://nfticket.local/api/auth',
  };
}

export async function issueWalletChallenge(options: WalletChallengeOptions): Promise<StoredWalletChallenge> {
  const walletAddress = normalizeWalletAddress(options.walletAddress);
  const { domain, uri } = resolveWalletChallengeContext(options);
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const challenge: StoredWalletChallenge = {
    id: crypto.randomUUID(),
    userId: options.userId ?? null,
    walletAddress,
    nonce,
    message: buildSiweStyleMessage({
      domain,
      uri,
      walletAddress,
      nonce,
      issuedAt,
    }),
    issuedAt,
    expiresAt: issuedAt + WALLET_CHALLENGE_DURATION_MS,
    consumedAt: null,
    purpose: options.purpose,
  };

  const challenges = await readWalletChallenges();
  await writeWalletChallenges([challenge, ...challenges.filter((entry) => entry.expiresAt >= issuedAt)]);
  return challenge;
}

export async function verifySignature(
  walletAddress: string,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const signatureBytes = decodeWalletSignature(signature);
    const messageBytes = new TextEncoder().encode(message);

    return crypto.verify(
      null,
      Buffer.from(messageBytes),
      {
        key: publicKeyToSpki(publicKey.toBytes()),
        format: 'der',
        type: 'spki',
      },
      Buffer.from(signatureBytes),
    );
  } catch {
    return false;
  }
}

export async function verifyWalletChallenge(options: VerifyWalletChallengeOptions): Promise<StoredWalletChallenge> {
  const walletAddress = normalizeWalletAddress(options.walletAddress);
  const challenges = await readWalletChallenges();
  const challenge = challenges.find((entry) => entry.id === options.challengeId);

  if (!challenge) {
    throw ApiError.unauthorized('Wallet challenge not found', 'WALLET_CHALLENGE_NOT_FOUND');
  }
  if (challenge.purpose !== options.purpose) {
    throw ApiError.unauthorized('Wallet challenge purpose mismatch', 'WALLET_CHALLENGE_MISMATCH');
  }
  if (challenge.walletAddress !== walletAddress) {
    throw ApiError.unauthorized('Wallet challenge wallet mismatch', 'WALLET_CHALLENGE_MISMATCH');
  }
  if (challenge.userId && challenge.userId !== (options.userId ?? null)) {
    throw ApiError.unauthorized('Wallet challenge user mismatch', 'WALLET_CHALLENGE_MISMATCH');
  }
  if (challenge.consumedAt) {
    throw ApiError.unauthorized('Wallet challenge has already been used', 'WALLET_CHALLENGE_CONSUMED');
  }
  if (challenge.expiresAt < Date.now()) {
    throw ApiError.unauthorized('Wallet challenge has expired', 'WALLET_CHALLENGE_EXPIRED');
  }

  const verified = await verifySignature(challenge.walletAddress, challenge.message, options.signature);
  if (!verified) {
    throw ApiError.unauthorized('Wallet signature verification failed', 'INVALID_WALLET_SIGNATURE');
  }

  const consumedChallenge: StoredWalletChallenge = {
    ...challenge,
    consumedAt: Date.now(),
  };
  await writeWalletChallenges(
    challenges.map((entry) => (entry.id === consumedChallenge.id ? consumedChallenge : entry)),
  );

  return consumedChallenge;
}

/**
 * Generate a cryptographically secure session token
 */
function generateToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/**
 * Sign a session token with the secret
 */
function signToken(payload: SessionToken): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw ApiError.serviceUnavailable(
      'Session authentication is not configured',
      'AUTH_CONFIGURATION_ERROR',
    );
  }

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a session token
 */
function verifyToken(token: string): SessionToken | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw ApiError.serviceUnavailable(
      'Session authentication is not configured',
      'AUTH_CONFIGURATION_ERROR',
    );
  }
  
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [payloadB64, signature] = parts;
  
  try {
    const payloadBuffer = Buffer.from(payloadB64, 'base64url');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    // Accept legacy tokens signed over raw JSON bytes.
    const legacySignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBuffer)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const isCurrentSignature =
      signatureBuffer.length === Buffer.byteLength(expectedSignature) &&
      crypto.timingSafeEqual(signatureBuffer, Buffer.from(expectedSignature));
    const isLegacySignature =
      signatureBuffer.length === Buffer.byteLength(legacySignature) &&
      crypto.timingSafeEqual(signatureBuffer, Buffer.from(legacySignature));

    if (!isCurrentSignature && !isLegacySignature) {
      return null;
    }
    
    // Decode payload
    const payload = JSON.parse(payloadBuffer.toString());
    
    // Check expiration
    if (payload.expiresAt < Date.now()) {
      throw ApiError.unauthorized('Session has expired', 'SESSION_EXPIRED');
    }
    
    return payload as SessionToken;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    return null;
  }
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  metadata?: { ip?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const prisma = getPrismaClient();
  
  // Clean up old sessions if at limit
  const existingSessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  
  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    const toDelete = existingSessions.slice(0, existingSessions.length - MAX_SESSIONS_PER_USER + 1);
    await prisma.session.deleteMany({
      where: { id: { in: toDelete.map(s => s.id) } },
    });
  }
  
  // Create new session
  const sessionId = crypto.randomUUID();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token,
      expiresAt,
    },
  });
  
  // Create signed token for client
  const signedToken = signToken({
    userId,
    sessionId,
    expiresAt: expiresAt.getTime(),
  });
  
  return { token: signedToken, expiresAt };
}

/**
 * Verify a session token and return the user
 */
export async function verifySession(token: string): Promise<{
  userId: string;
  sessionId: string;
  role: UserRole;
  email: string | null;
} | null> {
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const prisma = getPrismaClient();
  
  // Verify session exists in database
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: { select: { id: true, role: true, email: true } } },
  });
  
  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session has expired', 'SESSION_EXPIRED');
  }
  
  return {
    userId: session.user.id,
    sessionId: session.id,
    role: normalizeUserRole(session.user.role),
    email: session.user.email,
  };
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Login with email/password
 */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; email: string; role: UserRole } }> {
  const prisma = getPrismaClient();
  
  const user = await prisma.userIdentity.findUnique({
    where: { email },
  });
  
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }
  
  // Support both hashed and legacy plaintext demo passwords during transition.
  const metadata = user.metadata as { passwordHash?: string; password?: string } | null;
  const storedPassword = readStoredPassword(metadata);
  if (!storedPassword) {
    throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }
  
  const valid = await verifyStoredPassword(password, storedPassword);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  if (!isPasswordHash(storedPassword)) {
    const { password: legacyPassword, ...restMetadata } = metadata ?? {};
    void legacyPassword;
    await prisma.userIdentity.update({
      where: { id: user.id },
      data: {
        metadata: { ...restMetadata, passwordHash: await hashPassword(password) },
      },
    });
  }
  
  const session = await createSession(user.id);

  return {
    token: session.token,
    user: {
      id: user.id,
      email: user.email!,
      role: normalizeUserRole(user.role),
    },
  };
}

export async function signInWithWallet(
  challengeId: string,
  walletAddress: string,
  signature: string,
): Promise<{ token: string; user: { id: string; email: string | null; role: UserRole } }> {
  const prisma = getPrismaClient();
  const normalizedWallet = normalizeWalletAddress(walletAddress);

  await verifyWalletChallenge({
    challengeId,
    walletAddress: normalizedWallet,
    signature,
    purpose: 'sign_in',
  });

  let user = await prisma.userIdentity.findFirst({
    where: {
      OR: [
        { primaryWallet: normalizedWallet },
        { wallets: { has: normalizedWallet } },
      ],
    },
  });

  if (!user) {
    user = await prisma.userIdentity.create({
      data: {
        id: crypto.randomUUID(),
        email: null,
        displayName: `Wallet ${normalizedWallet.slice(0, 4)}...${normalizedWallet.slice(-4)}`,
        primaryWallet: normalizedWallet,
        wallets: [normalizedWallet],
        authMode: 'wallet',
        role: 'buyer',
        metadata: {},
      },
    });
  }

  const session = await createSession(user.id);

  return {
    token: session.token,
    user: {
      id: user.id,
      email: user.email,
      role: normalizeUserRole(user.role),
    },
  };
}

export async function linkWallet(
  userId: string,
  challengeId: string,
  walletAddress: string,
  signature: string,
): Promise<{ id: string; wallets: string[]; primaryWallet: string | null; authMode: string }> {
  const prisma = getPrismaClient();
  const normalizedWallet = normalizeWalletAddress(walletAddress);

  await verifyWalletChallenge({
    challengeId,
    walletAddress: normalizedWallet,
    signature,
    purpose: 'link_wallet',
    userId,
  });

  const [user, existingWalletOwner] = await Promise.all([
    prisma.userIdentity.findUnique({ where: { id: userId } }),
    prisma.userIdentity.findFirst({
      where: {
        OR: [
          { primaryWallet: normalizedWallet },
          { wallets: { has: normalizedWallet } },
        ],
      },
    }),
  ]);

  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }
  if (existingWalletOwner && existingWalletOwner.id !== userId) {
    throw ApiError.badRequest('Wallet is already linked to another account', 'WALLET_ALREADY_LINKED');
  }

  const nextWallets = Array.from(new Set([...(user.wallets ?? []), normalizedWallet]));
  const nextAuthMode: AuthMode = user.email ? 'hybrid' : 'wallet';
  const updated = await prisma.userIdentity.update({
    where: { id: userId },
    data: {
      wallets: nextWallets,
      primaryWallet: user.primaryWallet ?? normalizedWallet,
      authMode: nextAuthMode,
    },
  });

  return {
    id: updated.id,
    wallets: updated.wallets,
    primaryWallet: updated.primaryWallet,
    authMode: updated.authMode,
  };
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string,
  displayName?: string
): Promise<{ token: string; user: { id: string; email: string; role: UserRole } }> {
  const prisma = getPrismaClient();
  
  // Check if user exists
  const existing = await prisma.userIdentity.findUnique({
    where: { email },
  });
  
  if (existing) {
    throw ApiError.badRequest('Email already registered', 'EMAIL_EXISTS');
  }
  
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  
  const user = await prisma.userIdentity.create({
    data: {
      id: userId,
      email,
      displayName: displayName || null,
      authMode: 'email',
      role: 'buyer',
      wallets: [],
      metadata: { passwordHash },
    },
  });
  
  const session = await createSession(user.id);
  
  return {
    token: session.token,
    user: {
      id: user.id,
      email: user.email!,
      role: normalizeUserRole(user.role),
    },
  };
}

/**
 * Change user password
 */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const prisma = getPrismaClient();
  
  const user = await prisma.userIdentity.findUnique({
    where: { id: userId },
  });
  
  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }
  
  const metadata = user.metadata as { passwordHash?: string; password?: string } | null;
  const storedPassword = readStoredPassword(metadata);
  if (!storedPassword) {
    throw ApiError.badRequest('No password set', 'NO_PASSWORD');
  }
  
  const valid = await verifyStoredPassword(oldPassword, storedPassword);
  if (!valid) {
    throw ApiError.unauthorized('Invalid current password', 'INVALID_PASSWORD');
  }
  
  const newHash = await hashPassword(newPassword);
  const { password: legacyPassword, ...restMetadata } = metadata ?? {};
  void legacyPassword;
  
  await prisma.userIdentity.update({
    where: { id: userId },
    data: {
      metadata: { ...restMetadata, passwordHash: newHash },
    },
  });
  
  // Revoke all sessions except current (requires session tracking)
  await revokeAllUserSessions(userId);
}

// Export for use in other modules
export { signToken, verifyToken };
