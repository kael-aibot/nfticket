import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthPanel } from '../../shared/components/AuthPanel';
import { WalletButton } from '../../shared/components/WalletButton';
import { useHybridAuth } from '../../shared/auth/HybridAuthContext';
import { calculatePrimaryPrice } from '../../shared/lib/pricing';
import { loadSettings } from '../../shared/lib/settings';
import type { PaymentMethod } from '../../shared/lib/types';
import type { Event } from '../shared/hooks/useNfticket';
import { useNfticket } from '../shared/hooks/useNfticket';

export default function BrowseEvents() {
  const { authReady, user, walletConnected } = useHybridAuth();
  const { fetchEvents, purchaseTicket } = useNfticket();
  const settings = useMemo(() => loadSettings(), []);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [message, setMessage] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchEvents()
      .then((items) => setEvents(items.filter((event) => event.eventDate > Date.now())))
      .finally(() => setLoading(false));
  }, [fetchEvents]);

  const selectedTierData = selectedEvent && selectedTier !== null ? selectedEvent.tiers[selectedTier] : null;
  const price = selectedTierData ? calculatePrimaryPrice(selectedTierData.price, settings) : null;

  async function handlePurchase() {
    if (!selectedEvent || selectedTier === null) return;
    if (!authReady) {
      setMessage('Checking secure session...');
      return;
    }
    if (!user) {
      setMessage('Sign in with email or social login before paying.');
      return;
    }

    setPurchasing(true);
    setMessage('');
    try {
      const ticket = await purchaseTicket(selectedEvent.id, selectedTier, paymentMethod);
      setMessage(ticket.status === 'minted'
        ? 'Ticket purchased and minted.'
        : 'Ticket purchased. Connect a wallet later to mint or resell.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.18),_transparent_28%),linear-gradient(180deg,_#09111f_0%,_#05070d_55%,_#020304_100%)]">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">NFTicket</p>
            <h1 className="text-2xl font-semibold text-white">Browse events without a wallet wall</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/my-tickets" className="text-sm text-white/70 hover:text-white">My Tickets</Link>
            <WalletButton className="!bg-amber-400 !text-black" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.5fr_0.8fr]">
        <section>
          <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1">Primary fee {settings.platformFeePercent}%</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Card-first checkout</span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Wallet {walletConnected ? 'connected for minting' : 'optional until mint/resale'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-24 text-center text-white/60">Loading events...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  data-testid={`event-card-${event.id}`}
                  onClick={() => {
                    setSelectedEvent(event);
                    setSelectedTier(0);
                    setMessage('');
                  }}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-white transition hover:-translate-y-1 hover:border-amber-300/50"
                >
                  <div className="mb-4 rounded-2xl bg-[linear-gradient(135deg,_rgba(251,191,36,0.95),_rgba(249,115,22,0.85))] p-5 text-black">
                    <p className="text-xs uppercase tracking-[0.25em]">Upcoming</p>
                    <h2 className="mt-6 text-2xl font-semibold">{event.name}</h2>
                  </div>
                  <p className="text-sm text-white/65">{event.description}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p>{event.venue}</p>
                      <p className="text-sm text-white/50">{new Date(event.eventDate).toLocaleString()}</p>
                    </div>
                    <p className="text-lg font-semibold text-amber-300">
                      From ${Math.min(...event.tiers.map((tier) => tier.price)).toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <AuthPanel role="buyer" />
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            <p className="font-medium text-white">Checkout flow</p>
            <p className="mt-2">1. Sign in with email/password or social login.</p>
            <p>2. Pay with card or opt into crypto.</p>
            <p>3. Mint later when you connect a wallet.</p>
          </div>
        </aside>
      </main>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 backdrop-blur">
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-[#0d1320] p-6 text-white">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-amber-300">{selectedEvent.organizerName}</p>
                <h2 className="text-3xl font-semibold">{selectedEvent.name}</h2>
                <p className="mt-2 text-white/60">{selectedEvent.venue} • {new Date(selectedEvent.eventDate).toLocaleString()}</p>
              </div>
                <button onClick={() => setSelectedEvent(null)} className="rounded-full bg-white/10 px-3 py-2 text-sm">
                  Close
                </button>
            </div>

            <div className="space-y-3">
              {selectedEvent.tiers.map((tier, index) => (
                <button
                  data-testid={`event-tier-${index}`}
                  key={`${tier.name}-${index}`}
                  onClick={() => setSelectedTier(index)}
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selectedTier === index ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{tier.name}</p>
                      <p className="text-sm text-white/60">{tier.benefits}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold">${tier.price.toFixed(2)}</p>
                      <p className="text-xs text-white/50">{tier.sold}/{tier.supply} sold</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {price && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-4 flex gap-2">
                  <button
                    data-testid="payment-method-card"
                    onClick={() => setPaymentMethod('card')}
                    className={`rounded-full px-4 py-2 ${paymentMethod === 'card' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    Pay with Card
                  </button>
                  <button
                    data-testid="payment-method-crypto"
                    onClick={() => setPaymentMethod('crypto')}
                    className={`rounded-full px-4 py-2 ${paymentMethod === 'crypto' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                  >
                    Pay with Crypto
                  </button>
                </div>

                <div className="space-y-2 text-white/70">
                  <div className="flex justify-between"><span>Ticket</span><span>${price.basePrice.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Platform fee</span><span>${price.platformFee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-white"><span>Total</span><span>${price.total.toFixed(2)}</span></div>
                </div>

                <p className="mt-4 text-xs text-white/50">
                  {walletConnected
                    ? 'Wallet is connected, so this ticket can mint immediately.'
                    : 'No wallet connected. Payment still works; minting and resale unlock later.'}
                </p>

                {message && <p className="mt-4 text-sm text-amber-200">{message}</p>}

                <button
                  data-testid="purchase-submit"
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="mt-4 w-full rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-black disabled:opacity-60"
                >
                  {purchasing ? 'Processing...' : paymentMethod === 'card' ? 'Confirm Card Payment' : 'Confirm Crypto Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
