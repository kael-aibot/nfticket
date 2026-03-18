import React, { useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function ScannerPage() {
  const { connected } = useWallet();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [manualTicketId, setManualTicketId] = useState('');

  // Mock ticket validation
  const mockTickets = {
    'TICKET123': {
      valid: true,
      event: 'Solana Summer Fest 2026',
      tier: 'VIP',
      seat: 'Section A, Row 5, Seat 12',
      owner: '8xR9...3kL2',
      scanned: false,
    },
    'TICKET456': {
      valid: true,
      event: 'Solana Summer Fest 2026',
      tier: 'General',
      seat: 'Section C, Row 20, Seat 45',
      owner: '9mN0...4pQ3',
      scanned: true,
      scannedAt: '2026-06-15T18:05:23',
    },
    'INVALID': {
      valid: false,
      error: 'Ticket not found or invalid',
    },
  };

  const validateTicket = (ticketId) => {
    const ticket = mockTickets[ticketId] || mockTickets['INVALID'];
    setResult({ ...ticket, ticketId });
    setScanning(false);
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📱</div>
        <h2 className="text-2xl font-bold text-white mb-4">Ticket Scanner</h2>
        <p className="text-white/60 mb-8">Connect wallet to scan and validate tickets</p>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-2">Ticket Scanner</h2>
      <p className="text-white/60 mb-8">Scan QR codes or enter ticket IDs to validate entry</p>

      {/* Scan Options */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setScanning(true)}
          className="p-6 bg-purple-600 rounded-xl hover:bg-purple-700 transition text-center"
        >
          <div className="text-4xl mb-2">📷</div>
          <p className="font-semibold text-white">Scan QR Code</p>
        </button>

        <button
          onClick={() => setScanning(false)}
          className="p-6 bg-white/10 rounded-xl hover:bg-white/20 transition text-center"
        >
          <div className="text-4xl mb-2">⌨️</div>
          <p className="font-semibold text-white">Manual Entry</p>
        </button>
      </div>

      {/* Manual Entry */}
      {!scanning && (
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-8">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Enter Ticket ID
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={manualTicketId}
              onChange={(e) => setManualTicketId(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40"
              placeholder="e.g., TICKET123"
            />
            <button
              onClick={() => validateTicket(manualTicketId)}
              disabled={!manualTicketId}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              Validate
            </button>
          </div>
        </div>
      )}

      {/* Mock Camera View */}
      {scanning && (
        <div className="bg-black rounded-xl overflow-hidden mb-8 relative">
          <div className="aspect-square flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📷</div>
              <p className="text-white/60">Camera view would appear here</p>
              <div className="mt-6 space-x-2">
                <button
                  onClick={() => validateTicket('TICKET123')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                >
                  Simulate Valid Ticket
                </button>
                <button
                  onClick={() => validateTicket('INVALID')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                >
                  Simulate Invalid
                </button>
              </div>
            </div>
          </div>

          {/* Scan Overlay */}
          <div className="absolute inset-0 border-2 border-white/30 m-12 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
          </div>
        </div>
      )}

      {/* Validation Result */}
      {result && (
        <div
          className={`rounded-xl p-6 ${
            result.valid
              ? result.scanned
                ? 'bg-yellow-500/20 border border-yellow-500/50'
                : 'bg-green-500/20 border border-green-500/50'
              : 'bg-red-500/20 border border-red-500/50'
          }`}
        >
          {result.valid ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">{result.scanned ? '⚠️' : '✅'}</div>
                <div>
                  <p className="text-xl font-bold text-white">
                    {result.scanned ? 'ALREADY SCANNED' : 'VALID TICKET'}
                  </p>
                  <p className="text-white/60">Ticket ID: {result.ticketId}</p>
                </div>
              </div>

              {!result.scanned && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-sm">Event</p>
                      <p className="text-white font-semibold">{result.event}</p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/60 text-sm">Tier</p>
                      <p className="text-white font-semibold">{result.tier}</p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 col-span-2">
                      <p className="text-white/60 text-sm">Seat</p>
                      <p className="text-white font-semibold text-lg">{result.seat}</p>
                    </div>
                  </div>

                  <button className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
                    ✓ ADMIT ENTRY
                  </button>
                </div>
              )}

              {result.scanned && (
                <div className="bg-yellow-500/10 rounded-lg p-4">
                  <p className="text-yellow-200">
                    This ticket was already scanned at {result.scannedAt}
                  </p>
                  <p className="text-yellow-200/60 text-sm mt-2">
                    Check with event organizer if this is suspicious
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-4xl">❌</div>
              <div>
                <p className="text-xl font-bold text-white">INVALID TICKET</p>
                <p className="text-red-200">{result.error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-white/5 rounded-xl p-6">
        <h4 className="font-semibold text-white mb-3">How to Scan</h4>
        <ol className="list-decimal list-inside space-y-2 text-white/70 text-sm">
          <li>Position QR code within the green frame</li>
          <li>Hold steady until validation completes</li>
          <li>Check ticket details on screen</li>
          <li>Tap "ADMIT ENTRY" to scan the ticket</li>
          <li>Ticket cannot be reused after scanning</li>
        </ol>
      </div>
    </div>
  );
}