import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateEvent,
  validateOrder,
  validateTicket,
  validateUserIdentity,
  defaultEventConfiguration,
} from '../lib/domain';
import type { Event, Order, Ticket, UserIdentity } from '../lib/domain';

describe('Domain Validation', () => {
  describe('Event Validation', () => {
    it('creates valid event with defaults', () => {
      const event = validateEvent({
        id: 'evt_test',
        organizerId: 'org_123',
        name: 'Test Concert',
        description: 'A great show',
        venue: 'The Venue',
        startsAt: Date.now() + 86400000,
        endsAt: null,
        timeZone: 'America/Anchorage',
        status: 'published',
        capacity: 100,
        configuration: defaultEventConfiguration,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(event.id).toBe('evt_test');
      expect(event.name).toBe('Test Concert');
      expect(event.configuration.nftMode).toBe('compressed');
    });

    it('throws on invalid capacity', () => {
      expect(() =>
        validateEvent({
          id: 'evt_test',
          organizerId: 'org_123',
          name: 'Test',
          description: 'Test',
          venue: 'Venue',
          startsAt: Date.now(),
          endsAt: null,
          timeZone: 'UTC',
          status: 'published',
          capacity: -1,
          configuration: defaultEventConfiguration,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      ).toThrow();
    });
  });

  describe('Order Validation', () => {
    it('creates valid order', () => {
      const order = validateOrder({
        id: 'ord_test',
        eventId: 'evt_123',
        purchaserId: 'usr_456',
        ticketId: 'tkt_789',
        paymentRail: 'stripe',
        amount: 50.00,
        currency: 'USD',
        status: 'confirmed',
        paymentReference: 'pi_123',
        idempotencyKey: 'idem_123',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(order.amount).toBe(50.00);
      expect(order.status).toBe('confirmed');
    });

    it('validates payment rails', () => {
      expect(() =>
        validateOrder({
          id: 'ord_test',
          eventId: 'evt_123',
          purchaserId: 'usr_456',
          ticketId: 'tkt_789',
          paymentRail: 'invalid' as any,
          amount: 50,
          currency: 'USD',
          status: 'pending',
          paymentReference: null,
          idempotencyKey: 'idem',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      ).toThrow();
    });
  });

  describe('Ticket Validation', () => {
    it('creates valid ticket', () => {
      const ticket = validateTicket({
        id: 'tkt_test',
        eventId: 'evt_123',
        orderId: 'ord_456',
        ownerId: 'usr_789',
        inventoryKey: 'inv_1',
        tierName: 'General',
        seatLabel: 'A-1',
        faceValue: 50.00,
        currency: 'USD',
        assetId: 'asset_123',
        nftMode: 'compressed',
        status: 'minted',
        transferCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(ticket.status).toBe('minted');
      expect(ticket.nftMode).toBe('compressed');
    });
  });

  describe('User Identity Validation', () => {
    it('creates valid identity', () => {
      const identity = validateUserIdentity({
        id: 'usr_test',
        email: 'test@example.com',
        emailVerified: false,
        displayName: 'Test User',
        primaryWallet: null,
        wallets: [],
        authMode: 'email',
        role: 'buyer',
        kycStatus: 'not_required',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(identity.email).toBe('test@example.com');
      expect(identity.role).toBe('buyer');
    });
  });
});
