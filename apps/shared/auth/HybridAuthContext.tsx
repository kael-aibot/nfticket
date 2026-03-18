import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createAuthOrchestrator } from '../../../lib/auth';
import { ensureSeedData } from '../lib/mockData';
import {
  getAuthSessions,
  getMagicLinks,
  getSessionUserId,
  getUsers,
  getWalletChallenges,
  saveAuthSessions,
  saveMagicLinks,
  saveSessionUserId,
  saveUsers,
  saveWalletChallenges,
  uid,
} from '../lib/storage';
import type {
  AdminRole,
  AuthMode,
  AuthProvider,
  AuthSessionRecord,
  AuthUser,
  MagicLinkRecord,
  UserRole,
  WalletChallengeRecord,
} from '../lib/types';

interface HybridAuthContextValue {
  user: AuthUser | null;
  session: AuthSessionRecord | null;
  authMode: AuthMode | null;
  walletAddress: string | null;
  walletConnected: boolean;
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

const HybridAuthContext = createContext<HybridAuthContextValue | undefined>(undefined);

export function HybridAuthProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSessionRecord | null>(null);

  const auth = useMemo(() => createAuthOrchestrator<AuthUser>({
    listIdentities: getUsers,
    saveIdentities: saveUsers,
    listSessions: getAuthSessions,
    saveSessions: saveAuthSessions,
    listMagicLinks: getMagicLinks,
    saveMagicLinks,
    listWalletChallenges: getWalletChallenges,
    saveWalletChallenges,
    uid,
    verifySignature: async ({ signature, signedMessage, challenge }) =>
      signature.trim().length > 0 && signedMessage === challenge.message,
  }), []);

  function persistUser(nextUser: AuthUser) {
    const users = getUsers();
    saveUsers(users.map((item) => (item.id === nextUser.id ? nextUser : item)));
    setUser(nextUser);
  }

  function openSession(nextUser: AuthUser, authMode: AuthMode, walletAddress?: string | null) {
    const nextSession = auth.createSession({
      userId: nextUser.id,
      authMode,
      walletAddress: walletAddress ?? null,
    });
    saveSessionUserId(nextUser.id);
    setUser(nextUser);
    setSession(nextSession);
    return nextSession;
  }

  useEffect(() => {
    ensureSeedData();
    const users = getUsers();
    const sessionUserId = getSessionUserId();
    const nextUser = users.find((item) => item.id === sessionUserId) ?? null;
    setUser(nextUser);
    const nextSession = getAuthSessions().find((item) => item.userId === sessionUserId) ?? null;
    setSession(nextSession ? auth.restoreSession(nextSession.id) : null);
  }, [auth]);

