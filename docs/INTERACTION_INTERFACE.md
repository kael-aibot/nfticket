# NFTicket Interaction Interface
## Provider ↔ Recipient Communication & Interaction System

---

## 1. Overview

The Interaction Interface enables seamless communication and transactions between event organizers (providers) and ticket holders (recipients) throughout the entire event lifecycle.

### Key Principles
- **Decentralized**: Core logic on Solana, metadata off-chain
- **Transparent**: All interactions recorded and visible
- **User-Controlled**: Users own their data and communications
- **Low-Friction**: Minimal steps for common actions

---

## 2. Core Interaction Flows

### 2.1 Ticket Purchase Flow
```
RECIPIENT                        PROVIDER
   │                                │
   │  1. Browse Events              │
   │  2. Select Tier                │
   │  3. Review Price Breakdown     │
   │  4. Connect Wallet             │
   │  5. Sign Transaction           │
   │────────PURCHASE──────────────►│
   │                                │
   │◄────────NFT TICKET────────────│
   │  • Ownership recorded on-chain │
   │  • QR code generated           │
   │  • Confirmation notification   │
```

### 2.2 Pre-Event Communication

**Provider Actions:**
- Post updates (venue change, schedule, etc.)
- Send reminders (24h, 2h before)
- Share exclusive content (backstage, meet&greet info)
- Request RSVP confirmations
- Poll ticket holders (merch preferences, dietary, etc.)

**Recipient Actions:**
- Receive push notifications
- Reply to polls
- Request accommodations
- Ask questions (Q&A forum)
- Opt-in to marketing

### 2.3 Ticket Transfer Flow
```
CURRENT OWNER                    NEW RECIPIENT
      │                                │
      │  1. Initiate Transfer          │
      │  2. Enter recipient address    │
      │  3. Set price (if reselling)   │
      │                                │
      │  ┌─ IF RESALE ─────────────┐   │
      │  │ Check time-decay rules   │   │
      │  │ Verify max premium       │   │
      │  │ Calculate profit split   │   │
      │  │ Execute triple-payment   │   │
      │  └──────────────────────────┘   │
      │                                │
      │──────TRANSFER REQUEST────────►│
      │                                │
      │◄────────ACCEPT/DECLINE────────│
      │                                │
      │──────NFT OWNERSHIP TRANSFER──►│
```

### 2.4 Entry Validation Flow
```
RECIPIENT              SCANNER APP              BLOCKCHAIN
   │                        │                        │
   │  1. Show QR Code       │                        │
   │───────────────────────►│                        │
   │                        │  2. Scan QR            │
   │                        │  3. Extract data       │
   │                        │  4. Validate on-chain  │
   │                        │───────────────────────►│
   │                        │◄───Validation Result───│
   │◄───5. Display Result───│                        │
```

---

## 3. Smart Contract Extensions

### 3.1 New Data Structures

```rust
// Message system for provider-recipient communication
#[account]
pub struct EventMessage {
    pub event_id: Pubkey,
    pub sender: Pubkey,           // Provider or authorized staff
    pub message_type: MessageType,
    pub content_hash: String,     // IPFS hash of encrypted content
    pub timestamp: i64,
    pub priority: PriorityLevel,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum MessageType {
    Announcement,      // General update
    Reminder,          // Time-based reminder
    ExclusiveContent,  // Backstage, meet&greet info
    Emergency,         // Urgent: cancellation, venue change
    Poll,              // Question/poll for recipients
}

// Review and rating system
#[account]
pub struct EventReview {
    pub event_id: Pubkey,
    pub reviewer: Pubkey,
    pub ticket_proof: Pubkey,     // Proof of attendance
    pub rating: u8,               // 1-5 stars
    pub review_hash: String,      // IPFS hash of review text
    pub timestamp: i64,
    pub verified: bool,           // Only if ticket was scanned
}

// Dispute system
#[account]
pub struct Dispute {
    pub dispute_id: Pubkey,
    pub event_id: Pubkey,
    pub ticket_id: Pubkey,
    pub complainant: Pubkey,
    pub dispute_type: DisputeType,
    pub description_hash: String,
    pub evidence_hashes: Vec<String>,
    pub status: DisputeStatus,
    pub created_at: i64,
    pub resolved_at: Option<i64>,
    pub resolution: Option<Resolution>,
}
```

### 3.2 New Instructions

```rust
pub fn broadcast_message(
    ctx: Context<BroadcastMessage>,
    content_hash: String,
    message_type: MessageType,
) -> Result<()>

pub fn submit_review(
    ctx: Context<SubmitReview>,
    rating: u8,
    review_hash: String,
) -> Result<()>

pub fn open_dispute(
    ctx: Context<OpenDispute>,
    dispute_type: DisputeType,
    description_hash: String,
    evidence_hashes: Vec<String>,
) -> Result<()>

pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    resolution: Resolution,
) -> Result<()>

pub fn transfer_with_message(
    ctx: Context<TransferWithMessage>,
    recipient: Pubkey,
    message: Option<String>,
) -> Result<()>
```

---

## 4. Frontend Components

### 4.1 Provider Dashboard - Communication Hub

**Features:**
- **Announcement Composer**
  - Pre-built templates (24h reminder, venue change, thank you)
  - Rich text editor
  - Audience segmentation (by tier, scan status)
  - Delivery analytics

- **Direct Messages**
  - One-on-one chat with ticket holders
  - Automated responses for common questions
  - Escalation to support

- **Analytics Dashboard**
  - Message open rates
  - Ticket scan rates by communication type
  - Engagement heatmaps

