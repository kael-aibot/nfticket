import { expect, test } from '@playwright/test';
import { attachMockApi, createMockOrder, createMockState, createMockTicket } from './support/mockApi';
import { connectWallet, signIn } from './support/helpers';

test('lists a minted ticket for resale', async ({ context, page }) => {
  const ticket = createMockTicket({
    id: 'ticket_for_sale',
    status: 'minted',
    ownerWallet: '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT',
    fulfillmentStatus: 'completed',
    issuanceAttempts: 1,
    mintAddress: 'mint_ticket_for_sale',
    mintSignature: 'mint_sig_ticket_for_sale',
    assetId: 'asset_ticket_for_sale',
  });
  const order = createMockOrder({ id: 'order_for_sale', ticketId: ticket.id });
  const state = createMockState({
    tickets: [ticket],
    orders: [order],
  });

  await attachMockApi(context, state);

  await page.goto('/my-tickets');
  await signIn(page);
  await connectWallet(page);

  await page.getByTestId(`ticket-card-${ticket.id}`).click();
  await page.getByTestId('resale-price-input').fill('99');
  await page.getByTestId('list-ticket').click();

  await expect(page.getByText('Ticket listed for resale.')).toBeVisible();
  await expect.poll(() => state.resaleListings.length).toBe(1);
  await expect.poll(() => state.tickets.find((entry) => entry.id === ticket.id)?.isForSale).toBe(true);
});
