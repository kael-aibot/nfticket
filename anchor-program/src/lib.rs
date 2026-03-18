use anchor_lang::prelude::*;

// Program ID (placeholder - will be generated)
declare_id!("NFTicket111111111111111111111111111111111111");

const MAX_SCANNERS: usize = 50;

#[program]
pub mod nfticket {
    use super::*;

    /// Create a new event
    pub fn create_event(
        ctx: Context<CreateEvent>,
        name: String,
        description: String,
        event_date: i64,
        venue: String,
        tiers: Vec<TicketTier>,
        resale_config: ResaleConfig,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let organizer = &ctx.accounts.organizer;
        let clock = Clock::get()?;

        require!(!name.is_empty(), ErrorCode::InvalidEventName);
        require!(event_date > clock.unix_timestamp, ErrorCode::InvalidEventDate);
        require!(!tiers.is_empty(), ErrorCode::NoTiersProvided);

        event.organizer = organizer.key();
        event.name = name;
        event.description = description;
        event.event_date = event_date;
        event.venue = venue;
        event.tiers = tiers;
        event.resale_config = resale_config;
        event.is_active = true;
        event.total_tickets_sold = 0;
        event.total_revenue = 0;
        event.authorized_scanners = vec![];
        event.created_at = clock.unix_timestamp;

        msg!("Event created: {}", event.name);
        Ok(())
    }

    /// Mint a new ticket NFT
    pub fn mint_ticket(
        ctx: Context<MintTicket>,
        tier_index: u8,
        seat_info: Option<String>,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let ticket = &mut ctx.accounts.ticket;
        let buyer = &ctx.accounts.buyer;
        let clock = Clock::get()?;

        require!(event.is_active, ErrorCode::EventNotActive);
        require!((tier_index as usize) < event.tiers.len(), ErrorCode::InvalidTier);

        let tier = &mut event.tiers[tier_index as usize];
        require!(tier.sold < tier.supply, ErrorCode::TierSoldOut);

        // Update tier sold count
        tier.sold += 1;
        event.total_tickets_sold += 1;
        event.total_revenue += tier.price;

        // Set ticket data
        ticket.event_id = event.key();
        ticket.owner = buyer.key();
        ticket.tier_index = tier_index;
        ticket.tier_name = tier.name.clone();
        ticket.seat_info = seat_info;
        ticket.purchase_price = tier.price;
        ticket.purchase_time = clock.unix_timestamp;
        ticket.scan_status = ScanStatus::Unscanned;
        ticket.resale_count = 0;
        ticket.resale_history = vec![];
        ticket.is_for_sale = false;
        ticket.sale_price = None;

        msg!("Ticket minted: Event={}, Tier={}", event.name, tier.name);
        Ok(())
    }

    /// List ticket for resale
    pub fn list_ticket_for_resale(
        ctx: Context<ListTicketForResale>,
        sale_price: u64,
    ) -> Result<()> {
        let event = &ctx.accounts.event;
        let ticket = &mut ctx.accounts.ticket;
        let clock = Clock::get()?;

        require!(
            ticket.owner == ctx.accounts.seller.key(),
            ErrorCode::NotTicketOwner
        );
        require!(
            matches!(ticket.scan_status, ScanStatus::Unscanned),
            ErrorCode::TicketAlreadyUsed
        );

        // Calculate max allowed price based on time decay
        let time_until_event = event.event_date.saturating_sub(clock.unix_timestamp);
        let max_price = calculate_max_resale_price(
            ticket.purchase_price,
            time_until_event,
            &event.resale_config,
        )?;

        require!(sale_price <= max_price, ErrorCode::PriceExceedsMaximum);

        ticket.is_for_sale = true;
        ticket.sale_price = Some(sale_price);

        msg!("Ticket listed for resale at: {} lamports", sale_price);
        Ok(())
    }

