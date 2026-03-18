# NFTicket

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Prototype](https://img.shields.io/badge/Status-Product%20Prototype-orange)](#current-status)
[![Anchor](https://img.shields.io/badge/Anchor-Partial-blue)](#architecture-overview)

**NFTicket is a strong product prototype for modern ticketing flows on Solana-inspired rails.** The repository already includes polished buyer and organizer demos, solid pricing and resale domain modeling, and real QR scanning UX. It does **not** yet deliver a production-ready on-chain ticketing system.

![NFTicket Banner](docs/banner.png)

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

## Getting Started

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
- The apps are suitable for demos, not production operations

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

## Contributing

Contributors should treat this repo as a prototype with strong product and domain foundations. The highest-value work is reducing the gap between the polished demo experience and the still-partial production architecture.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
