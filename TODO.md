# NFTicket - Remaining Tasks

This document tracks what needs to be done to get NFTicket fully operational.

## 🔴 Critical (Must Do)

### Smart Contract
- [ ] Complete `anchor-program/Cargo.toml` with proper dependencies
- [ ] Add Anchor configuration file (`Anchor.toml`)
- [ ] Write program tests (`tests/nfticket.ts`)
- [ ] Deploy to devnet and get real program ID
- [ ] Update program ID in all apps

### Dependencies
- [ ] Run `npm install` in all app directories
- [ ] Verify all imports resolve correctly
- [ ] Test TypeScript compilation

### QR Code Scanning
- [ ] Add real camera QR scanning (currently mocked)
- [ ] Options: `react-qr-reader` or `html5-qrcode`

## 🟡 Important (Should Do)

### Mobile Experience
- [ ] Create app icons (192x192, 512x512)
- [ ] Add splash screen for PWA
- [ ] Test on actual mobile devices
- [ ] Optimize touch targets for mobile

### Security
- [ ] Add input validation
- [ ] Sanitize user inputs
- [ ] Add rate limiting for API calls
- [ ] Review program security (reentrancy, overflow checks)

### UX Improvements
- [ ] Add loading states for all transactions
- [ ] Add error handling with user-friendly messages
- [ ] Add transaction confirmation toasts
- [ ] Add empty states for all lists

## 🟢 Nice to Have (Could Do)

### Features
- [ ] Push notifications for event reminders
- [ ] Apple Wallet / Google Pay integration
- [ ] Social sharing for events
- [ ] Event search and filters
- [ ] Categories/tags for events
- [ ] Featured events section

### Analytics
- [ ] Add Google Analytics or similar
- [ ] Track key metrics (conversion, retention)

### Testing
- [ ] Add unit tests for React components
- [ ] Add integration tests for program
- [ ] Add E2E tests with Playwright

## 📋 Deployment Checklist

### Devnet Testing
- [ ] Deploy program to devnet
- [ ] Test full flow: create → buy → scan
- [ ] Verify all transactions succeed
- [ ] Check compute unit usage

### Mainnet Preparation
- [ ] Security audit (optional but recommended)
- [ ] Calculate rent exemption costs
- [ ] Get mainnet SOL for deployment
- [ ] Deploy to mainnet

### Hosting
- [ ] Set up Vercel accounts
- [ ] Configure custom domains
- [ ] Set environment variables
- [ ] Deploy provider app
- [ ] Deploy buyer app
- [ ] Test SSL/HTTPS

## 🎯 Quick Wins (Do These Now)

1. **Add real QR scanning library**
   ```bash
   cd apps/provider
   npm install html5-qrcode
   ```

2. **Create simple icons**
   - Use a tool like https://app-manifest.firebaseapp.com/
   - Generate 192x192 and 512x512 PNGs
   - Place in `apps/app/public/`

3. **Test the PWA**
   ```bash
   cd apps/app
   npm install
   npm run dev
   # Open on phone, tap "Add to Home Screen"
   ```

## 🐛 Known Issues

1. **Program ID is placeholder** — Won't work until deployed
2. **QR scanning is mocked** — Need real library
3. **No error boundaries** — App may crash on errors
4. **No loading states** — UX feels unresponsive
5. **Camera not implemented** — Scanner page is UI-only

## 📱 Getting On Your Phone

### Option 1: PWA (Recommended for now)
1. Deploy to Vercel
2. Visit URL on iPhone/Android
3. Tap "Share" → "Add to Home Screen"
4. Opens like a native app

### Option 2: Native App (Future)
- React Native with Expo
- Or Capacitor to wrap web app
- More work but better UX

### Option 3: Test Locally
```bash
# On your Mac
cd apps/app
npm run dev

# On iPhone, open Safari
# Visit: http://YOUR_MAC_IP:3002
```

## 💰 Costs to Consider

| Item | Devnet | Mainnet |
|------|--------|---------|
| Program deployment | Free | ~0.5-1 SOL |
| Event account rent | Free | ~0.001 SOL per event |
| Ticket account rent | Free | ~0.001 SOL per ticket |
| Transaction fees | Free | ~0.000005 SOL |
| Vercel hosting | Free tier | Free tier |
| RPC endpoint | Free | $50-200/month |

## 🆘 Help Needed?

- Solana docs: https://solana.com/developers
- Anchor docs: https://anchor-lang.com
- Wallet adapter: https://github.com/solana-labs/wallet-adapter

---

**Status**: MVP code complete, needs deployment and testing
