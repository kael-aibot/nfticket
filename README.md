# NFTicket

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet-purple)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.29-blue)](https://anchor-lang.com)

**Open-source NFT ticketing on Solana** — eliminating fraud, enabling transparent pricing, and solving the resale problem through programmable royalty splits.

![NFTicket Banner](docs/banner.png)

## ✨ Features

- **🎫 NFT Tickets** — Non-counterfeitable, verifiable on-chain
- **💰 Transparent Pricing** — 2.5% platform fee, no hidden charges
- **↔️ Smart Resale** — Time-decaying premiums + triple-split profit sharing
- **📱 Mobile-First** — Dedicated apps for organizers and attendees
- **🔒 Anti-Fraud** — QR code validation with on-chain verification
- **⚡ Fast & Cheap** — Solana's low fees (~$0.01 per transaction)

## 🏗️ Architecture

```
nfticket/
├── apps/
│   ├── provider/          # Event organizer portal (Next.js)
│   │   ├── pages/
│   │   │   ├── index.tsx       # Dashboard
│   │   │   ├── create.tsx      # Create events
│   │   │   ├── events/[id].tsx # Event management
│   │   │   └── scanner.tsx     # Ticket scanner
│   │   └── package.json
│   │
│   └── app/               # Ticket buyer app (Next.js, mobile-first)
│       ├── pages/
│       │   ├── index.tsx       # Browse events
│       │   └── my-tickets.tsx  # View & use tickets
│       └── package.json
│
├── apps/shared/           # Shared hooks & types
│   ├── hooks/useNfticket.ts
│   └── idl/nfticket.json
│
├── anchor-program/        # Solana smart contract
│   └── src/lib.rs
│
└── docs/                  # Documentation
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) for Anchor
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nfticket.git
cd nfticket
```

### 2. Install Dependencies

```bash
# Install shared dependencies
cd apps/shared
npm install
cd ../..

# Install provider app
cd apps/provider
npm install
cd ../..

# Install buyer app
cd apps/app
npm install
cd ../..
```

### 3. Configure Solana

```bash
# Set to devnet for testing
solana config set --url devnet

# Generate a new keypair (or use existing)
solana-keygen new --outfile ~/.config/solana/id.json

# Airdrop SOL for testing
solana airdrop 2
```

### 4. Build & Deploy the Program

```bash
cd anchor-program
anchor build
anchor deploy

# Copy the new program ID to your apps
# Update apps/shared/hooks/useNfticket.ts with the deployed program ID
```

### 5. Run the Apps

```bash
# Terminal 1: Provider Portal
cd apps/provider
npm run dev
# Open http://localhost:3001

# Terminal 2: Buyer App
cd apps/app
npm run dev
# Open http://localhost:3002
```

## 📖 Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md)** — System design & data flow
- **[Smart Contract](docs/CONTRACT.md)** — Anchor program documentation
- **[Provider Guide](docs/PROVIDER.md)** — Event organizer setup
- **[API Reference](docs/API.md)** — Program instruction reference

## 🎨 Screenshots

| Provider Dashboard | Create Event | Ticket Scanner |
|-------------------|--------------|----------------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Create](docs/screenshots/create.png) | ![Scanner](docs/screenshots/scanner.png) |

| Browse Events | My Tickets | QR Code |
|---------------|------------|---------|
| ![Browse](docs/screenshots/browse.png) | ![Tickets](docs/screenshots/tickets.png) | ![QR](docs/screenshots/qr.png) |

## 💡 How It Works

### For Event Organizers

1. **Create Event** — Set name, date, venue, ticket tiers
2. **Configure Resale** — Set time-decay curve & profit splits
3. **Authorize Scanners** — Add staff wallets for entry validation
4. **Track Sales** — Real-time revenue & attendance analytics

### For Ticket Buyers

1. **Browse Events** — Discover upcoming events
2. **Purchase** — Buy with SOL/USDC, receive NFT ticket
3. **Show QR** — Present at entry for scanning
4. **Resell Fairly** — List on marketplace with enforced price limits

### Smart Resale Algorithm

As the event approaches, maximum resale premium **decreases**:

| Time Until Event | Max Premium |
|-----------------|-------------|
| > 60 days | 50% above face |
| 30-60 days | 30% above face |
| 7-30 days | 15% above face |
| < 7 days | 5% above face |
| Day of event | Face value only |

**Profit Split:** 40% original buyer, 40% organizer, 20% charity

## 🛠️ Tech Stack

- **Blockchain:** Solana
- **Smart Contract:** Rust + Anchor Framework
- **Frontend:** Next.js 14 + Tailwind CSS
- **Web3:** Solana Web3.js + Wallet Adapter
- **Storage:** Arweave/IPFS for NFT metadata

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Solana Foundation](https://solana.org) for the amazing ecosystem
- [Anchor Framework](https://anchor-lang.com) for making Solana development accessible
- [Metaplex](https://metaplex.com) for NFT standards

## 📧 Contact

- Twitter: [@nfticket](https://twitter.com/nfticket)
- Discord: [Join our community](https://discord.gg/nfticket)
- Email: hello@nfticket.app

---

**Made with ❤️ for the Solana community**
