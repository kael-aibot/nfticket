import React, { useState } from 'react';
import { useHybridAuth } from '../auth/HybridAuthContext';
import type { UserRole } from '../lib/types';

interface AuthPanelProps {
  role: UserRole;
  compact?: boolean;
}

export function AuthPanel({ role, compact = false }: AuthPanelProps) {
  const { authReady, user, signInWithCredentials, signInWithSocial, signUpWithCredentials, signOut } = useHybridAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(role === 'provider' ? 'provider@nfticket.app' : 'buyer@nfticket.app');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');

  if (!authReady) {
    return (
      <div data-testid={`auth-panel-${role}`} className={`rounded-2xl border border-white/15 bg-white/10 p-4 ${compact ? '' : 'max-w-md'}`} suppressHydrationWarning>
        <p className="text-sm text-white/60">Checking secure session...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div data-testid={`auth-panel-${role}`} className={`rounded-2xl border border-white/15 bg-white/10 p-4 ${compact ? '' : 'max-w-md'}`} suppressHydrationWarning>
        <p className="text-sm text-white/60">Signed in as</p>
        <p className="font-semibold text-white">{user.name}</p>
        <p className="text-sm text-white/60">{user.email}</p>
        <button data-testid="auth-sign-out" onClick={() => signOut()} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div data-testid={`auth-panel-${role}`} className={`rounded-2xl border border-white/15 bg-white/10 p-4 ${compact ? '' : 'max-w-md'}`} suppressHydrationWarning>
      <div className="mb-4 flex gap-2 text-sm">
        <button
          onClick={() => setMode('signin')}
          className={`rounded-full px-3 py-1 ${mode === 'signin' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode('signup')}
          className={`rounded-full px-3 py-1 ${mode === 'signup' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
        >
          Create account
        </button>
      </div>

      {mode === 'signup' && (
        <input
          data-testid="auth-name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Full name"
          className="mb-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white"
        />
      )}

      <input
        data-testid="auth-email-input"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        className="mb-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white"
      />
      <input
        data-testid="auth-password-input"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        placeholder="Password"
        className="mb-3 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white"
      />

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <button
        data-testid="auth-submit"
        onClick={async () => {
          setError('');
          try {
            if (mode === 'signin') {
              await signInWithCredentials(email, password);
              return;
            }
            await signUpWithCredentials(name || 'NFTicket User', email, password, role);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
          }
        }}
        className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black"
      >
        {mode === 'signin' ? 'Continue with email' : 'Create account'}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={async () => {
            setError('');
            try {
              await signInWithSocial('google', role);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Authentication failed');
            }
          }}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
        >
          Google
        </button>
        <button
          onClick={async () => {
            setError('');
            try {
              await signInWithSocial('github', role);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Authentication failed');
            }
          }}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
        >
          GitHub
        </button>
      </div>
    </div>
  );
}
