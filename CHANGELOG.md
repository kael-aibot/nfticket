# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup
- Solana smart contract for NFT ticketing
- Provider portal for event organizers
- Buyer app for ticket purchasers
- Time-decaying resale mechanism
- Triple-split profit sharing
- QR code ticket validation

## [0.1.0] - 2026-03-14

### Added
- **Smart Contract**
  - Event creation with multiple tiers
  - NFT ticket minting
  - Time-decaying resale pricing
  - Triple-split profit distribution
  - On-chain ticket scanning
  - Scanner authorization

- **Provider App**
  - Dashboard with event stats
  - Event creation wizard (3-step)
  - Event management page
  - Ticket tier configuration
  - Resale rule settings
  - Scanner management
  - Ticket validation interface

- **Buyer App**
  - Event browsing
  - Ticket purchase flow
  - My tickets view
  - QR code display
  - Resale listing
  - Mobile-optimized UI

- **Shared**
  - `useNfticket` hook for program interaction
  - Anchor IDL
  - TypeScript types

[Unreleased]: https://github.com/yourusername/nfticket/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/nfticket/releases/tag/v0.1.0
