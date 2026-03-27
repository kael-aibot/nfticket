import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { AuthPanel } from '../../shared/components/AuthPanel';
import { WalletButton } from '../../shared/components/WalletButton';
import { useHybridAuth } from '../../shared/auth/HybridAuthContext';
import type { Ticket } from '../shared/hooks/useNfticket';
import { useNfticket } from '../shared/hooks/useNfticket';

export default function MyTickets() {
  const { authReady, user, walletConnected } = useHybridAuth();
  const { fetchMyTickets, getTicketQRData, listTicketForResale, mintTicket } = useNfticket();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [resalePrice, setResalePrice] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user) {
      setTickets([]);
      return;
    }
    fetchMyTickets().then(setTickets);
  }, [authReady, fetchMyTickets, user]);

  async function refreshTickets() {
    setTickets(await fetchMyTickets());
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#09111f_0%,_#05070d_100%)] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Ticket Wallet</p>
            <h1 className="text-2xl font-semibold">My Tickets</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-white/70 hover:text-white">Browse Events</Link>
            <WalletButton className="!bg-sky-300 !text-black" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.35fr_0.8fr]">
        <section className="space-y-4">
          {!authReady ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              Checking secure session...
            </div>
          ) : !user ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              Sign in to see your reservations, minted tickets, and resale status.
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
              No tickets yet. Buy one from the browse page.
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                data-testid={`ticket-card-${ticket.id}`}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setMessage('');
                  setResalePrice(ticket.salePrice?.toString() ?? '');
                }}
                className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-sky-300/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-sky-300">{ticket.status}</p>
                    <h2 className="mt-1 text-xl font-semibold">{ticket.event?.name}</h2>
                    <p className="text-white/60">{ticket.tierName} • {ticket.event?.venue}</p>
                    <p className="mt-2 text-sm text-white/50">{ticket.event ? new Date(ticket.event.eventDate).toLocaleString() : ''}</p>
                  </div>
                  <p className="text-lg font-semibold">${ticket.purchasePrice.toFixed(2)}</p>
                </div>
              </button>
            ))
          )}
        </section>

        <aside className="space-y-4">
          <AuthPanel role="buyer" compact />
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            <p className="font-medium text-white">Wallet-dependent actions</p>
            <p className="mt-2">Minting and resale stay disabled until a wallet is connected.</p>
            <p className="mt-2">{walletConnected ? 'Wallet ready for blockchain actions.' : 'Wallet not connected yet.'}</p>
          </div>
        </aside>
      </main>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 p-4 backdrop-blur">
          <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#0d1320] p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-sky-300">{selectedTicket.status}</p>
                <h2 className="text-2xl font-semibold">{selectedTicket.event?.name}</h2>
                <p className="text-white/60">{selectedTicket.tierName}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="rounded-full bg-white/10 px-3 py-2 text-sm">
                Close
              </button>
            </div>

            <div className="rounded-3xl bg-white p-6">
              <QRCodeSVG value={getTicketQRData(selectedTicket.id)} size={220} className="mx-auto" />
            </div>

            <div className="mt-6 space-y-3">
              <button
                data-testid="mint-ticket"
                onClick={async () => {
                  try {
                    await mintTicket(selectedTicket.id);
                    setMessage('Ticket minted to connected wallet.');
                    await refreshTickets();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : 'Minting failed');
                  }
                }}
                className="w-full rounded-2xl bg-sky-300 px-4 py-3 font-semibold text-black"
              >
                {selectedTicket.status === 'minted' ? 'Minted to Wallet' : 'Mint to Wallet'}
              </button>

              <div className="rounded-2xl border border-white/10 p-4">
                <p className="mb-2 text-sm text-white/60">List for resale</p>
                <div className="flex gap-2">
                  <input
                    data-testid="resale-price-input"
                    value={resalePrice}
                    onChange={(event) => setResalePrice(event.target.value)}
                    placeholder="Resale price"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                  />
                  <button
                    data-testid="list-ticket"
                    onClick={async () => {
                      try {
                        await listTicketForResale(selectedTicket.id, Number(resalePrice));
                        setMessage('Ticket listed for resale.');
                        await refreshTickets();
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : 'Resale failed');
                      }
                    }}
                    className="rounded-xl bg-white/10 px-4 py-3"
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {message && <p className="mt-4 text-sm text-sky-200">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
