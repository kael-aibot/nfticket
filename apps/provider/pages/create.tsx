import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthPanel } from '../../shared/components/AuthPanel';
import { WalletButton } from '../../shared/components/WalletButton';
import { useHybridAuth } from '../../shared/auth/HybridAuthContext';
import { loadSettings } from '../../shared/lib/settings';
import { useNfticket } from '../shared/hooks/useNfticket';

export default function CreateEvent() {
  const router = useRouter();
  const { authReady, user } = useHybridAuth();
  const { createEvent } = useNfticket();
  const settings = useMemo(() => loadSettings(), []);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    eventDate: '',
    venue: '',
    acceptedPayments: ['card', 'crypto'],
    tiers: [
      { name: 'General Admission', price: 89, supply: 100, benefits: 'Main event access' },
    ],
  });

  async function handleCreate() {
    if (!authReady) {
      setMessage('Checking secure session...');
      return;
    }
    if (!user) {
      setMessage('Sign in as a provider before creating an event.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await createEvent({
        name: eventData.name,
        description: eventData.description,
        eventDate: new Date(eventData.eventDate),
        venue: eventData.venue,
        tiers: eventData.tiers,
        acceptedPayments: eventData.acceptedPayments as ('card' | 'crypto')[],
        organizerName: user.name,
      });
      router.push(`/events/${result.eventPublicKey}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-slate-900">
      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">Dashboard</Link>
            <Link href="/settings">Settings</Link>
          </div>
          <WalletButton className="!bg-emerald-600" />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-[2rem] border border-black/10 bg-white p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Create Event</p>
          <h1 className="mt-2 text-3xl font-semibold">Build a card-first event checkout</h1>

          <div className="mt-6 space-y-4">
            <input
              value={eventData.name}
              onChange={(event) => setEventData({ ...eventData, name: event.target.value })}
              placeholder="Event name"
              className="w-full rounded-2xl border border-black/10 px-4 py-3"
            />
            <textarea
              value={eventData.description}
              onChange={(event) => setEventData({ ...eventData, description: event.target.value })}
              placeholder="Describe the event"
              rows={4}
              className="w-full rounded-2xl border border-black/10 px-4 py-3"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="datetime-local"
                value={eventData.eventDate}
                onChange={(event) => setEventData({ ...eventData, eventDate: event.target.value })}
                className="w-full rounded-2xl border border-black/10 px-4 py-3"
              />
              <input
                value={eventData.venue}
                onChange={(event) => setEventData({ ...eventData, venue: event.target.value })}
                placeholder="Venue"
                className="w-full rounded-2xl border border-black/10 px-4 py-3"
              />
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Ticket tiers</h2>
                <button
                  onClick={() => setEventData({
                    ...eventData,
                    tiers: [...eventData.tiers, { name: '', price: 45, supply: 50, benefits: '' }],
                  })}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Add tier
                </button>
              </div>
              <div className="space-y-3">
                {eventData.tiers.map((tier, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-4">
                    <input
                      value={tier.name}
                      onChange={(event) => {
                        const tiers = [...eventData.tiers];
                        tiers[index].name = event.target.value;
                        setEventData({ ...eventData, tiers });
                      }}
                      placeholder="Tier name"
                      className="rounded-2xl border border-black/10 px-4 py-3"
                    />
                    <input
                      value={tier.price}
                      type="number"
                      onChange={(event) => {
                        const tiers = [...eventData.tiers];
                        tiers[index].price = Number(event.target.value);
                        setEventData({ ...eventData, tiers });
                      }}
                      placeholder="Price"
                      className="rounded-2xl border border-black/10 px-4 py-3"
                    />
                    <input
                      value={tier.supply}
                      type="number"
                      onChange={(event) => {
                        const tiers = [...eventData.tiers];
                        tiers[index].supply = Number(event.target.value);
                        setEventData({ ...eventData, tiers });
                      }}
                      placeholder="Supply"
                      className="rounded-2xl border border-black/10 px-4 py-3"
                    />
                    <input
                      value={tier.benefits}
                      onChange={(event) => {
                        const tiers = [...eventData.tiers];
                        tiers[index].benefits = event.target.value;
                        setEventData({ ...eventData, tiers });
                      }}
                      placeholder="Benefits"
                      className="rounded-2xl border border-black/10 px-4 py-3"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-slate-700">
              <p>Platform fee default: {settings.platformFeePercent}%</p>
              <p>Royalty split default: {settings.royaltySplit.organizer}/{settings.royaltySplit.originalBuyer}/{settings.royaltySplit.charity}</p>
              <p>Accepted payments: card and crypto</p>
            </div>

            {message && <p className="text-sm text-red-600">{message}</p>}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <AuthPanel role="provider" compact />
          <div className="rounded-3xl border border-black/10 bg-white p-5 text-sm text-slate-600">
            Event creation now works without forcing a wallet. Connect a wallet later only if you want on-chain minting and resale actions.
          </div>
        </aside>
      </main>
    </div>
  );
}
