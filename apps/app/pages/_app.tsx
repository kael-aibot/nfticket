import React, { useEffect } from 'react';
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

export default function NFTicketApp({ Component, pageProps }) {
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <>
      <Head>
        <title>NFTicket | Your Tickets</title>
        <meta name="description" content="NFT tickets on Solana" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>
            <HybridAuthProvider>
              <div className="min-h-screen bg-black text-white" suppressHydrationWarning>
                <Component {...pageProps} />
              </div>
            </HybridAuthProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  );
}
