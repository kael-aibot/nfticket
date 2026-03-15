import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Mock events data (in production, fetch from program)
const MOCK_EVENTS = [
  {
    id: '1',
    name: 'Solana Summer Fest 2026',
    description: 'The biggest Solana community event of the year',
    date: '2026-06-15T18:00:00',
    venue: 'Miami Beach Convention Center',
    image: '🏖️',
    tiers: [
      { name: 'General', price: 0.5, supply: 1000, sold: 450 },
      { name: 'VIP', price: 1.5, supply: 200, sold: 120 },
      { name: 'Founder', price: 5.0, supply: 50, sold: 48 },
    ],
  },
  {
    id: '2',
    name: 'Crypto Concert Series: deadmau5',
    description: 'Electronic music legend live in the metaverse',
    date: '2026-04-20T20:00:00',
    venue: 'The Fillmore, San Francisco',
    image: '🎵',
    tiers: [
      { name: 'General Admission', price: 0.3, supply: 500, sold: 200 },
      { name: 'Backstage Pass', price: 1.0, supply: 100, sold: 85 },
    ],
  },
  {
    id: '3',
    name: 'Blockchain Developer Workshop',
    description: 'Learn to build on Solana with hands-on coding',
    date: '2026-03-25T09:00:00',
    venue: 'Online (Zoom)',
    image: '💻',
    tiers: [
      { name: 'Student', price: 0.1, supply: 200, sold: 150 },
      { name: 'Professional', price: 0.25, supply: 100, sold: 80 },
    ],
  },
];

export default function EventsPage() {
  const { connected } = useWallet();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculatePriceBreakdown = (price) => {
    const platformFee = price * 0.025;
    const networkFee = 0.00001; // Approximate
    const total = price + platformFee + networkFee;
    return { platformFee, networkFee, total };
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Upcoming Events</h2>
          <p className="text-white/60">Discover and purchase NFT tickets for amazing events</p>
        </div>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>

      {!connected && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
          <p className="text-yellow-200">⚠️ Connect your wallet to purchase tickets</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_EVENTS.map((event) => (
          <div
            key={event.id}
            className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 hover:border-purple-400/50 transition"
          >
            <div className="h-48 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-6xl">
              {event.image}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
              <p className="text-white/70 text-sm mb-4">{event.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-white/80 text-sm">
                  <span className="mr-2">📅</span>
                  {formatDate(event.date)}
                </div>
                <div className="flex items-center text-white/80 text-sm">
                  <span className="mr-2">📍</span>
                  {event.venue}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white/90">Select Tier:</p>
                {event.tiers.map((tier, idx) => {
                  const { platformFee, networkFee, total } = calculatePriceBreakdown(tier.price);
                  const isSoldOut = tier.sold >= tier.supply;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedEvent(event);
                        setSelectedTier({ ...tier, platformFee, networkFee, total });
                      }}
                      disabled={isSoldOut || !connected}
                      className={`w-full p-3 rounded-lg border text-left transition ${
                        isSoldOut
                          ? 'bg-red-500/20 border-red-500/50 cursor-not-allowed'
                          : 'bg-white/5 border-white/20 hover:border-purple-400/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-white">{tier.name}</p>
                          <p className="text-sm text-white/60">
                            {tier.sold}/{tier.supply} sold
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-400">{tier.price} SOL</p>
                          {isSoldOut && (
                            <span className="text-xs text-red-400">SOLD OUT</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedEvent && selectedTier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-2">{selectedEvent.name}</h3>
            <p className="text-white/60 mb-6">{selectedTier.name} Ticket</p>

            <div className="bg-white/5 rounded-lg p-4 mb-6 space-y-2">
              <p className="text-sm font-semibold text-white/90 mb-3">Price Breakdown:</p>
              
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Base Ticket Price</span>
                <span className="text-white">{selectedTier.price} SOL</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Platform Fee (2.5%)</span>
                <span className="text-white">{selectedTier.platformFee.toFixed(4)} SOL</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Network Fee</span>
                <span className="text-white">~{selectedTier.networkFee.toFixed(5)} SOL</span>
              </div>
              
              <div className="border-t border-white/20 pt-2 mt-2">
                <div className="flex justify-between font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-green-400">{selectedTier.total.toFixed(4)} SOL</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-200">
                💡 Your ticket will be minted as an NFT and sent to your wallet. 
                You can resell it on the secondary market with fair pricing rules.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedTier(null);
                }}
                className="flex-1 py-3 px-4 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  alert('Purchase functionality would connect to Solana program here!');
                }}
                className="flex-1 py-3 px-4 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition font-semibold"
              >
                Purchase Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}