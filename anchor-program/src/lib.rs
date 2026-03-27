use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// Deployment placeholder only. Replace this with the pubkey from
// `solana address -k target/deploy/nfticket-keypair.json` before running
// `anchor build` / `anchor deploy`.
declare_id!("NFTicket111111111111111111111111111111111111");

const MAX_SCANNERS: usize = 50;
const MAX_TIERS: usize = 10;
const MAX_NAME_LENGTH: usize = 100;
const MAX_DESCRIPTION_LENGTH: usize = 500;
const MAX_VENUE_LENGTH: usize = 200;

#[program]
pub mod nfticket {
    use super::*;

    pub fn create_event(
        ctx: Context<CreateEvent>,
        name: String,
        description: String,
        event_date: i64,
        venue: String,
        tiers: Vec<TicketTier>,
        resale_config: ResaleConfig,
    ) -> Result<()> {
        require!(!name.is_empty() && name.len() <= MAX_NAME_LENGTH, ErrorCode::InvalidEventName);
        require!(description.len() <= MAX_DESCRIPTION_LENGTH, ErrorCode::InvalidDescription);
        require!(!venue.is_empty() && venue.len() <= MAX_VENUE_LENGTH, ErrorCode::InvalidVenue);

        let clock = Clock::get()?;
        require!(event_date > clock.unix_timestamp, ErrorCode::InvalidEventDate);

        require!(!tiers.is_empty(), ErrorCode::NoTiersProvided);
        require!(tiers.len() <= MAX_TIERS, ErrorCode::TooManyTiers);

        for tier in &tiers {
            require!(!tier.name.is_empty(), ErrorCode::InvalidTierName);
            require!(tier.supply > 0, ErrorCode::InvalidTierSupply);
        }

        require!(resale_config.organizer_royalty <= 100, ErrorCode::InvalidRoyaltyPercentage);

        let event = &mut ctx.accounts.event;
        event.organizer = ctx.accounts.organizer.key();
        event.name = name;
        event.description = description;
        event.event_date = event_date;
        event.venue = venue;
        event.tiers = tiers;
        event.resale_config = resale_config;
        event.is_active = true;
        event.total_tickets_sold = 0;
        event.total_revenue = 0;
        event.authorized_scanners = Vec::new();
        event.bump = ctx.bumps.event;

        Ok(())
    }

    pub fn mint_ticket(ctx: Context<MintTicket>, tier_index: u8) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!((tier_index as usize) < event.tiers.len(), ErrorCode::InvalidTierIndex);

        let tier = &mut event.tiers[tier_index as usize];
        require!(tier.minted_count < tier.supply, ErrorCode::TierSupplyExhausted);

        let price = tier.price;

