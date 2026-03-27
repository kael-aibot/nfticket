# NFTicket Implementation Roadmap

## Phase 1: Foundation

- Add architecture and environment documentation.
- Fix root linting configuration.
- Remove silent script workarounds from the root workspace.
- Establish root `lib/blockchain.ts` for Solana and compressed NFT preparation helpers.
- Establish root `lib/payments.ts` for Stripe and crypto payment orchestration.
- Add a real `apps/shared` build command so shared code participates in CI.

Exit criteria:
- Root lint runs with a checked-in ESLint config.
- All required environment variables are documented.
- Shared workspace build no longer relies on `|| true`.
- Blockchain and payment foundations are ready for integration in later phases.

## Phase 2: Core domain and persistence

- Define canonical domain models for events, orders, tickets, payouts, scans, and user identity.
- Add persistent storage for off-chain read models and reconciliation state.
- Introduce job processors for chain indexing, Stripe webhook handling, and fulfillment retries.
- Normalize event configuration for NFT mode, accepted payments, resale policy, and auth requirements.

Exit criteria:
- Durable order and ticket records exist off-chain.
- Payment and minting jobs are replayable and idempotent.
- Event configuration is stored in a form that maps directly to fulfillment logic.

## Phase 3: Minting and fulfillment

- Implement compressed NFT minting via Metaplex for the default ticket path.
- Implement standard metadata NFT minting as a selectable fallback mode.
- Connect payment confirmation to ticket issuance, receipt generation, and buyer notifications.
- Add failure handling for delayed chain finality, webhook retries, and partial fulfillment.

Exit criteria:
- A successful fiat or crypto payment can mint or reserve a ticket reliably.
- Ticket issuance is idempotent across retries.
- Collection, metadata, and ownership are traceable for every issued ticket.

## Phase 4: Marketplace and transfer controls

- Implement resale listing, purchasing, transfer eligibility checks, and payout splitting.
- Enforce default resale settings with organizer overrides.
- Add audit logs for transfers, royalties, and support actions.
- Add fraud controls around excessive transfer activity and scan abuse.

Exit criteria:
- Resale works across configured events and payment rails.
- Organizer-defined policy is enforced consistently.
- Payout accounting is auditable.

## Phase 5: Auth, KYC, and operations

- Expand email-first auth into production-ready account recovery, wallet linking, and session management.
- Add wallet-only mode support as a configurable event or deployment option.
- Integrate optional KYC gating into purchase and transfer flows.
- Add admin operations tooling, dashboards, and alerting.

Exit criteria:
- Identity flows match the configured auth mode.
- Optional KYC can gate purchases where required.
- Operators can observe, replay, and resolve failed payment or mint flows safely.

## Phase 6: Hardening and launch readiness

- Add integration tests across fiat, crypto, minting, scanning, and resale flows.
- Add staging environment validation, load testing, and incident runbooks.
- Review secrets management, key custody, and webhook authenticity.
- Finalize release gates and rollback plans.

Exit criteria:
- Production readiness checklist is complete.
- Critical user journeys are covered by automated tests.
- Operational runbooks exist for payment, minting, and auth incidents.
