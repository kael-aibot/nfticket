import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { persistSettings, loadSettings } from '../../shared/lib/settings';
import type { AppSettings } from '../../shared/lib/types';

export default function ProviderSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [message, setMessage] = useState('');

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update(nextSettings: AppSettings) {
    setSettings(nextSettings);
    persistSettings(nextSettings);
    setMessage('Settings saved locally.');
  }

  return (
    <div className="min-h-screen bg-[#eef2e7] text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-slate-500">Back to dashboard</Link>
            <h1 className="mt-2 text-3xl font-semibold">Provider Settings</h1>
          </div>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-black/10 bg-white p-6">
            <h2 className="text-xl font-semibold">Platform fee</h2>
            <p className="mt-2 text-sm text-slate-500">Adjust the buyer checkout fee between 1% and 4%.</p>
            <input
              type="range"
              min="1"
              max="4"
              step="0.1"
              value={settings.platformFeePercent}
              onChange={(event) => update({ ...settings, platformFeePercent: Number(event.target.value) })}
              className="mt-4 w-full"
            />
            <p className="mt-3 text-2xl font-semibold">{settings.platformFeePercent.toFixed(1)}%</p>
          </section>

          <section className="rounded-[2rem] border border-black/10 bg-white p-6">
            <h2 className="text-xl font-semibold">Resale time-decay</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['moreThan60Days', '> 60 days'],
                ['between30And60Days', '30 - 60 days'],
                ['between7And30Days', '7 - 30 days'],
                ['under7Days', '< 7 days'],
                ['dayOfEvent', 'Day of event'],
              ].map(([key, label]) => (
                <label key={key} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <input
                    type="number"
                    value={settings.resaleDecay[key as keyof AppSettings['resaleDecay']]}
                    onChange={(event) => update({
                      ...settings,
                      resaleDecay: {
                        ...settings.resaleDecay,
                        [key]: Number(event.target.value),
                      },
                    })}
                    className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-black/10 bg-white p-6">
            <h2 className="text-xl font-semibold">Royalty split</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                ['organizer', 'Organizer'],
                ['originalBuyer', 'Original buyer'],
                ['charity', 'Charity'],
              ].map(([key, label]) => (
                <label key={key} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <input
                    type="number"
                    value={settings.royaltySplit[key as keyof AppSettings['royaltySplit']]}
                    onChange={(event) => update({
                      ...settings,
                      royaltySplit: {
                        ...settings.royaltySplit,
                        [key]: Number(event.target.value),
                      },
                    })}
                    className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
