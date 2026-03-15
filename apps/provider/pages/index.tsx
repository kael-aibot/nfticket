import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNfticket } from '../../shared/hooks/useNfticket';
import Link from 'next/link';

interface EventStats {
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  upcomingEvents: number;
}

export default function ProviderDashboard() {
  const { connected, publicKey } = useWallet();
  const { fetchMyEvents } = useNfticket();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EventStats>({
    totalEvents: 0,
    totalTicketsSold: 0,
    totalRevenue: 0,
    upcomingEvents: 0,
  });

  useEffect(() => {
    if (connected) {
      loadEvents();
    }
  }, [connected]);

  const loadEvents = async () => {
    try {
      const myEvents = await fetchMyEvents();
      setEvents(myEvents);
      
      const now = Date.now();
      const upcoming = myEvents.filter(e => e.eventDate > now);
      const totalSold = myEvents.reduce((sum, e) => sum + e.totalTicketsSold, 0);
      const totalRev = myEvents.reduce((sum, e) => sum + e.totalRevenue, 0);
      
      setStats({
        totalEvents: myEvents.length,
        totalTicketsSold: totalSold,
        totalRevenue: totalRev,
        upcomingEvents: upcoming.length,
      });
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎫</div>
          <h1 className="text-3xl font-bold text-white mb-4">NFTicket Provider Portal</h1>
          <p className="text-white/70 mb-8">Connect your wallet to manage events</p>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !px-8 !py-3 !rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-3xl">🎫</span>
              <span className="text-xl font-bold text-gray-900">NFTicket Provider</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-purple-600 font-medium">Dashboard</Link>
              <Link href="/events" className="text-gray-600 hover:text-purple-600 font-medium">My Events</Link>
              <Link href="/create" className="text-gray-600 hover:text-purple-600 font-medium">Create Event</Link>
              <Link href="/scanner" className="text-gray-600 hover:text-purple-600 font-medium">Scanner</Link>
            </nav>
          </div>
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm font-medium">Total Events</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEvents}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm font-medium">Tickets Sold</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalTicketsSold}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm font-medium">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalRevenue.toFixed(2)} SOL</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm font-medium">Upcoming Events</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.upcomingEvents}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-8 mb-8 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Create Your Next Event</h2>
              <p className="text-purple-100">Set up ticketing, pricing tiers, and resale rules in minutes</p>
            </div>
            <Link
              href="/create"
              className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              + Create Event
            </Link>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Your Events</h3>
            <Link href="/events" className="text-purple-600 hover:text-purple-700 font-medium">
              View All →
            </Link>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-gray-500 mb-4">No events yet</p>
              <Link
                href="/create"
                className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
              >
                Create Your First Event
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">{event.name}</h4>
                      <p className="text-gray-500 text-sm mt-1">{event.venue}</p>
                      <p className="text-gray-400 text-sm">
                        {new Date(event.eventDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {event.totalTicketsSold}
                      </p>
                      <p className="text-gray-500 text-sm">tickets sold</p>
                      <p className="text-green-600 font-medium">
                        {event.totalRevenue.toFixed(2)} SOL
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link
                      href={`/events/${event.id}`}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      Manage →
                    </Link>
                    <Link
                      href={`/events/${event.id}/scanners`}
                      className="text-gray-500 hover:text-gray-600 font-medium text-sm"
                    >
                      Scanners →
                    </Link>
                    <Link
                      href={`/events/${event.id}/analytics`}
                      className="text-gray-500 hover:text-gray-600 font-medium text-sm"
                    >
                      Analytics →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
