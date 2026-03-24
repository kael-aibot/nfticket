import { describe, expect, it } from 'vitest';
import {
  handleEventsApi,
  handleOrdersApi,
  handleTicketsApi,
} from '../apps/shared/lib/apiHandlers';
import type {
  EventRecord,
  PaymentOrder,
  TicketRecord,
} from '../apps/shared/lib/types';
import { createMockResponse } from './utils/http';
import { prismaMock } from './utils/prismaMock';

describe('apiHandlers authenticated write guards', () => {
  it('rejects event writes without an authenticated user', async () => {
    const res = createMockResponse();

    await expect(
      handleEventsApi(
        {
          method: 'POST',
          body: { event: buildEvent() },
        },
        res,
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('rejects event writes that target another organizer account', async () => {
    const res = createMockResponse();

    await expect(
      handleEventsApi(
        {
          method: 'POST',
          user: { id: 'attacker_1' },
          body: { event: buildEvent() },
        } as never,
        res,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects ticket writes that try to overwrite another owner record', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue({
      ownerId: 'buyer_2',
    });

    const res = createMockResponse();

    await expect(
      handleTicketsApi(
        {
          method: 'POST',
          user: { id: 'buyer_1' },
          body: { ticket: buildTicket() },
        } as never,
        res,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects order writes that try to create an order for another purchaser', async () => {
    const res = createMockResponse();

    await expect(
      handleOrdersApi(
        {
          method: 'POST',
          user: { id: 'buyer_1' },
          body: { order: buildOrder({ purchaserId: 'buyer_2' }) },
        } as never,
        res,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows an authenticated owner to write their own order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    prismaMock.order.upsert.mockResolvedValue({
      id: 'order_1',
      eventId: 'evt_1',
      ticketId: 'ticket_1',
      purchaserId: 'buyer_1',
      amount: 125,
      paymentRail: 'stripe',
      status: 'pending',
      currency: 'usd',
      paymentReference: null,
      idempotencyKey: 'idem_1',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
      metadata: null,
    });
    prismaMock.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order_1',
      eventId: 'evt_1',
      ticketId: 'ticket_1',
      purchaserId: 'buyer_1',
      amount: 125,
      paymentRail: 'stripe',
      status: 'pending',
      currency: 'usd',
      paymentReference: null,
      idempotencyKey: 'idem_1',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
      metadata: null,
    });

    const res = createMockResponse();
    await handleOrdersApi(
      {
        method: 'POST',
        user: { id: 'buyer_1' },
        body: { order: buildOrder() },
      } as never,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.order.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.order.upsert.mock.calls[0]?.[0]?.create?.purchaserId).toBe('buyer_1');
  });

  it('only returns buyer tickets for the authenticated owner on reads', async () => {
    prismaMock.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket_1',
        eventId: 'evt_1',
        ownerId: 'buyer_1',
        tierName: 'GA',
        seatLabel: null,
        faceValue: 125,
        status: 'reserved',
        nftMode: 'compressed',
        assetId: null,
        transferCount: 0,
        createdAt: new Date('2026-03-01T10:00:00Z'),
        metadata: null,
      },
    ]);

    const res = createMockResponse();
    await handleTicketsApi(
      {
        method: 'GET',
        user: { id: 'buyer_1', role: 'buyer' },
        query: { ownerId: 'buyer_2' },
      } as never,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(prismaMock.ticket.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      ownerId: 'buyer_1',
    });
  });

  it('only returns buyer orders for the authenticated purchaser on reads', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'order_1',
        eventId: 'evt_1',
        ticketId: 'ticket_1',
        purchaserId: 'buyer_1',
        amount: 125,
        paymentRail: 'stripe',
        status: 'pending',
        currency: 'usd',
        paymentReference: null,
        idempotencyKey: 'idem_1',
        createdAt: new Date('2026-03-01T10:00:00Z'),
        updatedAt: new Date('2026-03-01T10:00:00Z'),
        metadata: null,
      },
      {
        id: 'order_2',
        eventId: 'evt_2',
        ticketId: 'ticket_2',
        purchaserId: 'buyer_2',
        amount: 150,
        paymentRail: 'stripe',
        status: 'pending',
        currency: 'usd',
        paymentReference: null,
        idempotencyKey: 'idem_2',
        createdAt: new Date('2026-03-01T11:00:00Z'),
        updatedAt: new Date('2026-03-01T11:00:00Z'),
        metadata: null,
      },
    ]);

    const res = createMockResponse();
    await handleOrdersApi(
      {
        method: 'GET',
        user: { id: 'buyer_1', role: 'buyer' },
      } as never,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject([
      {
        id: 'order_1',
        purchaserId: 'buyer_1',
      },
    ]);
  });
});

function buildEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'evt_1',
    organizerId: 'organizer_1',
    organizerName: 'Organizer',
    organizerWallet: null,
    name: 'Security Conference',
    description: 'desc',
    eventDate: Date.now() + 60_000,
    venue: 'Main Hall',
    tiers: [],
    acceptedPayments: ['card'],
    nftMode: 'compressed',
    isActive: true,
    totalTicketsSold: 0,
    totalRevenue: 0,
    authorizedScanners: [],
    resaleConfig: {
      platformFeePercent: 2.5,
      resaleDecay: {
        moreThan60Days: 50,
        between30And60Days: 30,
        between7And30Days: 15,
        under7Days: 5,
        dayOfEvent: 0,
      },
      royaltySplit: {
        organizer: 40,
        originalBuyer: 40,
        charity: 20,
      },
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

function buildTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    id: 'ticket_1',
    eventId: 'evt_1',
    ownerId: 'buyer_1',
    ownerEmail: 'buyer@example.com',
    ownerName: 'Buyer',
    ownerWallet: null,
    tierIndex: 0,
    tierName: 'GA',
    seatInfo: null,
    purchasePrice: 125,
    purchaseTime: Date.now(),
    paymentMethod: 'card',
    status: 'reserved',
    nftMode: 'compressed',
    assetId: null,
    isForSale: false,
    salePrice: null,
    resaleCount: 0,
    ...overrides,
  };
}

function buildOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 'order_1',
    eventId: 'evt_1',
    ticketId: 'ticket_1',
    purchaserId: 'buyer_1',
    amount: 125,
    method: 'card',
    status: 'pending',
    processor: 'stripe',
    currency: 'usd',
    paymentReference: null,
    idempotencyKey: 'idem_1',
    createdAt: Date.now(),
    ...overrides,
  };
}
