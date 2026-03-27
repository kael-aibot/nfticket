import React, { useState } from 'react';
import Link from 'next/link';
import QRScanner from '../components/QRScanner';
import { WalletButton } from '../../shared/components/WalletButton';
import type { ScannerValidationResult } from '../../shared/lib/types';

export default function ProviderScanner() {
  const [result, setResult] = useState<ScannerValidationResult | null>(null);
  const [error, setError] = useState('');
  const [scannerLabel, setScannerLabel] = useState('');
  const [checkpoint, setCheckpoint] = useState('main-gate');

  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/">Dashboard</Link>
          <h1 className="text-xl font-semibold">Scanner</h1>
          <WalletButton className="!bg-emerald-500 !text-black" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <p className="mb-4 text-sm text-white/60">Authoritative camera scan</p>
            <QRScanner
              scannerLabel={scannerLabel}
              checkpoint={checkpoint}
              onValidationResult={(next) => {
                setError('');
                setResult(next);
              }}
              onError={setError}
            />
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <p className="mb-4 text-sm text-white/60">Scanner authorization</p>
            <input
              value={scannerLabel}
              onChange={(event) => setScannerLabel(event.target.value)}
              placeholder="Authorized scanner label"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />
            <input
              value={checkpoint}
              onChange={(event) => setCheckpoint(event.target.value)}
              placeholder="Checkpoint"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            />
            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              The scanner now validates against the backend, requires a device-bound JWT token,
              logs every attempt, and queues scans for sync when offline.
            </div>
          </div>
        </div>

        {error && <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-red-100">{error}</div>}

        {result && (
          <div
            className={`rounded-[2rem] p-6 ${
              result.status === 'accepted'
                ? 'border border-emerald-400/40 bg-emerald-500/10'
                : result.status === 'offline_queued'
                  ? 'border border-amber-400/40 bg-amber-500/10'
                  : 'border border-red-400/40 bg-red-500/10'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">{result.status}</p>
                <h2 className="mt-2 text-2xl font-semibold">{result.event?.name ?? 'Scan processed'}</h2>
                <p className="text-white/70">
                  {result.ticket?.tierName ?? 'No ticket details available'}
                  {result.event?.venue ? ` • ${result.event.venue}` : ''}
                </p>
                <p className="mt-2 text-sm text-white/60">{result.message}</p>
              </div>
              <div className="text-right text-sm text-white/60">
                <p>{new Date(result.scannedAt).toLocaleString()}</p>
                {result.checkpoint && <p>Checkpoint: {result.checkpoint}</p>}
                {result.alreadyScannedAt && (
                  <p>First scanned: {new Date(result.alreadyScannedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
