import { defaultSettings } from './settings';
import { getEvents, saveEvents, uid } from './storage';
import type { EventRecord } from './types';

function daysFromNow(days: number) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// Demo credentials only. Keep seed passwords hashed and out of non-demo environments.
export const demoAdminCredentials = {
  email: 'admin@nfticket.local',
  passwordHash:
    'demo_admin_seed_salt:2b7b59bfe3570bb931a5cd666293c60a9f41979e9e0bd8f1491ef4d66a8302617573ca678feeae2cf59f3a788fe04555cde6abb6e9bc0003409e7583038ba3cf',
} as const;

const demoEvents: EventRecord[] = [
  {
    id: 'event_demo_summit',
    organizerId: 'user_provider_demo',
    organizerName: 'Demo Organizer',
    organizerWallet: null,
    name: 'Future of Ticketing Summit',
    description: 'Panels, demos, and partner networking for modern event operators.',
    eventDate: daysFromNow(45),
    venue: 'Pier 48, San Francisco',
    tiers: [
      { name: 'General', price: 89, supply: 250, sold: 84, benefits: 'Main floor access' },
      { name: 'VIP', price: 229, supply: 40, sold: 19, benefits: 'Lounge + speaker dinner' },
    ],
    acceptedPayments: ['card', 'crypto'],
    isActive: true,
    totalTicketsSold: 103,
    totalRevenue: 11807,
    authorizedScanners: ['scanner:front-gate-team', 'scanner:vip-desk'],
    authRequirements: {
      mode: 'hybrid',
      requireVerifiedEmail: true,
      requireWalletLink: false,
      requireKyc: false,
    },
    resaleConfig: defaultSettings,
    createdAt: daysFromNow(-10),
  },
  {
    id: 'event_demo_night',
    organizerId: 'user_provider_demo',
    organizerName: 'Demo Organizer',
    organizerWallet: null,
    name: 'Midnight Rooftop Session',
    description: 'Live electronic set with limited-capacity rooftop admission.',
    eventDate: daysFromNow(12),
    venue: 'Skyline Hall, Los Angeles',
    tiers: [
      { name: 'Floor', price: 65, supply: 180, sold: 121, benefits: 'Standing entry' },
      { name: 'Table', price: 140, supply: 24, sold: 16, benefits: 'Reserved cocktail table' },
    ],
    acceptedPayments: ['card', 'crypto'],
    isActive: true,
    totalTicketsSold: 137,
    totalRevenue: 10195,
    authorizedScanners: ['scanner:main-door'],
    authRequirements: {
      mode: 'email',
      requireVerifiedEmail: true,
      requireWalletLink: false,
      requireKyc: false,
    },
    resaleConfig: defaultSettings,
    createdAt: daysFromNow(-20),
  },
];

export function ensureSeedData() {
  const events = getEvents();
  if (events.length === 0) {
    saveEvents(
      demoEvents.map((event) => ({
        ...event,
        id: event.id || uid('event'),
      }))
    );
  }
}
