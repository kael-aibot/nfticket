import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../../shared/hooks/useNfticket';
import Link from 'next/link';

export default function ProviderScanner() {
  const { connected } = useWallet();
  const { fetchTicket, scanTicket, parseScannedQRData } = useNfticket();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [manualTicketId, setManualTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async (qrData) => {
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const parsed = parseScannedQRData(qrData);
      if (!parsed) {
        setError('Invalid QR code format');
        return;
      }

      const ticket = await fetchTicket(parsed.ticketId);
      if (!ticket) {
        setError('Ticket not found');
        return;
      }

      setResult({
        valid: true,
        ticket,
        scanned: ticket.scanStatus && ticket.scanStatus.scanned,
      });
    } catch (err) {
      setError(err.message || 'Failed to validate ticket');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const ticket = await fetchTicket(manualTicketId.trim());
      if (!ticket) {
        setError('Ticket not found');
        return;
      }

      setResult({
        valid: true,
        ticket,
        scanned: ticket.scanStatus && ticket.scanStatus.scanned,
      });
    } catch (err) {
      setError(err.message || 'Failed to validate ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleAdmit = async () => {
    if (!result?.ticket) return;
    
    setLoading(true);
    try {
      await scanTicket(result.ticket.eventId, result.ticket.publicKey);
      setResult({ ...result, scanned: true });
    } catch (err) {
      setError(err.message || 'Failed to scan ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Connect wallet to scan tickets</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-white hover:text-purple-400">
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold text-white">Ticket Scanner</h1>
          <WalletMultiButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {!result && !scanning && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setScanning(true)}
              className="bg-purple-600 hover:bg-purple-700 rounded-2xl p-12 text-center transition"
            >
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-2xl font-bold text-white">Scan QR Code</h3>
              <p className="text-purple-200 mt-2">Use camera to scan attendee ticket</p>
            </button>

            <div className="bg-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-4">Manual Entry</h3>
              <p className="text-gray-400 mb-4">Enter ticket ID manually</p>
              <input
                type="text"
                value={manualTicketId}
                onChange={(e) => setManualTicketId(e.target.value)}
                placeholder="Ticket ID"
                className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white mb-4"
              />
              <button
                onClick={handleManualEntry}
                disabled={!manualTicketId || loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-600"
              >
                {loading ? 'Validating...' : 'Validate Ticket'}
              </button>
            </div>
          </div>
        )}

        {scanning && (
          <div className="bg-black rounded-2xl overflow-hidden">
            <div className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-400">Camera view would appear here</p>
                <div className="mt-6 space-x-2">
                  <button
                    onClick={() => handleScan('{"type":"nfticket","ticketId":"demo123"}')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg"
                  >
                    Simulate Valid
                  </button>
                  <button
                    onClick={() => setScanning(false)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 border-2 border-green-400 m-12 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">❌</span>
              <div>
                <p className="text-xl font-bold text-white">Invalid Ticket</p>
                <p className="text-red-200">{error}</p>
              </div>
            </div>
            <button
              onClick={() => { setError(''); setResult(null); }}
              className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}

        {result && (
          <div className={`rounded-2xl p-8 ${
            result.scanned
              ? 'bg-yellow-500/20 border-2 border-yellow-500'
              : 'bg-green-500/20 border-2 border-green-500'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-5xl">{result.scanned ? '⚠️' : '✅'}</span>
              <div>
                <p className="text-2xl font-bold text-white">
                  {result.scanned ? 'ALREADY SCANNED' : 'VALID TICKET'}
                </p>
                {!result.scanned && (
                  <p className="text-green-200">Ready to admit</p>
                )}
              </div>
            </div>

            {result.ticket && (
              <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Event</p>
                    <p className="text-white font-semibold">{result.ticket.event?.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Tier</p>
                    <p className="text-white font-semibold">{result.ticket.tierName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Seat</p>
                    <p className="text-white font-semibold">{result.ticket.seatInfo || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Owner</p>
                    <p className="text-white font-mono text-sm">{result.ticket.owner.slice(0, 8)}...{result.ticket.owner.slice(-4)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              {!result.scanned && (
                <button
                  onClick={handleAdmit}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:bg-gray-600"
                >
                  {loading ? 'Processing...' : '✓ ADMIT ENTRY'}
                </button>
              )}
              <button
                onClick={() => { setResult(null); setError(''); }}
                className="px-6 py-4 bg-gray-700 text-white rounded-xl hover:bg-gray-600"
              >
                Scan Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
