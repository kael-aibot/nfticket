import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../shared/hooks/useNfticket';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function CreateEvent() {
  const { connected } = useWallet();
  const { createEvent } = useNfticket();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    eventDate: '',
    venue: '',
    tiers: [
      { name: 'General Admission', price: 0.1, supply: 100, benefits: 'General entry' },
    ],
    resaleConfig: {
      timeDecayEnabled: true,
      maxPremiumBps: 5000,
      organizerRoyalty: 40,
      originalBuyerRoyalty: 40,
      charityRoyalty: 20,
      charityAddress: '',
    },
  });

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createEvent({
        name: eventData.name,
        description: eventData.description,
        eventDate: new Date(eventData.eventDate),
        venue: eventData.venue,
        tiers: eventData.tiers,
        resaleConfig: {
          timeDecayEnabled: eventData.resaleConfig.timeDecayEnabled,
          maxPremiumBps: eventData.resaleConfig.maxPremiumBps,
          organizerRoyalty: eventData.resaleConfig.organizerRoyalty,
          originalBuyerRoyalty: eventData.resaleConfig.originalBuyerRoyalty,
          charityRoyalty: eventData.resaleConfig.charityRoyalty,
          charityAddress: eventData.resaleConfig.charityAddress || undefined,
        },
      });
      router.push(`/events/${result.eventPublicKey}`);
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const addTier = () => {
    setEventData({
      ...eventData,
      tiers: [...eventData.tiers, { name: '', price: 0.1, supply: 100, benefits: '' }],
    });
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...eventData.tiers];
    newTiers[index][field] = field === 'name' || field === 'benefits' ? value : parseFloat(value) || 0;
    setEventData({ ...eventData, tiers: newTiers });
  };

  const removeTier = (index) => {
    setEventData({
      ...eventData,
      tiers: eventData.tiers.filter((_, i) => i !== index),
    });
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Connect your wallet to create events</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🎫</span>
            <span className="font-bold text-gray-900">Create Event</span>
          </Link>
          <WalletMultiButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Progress */}
        <div className="flex items-center mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step > s ? 'bg-purple-600' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Event Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Name *</label>
                <input
                  type="text"
                  value={eventData.name}
                  onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="e.g., Solana Summer Fest 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  placeholder="Describe your event..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={eventData.eventDate}
                    onChange={(e) => setEventData({ ...eventData, eventDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Venue *</label>
                  <input
                    type="text"
                    value={eventData.venue}
                    onChange={(e) => setEventData({ ...eventData, venue: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    placeholder="Venue location"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!eventData.name || !eventData.eventDate || !eventData.venue}
                className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Ticket Tiers</h2>
            <div className="space-y-4">
              {eventData.tiers.map((tier, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) => updateTier(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                        placeholder="e.g., VIP"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Price (SOL)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tier.price}
                        onChange={(e) => updateTier(index, 'price', e.target.value)}
                        className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Supply</label>
                      <input
                        type="number"
                        value={tier.supply}
                        onChange={(e) => updateTier(index, 'supply', e.target.value)}
                        className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Benefits</label>
                        <input
                          type="text"
                          value={tier.benefits}
                          onChange={(e) => updateTier(index, 'benefits', e.target.value)}
                          className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                          placeholder="What's included"
                        />
                      </div>
                      {eventData.tiers.length > 1 && (
                        <button onClick={() => removeTier(index)} className="text-red-500 hover:text-red-700 mb-2">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addTier} className="mt-4 text-purple-600 hover:text-purple-700 font-medium">
              + Add Another Tier
            </button>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(3)} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700">Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Resale Rules & Create</h2>
            <div className="space-y-6 mb-8">
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Time-Decaying Premium</p>
                  <p className="text-sm text-gray-600">Max resale premium decreases as event approaches</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventData.resaleConfig.timeDecayEnabled}
                    onChange={(e) => setEventData({
                      ...eventData,
                      resaleConfig: { ...eventData.resaleConfig, timeDecayEnabled: e.target.checked }
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-purple-600 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organizer Share (%)</label>
                  <input
                    type="number"
                    value={eventData.resaleConfig.organizerRoyalty}
                    onChange={(e) => setEventData({ ...eventData, resaleConfig: { ...eventData.resaleConfig, organizerRoyalty: parseInt(e.target.value) || 0 } })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Original Buyer Share (%)</label>
                  <input
                    type="number"
                    value={eventData.resaleConfig.originalBuyerRoyalty}
                    onChange={(e) => setEventData({ ...eventData, resaleConfig: { ...eventData.resaleConfig, originalBuyerRoyalty: parseInt(e.target.value) || 0 } })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Charity Share (%)</label>
                  <input
                    type="number"
                    value={eventData.resaleConfig.charityRoyalty}
                    onChange={(e) => setEventData({ ...eventData, resaleConfig: { ...eventData.resaleConfig, charityRoyalty: parseInt(e.target.value) || 0 } })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Review</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="text-gray-500">Event:</span> {eventData.name}</p>
                <p><span className="text-gray-500">Date:</span> {eventData.eventDate && new Date(eventData.eventDate).toLocaleString()}</p>
                <p><span className="text-gray-500">Venue:</span> {eventData.venue}</p>
                <p><span className="text-gray-500">Tiers:</span> {eventData.tiers.length}</p>
                <p><span className="text-gray-500">Total Supply:</span> {eventData.tiers.reduce((sum, t) => sum + t.supply, 0)} tickets</p>
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">← Back</button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Event 🚀'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
