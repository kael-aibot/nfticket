import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../shared/hooks/useNfticket';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';

export default function EventManagement() {
  const router = useRouter();
  const { id } = router.query;
  const { connected } = useWallet();
  const { fetchEvents, addScanner } = useNfticket();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [newScannerAddress, setNewScannerAddress] = useState('');
  const [scannerError, setScannerError] = useState('');
  const [scannerSuccess, setScannerSuccess] = useState('');

  useEffect(() => {
    if (id && connected) {
      loadEvent();
    }
  }, [id, connected]);

  const loadEvent = async () => {
    try {
      const events = await fetchEvents();
      const found = events.find(e => e.id === id);
      setEvent(found);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddScanner = async () => {
    setScannerError('');
    setScannerSuccess('');
    try {
      await addScanner(id as string, newScannerAddress);
      setScannerSuccess('Scanner authorized successfully!');
      setNewScannerAddress('');
      loadEvent();
    } catch (err) {
      setScannerError(err.message || 'Failed to add scanner');
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Connect your wallet</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Event not found</p>
          <Link href="/" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const totalRevenue = event.totalRevenue;
  const ticketsSold = event.totalTicketsSold;
  const totalSupply = event.tiers.reduce((sum, t) => sum + t.supply, 0);
  const soldPercentage = Math.round((ticketsSold / totalSupply) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">← Dashboard</Link>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              <p className="text-gray-500 mt-1">{event.venue}</p>
              <p className="text-gray-400 text-sm">{new Date(event.eventDate).toLocaleString()}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/events/${id}/scanner`}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Open Scanner
              </Link>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Tickets Sold</p>
            <p className="text-3xl font-bold text-gray-900">{ticketsSold} <span className="text-lg text-gray-400">/ {totalSupply}</span></p>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${soldPercentage}%` }}></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Revenue</p>
            <p className="text-3xl font-bold text-green-600">{totalRevenue.toFixed(2)} SOL</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Ticket Tiers</p>
            <p className="text-3xl font-bold text-gray-900">{event.tiers.length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm">Scanners</p>
            <p className="text-3xl font-bold text-gray-900">{event.authorizedScanners.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {['overview', 'tiers', 'scanners', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-medium capitalize ${
                    activeTab === tab
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Event Description</h3>
                  <p className="text-gray-600">{event.description || 'No description provided.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Resale Configuration</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      <li>Time Decay: {event.resaleConfig.timeDecayEnabled ? 'Enabled' : 'Disabled'}</li>
                      <li>Organizer Share: {event.resaleConfig.organizerRoyalty}%</li>
                      <li>Buyer Share: {event.resaleConfig.originalBuyerRoyalty}%</li>
                      <li>Charity Share: {event.resaleConfig.charityRoyalty}%</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Quick Actions</h4>
                    <div className="space-y-2">
                      <Link href={`/events/${id}/scanner`} className="block text-purple-600 hover:text-purple-700">
                        → Open Ticket Scanner
                      </Link>
                      <button className="block text-purple-600 hover:text-purple-700">
                        → Download Attendee List
                      </button>
                      <button className="block text-purple-600 hover:text-purple-700">
                        → Send Message to Attendees
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tiers' && (
              <div className="space-y-4">
                {event.tiers.map((tier, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900">{tier.name}</h4>
                        <p className="text-sm text-gray-500">{tier.benefits}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{tier.price} SOL</p>
                        <p className="text-sm text-gray-500">{tier.sold} / {tier.supply} sold</p>
                      </div>
                    </div>
                    <div className="mt-3 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${(tier.sold / tier.supply) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'scanners' && (
              <div className="space-y-6">
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Add Scanner</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Authorize staff members to scan tickets at your event
                  </p>
                  {scannerError && <p className="text-red-600 text-sm mb-2">{scannerError}</p>}
                  {scannerSuccess && <p className="text-green-600 text-sm mb-2">{scannerSuccess}</p>}
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newScannerAddress}
                      onChange={(e) => setNewScannerAddress(e.target.value)}
                      placeholder="Scanner wallet address"
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300"
                    />
                    <button
                      onClick={handleAddScanner}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                    >
                      Authorize
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Authorized Scanners</h4>
                  {event.authorizedScanners.length === 0 ? (
                    <p className="text-gray-500">No scanners authorized yet</p>
                  ) : (
                    <div className="space-y-2">
                      {event.authorizedScanners.map((scanner, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <code className="text-sm text-gray-700">{scanner}</code>
                          <button className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="text-center py-12">
                <p className="text-gray-500">Detailed analytics coming soon</p>
                <p className="text-gray-400 text-sm mt-2">
                  Revenue charts, attendance tracking, and more
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
