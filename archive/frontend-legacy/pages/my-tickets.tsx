import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function RecipientInbox() {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);

  const messages = [
    {
      id: 1,
      event: 'Solana Summer Fest 2026',
      sender: 'Event Organizer',
      type: 'reminder',
      title: '⏰ Your event is tomorrow!',
      preview: 'Hi there, just a friendly reminder that Solana Summer Fest is tomorrow at 6 PM...',
      timestamp: '2 hours ago',
      unread: true,
      actions: ['View Ticket', 'Get Directions'],
    },
    {
      id: 2,
      event: 'Crypto Concert Series',
      sender: 'Crypto Concerts',
      type: 'exclusive',
      title: '🎁 Exclusive: Backstage Access Info',
      preview: 'As a VIP ticket holder, you have backstage access! Check-in at the side entrance...',
      timestamp: '1 day ago',
      unread: true,
      actions: ['View Details'],
    },
    {
      id: 3,
      event: 'Blockchain Developer Workshop',
      sender: 'DevWorkshop Team',
      type: 'announcement',
      title: '📢 Workshop materials available',
      preview: 'The workshop materials are now available for download. Check your email...',
      timestamp: '3 days ago',
      unread: false,
      actions: ['Download Materials'],
    },
    {
      id: 4,
      event: 'Solana Summer Fest 2026',
      sender: 'Event Organizer',
      type: 'poll',
      title: '📊 Vote on Merch Design',
      preview: 'Which t-shirt design should we print? Cast your vote now!',
      timestamp: '5 days ago',
      unread: false,
      actions: ['Vote Now'],
    },
  ];

  const tickets = [
    {
      id: 'TICKET001',
      event: 'Solana Summer Fest 2026',
      date: 'Aug 15, 2026',
      time: '6:00 PM',
      venue: 'Miami Beach Convention Center',
      tier: 'VIP',
      seat: 'Section A, Row 5, Seat 12',
      status: 'upcoming',
      qrCode: '🎫',
    },
    {
      id: 'TICKET002',
      event: 'Crypto Concert Series: deadmau5',
      date: 'Apr 20, 2026',
      time: '8:00 PM',
      venue: 'The Fillmore, SF',
      tier: 'General Admission',
      seat: 'GA Standing',
      status: 'upcoming',
      qrCode: '🎫',
    },
    {
      id: 'TICKET003',
      event: 'Blockchain Developer Workshop',
      date: 'Mar 25, 2026',
      time: '9:00 AM',
      venue: 'Online (Zoom)',
      tier: 'Professional',
      seat: 'N/A',
      status: 'completed',
      qrCode: '✓',
    },
  ];

  if (!connected) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📬</div>
        <h2 className="text-2xl font-bold text-white mb-4">My Inbox</h2>
        <p className="text-white/60 mb-8">Connect your wallet to view your tickets and messages</p>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-2">📬 My Inbox</h2>
      <p className="text-white/60 mb-8">Your tickets and event updates</p>

      {/* Tabs */}
      <div className="flex border-b border-white/20 mb-6">
        {[
          { id: 'inbox', label: 'Inbox', icon: '📬', count: 2 },
          { id: 'tickets', label: 'My Tickets', icon: '🎫', count: 2 },
          { id: 'history', label: 'History', icon: '📜' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 flex items-center gap-2 transition ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.count && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inbox Tab */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              onClick={() => setSelectedMessage(message)}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                message.unread
                  ? 'bg-white/10 border-purple-400/50'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {message.type === 'reminder' && '⏰'}
                    {message.type === 'exclusive' && '🎁'}
                    {message.type === 'announcement' && '📢'}
                    {message.type === 'poll' && '📊'}
                  </span>
                  <div>
                    <p className="text-white font-semibold">{message.title}</p>
                    <p className="text-white/60 text-sm">{message.event}</p>
                  </div>
                </div>
                <span className="text-white/40 text-sm">{message.timestamp}</span>
              </div>
              <p className="text-white/70 text-sm mb-3">{message.preview}</p>
              <div className="flex gap-2">
                {message.actions.map((action, i) => (
                  <button
                    key={i}
                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {tickets.filter(t => t.status === 'upcoming').map(ticket => (
            <div
              key={ticket.id}
              className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{ticket.event}</h3>
                  <p className="text-white/60">{ticket.venue}</p>
                </div>
                <div className="text-4xl">{ticket.qrCode}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-sm">Date</p>
                  <p className="text-white font-semibold">{ticket.date}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-sm">Time</p>
                  <p className="text-white font-semibold">{ticket.time}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white/60 text-sm">Tier</p>
                  <p className="text-white font-semibold">{ticket.tier}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-lg p-3 mb-4">
                <p className="text-white/60 text-sm">Seat</p>
                <p className="text-white font-semibold text-lg">{ticket.seat}</p>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                  Show QR Code
                </button>
                <button className="flex-1 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20">
                  Transfer
                </button>
                <button className="flex-1 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20">
                  Sell
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {tickets.filter(t => t.status === 'completed').map(ticket => (
            <div
              key={ticket.id}
              className="bg-white/5 rounded-xl p-6 border border-white/10 opacity-70"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">✓</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{ticket.event}</h3>
                    <p className="text-white/60 text-sm">Attended on {ticket.date}</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Leave Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-white/20">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {selectedMessage.type === 'reminder' && '⏰'}
                  {selectedMessage.type === 'exclusive' && '🎁'}
                  {selectedMessage.type === 'announcement' && '📢'}
                  {selectedMessage.type === 'poll' && '📊'}
                </span>
                <div>
                  <p className="text-xl font-bold text-white">{selectedMessage.title}</p>
                  <p className="text-white/60">{selectedMessage.event}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-white/80 mb-6">
              {selectedMessage.preview} This is the full message content that would be displayed here. 
              In a real implementation, this would show the complete message from the event organizer.
            </p>

            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <p className="text-white/60 text-sm mb-2">Event Details</p>
              <p className="text-white">📅 August 15, 2026 at 6:00 PM</p>
              <p className="text-white">📍 Miami Beach Convention Center</p>
            </div>

            <div className="flex gap-3">
              {selectedMessage.actions.map((action, i) => (
                <button
                  key={i}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}