# NFTicket Product Testing Checklist

**Date:** March 23, 2026  
**Commit:** d27e552 - security: Harden API access control and payment flows  
**Status:** Ready for testing (with known limitations)

---

## 🎯 Test Scope

### Focus Areas
- Wallet-based authentication (primary path)
- Ticket purchase flows (Stripe + Crypto)
- Event management (provider)
- QR scanning & validation
- Resale marketplace

### Known Limitations
- ❌ Social login / magic links (UI exists but non-functional)
- ⚠️ Occasional UI lag from sync storage (acceptable for testing)
- ⚠️ Scanner auth is demo-grade (not for high-security events)

---

## 🔐 Authentication Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Wallet connect | Click "Connect Wallet" → Select Phantom/Solflare | Wallet connects, shows address | ⬜ |
| 1.2 | Session persistence | Refresh page after login | Still logged in | ⬜ |
| 1.3 | Session logout | Click "Disconnect" | Wallet disconnects, redirected to auth | ⬜ |
| 1.4 | Social login UI | Click "Sign in with Google/Twitter" | Shows "not implemented" or similar | ⬜ |

---

## 🎫 Buyer Flow Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 2.1 | Browse events | Go to / (buyer app) | Events list loads | ⬜ |
| 2.2 | View event details | Click an event | Event details, tiers, pricing shown | ⬜ |
| 2.3 | Purchase ticket (Stripe) | Select tier → Click "Buy with Card" → Complete Stripe checkout | Checkout opens, completes, returns to my-tickets | ⬜ |
| 2.4 | Purchase ticket (Crypto) | Select tier → Click "Buy with Crypto" → Confirm transaction | Transaction submitted, ticket reserved | ⬜ |
| 2.5 | View my tickets | Go to /my-tickets | Only YOUR tickets displayed | ⬜ |
| 2.6 | Download QR code | Click ticket → "Show QR" | QR code displays | ⬜ |
| 2.7 | List for resale | Click "Sell" → Set price → Confirm | Ticket listed in marketplace | ⬜ |
| 2.8 | Buy resale ticket | Find resale listing → Purchase | Transfer completes, new owner sees ticket | ⬜ |

---

## 🏪 Provider Flow Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Create event | Go to provider app → "Create Event" → Fill form → Submit | Event created, appears in list | ⬜ |
| 3.2 | View my events | Go to /events | Only YOUR events displayed | ⬜ |
| 3.3 | Edit event | Click event → "Edit" → Change details → Save | Changes saved | ⬜ |
| 3.4 | View event tickets | Click event → "Tickets" tab | Tickets for YOUR event shown | ⬜ |
| 3.5 | View event orders | Click event → "Orders" tab | Orders for YOUR event shown | ⬜ |
| 3.6 | Generate scanner token | Go to scanner page → Enter device name → Submit | Scanner token generated | ⬜ |
| 3.7 | Rate limiting | Request scanner token 50+ times rapidly | Rate limit error after threshold | ⬜ |

---

## 📱 Scanner Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | Open scanner | Go to /scanner with valid token | Scanner opens | ⬜ |
| 4.2 | Scan valid ticket | Scan QR from valid ticket | "Valid" confirmation, ticket marked scanned | ⬜ |
| 4.3 | Scan already used ticket | Scan same QR again | "Already scanned" warning | ⬜ |
| 4.4 | Scan invalid QR | Scan random QR code | "Invalid" error | ⬜ |
| 4.5 | Scan rate limiting | Scan rapidly 20+ times | Rate limit kicks in | ⬜ |

---

## 💰 Payment Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | Stripe checkout | Initiate purchase → Complete Stripe flow | Payment succeeds, order created | ⬜ |
| 5.2 | Stripe idempotency | Double-click "Pay" rapidly | Only ONE order created | ⬜ |
| 5.3 | Stripe cancel | Cancel Stripe checkout | Returns to event page, no order | ⬜ |
| 5.4 | Crypto payment | Initiate → Sign transaction → Wait confirmation | Payment verified, ticket minted | ⬜ |
| 5.5 | Invalid amount | Try to checkout with $0 or negative | Error rejected | ⬜ |
| 5.6 | Payment status | Call /api/checkout?orderId=xxx | Only authorized users see status | ⬜ |

---

## 🔒 Security Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Cross-user ticket access | As User A, try to view User B's tickets via API | 403 Forbidden or empty list | ⬜ |
| 6.2 | Cross-user order access | As User A, try to view User B's orders | 403 Forbidden or filtered list | ⬜ |
| 6.3 | Unauthenticated API | Call /api/tickets without auth | Requires authentication | ⬜ |
| 6.4 | Scanner token brute force | Request 100 tokens rapidly | Rate limited | ⬜ |
| 6.5 | Open redirect | Try checkout with malicious returnUrl | Rejected or sanitized | ⬜ |

---

## 🐛 Known Issues to Verify

| Issue | Expected Behavior | Actual (fill in) |
|-------|-------------------|------------------|
| Sync XHR lag | Brief UI freeze on storage ops | |
| Social login UI | Shows but doesn't work | |
| Scanner prototype auth | Works with device labels | |

---

## ✅ Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Tester | | | ⬜ Pass / ⬜ Fail |
| Reviewer | | | ⬜ Approved / ⬜ Changes Needed |

---

## 📝 Notes

- Test on both Chrome and Safari
- Test with both Phantom and Solflare wallets
- Test on mobile (iOS Safari) for scanner
- Document any crashes or error messages
