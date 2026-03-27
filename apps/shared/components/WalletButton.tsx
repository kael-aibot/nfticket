import React, { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { E2E_MOCK_WALLET_NAME, isE2ETestMode } from '../lib/e2e';

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const wallet = useWallet();

  // Auto-select mock wallet in e2e mode on first render
  useEffect(() => {
    if (!isE2ETestMode()) return;
    if (wallet.wallet) return; // Already selected

    const mockWallet = wallet.wallets.find((w) => w.adapter.name === E2E_MOCK_WALLET_NAME);
    if (mockWallet) {
      wallet.select(mockWallet.adapter.name);
    }
  }, [wallet]);

  if (!isE2ETestMode()) {
    return <WalletMultiButton className={className} />;
  }

  const shortAddress = wallet.publicKey
    ? `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <button
      data-testid="wallet-button"
      onClick={async () => {
        if (wallet.connected) {
          await wallet.disconnect();
          return;
        }
        await wallet.connect();
      }}
      className={className}
      type="button"
    >
      {wallet.connected ? `Disconnect ${shortAddress}` : 'Connect Mock Wallet'}
    </button>
  );
}
