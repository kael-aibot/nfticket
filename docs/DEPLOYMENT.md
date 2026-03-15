# Deployment Guide

This guide covers deploying NFTicket to production.

## Prerequisites

- Solana CLI configured for mainnet
- Deployer wallet with SOL for rent exemption
- Domain name (optional, for hosted apps)
- Vercel account (for frontend hosting)

## 1. Deploy the Smart Contract

### Build the Program

```bash
cd anchor-program
anchor build
```

### Deploy to Devnet (Testing)

```bash
solana config set --url devnet
solana airdrop 2  # Get devnet SOL
anchor deploy
```

Save the program ID output. Update:
- `apps/shared/hooks/useNfticket.ts` — replace `PROGRAM_ID`
- `anchor-program/programs/nfticket/src/lib.rs` — replace `declare_id!`

### Deploy to Mainnet (Production)

⚠️ **Warning:** Mainnet deployment costs real SOL and is permanent.

```bash
solana config set --url mainnet-beta
# Ensure your wallet has sufficient SOL
anchor deploy
```

## 2. Configure the Apps

### Update Environment Variables

Create `.env` files:

**apps/provider/.env**
```
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
```

**apps/app/.env**
```
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
```

### Build for Production

```bash
npm run build
```

## 3. Deploy Frontend Apps

### Option A: Vercel (Recommended)

1. Push code to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

**Provider App:**
- Root Directory: `apps/provider`
- Build Command: `npm run build`
- Output Directory: `.next`

**Buyer App:**
- Root Directory: `apps/app`
- Build Command: `npm run build`
- Output Directory: `.next`

### Option B: Self-Hosted

```bash
cd apps/provider
npm run build
npm start  # or use PM2, Docker, etc.
```

## 4. Set Up RPC Endpoint

For production, use a dedicated RPC provider:

- [Helius](https://helius.xyz)
- [QuickNode](https://quicknode.com)
- [Alchemy](https://alchemy.com)

Update `NEXT_PUBLIC_SOLANA_RPC` with your endpoint URL.

## 5. Configure Domains

### Provider Portal
- Set up DNS: `provider.yourdomain.com`
- Configure SSL certificate
- Update CORS settings if needed

### Buyer App
- Set up DNS: `app.yourdomain.com` or `tickets.yourdomain.com`
- Configure SSL certificate
- Set up PWA manifest for mobile app experience

## 6. Post-Deployment Checklist

### Smart Contract
- [ ] Program deployed successfully
- [ ] Program ID updated in all apps
- [ ] IDL synchronized

### Provider Portal
- [ ] Connect wallet works
- [ ] Create event flow works
- [ ] Scanner authorization works
- [ ] Analytics display correctly

### Buyer App
- [ ] Browse events works
- [ ] Purchase flow works
- [ ] QR code displays correctly
- [ ] Mobile layout looks good

### Security
- [ ] Environment variables are secure
- [ ] No sensitive keys in code
- [ ] HTTPS enabled
- [ ] Rate limiting configured

## 7. Monitoring

### Recommended Tools

- [Helius](https://helius.xyz) — Program monitoring, webhooks
- [SolanaFM](https://solana.fm) — Transaction explorer
- [Sentry](https://sentry.io) — Error tracking
- [Vercel Analytics](https://vercel.com/analytics) — Frontend metrics

### Key Metrics to Monitor

- Transaction success rate
- Program compute unit usage
- API response times
- Error rates
- User engagement

## 8. Backup and Recovery

### Program Upgradability

The current program is NOT upgradable. To upgrade:

1. Deploy new program
2. Update app configs
3. Users will need to interact with new program

Consider using [Program Derived Addresses (PDAs)](https://solanacookbook.com/core-concepts/pdas.html) for upgradeable programs.

### Data Backup

All data is on-chain and backed by Solana's consensus. No off-chain backup needed for ticket/NFT data.

## Troubleshooting

### Common Issues

**"Program not found"**
- Check program ID is correct
- Verify RPC endpoint is working
- Ensure you're on the right network (devnet/mainnet)

**"Insufficient funds"**
- Wallet needs SOL for transaction fees
- Check wallet balance on correct network

**"Transaction failed"**
- Check program logs
- Verify account constraints
- Ensure event is active and tier has supply

## Support

For deployment help:
- GitHub Issues: https://github.com/yourusername/nfticket/issues
- Discord: https://discord.gg/nfticket
