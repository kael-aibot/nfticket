import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';
import idl from '../idl/nfticket.json';

const PROGRAM_ID = new PublicKey('NFTicket111111111111111111111111111111111111');

export interface Event {
  id: string;
  publicKey: PublicKey;
  organizer: string;
  name: string;
  description: string;
  eventDate: number;
  venue: string;
  tiers: TicketTier[];
  resaleConfig: ResaleConfig;
  isActive: boolean;
  totalTicketsSold: number;
  totalRevenue: number;
  authorizedScanners: string[];
  createdAt: number;
}

export interface TicketTier {
  name: string;
  price: number;
  supply: number;
  sold: number;
  benefits: string;
}

export interface ResaleConfig {
  timeDecayEnabled: boolean;
  maxPremiumBps: number;
  organizerRoyalty: number;
  originalBuyerRoyalty: number;
  charityRoyalty: number;
  charityAddress: PublicKey | null;
}

export interface Ticket {
  id: string;
  publicKey: PublicKey;
  eventId: string;
  event?: {
    name: string;
    description: string;
    eventDate: number;
    venue: string;
    organizer?: string;
  };
  owner: string;
  tierIndex: number;
  tierName: string;
  seatInfo: string | null;
  purchasePrice: number;
  purchaseTime: number;
  scanStatus: any;
  resaleCount: number;
  isForSale: boolean;
  salePrice: number | null;
}

