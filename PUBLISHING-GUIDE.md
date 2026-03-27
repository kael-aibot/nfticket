# NFTicket - GitHub Publishing Guide

This guide covers everything needed to publish NFTicket to GitHub for mobile download and use.

---

## ✅ Pre-Publish Checklist

### 1. Repository Setup
- [x] Create GitHub repository
- [ ] Set up authentication: `gh auth login`
- [ ] Update `package.json` repository URL to your GitHub account
- [ ] Ensure `.gitignore` includes sensitive files (✅ verified)

### 2. Documentation
- [x] Created `MOBILE-QUICKSTART.md` - mobile user guide
- [x] Updated `README.md` - added mobile installation section
- [x] Created `PUBLISHING-GUIDE.md` - this file
- [ ] Create `screenshots/` folder with mobile screenshots
- [ ] Update `CODEOWNERS` file (optional)

### 3. Mobile Optimization
- [x] Created `manifest.json` for PWA (✅ verified)
- [x] PWA setup in `_app.tsx` (✅ verified)
- [x] Created Dockerfiles for both apps
- [ ] Add app icons to `public/icons/` folder (192x192, 512x512)
- [ ] Test "Add to Home Screen" on actual devices

### 4. Environment Security
- [x] `.env` not committed to git (✅ verified)
- [x] `.env.example` has safe placeholder values
- [ ] Remove any real API keys from `.env` before commit
- [ ] Document required env vars for deployment

### 5. Build Verification
- [ ] Run `npm run install:all` in clean environment
- [ ] Run `npm run build` successfully
- [ ] Run `npm run test` all tests pass
- [ ] Run E2E tests: `npm run test:e2e`

---

## 🚀 Deployment Options

### Option A: Vercel (Recommended)

**Advantages:**
- Free tier available
- Automatic deployments from GitHub
- Custom domains
- Serverless functions
- Easy configuration

**Steps:**
1. Install Vercel CLI: `npm install -g vercel`
2. Deploy buyer app:
   ```bash
   cd apps/app
   vercel --prod
   ```
3. Deploy provider app:
   ```bash
   cd apps/provider
   vercel --prod
   ```
4. Configure environment variables in Vercel dashboard

**Vercel Configuration:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### Option B: Netlify

**Steps:**
```bash
npm install -g netlify-cli
cd apps/app && netlify deploy --prod
cd apps/provider && netlify deploy --prod
```

### Option C: Self-Hosted (Docker)

**Docker Compose Example:**
```yaml
version: '3.8'
services:
  buyer-app:
    build: ./apps/app
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_APP_URL=https://nfticket.example.com
      - NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
  
  provider-app:
    build: ./apps/provider
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_APP_URL=https://provider.nfticket.example.com
```

---

## 📱 Mobile User Instructions

### For iOS (Safari)
1. Open browser and navigate to deployed app
2. Tap Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Confirm with "Add"
5. App icon appears on home screen

### For Android (Chrome)
1. Open browser and navigate to deployed app
2. Tap menu (⋮) in top-right
3. Tap "Add to Home Screen"
4. Confirm name and tap "Add"
5. Icon appears on home screen

---

## 🔐 Security Considerations

### Before Publishing

1. **Remove sensitive data:**
   ```bash
   # Check for secrets in git history
   git log --all --full-history -- '*.env'
   
   # If found, use BFG Repo-Cleaner to remove
   bfg --delete-files '.env'
   ```

2. **Environment Variables:**
   - Never commit `.env` files
   - Use `.env.example` for documentation
   - Document all required secrets for deployment
   - Consider using secret management tools

3. **API Keys:**
   - Use test/dev keys only
   - Document production key requirements
   - Rotate keys regularly

4. **Solana Configuration:**
   - Use devnet for public testing
   - Document mainnet deployment requirements
   - Never commit payer secrets

---

## 📦 GitHub Repository Structure

```
nfticket/
├── README.md                    # ✅ Updated with mobile instructions
├── MOBILE-QUICKSTART.md         # ✅ New mobile user guide
├── PUBLISHING-GUIDE.md          # ✅ This guide
├── .env.example                 # ✅ Safe template
├── .gitignore                   # ✅ Includes .env
├── apps/
│   ├── app/                     # Buyer app
│   │   ├── Dockerfile           # ✅ New
│   │   ├── public/
│   │   │   └── manifest.json    # ✅ New PWA manifest
│   │   └── ...
│   ├── provider/                # Organizer app
│   │   ├── Dockerfile           # ✅ New
│   │   └── ...
│   └── shared/
├── anchor-program/
├── docs/
├── e2e/
├── lib/
└── ...
```

---

## 🎯 Final Steps Before Push

1. **Update package.json:**
   ```json
   {
     "repository": {
       "type": "git",
       "url": "https://github.com/YOUR_USERNAME/nfticket.git"
     }
   }
   ```

2. **Add and commit:**
   ```bash
   cd projects/nfticket
   git add .
   git commit -m "docs: Add mobile publishing guide and PWA support"
   ```

3. **Authenticate with GitHub:**
   ```bash
   gh auth login
   ```

4. **Create repository (if not exists):**
   ```bash
   gh repo create YOUR_USERNAME/nfticket --public --source=. --remote=origin
   ```

5. **Push to GitHub:**
   ```bash
   git push -u origin main
   ```

6. **Deploy to Vercel (optional):**
   ```bash
   vercel link
   vercel --prod
   ```

---

## 📊 Post-Publish Verification

After pushing:

1. ✅ Clone on fresh machine: `git clone https://github.com/YOUR_USERNAME/nfticket.git`
2. ✅ Install dependencies: `npm run install:all`
3. ✅ Run builds: `npm run build`
4. ✅ Test locally: `npm run dev`
5. ✅ Deploy to Vercel/Netlify
6. ✅ Test on actual mobile devices (iOS + Android)
7. ✅ Test "Add to Home Screen" functionality

---

## 🆘 Troubleshooting

### "Manifest not loading"
- Ensure `manifest.json` is in `public/` folder
- Check `rel="manifest"` link in `_app.tsx`
- Verify manifest JSON is valid

### "Service worker not registering"
- Check browser console for errors
- Ensure HTTPS in production
- Verify `sw.js` exists or remove SW registration

### "Build fails"
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (need 18+)
- Verify all dependencies in package.json

### "Environment variables not working"
- Check Vercel/Netlify dashboard for deployed env vars
- Ensure variables are prefixed correctly (`NEXT_PUBLIC_` for client-side)
- Verify `.env.local` not committed

---

## 📞 Support

For issues:
1. Check existing issues on GitHub
2. Read this guide thoroughly
3. Open a new issue with details

---

**Ready to publish? Follow the checklist above and you're good to go! 🚀**
