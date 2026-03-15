import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

export default function CommunicationsHub() {
  const [activeTab, setActiveTab] = useState('announce');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [audience, setAudience] = useState('all');

  const templates = [
    { id: '24h', label: '24h Reminder', icon: '⏰', text: 'Your event is tomorrow at {time}! Don\'t forget your ticket.' },
    { id: '2h', label: '2h Reminder', icon: '⏰', text: 'Starting in 2 hours! See you soon.' },
    { id: 'venue', label: 'Venue Change', icon: '📍', text: 'Important: Venue changed to {new_venue}' },
    { id: 'exclusive', label: 'Exclusive Access', icon: '🎁', text: 'VIP Backstage access: Check in at {location}' },
    { id: 'thankyou', label: 'Thank You', icon: '🙏', text: 'Thanks for attending! Please leave a review.' },
  ];

  const applyTemplate = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.text);
      setSelectedTemplate(templateId);
    }
  };

  const sendAnnouncement = () => {
    console.log('Sending to', audience, ':', message);
    alert(`Announcement sent to ${audience === 'all' ? 'all 847' : audience} ticket holders!`);
    setMessage('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-2">📢 Communications Hub</h2>
      <p className="text-white/60 mb-8">Communicate with your ticket holders</p>

      {/* Tabs */}
      <div className="flex border-b border-white/20 mb-6">
        {[
          { id: 'announce', label: 'Announcements', icon: '📢' },
          { id: 'messages', label: 'Messages', icon: '💬' },
          { id: 'polls', label: 'Polls', icon: '📊' },
          { id: 'analytics', label: 'Analytics', icon: '📈' },
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
          </button>
        ))}
      </div>

      {/* Announcements Tab */}
      {activeTab === 'announce' && (
        <div className="space-y-6">
          {/* Templates */}
          <div>
            <label className="block text-sm text-white/80 mb-3">Quick Templates</label>
            <div className="grid grid-cols-5 gap-3">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={`p-4 rounded-lg border transition text-left ${
                    selectedTemplate === template.id
                      ? 'bg-purple-600 border-purple-400'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl mb-2">{template.icon}</div>
                  <div className="text-sm text-white font-medium">{template.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Editor */}
          <div>
            <label className="block text-sm text-white/80 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40"
              placeholder="Type your announcement..."
            />
          </div>

          {/* Audience Selector */}
          <div>
            <label className="block text-sm text-white/80 mb-2">Send To</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white"
            >
              <option value="all">All Ticket Holders (847)</option>
              <option value="vip">VIP Tier Only (120)</option>
              <option value="general">General Admission (627)</option>
              <option value="unscanned">Not Yet Scanned (400)</option>
            </select>
          </div>

          {/* Preview */}
          <div className="bg-white/5 rounded-lg p-4">
            <label className="block text-sm text-white/60 mb-2">Preview</label>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">🎫</div>
                <div>
                  <p className="text-white font-medium">Solana Summer Fest 2026</p>
                  <p className="text-white/60 text-sm">Official Update</p>
                </div>
              </div>
              <p className="text-white">{message || 'Your message will appear here...'}</p>
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={sendAnnouncement}
            disabled={!message}
            className="w-full py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
          >
            Send Announcement to {audience === 'all' ? '847' : audience} Recipients
          </button>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          <div className="grid grid-cols-3 h-96">
            {/* Conversation List */}
            <div className="border-r border-white/20 p-4">
              <h3 className="text-white font-semibold mb-4">Conversations</h3>
              <div className="space-y-2">
                {[
                  { name: 'Alex M.', msg: 'Question about VIP access', unread: true },
                  { name: 'Sarah K.', msg: 'Can I transfer my ticket?', unread: false },
                  { name: 'Mike R.', msg: 'Refund request', unread: true },
                ].map((conv, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10">
                    <p className="text-white font-medium flex items-center gap-2">
                      {conv.name}
                      {conv.unread && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                    </p>
                    <p className="text-white/60 text-sm truncate">{conv.msg}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="col-span-2 p-4 flex flex-col">
              <div className="flex-1 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm">A</div>
                  <div className="bg-white/10 rounded-lg p-3 max-w-xs">
                    <p className="text-white text-sm">Hi, I have a question about the VIP backstage access. What time should I arrive?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-purple-600 rounded-lg p-3 max-w-xs">
                    <p className="text-white text-sm">Hi Alex! VIP check-in opens at 5 PM. Come to the side entrance near the loading dock.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
                  placeholder="Type a message..."
                />
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Polls Tab */}
      {activeTab === 'polls' && (
        <div className="space-y-6">
          <button className="w-full py-4 border-2 border-dashed border-white/20 rounded-lg text-white/60 hover:border-purple-400 hover:text-white transition">
            + Create New Poll
          </button>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-white font-semibold">Merch Design Vote</h3>
                <p className="text-white/60 text-sm">Which design should we print?</p>
              </div>
              <span className="text-white/60 text-sm">234 votes</span>
            </div>
            <div className="space-y-3">
              {[
                { option: 'Design A - Minimalist', votes: 145, percent: 62 },
                { option: 'Design B - Colorful', votes: 89, percent: 38 },
              ].map((option, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{option.option}</span>
                    <span className="text-white/60">{option.votes} votes ({option.percent}%)</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${option.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Recipients', value: '847', change: '+12%' },
            { label: 'Message Open Rate', value: '78%', change: '+5%' },
            { label: 'Avg Response Time', value: '2.3h', change: '-15%' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <p className="text-white/60 text-sm">{stat.label}</p>
              <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
              <p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                {stat.change} vs last week
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}