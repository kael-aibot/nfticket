# NFTicket

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Product%20Prototype-orange)](#current-status)
[![Mobile Ready](https://img.shields.io/badge/Mobile-Ready-brightgreen)](#mobile-installation)

**NFTicket is a mobile-first NFT ticketing platform for modern events on Solana-inspired rails.** The repository includes polished buyer and organizer web apps with real QR scanning UX, solid pricing and resale domain modeling, and a strong foundation for production deployment.

![NFTicket Banner](docs/banner.png)

## 📱 Mobile Installation

**NFTicket works directly in your mobile browser** - no app store needed!

### Quick Setup (30 seconds)
1. Open browser on your phone (Safari on iOS, Chrome on Android)
2. Visit the deployed app URLs (see Deployment section)
3. **Optional**: Add to Home Screen for app-like experience

**iOS (Safari):** Share button → "Add to Home Screen"  
**Android (Chrome):** Menu (⋮) → "Add to Home Screen"

👉 **See full mobile guide:** [`MOBILE-QUICKSTART.md`](./MOBILE-QUICKSTART.md)

## Current Status

> [!WARNING]
> **This repository is currently a sophisticated product prototype, not a production Solana system.**
>
> - The active apps are polished local demos with browser `localStorage` as the source of truth.
> - Payments are simulated in the UI, not real Stripe, SOL, or USDC settlement flows.
> - Ticket minting uses placeholder mint data, not real Metaplex NFT issuance.
> - The Anchor program exists as a partial smart-contract foundation, but it is not integrated into the live app flows.

That said, the foundation is strong. The current implementation is useful for product demos, UX iteration, domain validation, and contributor onboarding into the target architecture.

## Features

### ✅ Implemented

- Buyer mobile web app for browsing events and viewing tickets
- Organizer dashboard for creating events, managing inventory, and running scans
- Local-first ticket lifecycle flows backed by browser `localStorage`
- Domain logic for pricing, resale caps, payout splits, fraud flags, and transfer rules
- QR code generation plus real camera-based scanning UX in the provider app
- Demo auth/session flows and wallet-connected UX for prototype scenarios

### 🚧 Partial

- Anchor program structure for events, tickets, resale listings, scanner authorization, and scan state transitions
- Shared service/domain modules in `lib/` that model the intended production backend architecture
- Prisma schema that describes a future persistent data model

### ❌ Not Yet Implemented

- Real on-chain ticket ownership as the active apps' source of truth
- Real Stripe, SOL, or USDC payment processing and reconciliation
- Real Metaplex NFT minting and metadata storage
- Backend/API persistence replacing browser-local state
- Authoritative scan validation against backend or chain state
- Production auth, secure sessions, and operational tooling

## Tech Stack

### Wired Up Today

- `Next.js 14` apps in `apps/app` and `apps/provider`
- Shared TypeScript logic in `apps/shared`
- Browser `localStorage` for demo persistence
- `html5-qrcode` and `qrcode.react` for ticket QR flows
- Solana wallet libraries for prototype wallet UX and future integration points

### Present but Not Fully Wired Into Runtime

- `anchor-program/` with a partial Rust + Anchor contract
- `lib/` service/domain modules for payments, minting, fulfillment, marketplace rules, and operations
- `prisma/schema.prisma` for future durable persistence

### Planned Target Stack

- Solana as the production settlement/ownership layer
- Anchor for finalized on-chain ticketing logic
- Metaplex for real NFT issuance
- Prisma + database-backed APIs for durable off-chain state
- Real fiat and crypto payment rails with reconciliation and retryable fulfillment

## Architecture Overview

- `apps/app/` = buyer mobile app. This is an active local demo that stores data in browser `localStorage`.
- `apps/provider/` = organizer dashboard and scanner. This is also an active local demo backed by browser `localStorage`.
- `apps/shared/` = shared frontend hooks, demo storage utilities, auth helpers, and UI/domain helpers used by the active apps.
- `anchor-program/` = partial Anchor smart contract modeling the intended on-chain system, but not integrated into the running apps.
- `lib/` = domain and service foundations for payments, fulfillment, resale, fraud controls, indexing, and operations. These modules are architectural groundwork, not the live runtime path.
- `prisma/` = schema definitions only. There is no runtime database integration yet.

## 🌐 Deployment (Mobile Access)

**For public use, deploy to a hosting platform:**

### Recommended: Vercel (Free Tier)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy buyer app
cd apps/app && vercel --prod

# Deploy provider app  
cd apps/provider && vercel --prod
```

### Alternative: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd apps/app && netlify deploy --prod
cd apps/provider && netlify deploy --prod
```

### Self-Hosted (Docker)
```bash
# Build and serve with Docker
docker build -t nfticket-app -f apps/app/Dockerfile .
docker build -t nfticket-provider -f apps/provider/Dockerfile .
```

---

## 💻 Getting Started (Local Development)

The current project runs as a **local demo environment**. It is best used for exploring flows, validating UX, and iterating toward the production architecture.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- `npm`

Rust, Solana CLI, and Anchor are only needed if you want to inspect or build the partial smart contract separately.

### Install dependencies

```bash
npm run install:all
```

### Run the demo apps

```bash
npm run dev
```

Then open:

- Organizer dashboard: `http://localhost:3001`
- Buyer app: `http://localhost:3002`

### Important demo behavior

- Data is stored per browser in `localStorage`
- Refreshing or switching browsers can change what data you see
- Payments, minting, and ownership are simulated
- **For production**: Deploy to Vercel/Netlify and configure environment variables

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required for mobile deployment:**
- `NEXT_PUBLIC_APP_URL` - Your deployed URL (e.g., `https://nfticket.vercel.app`)
- `NEXT_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint (devnet for testing)
- `SESSION_SECRET` - Random 32+ character string

**Optional:**
- `SOLANA_PAYER_SECRET` - For on-chain minting (devnet only)
- `STRIPE_*` keys - For credit card payments
- `DATABASE_URL` - For persistent backend storage

See `.env.example` for full configuration options.

### Optional: inspect the partial Anchor program

```bash
cd anchor-program
anchor build
```

This contract is still incomplete and is not the source of truth for the active apps.

## Documentation

- [CODEX Evaluation](CODEX-EVALUATION.md) for the current-state assessment
- [Implementation Roadmap](IMPLEMENTATION-ROADMAP.md) for the broader architecture direction
- [Architecture Decisions](ARCHITECTURE-DECISIONS.md) for design rationale
- [Architecture Notes](docs/ARCHITECTURE.md) for system documentation-in-progress

## Roadmap

The current implementation plan in [CODEX-EVALUATION.md](CODEX-EVALUATION.md) outlines a `Phase 0` alignment step plus nine delivery phases to move from prototype to a coherent production system:

1. **Phase 0:** Choose and document the real product path
2. **Phase 1:** Restore build health and CI credibility
3. **Phase 2:** Collapse the runtime onto one architecture
4. **Phase 3:** Complete production auth
5. **Phase 4:** Wire real payments and fulfillment
6. **Phase 5:** Finish NFT issuance
7. **Phase 6:** Complete and harden the Anchor program
8. **Phase 7:** Make scanning authoritative
9. **Phase 8:** Complete resale and payout flows
10. **Phase 9:** Testing, observability, and launch readiness

The near-term priority is straightforward: make the prototype honest, stable, and easier to extend, then replace local demo infrastructure with durable backend, payment, and blockchain integrations.

## 📱 Mobile Setup

**For contributors working on mobile:**

1. Clone and install: `npm run install:all`
2. Run both apps: `npm run dev`
3. Test on mobile device:
   - Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
   - Access from phone: `http://YOUR_IP:3002` (buyer) or `:3001` (provider)
4. Test PWA "Add to Home Screen" functionality
5. Verify responsive design at breakpoints: 375px (mobile), 768px (tablet), 1920px (desktop)

**Mobile testing tools:**
- Browser DevTools (Device Mode)
- Real device testing (recommended)
- E2E tests: `npm run test:e2e` (Playwright)

See [`MOBILE-QUICKSTART.md`](./MOBILE-QUICKSTART.md) for end-user instructions.

---

## Contributing

Contributors should treat this repo as a prototype with strong product and domain foundations. The highest-value work is reducing the gap between the polished demo experience and the still-partial production architecture.

**Mobile-first contributions welcome!** NFTicket is designed to work seamlessly on mobile browsers.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

### Mobile Contribution Checklist

- [ ] Test on both iOS Safari and Android Chrome
- [ ] Verify "Add to Home Screen" works
- [ ] Check responsive layouts (375px, 768px, 1920px)
- [ ] Ensure touch targets are large enough (min 44px)
- [ ] Test QR scanner on actual camera
- [ ] No console errors on mobile

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
