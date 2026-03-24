# NFTicket Audit Report

Date: 2025-03-23

## Scope

Reviewed the active TypeScript/Next.js runtime, shared auth and scanner libraries, payment integration paths, repository tooling, and the current test/build workflow.

## Fixed In This Pass

### 1. Cross-account data exposure on read APIs

- Severity: Critical
- Files: `apps/shared/lib/apiHandlers.ts`, `apps/app/pages/api/checkout.ts`
- Issue:
  - `GET /api/tickets` returned ticket records without authentication and accepted arbitrary `ownerId` filters.
  - `GET /api/orders` returned all orders without authentication.
  - `GET /api/checkout?orderId=...` exposed payment status for any authenticated user who knew an order id.
- Risk:
  - Buyers could enumerate other buyers' tickets and orders.
  - Organizers and attackers could inspect unrelated payment activity.
- Fix implemented:
  - Ticket and order reads now require an authenticated user.
  - Buyers are restricted to their own tickets/orders.
  - Providers can only read records for events they organize plus their own records.
  - Platform roles retain full access.
  - Checkout status reads now enforce purchaser, organizer, or platform ownership.
- Recommendation:
  - Keep all read endpoints scoped server-side even if the client already filters.

### 2. Checkout idempotency and redirect handling

- Severity: High
- Files: `apps/shared/lib/paymentService.ts`
- Issue:
  - Stripe idempotency keys defaulted to a timestamped value, defeating retry safety.
  - `returnUrl` was accepted without validating the origin.
- Risk:
  - Duplicate orders and duplicate checkout sessions on client retries.
  - Open redirect risk in payment completion flows.
- Fix implemented:
  - Idempotency keys are now deterministic by event, ticket, and purchaser unless a caller supplies one.
  - Payment amounts are validated as positive finite values.
  - Checkout return origins are validated against `NEXT_PUBLIC_APP_URL`; relative URLs are normalized safely.
- Recommendation:
  - Add explicit order-level inventory reservation before payment session creation to prevent oversells.

### 3. Scanner abuse protections were declared but inactive

- Severity: High
- Files: `apps/shared/lib/scannerValidation.ts`
- Issue:
  - Rate-limit constants existed but were never enforced.
- Risk:
  - Scanner-token issuance and scan validation were brute-forceable within a single process.
- Fix implemented:
  - Added in-memory rate limiting keyed by event, client address, and device fingerprint hash for token issuance and validation.
- Recommendation:
  - Replace the in-memory limiter with Redis or another shared store before multi-instance deployment.

### 4. Weak randomness fallbacks in id generation

- Severity: Medium
- Files: `apps/shared/lib/ids.ts`, `lib/auth.ts`, `apps/shared/lib/storage.ts`
- Issue:
  - Several ID and token paths used `Math.random()` fallbacks.
- Risk:
  - Increased collision risk and weaker entropy for identifiers.
- Fix implemented:
  - Replaced server-side random fallbacks with cryptographic sources.
  - Updated shared auth token generation to use secure bytes.
  - Updated client-side `uid()` to prefer Web Crypto UUIDs and secure random values.
- Recommendation:
  - Standardize all identifier creation on one shared helper.

### 5. Session cookie clearing was inconsistent in production

- Severity: Medium
- Files: `apps/shared/lib/apiHandlers.ts`
- Issue:
  - Session clearing omitted the `Secure` attribute in production.
- Risk:
  - Cookie invalidation behavior could differ from issuance behavior in HTTPS environments.
- Fix implemented:
  - Cookie clearing now mirrors production security flags.
- Recommendation:
  - Consolidate cookie serialization in one shared function to avoid drift.

### 6. Root test workflow failed before application-level checks

- Severity: Medium
- Files: `package.json`
- Issue:
  - `npm test` hard-required `anchor test`, which is not available in many app-only environments.
- Risk:
  - CI and contributor workflows fail before TypeScript/runtime tests can execute.
- Fix implemented:
  - Root `npm test` now targets the application/unit test workspace by default.
  - Full Anchor + unit coverage remains available via `npm run test:full`.
- Recommendation:
  - Split smart-contract CI from app CI so failures are attributable and parallelizable.

## Remaining Risks And Gaps

### 1. Tests are not runnable in the current checkout

- Severity: High
- Files: `tests/package.json`
- Issue:
  - `npm test` still fails locally because `vitest` is not installed in this workspace checkout.
- Impact:
  - Regression tests cannot currently confirm runtime behavior.
- Recommendation:
  - Run dependency installation for the `tests` workspace and verify `package-lock.json` is consistent with workspaces.

### 2. Browser storage and synchronous XHR remain part of the live path

- Severity: High
- Files: `apps/shared/lib/storage.ts`, `apps/shared/hooks/useNfticket.ts`
- Issue:
  - Browser persistence still relies on synchronous `XMLHttpRequest` and `localStorage`.
- Impact:
  - UI thread blocking, weak offline consistency, poor recoverability, and prototype-only trust boundaries.
- Recommendation:
  - Replace the sync storage adapter with async fetch clients and durable server-side persistence.

### 3. Production auth claims exceed implemented capability

- Severity: High
- Files: `apps/shared/auth/HybridAuthContext.tsx`, UI pages using `AuthPanel`
- Issue:
  - UI copy still references social login, magic links, and account recovery while those flows throw runtime errors in the secure-session path.
- Impact:
  - Broken user journeys and misleading product behavior.
- Recommendation:
  - Either implement these flows or remove their UI entry points and documentation references.

### 4. Scanner authorization is still prototype-grade

- Severity: Medium
- Files: `apps/shared/lib/scannerValidation.ts`
- Issue:
  - Human-readable scanner labels and device-fingerprint authorization remain acceptable credentials.
- Impact:
  - Authorization quality depends on label entropy and client-supplied identifiers.
- Recommendation:
  - Move scanner enrollment to server-issued device keys or attested device certificates.

### 5. Payment and fulfillment robustness is incomplete

- Severity: Medium
- Files: `apps/shared/lib/paymentService.ts`, `lib/fulfillment.ts`
- Issue:
  - There is no end-to-end inventory reservation, durable retry orchestration, or webhook replay audit trail in the reviewed changeset.
- Impact:
  - Risk of oversell, duplicate fulfillment attempts, and manual recovery burden.
- Recommendation:
  - Add inventory locking, webhook event ledgering, and idempotent fulfillment jobs before production use.

### 6. The active apps still mix prototype and production architecture

- Severity: Medium
- Files: `apps/*`, `lib/*`, `prisma/*`, `anchor-program/*`
- Issue:
  - The repository contains partially integrated production modules alongside demo-era local-first behavior.
- Impact:
  - High maintenance cost and ambiguous trust boundaries.
- Recommendation:
  - Pick one runtime path and decommission the unused parallel architecture in the active apps.

## Verification

- `npm run lint`: passed
- `npm run build`: passed
- `npm test`: failed in this environment because the `tests` workspace does not currently have `vitest` installed

