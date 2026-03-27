import { expect, test } from '@playwright/test';
import { attachMockApi, createMockState } from './support/mockApi';
import { connectWallet, signIn } from './support/helpers';

test('connects and disconnects the mock wallet', async ({ context, page }) => {
  await attachMockApi(context, createMockState());

  await page.goto('/my-tickets');
  await signIn(page);

  // Initial state: wallet not connected
  await expect(page.getByTestId('wallet-button')).toHaveText('Connect Mock Wallet');
  await expect(page.getByText('Wallet not connected yet.')).toBeVisible();

  // Connect wallet
  await connectWallet(page);
  await expect(page.getByTestId('wallet-button')).toContainText('Disconnect');

  // Disconnect wallet
  await page.getByTestId('wallet-button').click();
  await expect(page.getByTestId('wallet-button')).toHaveText('Connect Mock Wallet');
});
