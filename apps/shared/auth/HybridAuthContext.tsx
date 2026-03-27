import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ensureSeedData } from '../lib/mockData';
import type {
  AdminRole,
  AuthMode,
  AuthProvider,
  AuthSessionRecord,
  AuthUser,
  MagicLinkRecord,
  UserRole,
} from '../lib/types';
import { hasPlatformAccess, normalizeUserRole } from '../lib/types';

interface HybridAuthContextValue {
  user: AuthUser | null;
  session: AuthSessionRecord | null;
  authMode: AuthMode | null;
  walletAddress: string | null;
  walletConnected: boolean;
  authReady: boolean;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  signUpWithCredentials: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  signInWithSocial: (provider: Exclude<AuthProvider, 'credentials'>, role: UserRole) => Promise<void>;
  requestMagicLink: (email: string, purpose?: MagicLinkRecord['purpose']) => Promise<MagicLinkRecord>;
  consumeMagicLink: (token: string) => Promise<void>;
  requestAccountRecovery: (email: string) => Promise<MagicLinkRecord>;
  signInWithWallet: () => Promise<void>;
  linkWallet: () => Promise<string>;
  hasAdminAccess: (role: AdminRole) => boolean;
  signOut: () => void;
}

type SessionValidationResponse = {
  valid: boolean;
  user: {
    id: string;
    email: string | null;
    role: string;
  };
};

type CurrentUserResponse = {
  id: string;
  email: string | null;
  displayName?: string | null;
  role: string;
  wallets?: string[];
  authMode?: AuthMode;
  kycStatus?: AuthUser['kycStatus'];
  createdAt?: number;
};

type WalletChallengeResponse = {
  id: string;
  message: string;
  walletAddress: string;
  expiresAt: number;
};

const HybridAuthContext = createContext<HybridAuthContextValue | undefined>(undefined);

export function HybridAuthProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSessionRecord | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    ensureSeedData();

    let cancelled = false;

    async function bootstrapSecureSession() {
      try {
        const validation = await postAuth<SessionValidationResponse>('session:validate');
        if (!validation.ok || !validation.data.valid) {
          if (!cancelled) {
            setUser(null);
            setSession(null);
          }
          return;
        }

        const profile = await postAuth<CurrentUserResponse>('user:get');
        if (!profile.ok || !profile.data) {
          if (!cancelled) {
            setUser(null);
            setSession(null);
          }
          return;
        }

        if (!cancelled) {
          const nextUser = toAuthUser(profile.data, validation.data.user);
          setUser(nextUser);
          setSession(toSessionRecord(nextUser));
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    }

    void bootstrapSecureSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<HybridAuthContextValue>(() => ({
    user,
    session,
    authMode: session?.authMode ?? user?.authMode ?? null,
    walletAddress: wallet.publicKey?.toBase58() ?? null,
    walletConnected: Boolean(wallet.publicKey),
    authReady,
    async signInWithCredentials(email, password) {
      const response = await postAuth('login', { email, password });
      if (!response.ok) {
        throw new Error(response.error ?? 'Invalid email or password');
      }

      const validation = await postAuth<SessionValidationResponse>('session:validate');
      const profile = await postAuth<CurrentUserResponse>('user:get');
      if (!validation.ok || !validation.data.valid || !profile.ok || !profile.data) {
        throw new Error('Session established but user profile could not be loaded');
      }

      const nextUser = toAuthUser(profile.data, validation.data.user);
      setUser(nextUser);
      setSession(toSessionRecord(nextUser));
      setAuthReady(true);
    },
    async signUpWithCredentials(name, email, password, role) {
      void role;
      const response = await postAuth('register', { email, password, displayName: name });
      if (!response.ok) {
        throw new Error(response.error ?? 'Registration failed');
      }

      const validation = await postAuth<SessionValidationResponse>('session:validate');
      const profile = await postAuth<CurrentUserResponse>('user:get');
      if (!validation.ok || !validation.data.valid || !profile.ok || !profile.data) {
        throw new Error('Account created but user profile could not be loaded');
      }

      const nextUser = toAuthUser(profile.data, validation.data.user);
      setUser(nextUser);
      setSession(toSessionRecord(nextUser));
      setAuthReady(true);
    },
    async signInWithSocial() {
      throw new Error('Social sign-in is not available in the secure session flow.');
    },
    async requestMagicLink() {
      throw new Error('Magic-link authentication is not available in the secure session flow.');
    },
    async consumeMagicLink() {
      throw new Error('Magic-link authentication is not available in the secure session flow.');
    },
    async requestAccountRecovery() {
      throw new Error('Account recovery is not available in the secure session flow.');
    },
    async signInWithWallet() {
      const walletAddress = await ensureWalletSignatureReady(wallet);
      const challenge = await postAuth<WalletChallengeResponse>('wallet:challenge', {
        walletAddress,
        purpose: 'sign_in',
      });
      if (!challenge.ok || !challenge.data?.message || !challenge.data?.id) {
        throw new Error(challenge.error ?? 'Unable to issue wallet sign-in challenge');
      }

      const signature = await signWalletMessage(wallet, challenge.data.message);
      const response = await postAuth('wallet:sign-in', {
        walletAddress,
        challengeId: challenge.data.id,
        signature,
      });
      if (!response.ok) {
        throw new Error(response.error ?? 'Wallet sign-in failed');
      }

      const validation = await postAuth<SessionValidationResponse>('session:validate');
      const profile = await postAuth<CurrentUserResponse>('user:get');
      if (!validation.ok || !validation.data.valid || !profile.ok || !profile.data) {
        throw new Error('Wallet session established but user profile could not be loaded');
      }

      const nextUser = toAuthUser(profile.data, validation.data.user);
      setUser(nextUser);
      setSession(toSessionRecord(nextUser));
      setAuthReady(true);
    },
    async linkWallet() {
      if (!user) {
        throw new Error('Authentication required');
      }

      const walletAddress = await ensureWalletSignatureReady(wallet);
      const challenge = await postAuth<WalletChallengeResponse>('wallet:challenge', {
        walletAddress,
        purpose: 'link_wallet',
      });
      if (!challenge.ok || !challenge.data?.message || !challenge.data?.id) {
        throw new Error(challenge.error ?? 'Unable to issue wallet-link challenge');
      }

      const signature = await signWalletMessage(wallet, challenge.data.message);
      const response = await postAuth('wallet:link', {
        walletAddress,
        challengeId: challenge.data.id,
        signature,
      });
      if (!response.ok) {
        throw new Error(response.error ?? 'Wallet linking failed');
      }

      const profile = await postAuth<CurrentUserResponse>('user:get');
      if (!profile.ok || !profile.data) {
        throw new Error('Wallet linked but user profile could not be refreshed');
      }

      const nextUser = toAuthUser(profile.data, {
        id: user.id,
        email: user.email,
        role: user.role,
      });
      setUser(nextUser);
      setSession(toSessionRecord(nextUser));
      return walletAddress;
    },
    hasAdminAccess(role) {
      return Boolean(user && hasPlatformAccess(user.role) && (user.adminRoles.includes(role) || user.adminRoles.length === 0));
    },
    signOut() {
      setUser(null);
      setSession(null);
      setAuthReady(true);
      void postAuth('logout');
    },
  }), [authReady, session, user, wallet]);

  return <HybridAuthContext.Provider value={value}>{children}</HybridAuthContext.Provider>;
}

export function useHybridAuth() {
  const context = useContext(HybridAuthContext);
  if (!context) {
    throw new Error('useHybridAuth must be used within HybridAuthProvider');
  }
  return context;
}

async function postAuth<T = Record<string, never>>(action: string, body?: Record<string, unknown>): Promise<{
  ok: boolean;
  data: T;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        action,
        ...(body ?? {}),
      }),
    });

    const payload = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null;

    if (!response.ok) {
      return {
        ok: false,
        data: {} as T,
        error: typeof payload?.error === 'string' ? payload.error : `Authentication request failed (${response.status})`,
      };
    }

    return {
      ok: true,
      data: (payload ?? {}) as T,
    };
  } catch {
    return {
      ok: false,
      data: {} as T,
      error: 'Authentication request failed',
    };
  }
}

