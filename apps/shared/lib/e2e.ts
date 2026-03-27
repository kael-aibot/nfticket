export const E2E_MOCK_WALLET_NAME = 'Playwright Mock Wallet';
export const E2E_MOCK_WALLET_PUBLIC_KEY = '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT';

export function isE2ETestMode() {
  return process.env.NEXT_PUBLIC_E2E_TEST_MODE === '1';
}