        if price > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.organizer.to_account_info(),
                    },
                ),
                price,
            )?;
        }

        let ticket = &mut ctx.accounts.ticket;
        ticket.event_id = event.key();
        ticket.owner = ctx.accounts.buyer.key();
        ticket.tier_index = tier_index;
        ticket.purchase_price = price;
        ticket.scan_status = ScanStatus::Unscanned;
        ticket.is_for_sale = false;
        ticket.sale_price = None;
        ticket.bump = ctx.bumps.ticket;

        event.total_tickets_sold = event.total_tickets_sold.checked_add(1).ok_or(ErrorCode::ArithmeticOverflow)?;
        event.total_revenue = event.total_revenue.checked_add(price).ok_or(ErrorCode::ArithmeticOverflow)?;
        tier.minted_count = tier.minted_count.checked_add(1).ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn buy_resale_ticket(ctx: Context<BuyResaleTicket>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        let event = &ctx.accounts.event;

        require!(ticket.is_for_sale, ErrorCode::TicketNotForSale);
        let sale_price = ticket.sale_price.ok_or(ErrorCode::TicketNotForSale)?;

        let profit = sale_price.saturating_sub(ticket.purchase_price);
        let organizer_share = profit.checked_mul(event.resale_config.organizer_royalty as u64).ok_or(ErrorCode::ArithmeticOverflow)?.checked_div(100).ok_or(ErrorCode::ArithmeticOverflow)?;
        require!(sale_price >= organizer_share, ErrorCode::ArithmeticOverflow);
        let seller_amount = sale_price - organizer_share;

        anchor_lang::system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.to_account_info(), anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            }),
            seller_amount,
        )?;

        if organizer_share > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(ctx.accounts.system_program.to_account_info(), anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.organizer.to_account_info(),
                }),
                organizer_share,
            )?;
        }

        ticket.owner = ctx.accounts.buyer.key();
        ticket.is_for_sale = false;
        ticket.sale_price = None;

        Ok(())
    }

    pub fn scan_ticket(ctx: Context<ScanTicket>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        let event = &ctx.accounts.event;
        let scanner = &ctx.accounts.scanner;

        require!(ticket.event_id == event.key(), ErrorCode::TicketEventMismatch);
        require!(matches!(ticket.scan_status, ScanStatus::Unscanned), ErrorCode::TicketAlreadyUsed);

        let is_organizer = scanner.key() == event.organizer;
        let is_authorized_scanner = event.authorized_scanners.contains(&scanner.key());
        require!(is_organizer || is_authorized_scanner, ErrorCode::UnauthorizedScanner);

        let clock = Clock::get()?;
        ticket.scan_status = ScanStatus::Scanned { timestamp: clock.unix_timestamp, scanner: scanner.key() };

        Ok(())
    }

    pub fn list_for_resale(ctx: Context<Resale>, price: u64) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        let owner = &ctx.accounts.owner;

        require!(ticket.owner == owner.key(), ErrorCode::NotTicketOwner);
        require!(matches!(ticket.scan_status, ScanStatus::Unscanned), ErrorCode::TicketAlreadyUsed);
        require!(price > 0, ErrorCode::InvalidPrice);

        ticket.is_for_sale = true;
        ticket.sale_price = Some(price);

        Ok(())
    }

    pub fn cancel_resale(ctx: Context<Resale>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        let owner = &ctx.accounts.owner;

        require!(ticket.owner == owner.key(), ErrorCode::NotTicketOwner);
        require!(ticket.is_for_sale, ErrorCode::TicketNotForSale);

        ticket.is_for_sale = false;
        ticket.sale_price = None;

        Ok(())
    }

    pub fn add_scanner(ctx: Context<ManageEvent>, scanner: Pubkey) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!(event.authorized_scanners.len() < MAX_SCANNERS, ErrorCode::MaxScannersReached);
        require!(!event.authorized_scanners.contains(&scanner), ErrorCode::ScannerAlreadyExists);

        event.authorized_scanners.push(scanner);

        Ok(())
    }

    pub fn remove_scanner(ctx: Context<ManageEvent>, scanner: Pubkey) -> Result<()> {
        let event = &mut ctx.accounts.event;

        let index = event.authorized_scanners.iter().position(|&x| x == scanner).ok_or(ErrorCode::ScannerNotFound)?;
        event.authorized_scanners.remove(index);

        Ok(())
    }

    pub fn close_event(ctx: Context<ManageEvent>) -> Result<()> {
        ctx.accounts.event.is_active = false;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TicketTier {
    pub name: String,
    pub price: u64,
    pub supply: u32,
    pub minted_count: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ResaleConfig {
    pub organizer_royalty: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum ScanStatus {
    Unscanned,
    Scanned { timestamp: i64, scanner: Pubkey },
}

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
    pub bump: u8,
}

#[account]
pub struct Ticket {
    pub event_id: Pubkey,
    pub owner: Pubkey,
    pub tier_index: u8,
    pub purchase_price: u64,
    pub scan_status: ScanStatus,
    pub is_for_sale: bool,
    pub sale_price: Option<u64>,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateEvent<'info> {
    #[account(init, payer = organizer, space = 8 + 3000, seeds = [b"event", name.as_bytes(), organizer.key().as_ref()], bump)]
    pub event: Account<'info, Event>,
    #[account(mut)] pub organizer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTicket<'info> {
    #[account(mut)] pub event: Account<'info, Event>,
    #[account(init, payer = buyer, space = 8 + 500, seeds = [b"ticket", event.key().as_ref(), buyer.key().as_ref(), &event.total_tickets_sold.to_le_bytes()], bump)]
    pub ticket: Account<'info, Ticket>,
    #[account(mut)] pub buyer: Signer<'info>,
    #[account(mut, address = event.organizer)] pub organizer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyResaleTicket<'info> {
    #[account(mut)] pub event: Account<'info, Event>,
    #[account(mut, constraint = ticket.event_id == event.key())] pub ticket: Account<'info, Ticket>,
    #[account(mut)] pub buyer: Signer<'info>,
    #[account(mut, address = ticket.owner)] pub seller: AccountInfo<'info>,
    #[account(mut, address = event.organizer)] pub organizer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ScanTicket<'info> {
    #[account(mut)] pub event: Account<'info, Event>,
    #[account(mut, constraint = ticket.event_id == event.key())] pub ticket: Account<'info, Ticket>,
    pub scanner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Resale<'info> {
    #[account(mut, has_one = owner)] pub ticket: Account<'info, Ticket>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManageEvent<'info> {
    #[account(mut, has_one = organizer)] pub event: Account<'info, Event>,
    pub organizer: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid event name")] InvalidEventName,
    #[msg("Invalid description length")] InvalidDescription,
    #[msg("Invalid venue")] InvalidVenue,
    #[msg("Event date must be in the future")] InvalidEventDate,
    #[msg("No tiers provided")] NoTiersProvided,
    #[msg("Too many tiers (max 10)")] TooManyTiers,
    #[msg("Invalid tier name")] InvalidTierName,
    #[msg("Invalid tier supply")] InvalidTierSupply,
    #[msg("Invalid royalty percentage")] InvalidRoyaltyPercentage,
    #[msg("Invalid tier index")] InvalidTierIndex,
    #[msg("Tier supply exhausted")] TierSupplyExhausted,
    #[msg("Ticket not for sale")] TicketNotForSale,
    #[msg("Ticket already used")] TicketAlreadyUsed,
    #[msg("Not ticket owner")] NotTicketOwner,
    #[msg("Ticket does not belong to this event")] TicketEventMismatch,
    #[msg("Unauthorized scanner")] UnauthorizedScanner,
    #[msg("Max scanners reached (50)")] MaxScannersReached,
    #[msg("Scanner already exists")] ScannerAlreadyExists,
    #[msg("Scanner not found")] ScannerNotFound,
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Arithmetic overflow")] ArithmeticOverflow,
}
