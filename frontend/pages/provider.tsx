import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function ProviderPortal() {
  const { connected, publicKey } = useWallet();
  const [step, setStep] = useState(1);
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    date: '',
    venue: '',
    tiers: [{ name: 'General Admission', price: '', supply: '' }],
    resaleRules: { timeDecay: true },
  });

  if (!connected) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🎫</div>
        <h2 className="text-2xl font-bold text-white mb-4">Provider Portal</h2>
        <p className="text-white/60 mb-8">Connect your wallet to create events</p>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">Create New Event</h2>
      
      {step === 1 && (
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8">
          <h3 className="text-xl font-bold text-white mb-6">Step 1: Event Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/80 mb-2">Event Name</label>
              <input
                type="text"
                value={eventData.name}
                onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white"
                placeholder="e.g., Solana Summer Fest 2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/80 mb-2">Date & Time</label>
                <input
                  type="datetime-local"
                  value={eventData.date}
                  onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-white/80 mb-2">Venue</label>
                <input
                  type="text"
                  value={eventData.venue}
                  onChange={(e) => setEventData({ ...eventData, venue: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white"
                  placeholder="Venue location"
                />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Next: Ticket Tiers →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8">
          <h3 className="text-xl font-bold text-white mb-6">Step 2: Ticket Tiers</h3>
          
          <div className="space-y-4">
            {eventData.tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 bg-white/5 rounded-lg p-4">
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => {
                    const newTiers = [...eventData.tiers];
                    newTiers[index].name = e.target.value;
                    setEventData({ ...eventData, tiers: newTiers });
                  }}
                  className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
                  placeholder="Tier name"
                />
                <input
                  type="number"
                  value={tier.price}
                  onChange={(e) => {
                    const newTiers = [...eventData.tiers];
                    newTiers[index].price = e.target.value;
                    setEventData({ ...eventData, tiers: newTiers });
                  }}
                  className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
                  placeholder="Price (SOL)"
                />
                <input
                  type="number"
                  value={tier.supply}
                  onChange={(e) => {
                    const newTiers = [...eventData.tiers];
                    newTiers[index].supply = e.target.value;
                    setEventData({ ...eventData, tiers: newTiers });
                  }}
                  className="px-3 py-2 rounded bg-white/5 border border-white/20 text-white"
                  placeholder="Supply"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              ← Back
            </button>
            
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Review & Create →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8">
          <h3 className="text-xl font-bold text-white mb-6">Review & Create</h3>
          
          <div className="bg-white/5 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-white/60">Event Name</p>
              <p className="text-xl text-white font-semibold">{eventData.name}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60">Date</p>
                <p className="text-white">{eventData.date}</p>
              </div>
              <div>
                <p className="text-white/60">Venue</p>
                <p className="text-white">{eventData.venue}</p>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              <p className="text-white/60 mb-2">Ticket Tiers</p>
              {eventData.tiers.map((tier, idx) => (
                <div key={idx} className="flex justify-between py-2">
                  <span className="text-white">{tier.name}</span>
                  <span className="text-green-400">{tier.price} SOL ({tier.supply} supply)</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              ← Back
            </button>
            
            <button
              onClick={() => alert('Creating event on Solana...')}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Create Event 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}