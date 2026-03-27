import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { calculateResaleLimit } from '../../../shared/lib/pricing';
import { toScannerCredential } from '../../../shared/lib/scannerCredentials';
import { loadSettings } from '../../../shared/lib/settings';
import type { Event } from '../../shared/hooks/useNfticket';
import { useNfticket } from '../../shared/hooks/useNfticket';

export default function EventManagement() {
  const router = useRouter();
  const { id } = router.query;
  const { fetchMyEvents, addScanner } = useNfticket();
  const settings = useMemo(() => loadSettings(), []);
  const [event, setEvent] = useState<Event | null>(null);
  const [scannerId, setScannerId] = useState('');

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    fetchMyEvents().then((events) => setEvent(events.find((item) => item.id === id) ?? null));
  }, [fetchMyEvents, id]);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f5f2ea] px-4 py-10 text-slate-900">
        <Link href="/">Back to dashboard</Link>
        <p className="mt-6">Event not found.</p>
      </div>
    );
  }

  const lowestTier = event.tiers[0];
  const resaleLimit = calculateResaleLimit(lowestTier.price, event.eventDate, settings);

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-slate-900">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-slate-500">Back to dashboard</Link>
            <h1 className="mt-2 text-3xl font-semibold">{event.name}</h1>
            <p className="text-slate-500">{event.venue} • {new Date(event.eventDate).toLocaleString()}</p>
          </div>
          <Link href="/scanner" className="rounded-full bg-slate-900 px-5 py-3 font-semibold text-white">
            Open Scanner
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <p className="text-sm text-slate-500">Sold</p>
            <p className="mt-2 text-3xl font-semibold">{event.totalTicketsSold}</p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <p className="text-sm text-slate-500">Gross Revenue</p>
            <p className="mt-2 text-3xl font-semibold">${event.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <p className="text-sm text-slate-500">Current resale cap</p>
            <p className="mt-2 text-3xl font-semibold">{resaleLimit.capPercent}%</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white p-6">
          <h2 className="text-xl font-semibold">Ticket tiers</h2>
          <div className="mt-4 space-y-3">
            {event.tiers.map((tier) => (
              <div key={tier.name} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-semibold">{tier.name}</p>
                    <p className="text-sm text-slate-500">{tier.benefits}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${tier.price.toFixed(2)}</p>
                    <p className="text-sm text-slate-500">{tier.sold}/{tier.supply} sold</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white p-6">
          <h2 className="text-xl font-semibold">Authorized scanners</h2>
          <div className="mt-4 flex gap-3">
            <input
              value={scannerId}
              onChange={(event) => setScannerId(event.target.value)}
              placeholder="Scanner label or wallet"
              className="flex-1 rounded-2xl border border-black/10 px-4 py-3"
            />
            <button
              onClick={async () => {
                const normalizedScannerId = toScannerCredential(scannerId);
                if (!normalizedScannerId) {
                  return;
                }
                await addScanner(event.id, normalizedScannerId);
                setEvent({
                  ...event,
                  authorizedScanners: Array.from(new Set([...event.authorizedScanners, normalizedScannerId])),
                });
                setScannerId('');
              }}
              className="rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white"
            >
              Add Scanner
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {event.authorizedScanners.map((scanner) => (
              <div key={scanner} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {scanner}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