export const useNfticket = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey) return null;
    return new AnchorProvider(
      connection,
      wallet as any,
      AnchorProvider.defaultOptions()
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as any, provider);
  }, [provider]);

  const fetchEvents = useCallback(async (): Promise<Event[]> => {
    if (!program) return [];
    try {
      const events = await program.account.event.all();
      return events.map((event: any) => ({
        id: event.publicKey.toString(),
        publicKey: event.publicKey,
        organizer: event.account.organizer.toString(),
        name: event.account.name,
        description: event.account.description,
        eventDate: event.account.eventDate.toNumber() * 1000,
        venue: event.account.venue,
        tiers: event.account.tiers.map((tier: any) => ({
          name: tier.name,
          price: tier.price.toNumber() / LAMPORTS_PER_SOL,
          supply: tier.supply,
          sold: tier.sold,
          benefits: tier.benefits,
        })),
        resaleConfig: {
          timeDecayEnabled: event.account.resaleConfig.timeDecayEnabled,
          maxPremiumBps: event.account.resaleConfig.maxPremiumBps,
          organizerRoyalty: event.account.resaleConfig.organizerRoyalty,
          originalBuyerRoyalty: event.account.resaleConfig.originalBuyerRoyalty,
          charityRoyalty: event.account.resaleConfig.charityRoyalty,
          charityAddress: event.account.resaleConfig.charityAddress,
        },
        isActive: event.account.isActive,
        totalTicketsSold: event.account.totalTicketsSold,
        totalRevenue: event.account.totalRevenue.toNumber() / LAMPORTS_PER_SOL,
        authorizedScanners: event.account.authorizedScanners.map((pk: any) => pk.toString()),
        createdAt: event.account.createdAt.toNumber() * 1000,
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }, [program]);

  const fetchMyEvents = useCallback(async (): Promise<Event[]> => {
    if (!program || !wallet.publicKey) return [];
    try {
      const events = await program.account.event.all([
        {
          memcmp: {
            offset: 8,
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);
      return events.map((event: any) => ({
        id: event.publicKey.toString(),
        publicKey: event.publicKey,
        organizer: event.account.organizer.toString(),
        name: event.account.name,
        description: event.account.description,
        eventDate: event.account.eventDate.toNumber() * 1000,
        venue: event.account.venue,
        tiers: event.account.tiers.map((tier: any) => ({
          name: tier.name,
          price: tier.price.toNumber() / LAMPORTS_PER_SOL,
          supply: tier.supply,
          sold: tier.sold,
          benefits: tier.benefits,
        })),
        resaleConfig: event.account.resaleConfig,
        isActive: event.account.isActive,
        totalTicketsSold: event.account.totalTicketsSold,
        totalRevenue: event.account.totalRevenue.toNumber() / LAMPORTS_PER_SOL,
        authorizedScanners: event.account.authorizedScanners.map((pk: any) => pk.toString()),
        createdAt: event.account.createdAt.toNumber() * 1000,
      }));
    } catch (error) {
      console.error('Error fetching my events:', error);
      return [];
    }
  }, [program, wallet.publicKey]);

  const createEvent = useCallback(async (params: {
    name: string;
    description: string;
    eventDate: Date;
    venue: string;
    tiers: { name: string; price: number; supply: number; benefits: string }[];
    resaleConfig?: {
      timeDecayEnabled?: boolean;
      maxPremiumBps?: number;
      organizerRoyalty?: number;
      originalBuyerRoyalty?: number;
      charityRoyalty?: number;
      charityAddress?: string;
    };
  }) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const eventKeypair = web3.Keypair.generate();
      const resaleConfig = {
        timeDecayEnabled: params.resaleConfig?.timeDecayEnabled ?? true,
        maxPremiumBps: params.resaleConfig?.maxPremiumBps ?? 5000,
        organizerRoyalty: params.resaleConfig?.organizerRoyalty ?? 50,
        originalBuyerRoyalty: params.resaleConfig?.originalBuyerRoyalty ?? 25,
        charityRoyalty: params.resaleConfig?.charityRoyalty ?? 0,
        charityAddress: params.resaleConfig?.charityAddress 
          ? new PublicKey(params.resaleConfig.charityAddress)
          : null,
      };

      const tx = await program.methods
        .createEvent(
          params.name,
          params.description,
          new BN(Math.floor(params.eventDate.getTime() / 1000)),
          params.venue,
          params.tiers.map(tier => ({
            name: tier.name,
            price: new BN(tier.price * LAMPORTS_PER_SOL),
            supply: tier.supply,
            sold: 0,
            benefits: tier.benefits,
          })),
          resaleConfig
        )
        .accounts({
          event: eventKeypair.publicKey,
          organizer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([eventKeypair])
        .rpc();

      return {
        signature: tx,
        eventPublicKey: eventKeypair.publicKey.toString(),
      };
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const mintTicket = useCallback(async (
    eventPublicKey: string | PublicKey,
    tierIndex: number,
    seatInfo?: string
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const eventPk = typeof eventPublicKey === 'string' 
        ? new PublicKey(eventPublicKey) 
        : eventPublicKey;
      const ticketKeypair = web3.Keypair.generate();

      const tx = await program.methods
        .mintTicket(tierIndex, seatInfo || null)
        .accounts({
          event: eventPk,
          ticket: ticketKeypair.publicKey,
          buyer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([ticketKeypair])
        .rpc();

      return {
        signature: tx,
        ticketPublicKey: ticketKeypair.publicKey.toString(),
      };
    } catch (error) {
      console.error('Error minting ticket:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const fetchMyTickets = useCallback(async (): Promise<Ticket[]> => {
    if (!program || !wallet.publicKey) return [];
    try {
      const tickets = await program.account.ticket.all([
        {
          memcmp: {
            offset: 8 + 32,
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      const ticketsWithEvents = await Promise.all(
        tickets.map(async (ticket: any) => {
          try {
            const eventAccount = await program.account.event.fetch(ticket.account.eventId);
            return {
              id: ticket.publicKey.toString(),
              publicKey: ticket.publicKey,
              eventId: ticket.account.eventId.toString(),
              event: {
                name: eventAccount.name,
                description: eventAccount.description,
                eventDate: eventAccount.eventDate.toNumber() * 1000,
                venue: eventAccount.venue,
              },
              owner: ticket.account.owner.toString(),
              tierIndex: ticket.account.tierIndex,
              tierName: ticket.account.tierName,
              seatInfo: ticket.account.seatInfo,
              purchasePrice: ticket.account.purchasePrice.toNumber() / LAMPORTS_PER_SOL,
              purchaseTime: ticket.account.purchaseTime.toNumber() * 1000,
              scanStatus: ticket.account.scanStatus,
              resaleCount: ticket.account.resaleCount,
              isForSale: ticket.account.isForSale,
              salePrice: ticket.account.salePrice 
                ? ticket.account.salePrice.toNumber() / LAMPORTS_PER_SOL 
                : null,
            };
          } catch {
            return {
              id: ticket.publicKey.toString(),
              publicKey: ticket.publicKey,
              eventId: ticket.account.eventId.toString(),
              owner: ticket.account.owner.toString(),
              tierIndex: ticket.account.tierIndex,
              tierName: ticket.account.tierName,
              seatInfo: ticket.account.seatInfo,
              purchasePrice: ticket.account.purchasePrice.toNumber() / LAMPORTS_PER_SOL,
              purchaseTime: ticket.account.purchaseTime.toNumber() * 1000,
              scanStatus: ticket.account.scanStatus,
              resaleCount: ticket.account.resaleCount,
              isForSale: ticket.account.isForSale,
              salePrice: ticket.account.salePrice 
                ? ticket.account.salePrice.toNumber() / LAMPORTS_PER_SOL 
                : null,
            };
          }
        })
      );

      return ticketsWithEvents;
    } catch (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }
  }, [program, wallet.publicKey]);

  const fetchTicket = useCallback(async (ticketPublicKey: string | PublicKey): Promise<Ticket | null> => {
    if (!program) return null;
    try {
      const ticketPk = typeof ticketPublicKey === 'string'
        ? new PublicKey(ticketPublicKey)
        : ticketPublicKey;

      const ticket = await program.account.ticket.fetch(ticketPk);
      let eventAccount = null;
      try {
        eventAccount = await program.account.event.fetch(ticket.eventId);
      } catch {}

      return {
        id: ticketPk.toString(),
        publicKey: ticketPk,
        eventId: ticket.eventId.toString(),
        event: eventAccount ? {
          name: eventAccount.name,
          description: eventAccount.description,
          eventDate: eventAccount.eventDate.toNumber() * 1000,
          venue: eventAccount.venue,
          organizer: eventAccount.organizer.toString(),
        } : null,
        owner: ticket.owner.toString(),
        tierIndex: ticket.tierIndex,
        tierName: ticket.tierName,
        seatInfo: ticket.seatInfo,
        purchasePrice: ticket.purchasePrice.toNumber() / LAMPORTS_PER_SOL,
        purchaseTime: ticket.purchaseTime.toNumber() * 1000,
        scanStatus: ticket.scanStatus,
        resaleCount: ticket.resaleCount,
        isForSale: ticket.isForSale,
        salePrice: ticket.salePrice ? ticket.salePrice.toNumber() / LAMPORTS_PER_SOL : null,
      };
    } catch (error) {
      console.error('Error fetching ticket:', error);
      return null;
    }
  }, [program]);

  const listTicketForResale = useCallback(async (
    ticketPublicKey: string | PublicKey,
    salePrice: number
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const ticketPk = typeof ticketPublicKey === 'string'
        ? new PublicKey(ticketPublicKey)
        : ticketPublicKey;
      const ticket = await program.account.ticket.fetch(ticketPk);

      const tx = await program.methods
        .listTicketForResale(new BN(salePrice * LAMPORTS_PER_SOL))
        .accounts({
          event: ticket.eventId,
          ticket: ticketPk,
          seller: wallet.publicKey,
        })
        .rpc();

      return { signature: tx };
    } catch (error) {
      console.error('Error listing ticket for resale:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const buyResaleTicket = useCallback(async (ticketPublicKey: string | PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const ticketPk = typeof ticketPublicKey === 'string'
        ? new PublicKey(ticketPublicKey)
        : ticketPublicKey;
      const ticket = await program.account.ticket.fetch(ticketPk);

      const tx = await program.methods
        .buyResaleTicket()
        .accounts({
          event: ticket.eventId,
          ticket: ticketPk,
          buyer: wallet.publicKey,
        })
        .rpc();

      return { signature: tx };
    } catch (error) {
      console.error('Error buying resale ticket:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const scanTicket = useCallback(async (
    eventPublicKey: string | PublicKey,
    ticketPublicKey: string | PublicKey
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const eventPk = typeof eventPublicKey === 'string'
        ? new PublicKey(eventPublicKey)
        : eventPublicKey;
      const ticketPk = typeof ticketPublicKey === 'string'
        ? new PublicKey(ticketPublicKey)
        : ticketPublicKey;

      const tx = await program.methods
        .scanTicket()
        .accounts({
          event: eventPk,
          ticket: ticketPk,
          scanner: wallet.publicKey,
        })
        .rpc();

      return { signature: tx };
    } catch (error) {
      console.error('Error scanning ticket:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const addScanner = useCallback(async (
    eventPublicKey: string | PublicKey,
    scannerPublicKey: string | PublicKey
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    try {
      const eventPk = typeof eventPublicKey === 'string'
        ? new PublicKey(eventPublicKey)
        : eventPublicKey;
      const scannerPk = typeof scannerPublicKey === 'string'
        ? new PublicKey        : scannerPublicKey;

      const tx = await program.methods
        .addScanner(scannerPk)
        .accounts({
          event: eventPk,
          organizer: wallet.publicKey,
        })
        .rpc();

      return { signature: tx };
    } catch (error) {
      console.error('Error adding scanner:', error);
      throw error;
    }
  }, [program, wallet.publicKey]);

  const getTicketQRData = useCallback((ticketPublicKey: string) => {
    return JSON.stringify({
      type: 'nfticket',
      ticketId: ticketPublicKey,
      timestamp: Date.now(),
    });
  }, []);

  const parseScannedQRData = useCallback((qrData: string) => {
    try {
      const parsed = JSON.parse(qrData);
      if (parsed.type === 'nfticket' && parsed.ticketId) {
        return {
          ticketId: parsed.ticketId,
          timestamp: parsed.timestamp,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    program,
    provider,
    connected: !!wallet.publicKey,
    publicKey: wallet.publicKey,
    fetchEvents,
    fetchMyEvents,
    createEvent,
    mintTicket,
    fetchMyTickets,
    fetchTicket,
    listTicketForResale,
    buyResaleTicket,
    scanTicket,
    addScanner,
    getTicketQRData,
    parseScannedQRData,
  };
};
