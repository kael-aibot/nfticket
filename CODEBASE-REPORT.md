# NFTicket Codebase Report

## 1. Project Overview

NFTicket is an NFT-based ticketing platform intended to run on Solana. The product goal is clear across the docs and UI copy:

- Let organizers create events and issue tickets.
- Let buyers purchase tickets, view QR codes, and resell them under pricing constraints.
- Let staff scan tickets at entry and prevent reuse.
- Enforce resale rules and royalty splits programmatically.

Current reality: the repository contains both a Solana/Anchor implementation path and a local-first demo path. The actively buildable `apps/app` and `apps/provider` applications currently behave like an offline prototype backed by browser `localStorage`, seeded demo users, and simulated payment records rather than real on-chain state.

## 2. Codebase Structure Analysis

### Top-level layout

- `anchor-program/`: Anchor smart contract in Rust.
- `apps/provider/`: organizer-facing Next.js app.
- `apps/app/`: buyer-facing Next.js app.
- `apps/shared/`: shared auth, data model, storage, pricing, mock data, and UI helpers.
- `frontend/`: older separate Next.js frontend with partial direct Anchor integration and many mocked screens.
- `docs/`: architecture, deployment, and product-interface docs.
- `.github/workflows/ci.yml`: CI workflow.

### Important files

- `anchor-program/src/lib.rs`: core on-chain event/ticket logic.
- `apps/shared/hooks/useNfticket.ts`: primary runtime data layer for `apps/*`; uses local storage, not Anchor.
- `apps/shared/auth/HybridAuthContext.tsx`: hybrid auth abstraction with local credential storage and fake social login.
- `apps/shared/lib/storage.ts`: browser-local persistence for users, events, tickets, orders, and settings.
- `apps/shared/lib/payments.ts`: simulated payment service that marks orders as paid.
- `apps/provider/pages/*` and `apps/app/pages/*`: current UI entry points.
- `frontend/hooks/useNfticket.ts`: alternate Anchor-backed hook with partial implementation and some broken code paths.

### Organization assessment

The repo is understandable at a high level, but structurally inconsistent:

- `apps/*` is the current main product path.
- `frontend/` is a second, partially overlapping frontend that appears older or experimental.
- Shared logic exists in `apps/shared`, while `apps/app/shared` and `apps/provider/shared` are thin re-exports plus copied IDL/package artifacts.
- Build artifacts and local install state exist inside the tree (`.next/`, `node_modules/` directories under app folders), which adds noise even if `.gitignore` excludes them.

## 3. Technology Stack

### Languages

- TypeScript/React for frontends.
- Rust for the Solana program.
- Markdown for docs.

### Frontend stack

- Next.js 14, pages router.
- React 18.
- Tailwind CSS utility classes in components.
- Solana wallet adapter packages.
- `html5-qrcode` for camera scanning in the provider app.
- `qrcode.react` for ticket QR rendering.

### Blockchain stack

- Solana.
- Anchor `0.29.0`.
- `@coral-xyz/anchor`.
- `@solana/web3.js`.

### Data and auth

- Browser `localStorage` for users, sessions, events, tickets, settings, and orders.
- No real backend/API layer.
- No real payment processor integration despite Stripe/Solana terminology.

## 4. Architecture Assessment

### Implemented runtime architecture

For `apps/app` and `apps/provider`, the real runtime architecture is:

1. UI calls `useNfticket`.
2. `useNfticket` seeds demo data if needed.
3. Data is read/written from `localStorage`.
4. Payment is simulated by writing a paid order record locally.
5. Wallet connection is optional and only changes local ticket status.

This is a valid prototype architecture for UX exploration, but it is not a blockchain application in production terms.

### Intended architecture

The intended architecture in docs is:

1. Next.js apps connect to wallets.
2. Apps call the Anchor program.
3. Anchor stores event/ticket state on Solana.
4. Scanner validates tickets on-chain.
5. Resale rules and royalty splits are enforced on-chain.

That architecture is only partially present.

### Patterns in use

- Custom React hook as application service layer.
- Shared library package for cross-app code reuse.
- Context-based auth state.
- Static page-driven Next.js apps.
- Local-first state simulation instead of server/API design.

### Architectural gaps

- No single authoritative backend path: `apps/*` and `frontend/` diverge.
- No API boundary for payments, order reconciliation, email, notifications, or admin operations.
- No persistence beyond browser storage.
- No reliable mapping between off-chain checkout and on-chain minting.
- No defined migration strategy from prototype storage to real chain/indexer/backend state.

## 5. Code Quality Review

### Strengths

- The code is readable and easy to follow.
- Shared pricing/settings/storage abstractions keep the demo logic centralized.
- UI flows are coherent enough to exercise the product concept.
- `apps/provider` and `apps/app` both build successfully in production mode.

### Issues and technical debt

#### High impact

- Major mismatch between branding/docs and implementation. The apps present themselves as Solana NFT ticketing, but core flows are mock/local-only.
- Two frontend codepaths exist with overlapping responsibilities (`apps/*` and `frontend/`).
- Anchor program and frontend are not truly integrated in the active apps.
- Tests are effectively absent. `tests/` is empty and no component or integration suite exists.

#### Medium impact

- Root lint is broken: `npm run lint` fails because no ESLint config exists at the repo root.
- CI suppresses failures with `|| true` on lint, app builds, and Anchor tests, so it does not enforce quality.
- TypeScript is loose (`strict: false`) in the app tsconfigs.
- `any` is used in important places such as scanner results and the alternate frontend hook.
- Shared package has no `build` script, yet root build attempts to build it and ignores the failure.
- README references docs that do not exist: `docs/CONTRACT.md`, `docs/PROVIDER.md`, and `docs/API.md`.

#### Low impact