  const value = useMemo<HybridAuthContextValue>(() => ({
    user,
    session,
    authMode: session?.authMode ?? user?.authMode ?? null,
    walletAddress: wallet.publicKey?.toBase58() ?? null,
    walletConnected: Boolean(wallet.publicKey),
    async signInWithCredentials(email, password) {
      const existing = getUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
      if (!existing || existing.password !== password) {
        throw new Error('Invalid email or password');
      }
      const nextUser: AuthUser = {
        ...existing,
        emailVerified: true,
        authMode: existing.linkedWallets.length > 0 ? 'hybrid' : 'email',
        lastLoginAt: Date.now(),
        updatedAt: Date.now(),
      };
      persistUser(nextUser);
      openSession(nextUser, nextUser.authMode);
    },
    async signUpWithCredentials(name, email, password, role) {
      const users = getUsers();
      const duplicate = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
      if (duplicate) {
        throw new Error('Email is already registered');
      }
      const createdUser: AuthUser = {
        id: uid('user'),
        name,
        email,
        password,
        provider: 'credentials',
        role,
        emailVerified: false,
        wallets: [],
        linkedWallets: [],
        authMode: 'email',
        kycStatus: 'not_required',
        adminRoles: role === 'admin' ? ['support', 'finance', 'auth', 'operations'] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      saveUsers([createdUser, ...users]);
      openSession(createdUser, 'email');
    },
    async signInWithSocial(provider, role) {
      const email = `${provider}.${role}@nfticket.app`;
      const users = getUsers();
      let socialUser = users.find((item) => item.email === email);
      if (!socialUser) {
        socialUser = {
          id: uid('user'),
          name: `${provider[0].toUpperCase()}${provider.slice(1)} ${role === 'provider' ? 'Organizer' : 'Buyer'}`,
          email,
          provider,
          role,
          emailVerified: true,
          wallets: [],
          linkedWallets: [],
          authMode: 'email',
          kycStatus: 'not_required',
          adminRoles: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        saveUsers([socialUser, ...users]);
      }
      const nextUser: AuthUser = {
        ...socialUser,
        emailVerified: true,
        authMode: socialUser.linkedWallets.length > 0 ? 'hybrid' : 'email',
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      persistUser(nextUser);
      openSession(nextUser, nextUser.authMode);
    },
    async requestMagicLink(email, purpose = 'sign_in') {
      const existing = getUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
      return auth.issueMagicLink({
        email,
        purpose,
        userId: existing?.id ?? null,
      });
    },
    async consumeMagicLink(token) {
      const link = auth.consumeMagicLink(token);
      let nextUser = getUsers().find((item) => item.id === link.userId)
        ?? getUsers().find((item) => item.email.toLowerCase() === link.email.toLowerCase())
        ?? null;

      if (!nextUser) {
        nextUser = {
          id: uid('user'),
          name: link.email.split('@')[0] || 'NFTicket User',
          email: link.email,
          provider: 'credentials',
          role: 'buyer',
          emailVerified: true,
          wallets: [],
          linkedWallets: [],
          authMode: 'email',
          kycStatus: 'not_required',
          adminRoles: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        saveUsers([nextUser, ...getUsers()]);
      } else {
        nextUser = {
          ...nextUser,
          emailVerified: true,
          authMode: nextUser.linkedWallets.length > 0 ? 'hybrid' : 'email',
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        persistUser(nextUser);
      }

      openSession(nextUser, nextUser.linkedWallets.length > 0 ? 'hybrid' : 'email');
    },
    async requestAccountRecovery(email) {
      const existing = getUsers().find((item) => item.email.toLowerCase() === email.toLowerCase());
      if (!existing) {
        throw new Error('No account exists for that email');
      }
      return auth.issueMagicLink({
        email,
        purpose: 'account_recovery',
        userId: existing.id,
      });
    },
    async signInWithWallet() {
      if (!wallet.publicKey) {
        throw new Error('Connect a wallet to sign in');
      }
      if (!wallet.signMessage) {
        throw new Error('Connected wallet does not support message signing');
      }

      const walletAddress = wallet.publicKey.toBase58();
      const challenge = auth.issueWalletChallenge({
        walletAddress,
        userId: user?.id ?? null,
      });
      const signedBytes = await wallet.signMessage(new TextEncoder().encode(challenge.message));
      const signature = bytesToBase64(signedBytes);
      await auth.verifyWalletChallenge({
        challenge,
        signature,
        signedMessage: challenge.message,
      });

      let nextUser = getUsers().find((item) => item.linkedWallets.includes(walletAddress)) ?? user ?? null;
      if (!nextUser) {
        nextUser = {
          id: uid('user'),
          name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
          email: `${walletAddress.toLowerCase()}@wallet.nfticket.local`,
          provider: 'credentials',
          role: 'buyer',
          emailVerified: false,
          wallets: [walletAddress],
          linkedWallets: [walletAddress],
          authMode: 'wallet',
          kycStatus: 'not_required',
          adminRoles: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        saveUsers([nextUser, ...getUsers()]);
      } else if (!nextUser.linkedWallets.includes(walletAddress)) {
        nextUser = {
          ...auth.linkWallet(nextUser.id, walletAddress),
          linkedWallets: Array.from(new Set([walletAddress, ...nextUser.linkedWallets])),
          updatedAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        persistUser(nextUser);
      }

      openSession(nextUser, nextUser.emailVerified ? 'hybrid' : 'wallet', walletAddress);
    },
    async linkWallet() {
      if (!user) {
        throw new Error('Sign in before linking a wallet');
      }
      if (!wallet.publicKey) {
        throw new Error('Connect a wallet to link it');
      }
      if (!wallet.signMessage) {
        throw new Error('Connected wallet does not support message signing');
      }

      const walletAddress = wallet.publicKey.toBase58();
      const challenge = auth.issueWalletChallenge({
        walletAddress,
        userId: user.id,
      });
      const signedBytes = await wallet.signMessage(new TextEncoder().encode(challenge.message));
      await auth.verifyWalletChallenge({
        challenge,
        signature: bytesToBase64(signedBytes),
        signedMessage: challenge.message,
      });

      const linked = auth.linkWallet(user.id, walletAddress);
      const nextUser: AuthUser = {
        ...linked,
        linkedWallets: linked.wallets,
        authMode: linked.emailVerified ? 'hybrid' : 'wallet',
        updatedAt: Date.now(),
      };
      persistUser(nextUser);
      if (session) {
        openSession(nextUser, nextUser.authMode, walletAddress);
      }
      return walletAddress;
    },
    hasAdminAccess(role) {
      return user?.role === 'admin' && (user.adminRoles.includes(role) || user.adminRoles.length === 0);
    },
    signOut() {
      if (session) {
        auth.revokeSession(session.id);
      }
      saveSessionUserId(null);
      setUser(null);
      setSession(null);
    },
  }), [auth, session, user, wallet]);

  return <HybridAuthContext.Provider value={value}>{children}</HybridAuthContext.Provider>;
}

export function useHybridAuth() {
  const context = useContext(HybridAuthContext);
  if (!context) {
    throw new Error('useHybridAuth must be used within HybridAuthProvider');
  }
  return context;
}

function bytesToBase64(value: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value).toString('base64');
  }

  let binary = '';
  for (let i = 0; i < value.length; i += 1) {
    binary += String.fromCharCode(value[i]);
  }

  return btoa(binary);
}
