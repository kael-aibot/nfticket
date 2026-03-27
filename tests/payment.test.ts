import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from './utils/prismaMock';

const retrieveSessionMock = vi.fn();
const verifyTransactionMock = vi.fn();
const loadSolanaConfigMock = vi.fn(() => ({
  treasuryWallet: 'treasury_wallet',
  usdcMint: 'usdc_mint',
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        retrieve: retrieveSessionMock,
        create: vi.fn(),
      },
    };
  },
}));

vi.mock('../apps/shared/lib/solanaVerification', () => ({
  verifyTransaction: verifyTransactionMock,
  loadSolanaConfig: loadSolanaConfigMock,
}));

describe('payment service', () => {
  beforeEach(() => {
    retrieveSessionMock.mockReset();
    verifyTransactionMock.mockReset();
    loadSolanaConfigMock.mockClear();
  });

  it('requires Stripe configuration', async () => {
    process.env.STRIPE_SECRET_KEY = '';
    const { createStripeCheckout } = await import('../apps/shared/lib/paymentService');

    await expect(
      createStripeCheckout({
        amount: 50,
        eventId: 'evt_123',
        ticketId: 'tkt_456',
        purchaserId: 'usr_789',
        method: 'card',
        currency: 'usd',
      }),
    ).rejects.toThrow('Stripe not configured');
  });

  it('returns an existing order when the idempotency key was already used', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'ord_existing',
      eventId: 'evt_123',
      ticketId: 'tkt_456',
      purchaserId: 'usr_789',
      amount: 50,
      paymentRail: 'stripe',
      status: 'confirmed',
      currency: 'USD',
      paymentReference: 'cs_test123',
      idempotencyKey: 'test_key',
      metadata: { nftMode: 'compressed' },
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
    });

    const { createStripeCheckout } = await import('../apps/shared/lib/paymentService');
    const result = await createStripeCheckout({
      amount: 50,
      eventId: 'evt_123',
      ticketId: 'tkt_456',
      purchaserId: 'usr_789',
      method: 'card',
      currency: 'usd',
      idempotencyKey: 'test_key',
    });

    expect(result.order.id).toBe('ord_existing');
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });

  it('requires a transaction signature for crypto verification', async () => {
    const { verifyCryptoPayment } = await import('../apps/shared/lib/paymentService');

    await expect(
      verifyCryptoPayment({
        amount: 0.5,
        eventId: 'evt_123',
        ticketId: 'tkt_456',
        purchaserId: 'usr_789',
        method: 'crypto',
        currency: 'SOL',
        payerWallet: 'abc123',
      }),
    ).rejects.toThrow('Transaction signature required');
  });

  it('creates a confirmed order only after on-chain verification succeeds', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    prismaMock.order.create.mockResolvedValue({
      id: 'ord_new',
      eventId: 'evt_123',
      ticketId: null,
      purchaserId: 'usr_789',
      amount: 0.5,
      paymentRail: 'sol',
      status: 'confirmed',
      currency: 'SOL',
      paymentReference: 'tx_sig_abc',
      idempotencyKey: 'crypto:evt_123:tkt_456:usr_789:tx_sig_abc',
      metadata: { nftMode: 'compressed' },
      createdAt: new Date('2026-03-01T10:00:00Z'),
      updatedAt: new Date('2026-03-01T10:00:00Z'),
    });
    verifyTransactionMock.mockResolvedValue({
      valid: true,
      amount: 0.5,
      from: 'abc123',
      to: 'treasury_wallet',
      confirmations: 42,
    });

    const { verifyCryptoPayment } = await import('../apps/shared/lib/paymentService');
    const result = await verifyCryptoPayment({
      amount: 0.5,
      eventId: 'evt_123',
      ticketId: 'tkt_456',
      purchaserId: 'usr_789',
      method: 'crypto',
      currency: 'SOL',
      payerWallet: 'abc123',
      transactionSignature: 'tx_sig_abc',
    });

    expect(result.order.status).toBe('paid');
    expect(prismaMock.order.create).toHaveBeenCalledTimes(1);
    expect(verifyTransactionMock).toHaveBeenCalledWith(
      'tx_sig_abc',
      0.5,
      'SOL',
      expect.objectContaining({ treasuryWallet: 'treasury_wallet' }),
      'abc123',
    );
  });
});
