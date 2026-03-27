#!/bin/bash

# NFTicket Complete Setup Script
# This script sets up the entire NFTicket project from scratch

set -e

echo "🎫 NFTicket Setup Script"
echo "========================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}➡️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    print_status "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18+. Found: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v)"

# Check Git
if ! command -v git &> /dev/null; then
    print_error "Git not found. Please install Git"
    exit 1
fi
print_success "Git installed"

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    print_warning "Solana CLI not found. Install it for contract deployment:"
    print_status "  sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.0/install)\""
fi

# Check Anchor
if ! command -v anchor &> /dev/null; then
    print_warning "Anchor CLI not found. Install it for contract deployment:"
    print_status "  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    print_status "  avm install latest"
    print_status "  avm use latest"
fi

print_success "Prerequisites check complete"
echo ""

# Get the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Install root dependencies
print_status "Installing root dependencies..."
npm install
print_success "Root dependencies installed"
echo ""

# Install shared dependencies
print_status "Installing shared dependencies..."
cd apps/shared
npm install
cd "$PROJECT_DIR"
print_success "Shared dependencies installed"
echo ""

# Install provider app dependencies
print_status "Installing Provider App dependencies..."
cd apps/provider
npm install
cd "$PROJECT_DIR"
print_success "Provider App dependencies installed"
echo ""

# Install buyer app dependencies
print_status "Installing Buyer App dependencies..."
cd apps/app
npm install
cd "$PROJECT_DIR"
print_success "Buyer App dependencies installed"
echo ""

# Create public directories if they don't exist
mkdir -p apps/app/public
mkdir -p apps/provider/public

print_success "Setup complete!"
echo ""
echo "=============================="
echo ""
echo "Next steps:"
echo ""
echo "1. ${YELLOW}Configure Solana:${NC}"
echo "   solana config set --url devnet"
echo "   solana-keygen new --outfile ~/.config/solana/id.json"
echo "   solana airdrop 2"
echo ""
echo "2. ${YELLOW}Deploy the smart contract:${NC}"
echo "   cd anchor-program"
echo "   anchor build"
echo "   anchor deploy"
echo "   # Copy the Program ID from output"
echo ""
echo "3. ${YELLOW}Update program ID in apps:${NC}"
echo "   # Replace the placeholder in anchor-program/src/lib.rs"
echo "   # Replace the placeholder in anchor-program/Anchor.toml"
echo "   # Set NEXT_PUBLIC_PROGRAM_ID in apps/provider/.env and apps/app/.env"
echo "   # Rebuild and copy target/idl/nfticket.json into the checked-in app IDLs"
echo ""
echo "4. ${YELLOW}Run the apps:${NC}"
echo "   # Terminal 1 - Provider Portal:"
echo "   cd apps/provider && npm run dev"
echo "   # http://localhost:3001"
echo ""
echo "   # Terminal 2 - Buyer App:"
echo "   cd apps/app && npm run dev"
echo "   # http://localhost:3002"
echo ""
echo "5. ${YELLOW}Get on your phone:${NC}"
echo "   # Deploy to Vercel for public URL:"
echo "   ./deploy.sh"
echo ""
echo "   # Or test locally:"
echo "   # Visit http://YOUR_MAC_IP:3002 on your phone"
echo ""
echo "=============================="
echo ""
print_success "NFTicket is ready! 🎉"
