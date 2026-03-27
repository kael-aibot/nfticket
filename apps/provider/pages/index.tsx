import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthPanel } from '../../shared/components/AuthPanel';
import { WalletButton } from '../../shared/components/WalletButton';
import { useHybridAuth } from '../../shared/auth/HybridAuthContext';
import { loadSettings } from '../../shared/lib/settings';
import type { Event } from '../shared/hooks/useNfticket';
import { useNfticket } from '../shared/hooks/useNfticket';

export default function ProviderDashboard() {
  const { authReady, user, walletConnected } = useHybridAuth();
  const { fetchMyEvents } = useNfticket();
  const settings = useMemo(() => loadSettings(), []);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user) {
      setEvents([]);
      return;
    }
    fetchMyEvents().then(setEvents);
  }, [authReady, fetchMyEvents, user]);

  const totals = events.reduce((acc, event) => {
    acc.tickets += event.totalTicketsSold;
    acc.revenue += event.totalRevenue;
    return acc;
  }, { tickets: 0, revenue: 0 });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_26%),linear-gradient(180deg,_#f6f7ef_0%,_#f2f1ea_100%)] text-slate-900">
      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Provider Portal</p>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/create">Create Event</Link>
            <Link href="/settings">Settings</Link>
            <Link href="/scanner">Scanner</Link>
            <WalletButton className="!bg-emerald-600" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.45fr_0.8fr]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-black/10 bg-white p-5">
              <p className="text-sm text-slate-500">Events</p>
              <p className="mt-2 text-3xl font-semibold">{events.length}</p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white p-5">
              <p className="text-sm text-slate-500">Tickets Sold</p>
              <p className="mt-2 text-3xl font-semibold">{totals.tickets}</p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-white p-5">
              <p className="text-sm text-slate-500">Gross Revenue</p>
              <p className="mt-2 text-3xl font-semibold">${totals.revenue.toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-black/10 bg-[#0f172a] p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Commerce model</p>
                <h2 className="mt-2 text-3xl font-semibold">Card-first checkout, wallet-optional onboarding</h2>
              </div>
              <Link href="/create" className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-black">
                New Event
              </Link>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Platform fee: {settings.platformFeePercent}%</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Royalty split: {settings.royaltySplit.organizer}/{settings.royaltySplit.originalBuyer}/{settings.royaltySplit.charity}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Wallet {walletConnected ? 'available for minting and resale' : 'not required for dashboard work'}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your events</h2>
              <Link href="/settings" className="text-sm text-emerald-700">Adjust pricing rules</Link>
            </div>

            {!authReady ? (
              <p className="text-slate-500">Checking secure session...</p>
            ) : !user ? (
              <p className="text-slate-500">Sign in to manage provider events.</p>
            ) : events.length === 0 ? (
              <p className="text-slate-500">No events yet. Create one to start selling tickets.</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block rounded-2xl border border-black/10 bg-slate-50 p-4 transition hover:border-emerald-400"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{event.name}</h3>
                        <p className="text-sm text-slate-500">{event.venue} • {new Date(event.eventDate).toLocaleString()}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{event.totalTicketsSold} sold</p>
                        <p className="text-slate-500">${event.totalRevenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <AuthPanel role="provider" />
          <div className="rounded-3xl border border-black/10 bg-white p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Default provider login</p>
            <p className="mt-2">Email: `provider@nfticket.app`</p>
            <p>Password: `demo1234`</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