- Some UI text still includes placeholder GitHub URLs and contact links.
- Demo credentials are hard-coded in the UI and seed data.
- `frontend/` contains incomplete code and at least one obvious broken expression in `addScanner`.

## 6. Security Considerations

### Frontend/app security

- Credentials are stored in plaintext in browser `localStorage`.
- Session state is local-only and trivially mutable.
- Demo passwords are hard-coded.
- Social login is simulated and does not verify identity.
- Payment success is simulated entirely client-side.
- Local event/ticket/order data can be edited by any user through the browser.

This is acceptable only for a prototype. It is not acceptable for any environment with real users or money.

### Smart contract security

The Anchor program has a reasonable conceptual model, but important production protections are missing or incomplete:

- No actual SOL/token transfers in `mint_ticket` or `buy_resale_ticket`.
- Resale royalty shares are calculated but not distributed.
- No NFT minting or token metadata handling despite the product premise.
- Fixed account space allocations (`1000`, `500`) are unsafe for variable-length strings/vectors and can fail or constrain legitimate inputs.
- Many error codes exist without corresponding validation logic.
- No PDA-based account derivation strategy; accounts are arbitrary keypairs.
- No event closure, ticket invalidation, or resale cancellation instruction implementation despite context structs existing.
- No tests covering account constraints, overflow, resale limits, scanner authorization, or replay/edge cases.

### Operational security

- Program ID is still the placeholder `NFTicket111111111111111111111111111111111111`.
- Deployment docs describe env vars, but the active apps do not actually consume them.
- No secrets management, audit trail, rate limiting, or abuse controls exist because there is no real backend.

## 7. Completeness Audit

### Working today

- Provider UI for dashboard, event creation, event detail, settings, and scanner.
- Buyer UI for browsing events, purchasing tickets in demo mode, viewing tickets, mint/resale state transitions in demo mode.
- Local seeding of demo users and demo events.
- Local pricing calculations and resale cap calculations.
- Camera-based QR scanning UI in `apps/provider`.
- Next.js production builds for `apps/provider` and `apps/app`.

### Partial or misleading

- Wallet integration exists, but in the active apps it is mostly optional decoration around local state.
- “Mint to wallet” does not mint an NFT; it flips a local ticket status.
- “Card” and “crypto” checkout do not integrate with a processor or chain transfer.
- Scanner admits entry by changing local status, not by authoritative on-chain verification.
- Anchor program models events and tickets, but does not complete token economics or NFT issuance.
- `frontend/` contains more direct Anchor calls, but it is not the main app path and is incomplete.

### Missing

- Real event discovery backend or indexer.
- Real wallet-required on-chain ticket minting in active apps.
- NFT minting and metadata storage.
- Real payment processing and settlement.
- Real resale transfer and funds distribution.
- Real authentication.
- Test coverage.
- Observability and error reporting.
- API documentation referenced in README.

## 8. Suggestions & Recommendations

### Priority 1: choose the product path

Decide whether this repo is:

- a UX prototype, or
- a real Solana ticketing product in progress.

Then align docs, README, CI, and implementation around that choice. Right now the repo overstates completeness.

### Priority 2: collapse duplicate frontends

- Archive or remove `frontend/`, or explicitly mark it as legacy.
- Keep one frontend architecture.
- Keep one `useNfticket` implementation.

### Priority 3: define the real system boundary

If the target is production, introduce a real backend or service layer for:

- auth,
- payments,
- order reconciliation,
- notification delivery,
- event indexing/querying,
- mint orchestration if hybrid checkout remains part of the model.

### Priority 4: harden the smart contract

- Implement real payment/token movement.
- Implement NFT mint/ownership flow.
- Use PDAs and deterministic account derivation.
- Replace fixed account sizes with explicit sizing strategy.
- Add missing instructions or remove unused contexts.
- Add thorough Anchor tests before any deployment.

### Priority 5: restore engineering guardrails

- Add a real ESLint config.
- Remove `|| true` from CI for key checks.
- Add unit tests for shared pricing/auth/storage logic.
- Add integration tests for purchase, resale, and scan flows.
- Move to stricter TypeScript settings incrementally.

### Priority 6: fix security posture

- Remove plaintext password storage.
- Remove fake social login if not clearly marked as demo-only.
- Move all sensitive state changes off the client.
- Treat the current local storage model as non-production-only.

## 9. Information Needed

The following missing information blocks a reliable production assessment:

- Product decision: prototype-only or production-bound blockchain app.
- Source of truth: on-chain only, backend only, or hybrid model.
- Payment architecture: Stripe, fiat on-ramp, direct SOL/USDC, or hybrid.
- NFT design: Metaplex standard, compressed NFTs, transfer restrictions, metadata storage.
- Resale policy details: exact caps, royalty legality, charity routing, cancellation/refund rules.
- Scanner/security requirements: offline validation, revocation, multi-gate concurrency, fraud response.
- Identity/auth requirements: wallet-only, email-first, organizer KYC, staff roles.
- Missing API and contract docs referenced by README.
- Deployment target and environment strategy for devnet/mainnet.

## Validation Notes

Checks run during this review:

- `npm run build` succeeded for `apps/provider` and `apps/app`, but `apps/shared` has no build script and is skipped by `|| true`.
- `npm run lint` failed because the repo has no ESLint configuration at the root.
- `tests/` is empty.

## Overall Assessment

NFTicket is a solid product prototype with clear UX direction and a plausible Solana-based concept, but it is not yet a cohesive production codebase. The current repo is best described as a mixed prototype: one part local-first demo, one part partial Anchor implementation, and one part forward-looking documentation. The highest-value work is reducing architectural ambiguity, removing duplicate codepaths, and deciding whether to finish the blockchain path or simplify the project into an honest prototype.
