import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page, email = 'buyer@nfticket.app', password = 'demo1234') {
  await expect(page.getByTestId('auth-submit')).toBeVisible();
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('auth-sign-out')).toBeVisible();
}

export async function connectWallet(page: Page) {
  await page.getByTestId('wallet-button').click();
  await expect(page.getByTestId('wallet-button')).toContainText('Disconnect');
}
