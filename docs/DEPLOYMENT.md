# Deployment Guide

This guide covers deploying NFTicket to production.

## Prerequisites

- Solana CLI configured for mainnet
- Deployer wallet with SOL for rent exemption
- Domain name (optional, for hosted apps)
- Vercel account (for frontend hosting)

## 1. Deploy the Smart Contract

The checked-in program ID is still a deployment placeholder:

- `anchor-program/src/lib.rs`
- `anchor-program/Anchor.toml`
- Generated IDLs checked into `apps/shared/nfticket.json`, `apps/app/shared/nfticket.json`, `apps/app/shared/idl/nfticket.json`, `apps/provider/shared/nfticket.json`, and `apps/provider/shared/idl/nfticket.json`

There is no committed real devnet/mainnet program ID in this repo. You must set the actual program ID during deployment.

### Build the Program

```bash
cd anchor-program
solana-keygen new --outfile target/deploy/nfticket-keypair.json --force
solana address -k target/deploy/nfticket-keypair.json
```

Copy the pubkey output and replace the placeholder `NFTicket111111111111111111111111111111111111` in:

- `anchor-program/src/lib.rs` in `declare_id!(...)`
- `anchor-program/Anchor.toml` under `[programs.localnet]`, `[programs.devnet]`, and `[programs.mainnet]`

Then build:

```bash
anchor build
```

### Deploy to Devnet (Testing)

```bash
solana config set --url devnet
solana airdrop 2  # Get devnet SOL
anchor deploy
```

After deployment, verify the deployed address matches the pubkey from `target/deploy/nfticket-keypair.json`:

```bash
solana address -k target/deploy/nfticket-keypair.json
```

Then sync generated artifacts:

```bash
cp target/idl/nfticket.json ../apps/shared/nfticket.json
cp target/idl/nfticket.json ../apps/app/shared/nfticket.json
cp target/idl/nfticket.json ../apps/app/shared/idl/nfticket.json
cp target/idl/nfticket.json ../apps/provider/shared/nfticket.json
cp target/idl/nfticket.json ../apps/provider/shared/idl/nfticket.json
```

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

`NEXT_PUBLIC_PROGRAM_ID` should match the same deployed address used in `anchor-program/src/lib.rs` and `anchor-program/Anchor.toml`.
The current `apps/shared/hooks/useNfticket.ts` implementation does not contain a hard-coded `PROGRAM_ID`, so this value is configuration for frontend/runtime integration rather than a source file replacement.

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
- [ ] Placeholder replaced in `anchor-program/src/lib.rs`
- [ ] Placeholder replaced in `anchor-program/Anchor.toml`
- [ ] `NEXT_PUBLIC_PROGRAM_ID` set in frontend environments
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
- Check `solana address -k target/deploy/nfticket-keypair.json` matches `declare_id!`
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
