import { expect, test } from '@playwright/test';

test.describe('NFTicket Visual Tests', () => {
  test('capture homepage screenshot', async ({ page, context }) => {
    // Set up mock API
    await context.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{ id: 'user_buyer_demo', email: 'buyer@nfticket.app', name: 'Buyer Demo', role: 'buyer', wallets: [], authMode: 'email', kycStatus: 'not_required' }],
          currentUser: null,
          events: [{
            id: 'event_demo_summit',
            organizerId: 'user_provider_demo',
            organizerName: 'Demo Organizer',
            organizerWallet: null,
            name: 'Future of Ticketing Summit',
            description: 'Panels, demos, and partner networking',
            eventDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
            venue: 'Pier 48, San Francisco',
            tiers: [
              { name: 'General', price: 89, supply: 250, sold: 12, benefits: 'Main floor access' },
              { name: 'VIP', price: 229, supply: 40, sold: 4, benefits: 'Speaker dinner' }
            ],
            acceptedPayments: ['card', 'crypto'],
            isActive: true,
            totalTicketsSold: 16,
            totalRevenue: 1984,
            authorizedScanners: ['scanner:front-gate'],
            authRequirements: { mode: 'hybrid', requireVerifiedEmail: true, requireWalletLink: false, requireKyc: false },
            resaleConfig: { platformFeePercent: 2.5, resaleDecay: {}, royaltySplit: {} },
            createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
          }],
          tickets: [], orders: [], resaleListings: [], payoutSplits: [], transferAudit: [], fraudFlags: [], failedFlows: [], incidentAlerts: [], sequence: 1
        }),
      });
      await route.continue();
    });

    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/homepage.png', fullPage: true });
  });

  test('capture my-tickets page screenshot', async ({ page, context }) => {
    await context.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{ id: 'user_buyer_demo', email: 'buyer@nfticket.app', name: 'Buyer Demo', role: 'buyer', wallets: [], authMode: 'email', kycStatus: 'not_required' }],
          currentUser: { id: 'user_buyer_demo', email: 'buyer@nfticket.app', name: 'Buyer Demo', role: 'buyer', wallets: [], authMode: 'email', kycStatus: 'not_required' },
          events: [],
          tickets: [], orders: [], resaleListings: [], payoutSplits: [], transferAudit: [], fraudFlags: [], failedFlows: [], incidentAlerts: [], sequence: 1
        }),
      });
      await route.continue();
    });

    await page.goto('http://localhost:3002/my-tickets');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/my-tickets.png', fullPage: true });
  });

  test('capture event modal screenshot', async ({ page, context }) => {
    await context.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{ id: 'user_buyer_demo', email: 'buyer@nfticket.app', name: 'Buyer Demo', role: 'buyer', wallets: [], authMode: 'email', kycStatus: 'not_required' }],
          currentUser: null,
          events: [{
            id: 'event_demo_summit',
            organizerId: 'user_provider_demo',
            organizerName: 'Demo Organizer',
            organizerWallet: null,
            name: 'Future of Ticketing Summit',
            description: 'Panels, demos, and partner networking',
            eventDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
            venue: 'Pier 48, San Francisco',
            tiers: [
              { name: 'General', price: 89, supply: 250, sold: 12, benefits: 'Main floor access' },
              { name: 'VIP', price: 229, supply: 40, sold: 4, benefits: 'Speaker dinner' }
            ],
            acceptedPayments: ['card', 'crypto'],
            isActive: true,
            totalTicketsSold: 16,
            totalRevenue: 1984,
            authorizedScanners: ['scanner:front-gate'],
            authRequirements: { mode: 'hybrid', requireVerifiedEmail: true, requireWalletLink: false, requireKyc: false },
            resaleConfig: { platformFeePercent: 2.5, resaleDecay: {}, royaltySplit: {} },
            createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
          }],
          tickets: [], orders: [], resaleListings: [], payoutSplits: [], transferAudit: [], fraudFlags: [], failedFlows: [], incidentAlerts: [], sequence: 1
        }),
      });
      await route.continue();
    });

    await page.goto('http://localhost:3002/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="event-card-event_demo_summit"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/event-modal.png', fullPage: false });
  });
});