    /// Buy ticket from secondary market
    pub fn buy_resale_ticket(ctx: Context<BuyResaleTicket>) -> Result<()> {
        let event = &ctx.accounts.event;
        let ticket = &mut ctx.accounts.ticket;
        let buyer = &ctx.accounts.buyer;
        let clock = Clock::get()?;

        require!(ticket.is_for_sale, ErrorCode::TicketNotForSale);
        let sale_price = ticket.sale_price.ok_or(ErrorCode::TicketNotForSale)?;

        // Calculate profit and splits
        let profit = sale_price.saturating_sub(ticket.purchase_price);
        
        let config = &event.resale_config;
        let organizer_share = profit * config.organizer_royalty as u64 / 100;
        let original_buyer_share = profit * config.original_buyer_royalty as u64 / 100;
        let charity_share = profit * config.charity_royalty as u64 / 100;

        // Record original owner
        let original_owner = ticket.owner;
        
        // Update ticket
        ticket.owner = buyer.key();
        ticket.resale_count = ticket.resale_count.saturating_add(1);
        ticket.is_for_sale = false;
        ticket.sale_price = None;
        ticket.resale_history.push(ResaleRecord {
            from: original_owner,
            to: buyer.key(),
            price: sale_price,
            timestamp: clock.unix_timestamp,
        });

        msg!(
            "Ticket resold! Profit split - Organizer: {}, Original Buyer: {}, Charity: {}",
            organizer_share, original_buyer_share, charity_share
        );

        Ok(())
    }

    /// Scan and validate ticket
    pub fn scan_ticket(ctx: Context<ScanTicket>) -> Result<()> {
        let event = &ctx.accounts.event;
        let ticket = &mut ctx.accounts.ticket;
        let scanner = &ctx.accounts.scanner;
        let clock = Clock::get()?;

        require!(ticket.event_id == event.key(), ErrorCode::TicketEventMismatch);
        require!(
            matches!(ticket.scan_status, ScanStatus::Unscanned),
            ErrorCode::TicketAlreadyUsed
        );
        require!(
            event.organizer == scanner.key() || 
            event.authorized_scanners.contains(&scanner.key()),
            ErrorCode::UnauthorizedScanner
        );

        ticket.scan_status = ScanStatus::Scanned {
            timestamp: clock.unix_timestamp,
            scanner: scanner.key(),
        };

        msg!("Ticket scanned successfully!");
        Ok(())
    }

    /// Add authorized scanner
    pub fn add_scanner(ctx: Context<ManageScanners>, scanner: Pubkey) -> Result<()> {
        let event = &mut ctx.accounts.event;
        
        require!(
            !event.authorized_scanners.contains(&scanner),
            ErrorCode::ScannerAlreadyExists
        );
        require!(
            event.authorized_scanners.len() < MAX_SCANNERS,
            ErrorCode::MaxScannersReached
        );

        event.authorized_scanners.push(scanner);
        msg!("Scanner authorized: {}", scanner);
        Ok(())
    }

    /// Cancel a resale listing
    pub fn cancel_resale_listing(ctx: Context<ListTicketForResale>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;

        require!(
            ticket.owner == ctx.accounts.seller.key(),
            ErrorCode::NotTicketOwner
        );
        require!(ticket.is_for_sale, ErrorCode::TicketNotForSale);

        ticket.is_for_sale = false;
        ticket.sale_price = None;

        msg!("Ticket resale listing cancelled");
        Ok(())
    }

    /// Close/archive an event
    pub fn close_event(ctx: Context<ManageScanners>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        event.is_active = false;
        msg!("Event closed: {}", event.name);
        Ok(())
    }

    /// Remove an authorized scanner
    pub fn remove_scanner(ctx: Context<ManageScanners>, scanner: Pubkey) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let original_len = event.authorized_scanners.len();

        event.authorized_scanners.retain(|authorized| authorized != &scanner);

        require!(
            event.authorized_scanners.len() != original_len,
            ErrorCode::ScannerNotFound
        );

        msg!("Scanner removed: {}", scanner);
        Ok(())
    }

    /// Staff override to invalidate a ticket
    pub fn invalidate_ticket(ctx: Context<InvalidateTicket>) -> Result<()> {
        let event = &ctx.accounts.event;
        let ticket = &mut ctx.accounts.ticket;

        require!(ticket.event_id == event.key(), ErrorCode::TicketEventMismatch);
        require!(
            !matches!(ticket.scan_status, ScanStatus::Invalidated),
            ErrorCode::TicketAlreadyInvalidated
        );

        ticket.scan_status = ScanStatus::Invalidated;

        msg!("Ticket invalidated");
        Ok(())
    }
}

