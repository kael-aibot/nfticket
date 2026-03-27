import {
  BaseMessageSignerWalletAdapter,
  type WalletName,
  WalletReadyState,
} from '@solana/wallet-adapter-base';
import type { Connection, TransactionSignature } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { E2E_MOCK_WALLET_NAME, E2E_MOCK_WALLET_PUBLIC_KEY } from './e2e';

export class MockWalletAdapter extends BaseMessageSignerWalletAdapter<typeof E2E_MOCK_WALLET_NAME> {
  name = E2E_MOCK_WALLET_NAME as WalletName<typeof E2E_MOCK_WALLET_NAME>;
  url = 'https://nfticket.local/mock-wallet';
  icon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNiIgZmlsbD0iIzA2YjZkNCIvPjxwYXRoIGQ9Ik0xOCAyMGgyOHYyNEgxOHoiIGZpbGw9IiNmZmYiIG9wYWNpdHk9Ii45Ii8+PHBhdGggZD0iTTIyIDI4aDIwIiBzdHJva2U9IiMwNmI2ZDQiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTIyIDM2aDE0IiBzdHJva2U9IiMwNmI2ZDQiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+';
  readyState = WalletReadyState.Installed;
  supportedTransactionVersions = null;

  private _publicKey: PublicKey | null = null;
  private _connecting = false;

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get connected() {
    return this._publicKey !== null;
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) {
      return;
    }

    this._connecting = true;

    try {
      this._publicKey = new PublicKey(
        process.env.NEXT_PUBLIC_E2E_WALLET_PUBLIC_KEY || E2E_MOCK_WALLET_PUBLIC_KEY,
      );
      // @ts-expect-error - emit is protected but we need to call it
      this.emit('connect', this._publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._publicKey) {
      return;
    }

    this._publicKey = null;
    // @ts-expect-error - emit is protected but we need to call it
    this.emit('disconnect');
  }

  async signTransaction<T>(transaction: T): Promise<T> {
    return transaction;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    return Uint8Array.from([...Array.from(message), 1]);
  }

  async sendTransaction(
    _transaction: unknown,
    _connection: Connection,
  ): Promise<TransactionSignature> {
    return 'mock_wallet_transaction_signature';
  }
}

export function createWalletAdapters() {
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === '1') {
    return [new MockWalletAdapter()];
  }

  const { PhantomWalletAdapter, SolflareWalletAdapter } = require('@solana/wallet-adapter-wallets');
  return [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
}
