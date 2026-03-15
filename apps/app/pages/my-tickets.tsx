import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../shared/hooks/useNfticket';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function MyTickets() {
  const { connected } = useWallet();
  const { fetchMyTickets, getTicketQRData, listTicketForResale } = useNfticket();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [resalePrice, setResalePrice] = useState('');
  const [showResale, setShowResale] = useState(false);

  useEffect(() => {
    if (connected) {
      loadTickets();
    }
  }, [connected]);

  const loadTickets = async () => {
    try {
      const myTickets = await fetchMyTickets();
      setTickets(myTickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleListForResale = async () => {
    if (!selectedTicket || !resalePrice) return;
    
    try {
      await listTicketForResale(selectedTicket.publicKey, parseFloat(resalePrice));
      alert('Ticket listed for resale!');
      setShowResale(false);
      setResalePrice('');
      loadTickets();
    } catch (error) {
      alert('Failed to list: ' + error.message);
    }
  };

  const upcomingTickets = tickets.filter(t => t.event && t.event.eventDate > Date.now());
  const pastTickets = tickets.filter(t => t.event && t.event.eventDate <= Date.now());

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-900 to-black">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎫</div>
          <p className="text-white/60 mb-4">Connect wallet to view your tickets</p>
          <WalletMultiButton className="!bg-purple-600" />
        </div>
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
            <span className="font-bold text-lg">My Tickets</span>
          </div>
          <WalletMultiButton className="!bg-purple-600 !px-3 !py-2 !text-sm" />
        </div>
      </header>

      <main className="px-4 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎫</div>
            <p className="text-white/60">No tickets yet</p>
            <Link href="/" className="text-purple-400 mt-4 inline-block">
              Browse Events →
            </Link>
          </div>
        ) : (
          <>
            {upcomingTickets.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
                <div className="space-y-4 mb-8">
                  {upcomingTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20 active:scale-95 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold">{ticket.event?.name}</h3>
                          <p className="text-white/60 text-sm">{ticket.event?.venue}</p>
                          <p className="text-white/40 text-xs mt-1">
                            {new Date(ticket.event?.eventDate).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="bg-purple-500/30 text-purple-300 text-xs px-2 py-1 rounded">
                              {ticket.tierName}
                            </span>
                            {ticket.isForSale && (
                              <span className="bg-green-500/30 text-green-300 text-xs px-2 py-1 rounded">
                                For Sale
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-3xl">🎫</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {pastTickets.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mb-4">Past Events</h2>
                <div className="space-y-4 opacity-60">
                  {pastTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-white/5 rounded-2xl p-4 border border-white/10"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold">{ticket.event?.name}</h3>
                          <p className="text-white/60 text-sm">
                            {new Date(ticket.event?.eventDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-2xl">✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-white/10 px-6 py-3">
        <div className="flex justify-around">
          <Link href="/" className="flex flex-col items-center text-white/60">
            <span className="text-xl">🔍</span>
            <span className="text-xs mt-1">Browse</span>
          </Link>
          <Link href="/my-tickets" className="flex flex-col items-center text-purple-400">
            <span className="text-xl">🎫</span>
            <span className="text-xs mt-1">My Tickets</span>
          </Link>
          <Link href="/resale" className="flex flex-col items-center text-white/60">
            <span className="text-xl">↔️</span>
            <span className="text-xs mt-1">Resale</span>
          </Link>
        </div>
      </nav>

      {/* Ticket Detail Modal */}
      {selectedTicket && !showQR && !showResale && (
        <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
          <div className="min-h-screen p-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Ticket Details</h2>
              <button
                onClick={() => setSelectedTicket(null)}
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-6 mb-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold">{selectedTicket.event?.name}</h3>
                <p className="text-white/80">{selectedTicket.tierName}</p>
                <p className="text-white/60 text-sm mt-2">{selectedTicket.event?.venue}</p>
                <p className="text-white/60 text-sm">
                  {new Date(selectedTicket.event?.eventDate).toLocaleString()}
                </p>
                {selectedTicket.seatInfo && (
                  <p className="text-white/80 mt-2 font-semibold">Seat: {selectedTicket.seatInfo}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setShowQR(true)}
                className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg"
              >
                Show QR Code
              </button>

              {!selectedTicket.isForSale && (
                <button
                  onClick={() => setShowResale(true)}
                  className="w-full bg-white/10 text-white py-4 rounded-xl font-semibold border border-white/20"
                >
                  Sell Ticket
                </button>
              )}

              <button className="w-full bg-white/10 text-white py-4 rounded-xl font-semibold border border-white/20">
                Transfer to Friend
              </button>
            </div>

            <div className="mt-6 bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Ticket ID</p>
              <code className="text-xs text-white/60 break-all">{selectedTicket.id}</code>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedTicket && showQR && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <h2 className="text-xl font-bold mb-8">Show This at Entry</h2>
            
            <div className="bg-white p-6 rounded-2xl">
              <QRCodeSVG
                value={getTicketQRData(selectedTicket.id)}
                size={250}
                level="H"
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-white/60 text-sm">{selectedTicket.event?.name}</p>
              <p className="text-white/40 text-sm">{selectedTicket.tierName}</p>
            </div>
          </div>

          <div className="p-4 pb-8">
            <button
              onClick={() => setShowQR(false)}
              className="w-full bg-white/10 text-white py-4 rounded-xl font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Resale Modal */}
      {selectedTicket && showResale && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-4">List for Resale</h3>
            <p className="text-white/60 text-sm mb-4">
              Original price: {selectedTicket.purchasePrice} SOL
            </p>
            
            <label className="block text-sm text-white/80 mb-2">Your Price (SOL)</label>
            <input
              type="number"
              step="0.01"
              value={resalePrice}
              onChange={(e) => setResalePrice(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white mb-4"
              placeholder="Enter price"
            />

            {resalePrice && (
              <div className="bg-white/5 rounded-lg p-3 mb-4 text-sm">
                <p className="text-white/60">You'll receive:</p>
                <p className="text-green-400 font-semibold">
                  {(parseFloat(resalePrice) * 0.975).toFixed(4)} SOL
                </p>
                <p className="text-white/40 text-xs">(after 2.5% platform fee)</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowResale(false)}
                className="flex-1 py-3 bg-white/10 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleListForResale}
                disabled={!resalePrice || parseFloat(resalePrice) <= 0}
                className="flex-1 py-3 bg-purple-600 rounded-xl font-semibold disabled:bg-gray-700"
              >
                List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
