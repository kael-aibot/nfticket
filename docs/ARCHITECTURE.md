# Architecture Overview

This document describes the high-level architecture of NFTicket.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        NFTICKET SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  Provider App   │    │   Solana        │    │  Buyer App  │ │
│  │  (Next.js)      │◄──►│   Blockchain    │◄──►│ (Next.js)   │ │
│  │  Port: 3001     │    │                 │    │ Port: 3002  │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                    │        │
│           │              ┌───────┴───────┐            │        │
│           │              │ Anchor        │            │        │
│           │              │ Program       │            │        │
│           │              │ (Rust)        │            │        │
│           │              └───────────────┘            │        │
│           │                                           │        │
│  ┌────────▼────────┐                        ┌────────▼──────┐ │
│  │ Event Creation  │                        │ Browse/Buy    │ │
│  │ Scanner Mgmt    │                        │ Show QR       │ │
│  │ Analytics       │                        │ Resell        │ │
│  └─────────────────┘                        └───────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Ticket Purchase Flow

1. Buyer browses events in the buyer app
2. Buyer selects event and tier
3. Buyer connects wallet (Phantom/Solflare)
4. App calls `mint_ticket` on the program
5. Program:
   - Verifies event is active
   - Verifies tier has supply remaining
   - Creates Ticket NFT account
   - Updates tier sold count
   - Transfers SOL from buyer
6. Buyer receives NFT ticket in their wallet

### Ticket Validation Flow

1. Attendee shows QR code at entry
2. Scanner app reads QR (contains ticket pubkey)
3. Scanner calls `scan_ticket` on the program
4. Program:
   - Verifies ticket exists
   - Verifies scanner is authorized
   - Verifies ticket hasn't been scanned
   - Marks ticket as scanned with timestamp
5. Entry granted

### Resale Flow

1. Ticket holder lists ticket for resale
2. App calls `list_ticket_for_resale`
3. Program validates price against time-decay rules
4. New buyer purchases via `buy_resale_ticket`
5. Program:
   - Calculates profit
   - Splits profit: 40% seller, 40% organizer, 20% charity
   - Transfers ticket NFT to new owner
   - Records resale history

## Account Structure

### Event Account

```rust
pub struct Event {
    pub organizer: Pubkey,           // 32 bytes
    pub name: String,                // 4 + len bytes
    pub description: String,         // 4 + len bytes
    pub event_date: i64,             // 8 bytes
    pub venue: String,               // 4 + len bytes
    pub tiers: Vec<TicketTier>,      // 4 + n*size bytes
    pub resale_config: ResaleConfig, // ~40 bytes
    pub is_active: bool,             // 1 byte
    pub total_tickets_sold: u32,     // 4 bytes
    pub total_revenue: u64,          // 8 bytes
    pub authorized_scanners: Vec<Pubkey>, // 4 + n*32 bytes
    pub created_at: i64,             // 8 bytes
}
```

### Ticket Account

```rust
pub struct Ticket {
    pub event_id: Pubkey,            // 32 bytes
    pub owner: Pubkey,               // 32 bytes
    pub tier_index: u8,              // 1 byte
    pub tier_name: String,           // 4 + len bytes
    pub seat_info: Option<String>,   // 1 + 4 + len bytes
    pub purchase_price: u64,         // 8 bytes
    pub purchase_time: i64,          // 8 bytes
    pub scan_status: ScanStatus,     // ~40 bytes
    pub resale_count: u8,            // 1 byte
    pub resale_history: Vec<ResaleRecord>, // 4 + n*size bytes
    pub is_for_sale: bool,           // 1 byte
    pub sale_price: Option<u64>,     // 1 + 8 bytes
}
```

## Security Considerations

- Only event organizer can authorize scanners
- Only authorized scanners can validate tickets
- Tickets can only be scanned once
- Resale prices are constrained by time-decay algorithm
- All state changes are on-chain and auditable

## Scalability

- Events are independent accounts
- Tickets are independent accounts
- No global state that could cause contention
- Supports parallel ticket purchases for different events
