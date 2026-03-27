import { expect, test } from '@playwright/test';
import { attachMockApi, createMockOrder, createMockState, createMockTicket } from './support/mockApi';
import { connectWallet, signIn } from './support/helpers';

test('mints a reserved ticket to the connected wallet', async ({ context, page }) => {
  const ticket = createMockTicket({ id: 'ticket_reserved_mint', status: 'reserved' });
  const order = createMockOrder({ id: 'order_reserved_mint', ticketId: ticket.id });
  const state = createMockState({
    tickets: [ticket],
    orders: [order],
  });

  await attachMockApi(context, state);

  await page.goto('/my-tickets');
  await signIn(page);
  await connectWallet(page);

  await page.getByTestId(`ticket-card-${ticket.id}`).click();
  await page.getByTestId('mint-ticket').click();

  await expect(page.getByText('Ticket minted to connected wallet.')).toBeVisible();
  await expect.poll(() => state.tickets.find((entry) => entry.id === ticket.id)?.status).toBe('minted');
});
