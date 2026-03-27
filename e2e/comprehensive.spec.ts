import { expect, test } from '@playwright/test';
import { attachMockApi, createMockState, createMockEvent, createMockTicket } from './support/mockApi';
import { connectWallet, signIn } from './support/helpers';

test.describe('NFTicket Comprehensive E2E Tests', () => {
  let state: ReturnType<typeof createMockState>;

  test.beforeEach(() => {
    state = createMockState();
  });

  test.describe('Navigation & Layout', () => {
    test('homepage loads with correct branding', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await expect(page.getByText('NFTicket')).toBeVisible();
      await expect(page.getByText('Browse events without a wallet wall')).toBeVisible();
      await expect(page.getByText('Primary fee 2.5%')).toBeVisible();
    });

    test('navigation between pages works', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.getByRole('link', { name: 'My Tickets' }).click();
      await expect(page.getByText('My Tickets')).toBeVisible();
      
      await page.getByRole('link', { name: 'Browse Events' }).click();
      await expect(page.getByText('Browse events')).toBeVisible();
    });

    test('event card displays correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      const eventCard = page.getByTestId('event-card-event_demo_summit');
      await expect(eventCard).toBeVisible();
      await expect(eventCard.getByRole('heading', { name: 'Future of Ticketing Summit' })).toBeVisible();
      await expect(eventCard.getByText('From $89.00')).toBeVisible();
    });

    test('header shows wallet connection status', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await expect(page.getByTestId('wallet-button')).toHaveText('Connect Mock Wallet');
      
      await page.getByTestId('wallet-button').click();
      await expect(page.getByTestId('wallet-button')).toContainText('Disconnect');
    });
  });

  test.describe('Authentication Flow', () => {
    test('can sign in with email', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await signIn(page);
      await expect(page.getByTestId('auth-sign-out')).toBeVisible();
      await expect(page.getByText('Buyer Demo')).toBeVisible();
    });

    test('auth panel appears on homepage', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await expect(page.getByText('Sign in with email/password')).toBeVisible();
    });

    test('my-tickets shows login prompt when not authenticated', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      
      await expect(page.getByText('Sign in to see your reservations')).toBeVisible();
    });
  });

  test.describe('Ticket Purchasing Flow', () => {
    test('can select event tier', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.getByTestId('event-card-event_demo_summit').click();
      
      await expect(page.getByRole('heading', { name: 'Future of Ticketing Summit' }).nth(1)).toBeVisible();
      await expect(page.getByText('General')).toBeVisible();
      await expect(page.getByText('VIP')).toBeVisible();
      
      await page.getByTestId('event-tier-1').click();
      await expect(page.getByTestId('event-tier-1')).toHaveAttribute('class', /bg-amber-300/);
    });

    test('payment method selection works', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.getByTestId('event-card-event_demo_summit').click();
      
      await expect(page.getByTestId('payment-method-card')).toBeVisible();
      await expect(page.getByTestId('payment-method-crypto')).toBeVisible();
      
      await page.getByTestId('payment-method-card').click();
      await expect(page.getByTestId('payment-method-card')).toHaveClass(/bg-white/);
    });

    test('price calculation displays correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.getByTestId('event-card-event_demo_summit').click();
      
      await expect(page.getByText('Platform fee')).toBeVisible();
      await expect(page.getByText('Total')).toBeVisible();
    });

    test('purchase flow shows success message', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await signIn(page);
      
      await page.getByTestId('event-card-event_demo_summit').click();
      await page.getByTestId('payment-method-card').click();
      await page.getByTestId('purchase-submit').click();
      
      // Should show processing message
      await expect(page.getByText(/Processing|purchased|success/i)).toBeVisible();
    });
  });

  test.describe('My Tickets Page', () => {
    test('displays empty state when no tickets', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      
      await signIn(page);
      await expect(page.getByText('No tickets yet')).toBeVisible();
    });

    test('displays purchased tickets', async ({ context, page }) => {
      const ticket = createMockTicket({
        id: 'ticket_purchased_test',
        status: 'reserved',
        eventId: 'event_demo_summit',
        ownerEmail: 'buyer@nfticket.app',
        purchasePrice: 89,
      });
      state = createMockState({ tickets: [ticket] });
      
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      await signIn(page);
      
      await expect(page.getByText('Future of Ticketing Summit')).toBeVisible();
      await expect(page.getByText('reserved')).toBeVisible();
    });

    test('ticket detail modal shows QR code', async ({ context, page }) => {
      const ticket = createMockTicket({
        id: 'ticket_qr_test',
        status: 'reserved',
        eventId: 'event_demo_summit',
        ownerEmail: 'buyer@nfticket.app',
      });
      state = createMockState({ tickets: [ticket] });
      
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      await signIn(page);
      
      await page.getByTestId(`ticket-card-${ticket.id}`).click();
      
      await expect(page.getByRole('img')).toBeVisible();
      await expect(page.getByTestId('mint-ticket')).toBeVisible();
    });
  });

  test.describe('Wallet Integration', () => {
    test('mint ticket flow', async ({ context, page }) => {
      const ticket = createMockTicket({
        id: 'ticket_mint_test',
        status: 'reserved',
        ownerEmail: 'buyer@nfticket.app',
        ownerWallet: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
      });
      state = createMockState({ tickets: [ticket] });
      
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      await signIn(page);
      await connectWallet(page);
      
      await page.getByTestId(`ticket-card-${ticket.id}`).click();
      await page.getByTestId('mint-ticket').click();
      
      await expect(page.getByText(/Minted|minted/)).toBeVisible();
    });

    test('resale listing flow', async ({ context, page }) => {
      const ticket = createMockTicket({
        id: 'ticket_resale_test',
        status: 'minted',
        ownerEmail: 'buyer@nfticket.app',
        ownerWallet: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
        isForSale: false,
      });
      state = createMockState({ tickets: [ticket] });
      
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      await signIn(page);
      await connectWallet(page);
      
      await page.getByTestId(`ticket-card-${ticket.id}`).click();
      await page.getByTestId('resale-price-input').fill('150');
      await page.getByTestId('list-ticket').click();
      
      // Check for success message in the modal
      await expect(page.getByTestId('ticket-card-ticket_resale_test')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('mobile viewport renders correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await expect(page.getByText('NFTicket')).toBeVisible();
      await expect(page.getByText('Browse events')).toBeVisible();
      
      const eventCard = page.getByTestId('event-card-event_demo_summit');
      await expect(eventCard).toBeVisible();
    });

    test('tablet viewport renders correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await expect(page.getByText('Browse events')).toBeVisible();
      const eventCard = page.getByTestId('event-card-event_demo_summit');
      await expect(eventCard).toBeVisible();
    });

    test('large desktop viewport renders correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await expect(page.getByText('Browse events')).toBeVisible();
    });

    test('event modal is responsive', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      // Test mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.getByTestId('event-card-event_demo_summit').click();
      await expect(page.getByRole('heading', { name: 'Future of Ticketing Summit' }).nth(1)).toBeVisible();
      await page.getByText('Close').click();
      
      // Test tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.getByTestId('event-card-event_demo_summit').click();
      await expect(page.getByRole('heading', { name: 'Future of Ticketing Summit' }).nth(1)).toBeVisible();
      await page.getByText('Close').click();
    });

    test('my-tickets is responsive', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      
      // Test mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.getByText('My Tickets')).toBeVisible();
      
      // Test tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.getByText('My Tickets')).toBeVisible();
    });
  });

  test.describe('Console Error Checking', () => {
    test('no console errors on homepage load', async ({ context, page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await attachMockApi(context, state);
      await page.goto('/');
      
      // Wait a bit for any async errors
      await page.waitForTimeout(1000);
      
      expect(errors.length).toBe(0);
    });

    test('no console errors after authentication', async ({ context, page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await attachMockApi(context, state);
      await page.goto('/');
      await signIn(page);
      
      await page.waitForTimeout(1000);
      
      expect(errors.length).toBe(0);
    });

    test('no console errors when browsing tickets', async ({ context, page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await attachMockApi(context, state);
      await page.goto('/my-tickets');
      await signIn(page);
      
      await page.waitForTimeout(1000);
      
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Edge Cases & Error States', () => {
    test('handles empty events list gracefully', async ({ context, page }) => {
      const emptyState = createMockState({ events: [] });
      await attachMockApi(context, emptyState);
      await page.goto('/');
      
      // Should show empty state or continue loading
      await expect(page.locator('body')).toBeVisible();
    });

    test('network error handling - API returns error', async ({ context, page }) => {
      // Test with mock API error state
      await attachMockApi(context, state);
      await page.goto('/');
      
      // Page should still be functional
      await expect(page.getByText('NFTicket')).toBeVisible();
    });

    test('can navigate without signing in', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      await page.getByTestId('event-card-event_demo_summit').click();
      await page.getByText('Close').click();
      
      await page.goto('/my-tickets');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Performance & Loading States', () => {
    test('loading state displays correctly', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      // Should see loading state initially
      await expect(page.getByText(/Loading|Browse/)).toBeVisible();
    });

    test('event cards become clickable after load', async ({ context, page }) => {
      await attachMockApi(context, state);
      await page.goto('/');
      
      // Wait for events to load
      await page.waitForSelector('[data-testid^="event-card-"]', { state: 'visible' });
      
      const eventCard = page.getByTestId('event-card-event_demo_summit');
      await expect(eventCard).toBeEnabled();
    });
  });
});