function toAuthUser(profile: CurrentUserResponse, sessionUser: SessionValidationResponse['user']): AuthUser {
  const email = profile.email ?? sessionUser.email ?? `${profile.id}@nfticket.local`;
  const wallets = profile.wallets ?? [];
  const role = normalizeUserRole(profile.role || sessionUser.role);
  const authMode = normalizeAuthMode(profile.authMode);
  const createdAt = profile.createdAt ?? Date.now();

  return {
    id: profile.id,
    name: profile.displayName?.trim() || email.split('@')[0] || 'NFTicket User',
    email,
    provider: 'credentials',
    role,
    emailVerified: true,
    wallets,
    linkedWallets: wallets,
    authMode,
    kycStatus: profile.kycStatus ?? 'not_required',
    adminRoles: role === 'admin' ? ['support', 'finance', 'auth', 'operations'] : [],
    createdAt,
    updatedAt: Date.now(),
    lastLoginAt: Date.now(),
  };
}

function toSessionRecord(user: AuthUser): AuthSessionRecord {
  const now = Date.now();
  return {
    id: `secure:${user.id}`,
    userId: user.id,
    authMode: user.authMode,
    walletAddress: user.linkedWallets[0] ?? null,
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    lastValidatedAt: now,
  };
}

function normalizeAuthMode(authMode: string | null | undefined): AuthMode {
  if (authMode === 'wallet' || authMode === 'hybrid' || authMode === 'email') {
    return authMode;
  }

  return 'email';
}

async function ensureWalletSignatureReady(wallet: ReturnType<typeof useWallet>): Promise<string> {
  if (!wallet.connected) {
    await wallet.connect();
  }

  const walletAddress = wallet.publicKey?.toBase58();
  if (!walletAddress) {
    throw new Error('Wallet not connected');
  }
  if (!wallet.signMessage) {
    throw new Error('Connected wallet does not support message signing');
  }

  return walletAddress;
}

async function signWalletMessage(
  wallet: ReturnType<typeof useWallet>,
  message: string,
): Promise<string> {
  if (!wallet.signMessage) {
    throw new Error('Connected wallet does not support message signing');
  }

  const signature = await wallet.signMessage(new TextEncoder().encode(message));
  return bytesToBase64(signature);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
  }

  return Buffer.from(bytes).toString('base64');
}
