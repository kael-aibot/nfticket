#!/bin/bash

# NFTicket Quick Deploy Script
# This script helps you deploy NFTicket to Vercel

set -e

echo "🎫 NFTicket Deployment Script"
echo "=============================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git not found. Please install Git"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd apps/shared && npm install
cd ../provider && npm install
cd ../app && npm install
cd ../..
echo "✅ Dependencies installed"
echo ""

# Build apps
echo "🔨 Building apps..."
cd apps/provider && npm run build
cd ../app && npm run build
cd ../..
echo "✅ Apps built"
echo ""

# Git setup reminder
echo "📤 Next steps to deploy:"
echo ""
echo "1. Push to GitHub:"
echo "   git add -A"
echo "   git commit -m 'Add PWA support and TODO'"
echo "   git push origin main"
echo ""
echo "2. Deploy to Vercel:"
echo "   - Go to https://vercel.com/new"
echo "   - Import your GitHub repo"
echo "   - For Provider App:"
echo "     - Root Directory: apps/provider"
echo "     - Framework: Next.js"
echo "   - For Buyer App:"
echo "     - Root Directory: apps/app"
echo "     - Framework: Next.js"
echo ""
echo "3. Configure environment variables in Vercel:"
echo "   NEXT_PUBLIC_SOLANA_NETWORK=devnet"
echo "   NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com"
echo "   NEXT_PUBLIC_PROGRAM_ID=your_program_id_here"
echo ""
echo "4. To get on your phone:"
echo "   - Visit the deployed URL on your phone"
echo "   - Tap 'Share' → 'Add to Home Screen'"
echo "   - Works like a native app!"
echo ""
echo "🎉 Done!"
