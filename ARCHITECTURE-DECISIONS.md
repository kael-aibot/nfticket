# NFTicket Architecture Decisions

## Product scope

- Product classification: production blockchain application, not a prototype.
- Consequence: every core flow must be designed for auditability, reversibility where possible, observability, and staged rollout.
- Consequence: architecture should tolerate partial outages across blockchain, fiat payments, and off-chain services without losing ticket ownership state.

## Source of truth

- Decision: hybrid architecture with on-chain data as the primary source of truth for ticket ownership and transfer state.
- Rationale:
  - Ticket ownership, scan authorization, and resale restrictions benefit from blockchain verifiability.
  - Off-chain infrastructure is still required for indexing, search, fiat reconciliation, customer support, analytics, email auth, and KYC workflows.
  - A hybrid model keeps user experience responsive while preserving verifiable ownership records.
- Implementation direction:
  - On-chain stores canonical ticket asset state and transfer-relevant constraints.
  - Off-chain services maintain a read model, payment reconciliation data, auth profiles, and operational metadata.
  - Indexers and webhook consumers must be replayable so the off-chain state can be rebuilt from chain events plus payment provider records.

## Payments

- Decision: support Stripe for fiat payments and direct SOL or USDC for crypto payments.
- Rationale:
  - Stripe covers the widest buyer base and lowers onboarding friction for mainstream event attendees.
  - SOL is the native network currency and is useful for crypto-native users.
  - USDC provides a stable-value crypto option for organizers and buyers.
- Implementation direction:
  - Treat payment rail selection as a first-class domain concept, not a UI-only toggle.
  - Stripe payment intents and webhooks must reconcile into the same order model as on-chain crypto payments.
  - Crypto settlement must support both native SOL and SPL token transfers for USDC.
  - Order fulfillment should happen only after payment confirmation on the selected rail.

## NFT format

- Decision: default to Metaplex compressed NFTs, with a configurable fallback to standard metadata NFTs.
- Rationale:
  - Compressed NFTs materially reduce minting and transfer costs at ticketing scale.
  - Production ticketing needs low per-ticket cost and high throughput during on-sale bursts.
  - Some organizers or integrations may still require standard metadata NFTs for marketplace or wallet compatibility.
- Implementation direction:
  - The minting layer should expose a mode switch: `compressed` by default, `metadata` when explicitly enabled.
  - Collection and metadata conventions should stay consistent across both modes.
  - Off-chain indexing must understand both compressed and metadata ticket assets.

## Resale

- Decision: ship with default general resale settings, but allow organizers to adjust them.
- Rationale:
  - Most organizers need sensible anti-scalping defaults without heavy setup.
  - Different event categories require different caps, royalties, transfer windows, and payout splits.
- Implementation direction:
  - Resale policy must be represented as explicit event configuration.
  - Defaults should be safe and conservative, then overridable per event.
  - Enforcement should happen in both user-facing workflows and on-chain transfer logic where feasible.

## Authentication

- Decision: default to email-first authentication, with settings for wallet-only mode and optional KYC.
- Rationale:
  - Email-first auth reduces onboarding friction for mainstream buyers.
  - Wallet-only mode remains important for crypto-native communities and gated events.
  - KYC must be optional because it is event-specific, jurisdiction-specific, and operationally sensitive.
- Implementation direction:
  - Identity should be modeled separately from wallet linkage so one user can operate in email-first or wallet-linked mode.
  - Wallet attachment should be additive in the default mode.
  - KYC status should be capability-based and event-scoped where possible.

## Operational implications

- Required infrastructure:
  - Solana RPC access, indexer/reconciliation jobs, Stripe webhooks, transactional email, and secure secrets management.
- Required controls:
  - Observability for minting, scan validation, payment reconciliation, and webhook replay.
  - Idempotent order fulfillment and ticket minting.
  - Admin tooling for payment disputes, failed mints, and support-assisted ticket recovery.

## Phase 1 scope alignment

- Establish the configuration surface for Solana, Stripe, auth, KYC, and resale defaults.
- Introduce foundational blockchain helpers around compressed NFT flows.
- Introduce foundational payment abstractions that can coordinate Stripe, SOL, and USDC.
- Remove silent build workarounds so failures become visible early.
