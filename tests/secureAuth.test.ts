import crypto from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  issueWalletChallenge,
  linkWallet,
  signInWithWallet,
  verifySignature,
  verifySession,
  verifyToken,
} from '../apps/shared/lib/secureAuth';
import { prismaMock } from './utils/prismaMock';

describe('secureAuth security paths', () => {
  beforeEach(() => {
    prismaMock.appState.findUnique.mockResolvedValue(null);
    prismaMock.appState.upsert.mockResolvedValue(undefined);
    prismaMock.session.findMany.mockResolvedValue([]);
    prismaMock.session.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.session.create.mockResolvedValue(undefined);
    prismaMock.session.findUnique.mockResolvedValue({
      id: 'session_123',
      userId: 'user_123',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user_123',
        role: 'buyer',
        email: 'user@example.com',
      },
    });
    prismaMock.userIdentity.findUnique.mockResolvedValue({
      id: 'user_123',
      email: 'user@example.com',
      primaryWallet: null,
      wallets: [],
      authMode: 'email',
      role: 'buyer',
    });
    prismaMock.userIdentity.findFirst.mockResolvedValue(null);
    prismaMock.userIdentity.create.mockImplementation(async ({ data }) => ({
      ...data,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    prismaMock.userIdentity.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      email: 'user@example.com',
      role: 'buyer',
      wallets: data.wallets ?? [],
      primaryWallet: data.primaryWallet ?? null,
      authMode: data.authMode ?? 'email',
    }));
  });

  it('creates a signed session token that verifies end to end', async () => {
    const { token } = await createSession('user_123');

    const payload = verifyToken(token);
    const session = await verifySession(token);

    expect(payload).toMatchObject({
      userId: 'user_123',
      sessionId: expect.any(String),
    });
    expect(payload?.expiresAt).toBeGreaterThan(Date.now());
    expect(session).toEqual({
      userId: 'user_123',
      sessionId: 'session_123',
      role: 'buyer',
      email: 'user@example.com',
    });
  });

  it('rejects a validly signed token when the backing session record is missing', async () => {
    const { token } = await createSession('user_123');
    prismaMock.session.findUnique.mockResolvedValueOnce(null);

    await expect(verifySession(token)).resolves.toBeNull();
  });

  it('verifies a valid Solana wallet signature only for the original challenge message', async () => {
    const keypair = createWalletKeypair();
    const message = 'Authenticate to NFTicket';
    const signature = signWalletMessage(keypair.privateKey, message);

    await expect(verifySignature(keypair.walletAddress, message, signature)).resolves.toBe(true);
    await expect(verifySignature(keypair.walletAddress, `${message} tampered`, signature)).resolves.toBe(false);
  });

  it('rejects wallet sign-in when the signature does not match the issued challenge', async () => {
    const keypair = createWalletKeypair();
    const challenge = await issueWalletChallenge({
      walletAddress: keypair.walletAddress,
      purpose: 'sign_in',
    });

    await expect(
      signInWithWallet(challenge.id, challenge.walletAddress, Buffer.from('bad-signature').toString('base64')),
    ).rejects.toMatchObject({
      code: 'INVALID_WALLET_SIGNATURE',
    });
  });

  it('creates a wallet-backed session only after a valid challenge signature', async () => {
    const keypair = createWalletKeypair();
    const challenge = await issueWalletChallenge({
      walletAddress: keypair.walletAddress,
      purpose: 'sign_in',
    });
    const signature = signWalletMessage(keypair.privateKey, challenge.message);

    const result = await signInWithWallet(challenge.id, challenge.walletAddress, signature);

    expect(result.user).toMatchObject({
      email: null,
      role: 'buyer',
    });
    expect(prismaMock.userIdentity.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.session.create).toHaveBeenCalledTimes(1);
  });

  it('binds wallet linking challenges to the authenticated user', async () => {
    const keypair = createWalletKeypair();
    const challenge = await issueWalletChallenge({
      walletAddress: keypair.walletAddress,
      purpose: 'link_wallet',
      userId: 'user_123',
    });
    const signature = signWalletMessage(keypair.privateKey, challenge.message);

    await expect(linkWallet('user_456', challenge.id, challenge.walletAddress, signature)).rejects.toMatchObject({
      code: 'WALLET_CHALLENGE_MISMATCH',
    });
  });
});

function createWalletKeypair(): {
  walletAddress: string;
  privateKey: crypto.KeyObject;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });

  return {
    walletAddress: new PublicKey(publicKeyDer.subarray(-32)).toBase58(),
    privateKey,
  };
}

function signWalletMessage(privateKey: crypto.KeyObject, message: string): string {
  return crypto.sign(null, Buffer.from(message), privateKey).toString('base64');
}