- **Dispute Manager**
  - View all open disputes
  - Evidence review
  - Resolution workflow
  - Refund processing

### 4.2 Recipient Inbox

**Features:**
- **Unified Inbox**
  - All event updates in one place
  - Filter by event, message type, read status
  - Priority indicators (emergency vs general)

- **Ticket Wallet**
  - View all owned tickets
  - Quick actions (transfer, list for resale)
  - Event countdown timers

- **Communication Preferences**
  - Opt-in/out of marketing
  - Notification frequency
  - Preferred channels (push, email, in-app)

### 4.3 Post-Event Review System

**Verified Reviews Only:**
- Only ticket holders whose tickets were scanned can leave reviews
- Prevents fake reviews
- Proof-of-attendance verification

**Review Components:**
- Star rating (1-5)
- Written review
- Photos/videos (optional)
- Would attend again? (Y/N)

---

## 5. Communication Templates

### 5.1 Provider Templates

```javascript
const MESSAGE_TEMPLATES = {
  reminder_24h: {
    title: "⏰ Your event is tomorrow!",
    body: "Hi {name}, just a friendly reminder that {event_name} is tomorrow at {time}. Venue: {venue}. Doors open at {door_time}. See you there!",
    actions: ["View Ticket", "Get Directions"]
  },
  
  reminder_2h: {
    title: "🎉 Starting in 2 hours!",
    body: "{event_name} kicks off in 2 hours! Don't forget your QR ticket. Venue: {venue}. See you soon!",
    actions: ["Show Ticket", "Contact Support"]
  },
  
  venue_change: {
    title: "📍 Important: Venue Change",
    body: "We've moved {event_name} to a new venue: {new_venue}. Same time, new location. Previous venue: {old_venue}. Sorry for any inconvenience!",
    priority: "high",
    actions: ["View New Location", "Request Refund"]
  },
  
  exclusive_content: {
    title: "🎁 Exclusive: Backstage Access Info",
    body: "As a {tier} ticket holder, you have backstage access! Check-in at the side entrance with your QR code. Time: {backstage_time}",
    tier: ["VIP", "Backstage"]
  },
  
  thank_you: {
    title: "🙏 Thank you for attending!",
    body: "Thanks for being part of {event_name}! We'd love your feedback. Leave a review and get early access to our next event.",
    actions: ["Leave Review", "Browse Future Events"],
    delay: "24h_after_event"
  },
  
  cancellation: {
    title: "🚨 Event Cancellation Notice",
    body: "We're sorry to inform you that {event_name} has been cancelled due to {reason}. Your ticket will be automatically refunded within 5-7 business days.",
    priority: "emergency",
    actions: ["View Refund Status", "Contact Support"]
  }
};
```

---

## 6. Dispute Resolution System

### 6.1 Dispute Types

1. **Event Cancelled** — Full refund warranted
2. **Significant Changes** — Partial refund negotiable
3. **Fraudulent Listing** — Scam ticket, full refund
4. **Scanning Issue** — Technical problems at venue
5. **Refund Request** — General refund appeal

### 6.2 Resolution Workflow

```
1. RECIPIENT opens dispute
   └─ Select dispute type
   └─ Describe issue
   └─ Upload evidence (photos, screenshots)
   └─ Submit within dispute window (e.g., 48h after event)

2. TICKET LOCKED
   └─ Cannot be resold during dispute
   └─ Scanning suspended

3. PROVIDER NOTIFIED
   └─ Receives dispute details
   └─ Can respond with evidence
   └─ Has resolution timeframe (e.g., 72h)

4. RESOLUTION OPTIONS
   ├─ Full refund (burn ticket)
   ├─ Partial refund (partial burn)
   ├─ Credit for future event
   ├─ Deny (no refund)
   └─ Escalate to arbitration

5. RESOLUTION EXECUTED
   └─ If refund: SOL/USDC transferred
   └─ Ticket status updated
   └─ Both parties notified
   └─ Dispute record stored
```

### 6.3 Arbitration (Escalation)

If provider and recipient cannot agree:
- **Community jury** — Random selection of NFTicket users vote
- **Automated rules** — Smart contract enforces refund based on evidence
- **DAO governance** — Long-term: NFTicket DAO handles escalations

---

## 7. Privacy & Security

### 7.1 Data Minimization
- Wallet addresses pseudonymized in communications
- Optional: Link to email (encrypted, user-controlled)
- No personal data stored on-chain

### 7.2 Message Encryption
- Direct messages end-to-end encrypted
- Group announcements signed by provider
- Content hashes verify integrity

### 7.3 Opt-Out Controls
- Recipients can block any provider
- Global "do not disturb" mode
- Granular notification preferences

---

## 8. Implementation Priority

### Phase 1: Essential (MVP)
- [x] Ticket purchase flow
- [x] Basic provider dashboard
- [ ] Broadcast announcements
- [ ] Simple messaging
- [ ] QR validation

### Phase 2: Engagement
- [ ] Review system
- [ ] Polls/surveys
- [ ] Template library
- [ ] Analytics dashboard

### Phase 3: Trust & Safety
- [ ] Dispute system
- [ ] Arbitration
- [ ] Verified reviews
- [ ] Report abuse

---

## Summary

The Interaction Interface transforms NFTicket from a simple ticketing system into a comprehensive event management platform. By enabling seamless provider-recipient communication, we:

- **Improve attendee experience** through timely updates
- **Reduce support burden** via self-service options
- **Build trust** with transparent dispute resolution
- **Create engagement** with post-event interactions
- **Generate insights** through analytics and reviews

This system ensures both providers and recipients have the tools they need for successful events.