// Data Structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TicketTier {
    pub name: String,
    pub price: u64,
    pub supply: u32,
    pub sold: u32,
    pub benefits: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ResaleConfig {
    pub time_decay_enabled: bool,
    pub max_premium_bps: u16,
    pub organizer_royalty: u8,
    pub original_buyer_royalty: u8,
    pub charity_royalty: u8,
    pub charity_address: Option<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum ScanStatus {
    Unscanned,
    Scanned { timestamp: i64, scanner: Pubkey },
    Invalidated,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ResaleRecord {
    pub from: Pubkey,
    pub to: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}

// Accounts
#[account]
pub struct Event {
    pub organizer: Pubkey,
    pub name: String,
    pub description: String,
    pub event_date: i64,
    pub venue: String,
    pub tiers: Vec<TicketTier>,
    pub resale_config: ResaleConfig,
    pub is_active: bool,
    pub total_tickets_sold: u32,
    pub total_revenue: u64,
    pub authorized_scanners: Vec<Pubkey>,
    pub created_at: i64,
}

#[account]
pub struct Ticket {
    pub event_id: Pubkey,
    pub owner: Pubkey,
    pub tier_index: u8,
    pub tier_name: String,
    pub seat_info: Option<String>,
    pub purchase_price: u64,
    pub purchase_time: i64,
    pub scan_status: ScanStatus,
    pub resale_count: u8,
    pub resale_history: Vec<ResaleRecord>,
    pub is_for_sale: bool,
    pub sale_price: Option<u64>,
}

// Contexts
#[derive(Accounts)]
pub struct CreateEvent<'info> {
    // Dynamic account sizing placeholder. Replace `1000` with a full calculation
    // covering discriminator + fixed fields + max string lengths + max tier entries
    // + `MAX_SCANNERS * 32` bytes for `authorized_scanners`.
    #[account(init, payer = organizer, space = 8 + 1000)]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub organizer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTicket<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(init, payer = buyer, space = 8 + 500)]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListTicketForResale<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(mut, has_one = owner)]
    pub ticket: Account<'info, Ticket>,
    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyResaleTicket<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub ticket: Account<'info, Ticket>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ScanTicket<'info> {
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub ticket: Account<'info, Ticket>,
    pub scanner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManageScanners<'info> {
    #[account(mut, has_one = organizer)]
    pub event: Account<'info, Event>,
    pub organizer: Signer<'info>,
}

#[derive(Accounts)]
pub struct InvalidateTicket<'info> {
    #[account(has_one = organizer)]
    pub event: Account<'info, Event>,
    #[account(mut)]
    pub ticket: Account<'info, Ticket>,
    pub organizer: Signer<'info>,
}

// Helper functions
fn calculate_max_resale_price(
    original_price: u64,
    time_until_event: i64,
    config: &ResaleConfig,
) -> Result<u64> {
    if !config.time_decay_enabled {
        let max_premium = original_price * config.max_premium_bps as u64 / 10000;
        return Ok(original_price + max_premium);
    }

    let days_until = time_until_event / 86400;
    
    let premium_bps = if days_until > 60 {
        5000u16 // 50%
    } else if days_until > 30 {
        3000u16 // 30%
    } else if days_until > 7 {
        1500u16 // 15%
    } else if days_until > 0 {
        500u16  // 5%
    } else {
        0u16    // Face value only
    };

    let max_premium = original_price * premium_bps as u64 / 10000;
    Ok(original_price + max_premium)
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid event name")]
    InvalidEventName,
    #[msg("Event date must be in the future")]
    InvalidEventDate,
    #[msg("No ticket tiers provided")]
    NoTiersProvided,
    #[msg("Event is not active")]
    EventNotActive,
    #[msg("Invalid ticket tier")]
    InvalidTier,
    #[msg("Ticket tier sold out")]
    TierSoldOut,
    #[msg("Not the ticket owner")]
    NotTicketOwner,
    #[msg("Ticket already used")]
    TicketAlreadyUsed,
    #[msg("Price exceeds maximum allowed")]
    PriceExceedsMaximum,
    #[msg("Ticket not for sale")]
    TicketNotForSale,
    #[msg("Ticket event mismatch")]
    TicketEventMismatch,
    #[msg("Unauthorized scanner")]
    UnauthorizedScanner,
    #[msg("Scanner already exists")]
    ScannerAlreadyExists,
    #[msg("Maximum number of scanners reached")]
    MaxScannersReached,
    #[msg("Scanner not found")]
    ScannerNotFound,
    #[msg("Ticket already invalidated")]
    TicketAlreadyInvalidated,
}
