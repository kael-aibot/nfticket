import React, { useState } from 'react';
import Head from 'next/head';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/globals.css';

// Wallet configuration
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
const endpoint = clusterApiUrl('devnet'); // Use devnet for testing

function NFTicketApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>NFTicket - Solana NFT Ticketing</title>
        <meta name="description" content="Decentralized ticketing on Solana" />
      </Head>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
              <nav className="p-6 border-b border-white/10 backdrop-blur-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                  <h1 className="text-3xl font-bold text-white">🎫 NFTicket</h1>
                  <div className="flex gap-4">
                    <a href="/" className="text-white/80 hover:text-white transition">
                      Events
                    </a>
                    <a href="/provider" className="text-white/80 hover:text-white transition">
                      Provider Portal
                    </a>
                    <a href="/my-tickets" className="text-white/80 hover:text-white transition">
                      My Tickets
                    </a>
                    <a href="/scanner" className="text-white/80 hover:text-white transition">
                      Scanner
                    </a>
                  </div>
                </div>
              </nav>
              <main className="max-w-7xl mx-auto p-6">
                <Component {...pageProps} />
              </main>
            </div>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  );
}

export default NFTicketApp;