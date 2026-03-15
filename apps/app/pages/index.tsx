import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../shared/hooks/useNfticket';
import Link from 'next/link';

export default function BrowseEvents() {
  const { connected } = useWallet();
  const { fetchEvents, mintTicket } = useNfticket();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const allEvents = await fetchEvents();
      const upcoming = allEvents.filter(e => e.eventDate > Date.now());
      setEvents(upcoming);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedEvent || selectedTier === null) return;
    
    setPurchasing(true);
    try {
      await mintTicket(selectedEvent.publicKey, selectedTier);
      alert('Ticket purchased successfully!');
      setSelectedEvent(null);
      setSelectedTier(null);
    } catch (error) {
      alert('Purchase failed: ' + error.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-black to-black">
      {/* Header */}
      <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎫</span>
            <span className="font-bold text-lg">NFTicket</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/my-tickets" className="text-white/80 hover:text-white">
              My Tickets
            </Link>
            <WalletMultiButton className="!bg-purple-600 !px-3 !py-2 !text-sm" />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24">
        <h1 className="text-2xl font-bold mb-2">Upcoming Events</h1>
        <p className="text-white/60 mb-6">Discover and buy NFT tickets</p>

        {!connected && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
            <p className="text-yellow-200 text-sm">⚠️ Connect your wallet to purchase tickets</p>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <p className="text-white/60">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="bg-white/10 backdrop-blur rounded-2xl overflow-hidden border border-white/20 active:scale-95 transition"
              >
                <div className="h-32 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                  <span className="text-5xl">🎉</span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg">{event.name}</h3>
                  <p className="text-white/60 text-sm">{event.venue}</p>
                  <p className="text-white/40 text-xs mt-1">
                    {new Date(event.eventDate).toLocaleDateString()} • {event.totalTicketsSold} sold
                  </p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-green-400 font-semibold">
                      From {Math.min(...event.tiers.map(t => t.price))} SOL
                    </span>
                    <span className="text-purple-400 text-sm">View →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-white/10 px-6 py-3">
        <div className="flex justify-around">
          <Link href="/" className="flex flex-col items-center text-purple-400">
            <span className="text-xl">🔍</span>
            <span className="text-xs mt-1">Browse</span>
          </Link>
          <Link href="/my-tickets" className="flex flex-col items-center text-white/60">
            <span className="text-xl">🎫</span>
            <span className="text-xs mt-1">My Tickets</span>
          </Link>
          <Link href="/resale" className="flex flex-col items-center text-white/60">
            <span className="text-xl">↔️</span>
            <span className="text-xs mt-1">Resale</span>
          </Link>
        </div>
      </nav>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-screen">
            <div className="h-48 bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
              <span className="text-6xl">🎉</span>
            </div>
            
            <div className="px-4 py-6">
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
              >
                ✕
              </button>

              <h2 className="text-2xl font-bold">{selectedEvent.name}</h2>
              <p className="text-white/60 mt-1">{selectedEvent.venue}</p>
              <p className="text-white/40 text-sm">
                {new Date(selectedEvent.eventDate).toLocaleString()}
              </p>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Select Ticket Tier</h3>
                <div className="space-y-3">
                  {selectedEvent.tiers.map((tier, index) => {
                    const isSoldOut = tier.sold >= tier.supply;
                    const isSelected = selectedTier === index;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => !isSoldOut && setSelectedTier(index)}
                        disabled={isSoldOut}
                        className={`w-full p-4 rounded-xl border-2 text-left transition ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/20'
                            : isSoldOut
                            ? 'border-red-500/50 bg-red-500/10 opacity-50'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold">{tier.name}</p>
                            <p className="text-sm text-white/60">{tier.benefits}</p>
                            <p className="text-xs text-white/40">{tier.sold}/{tier.supply} sold</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-400">{tier.price} SOL</p>
                            {isSoldOut && <p className="text-xs text-red-400">SOLD OUT</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedTier !== null && (
                <div className="mt-6 bg-white/5 rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Price Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Ticket Price</span>
                      <span>{selectedEvent.tiers[selectedTier].price} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Platform Fee (2.5%)</span>
                      <span>{(selectedEvent.tiers[selectedTier].price * 0.025).toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Network Fee</span>
                      <span>~0.00001 SOL</span>
                    </div>
                    <div className="border-t border-white/20 pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-green-400">
                        {(selectedEvent.tiers[selectedTier].price * 1.025 + 0.00001).toFixed(4)} SOL
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handlePurchase}
                disabled={selectedTier === null || purchasing || !connected}
                className="w-full mt-6 bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {purchasing ? 'Purchasing...' : connected ? 'Buy Ticket' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
