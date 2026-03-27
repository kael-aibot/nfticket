import { expect, test } from '@playwright/test';
import { attachMockApi, createMockState } from './support/mockApi';
import { signIn } from './support/helpers';

test('buys a ticket through the card checkout flow', async ({ context, page }) => {
  const state = createMockState();
  await attachMockApi(context, state);

  await page.goto('/');
  await signIn(page);

  await page.getByTestId(`event-card-${state.events[0].id}`).click();
  await page.getByTestId('payment-method-card').click();
  await page.getByTestId('purchase-submit').click();

  await page.waitForURL(/\/my-tickets\?success=true/);
  await expect(page.getByText(state.events[0].name)).toBeVisible();
  await expect(page.getByText('reserved')).toBeVisible();
  await expect.poll(() => state.tickets.length).toBe(1);
});
