import React from 'react';
import Head from 'next/head';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { HybridAuthProvider } from '../../shared/auth/HybridAuthContext';
import { createWalletAdapters } from '../../shared/lib/mockWalletAdapter';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/globals.css';

const wallets = createWalletAdapters();
const endpoint = clusterApiUrl('devnet');

export default function ProviderApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>NFTicket Provider | Event Management</title>
        <meta name="description" content="Event organizer portal for NFTicket" />
      </Head>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>
            <HybridAuthProvider>
              <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
                <Component {...pageProps} />
              </div>
            </HybridAuthProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  );
}
