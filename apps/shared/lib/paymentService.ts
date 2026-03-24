import Stripe from 'stripe';
import { ApiError } from './apiErrors';
import { createPrefixedId } from './ids';
import { getPrismaClient } from './prisma';
import type { PaymentOrder } from './types';
import { verifyTransaction, loadSolanaConfig } from './solanaVerification';

/**
 * Real payment service with Stripe and Solana/USDC integration.
 * Replaces the simulated payment service.
 */

export interface PaymentRequest {
  amount: number;
  currency?: string;
  eventId: string;
  purchaserId: string;
  ticketId: string;
  method: 'card' | 'crypto';
  nftMode?: 'compressed' | 'metadata';
  idempotencyKey?: string;
  returnUrl?: string;
  // For crypto payments
  payerWallet?: string;
  transactionSignature?: string;
}

export interface PaymentResult {
  order: PaymentOrder;
  checkoutUrl?: string; // For Stripe redirect
  clientSecret?: string; // For Stripe Elements
  requiresPayment?: boolean;
  crypto?: {
    recipientWallet: string;
    currency: 'USDC';
    usdcMint: string;
  };
}

export interface CheckoutSession {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: 'pending' | 'complete' | 'expired';
}

// Initialize Stripe
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

function assertValidPaymentAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Payment amount must be greater than zero', 'INVALID_PAYMENT_AMOUNT');
  }
}

function resolveReturnOrigin(returnUrl?: string): string {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!returnUrl) {
    if (!configuredAppUrl) {
      throw ApiError.serviceUnavailable('NEXT_PUBLIC_APP_URL is not configured', 'APP_URL_NOT_CONFIGURED');
    }
    return configuredAppUrl;
  }

  if (returnUrl.startsWith('/')) {
    if (!configuredAppUrl) {
      throw ApiError.serviceUnavailable('NEXT_PUBLIC_APP_URL is not configured', 'APP_URL_NOT_CONFIGURED');
    }
    return new URL(returnUrl, configuredAppUrl).toString();
  }

  if (!configuredAppUrl) {
    throw ApiError.serviceUnavailable('NEXT_PUBLIC_APP_URL is not configured', 'APP_URL_NOT_CONFIGURED');
  }

  const configuredOrigin = new URL(configuredAppUrl).origin;
  const candidate = new URL(returnUrl);
  if (candidate.origin !== configuredOrigin) {
    throw ApiError.badRequest('Return URL must match the configured app origin', 'INVALID_RETURN_URL');
  }

  return candidate.toString();
}

/**
 * Create a Stripe Checkout session for ticket purchase
 */
export async function createStripeCheckout(
  request: PaymentRequest
): Promise<PaymentResult> {
  assertValidPaymentAmount(request.amount);
  const stripe = getStripe();
  if (!stripe) {
    throw ApiError.serviceUnavailable('Stripe is not configured', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  }

  const prisma = getPrismaClient();
  const idempotencyKey =
    request.idempotencyKey ?? `stripe:${request.eventId}:${request.ticketId}:${request.purchaserId}`;
  const returnOrigin = resolveReturnOrigin(request.returnUrl);

  // Check for existing order
  const existing = await prisma.order.findFirst({
    where: { idempotencyKey },
    include: { ticket: true },
  });

  if (existing) {
    // Return existing checkout if still pending
    if (existing.status === 'pending' && existing.paymentReference?.startsWith('cs_')) {
      const session = await stripe.checkout.sessions.retrieve(existing.paymentReference);
      if (session.status === 'open') {
        return {
          order: mapPrismaOrderToPaymentOrder(existing),
          checkoutUrl: session.url || undefined,
        };
      }
    }
    return { order: mapPrismaOrderToPaymentOrder(existing) };
  }

  // Get event details
  const event = await prisma.event.findUnique({ where: { id: request.eventId } });
  if (!event) {
    throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: request.currency?.toLowerCase() || 'usd',
        product_data: {
          name: `Ticket for ${event.name}`,
          description: `Event: ${event.name} at ${event.venue}`,
        },
        unit_amount: Math.round(request.amount * 100), // Stripe uses cents
      },
      quantity: 1,
    }],
    metadata: {
      eventId: request.eventId,
      ticketId: request.ticketId,
      purchaserId: request.purchaserId,
      idempotencyKey,
      nftMode: request.nftMode || 'compressed',
    },
    success_url: `${new URL('/my-tickets?success=true&session_id={CHECKOUT_SESSION_ID}', returnOrigin).toString()}`,
    cancel_url: `${new URL('/?canceled=true', returnOrigin).toString()}`,
  }, {
    idempotencyKey,
  });

  // Create pending order in database
  const order = await prisma.order.create({
    data: {
      id: createPrefixedId('order'),
      eventId: request.eventId,
      purchaserId: request.purchaserId,
      ticketId: null, // Will be set after payment
      paymentRail: 'stripe',
      amount: request.amount,
      currency: request.currency?.toUpperCase() || 'USD',
      status: 'pending',
      paymentReference: session.id,
      idempotencyKey,
      metadata: {
        nftMode: request.nftMode || 'compressed',
        checkoutStatus: session.status,
      },
    },
    include: { ticket: true },
  });

  return {
    order: mapPrismaOrderToPaymentOrder(order),
    checkoutUrl: session.url || undefined,
  };
}

/**
 * Handle Stripe webhook for payment completion
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) {
    throw ApiError.serviceUnavailable('Stripe is not configured', 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw ApiError.serviceUnavailable('Webhook secret is not configured', 'WEBHOOK_NOT_CONFIGURED');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid webhook signature', 'INVALID_SIGNATURE');
  }

  const prisma = getPrismaClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { eventId, ticketId, purchaserId, idempotencyKey, nftMode } = session.metadata || {};

    if (!eventId || !purchaserId) {
      console.error('Missing metadata in checkout session');
      return;
    }

    // Update order status
    await prisma.order.updateMany({
      where: { paymentReference: session.id },
      data: {
        status: 'confirmed',
        metadata: {
          checkoutStatus: 'complete',
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          nftMode: nftMode || 'compressed',
        } as any,
      },
    });

    // Get the updated order
    const order = await prisma.order.findFirst({
      where: { paymentReference: session.id },
    });

    if (order && !order.ticketId) {
      // Trigger fulfillment - mint the NFT ticket
      console.log(`Payment confirmed for order ${order.id}, triggering fulfillment...`);

      // Call fulfillment directly (webhook is already authenticated by Stripe signature)
      try {
        const { fulfillOrder } = await import('../../../lib/fulfillment');
        const result = await fulfillOrder(order.id, {
          fulfilledBy: 'stripe_webhook',
        });

        if (result.success) {
          console.log('Fulfillment completed successfully:', result.ticket?.id);
        } else {
          console.error('Fulfillment failed:', result.error);
        }
      } catch (fulfillError) {
        console.error('Failed to fulfill order:', fulfillError);
        // Don't throw - webhook should succeed even if fulfillment fails initially
        // Retry logic or manual fulfillment should handle this
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    await prisma.order.updateMany({
      where: { paymentReference: session.id },
      data: { status: 'cancelled' },
    });
  }
}

/**
 * Verify a Solana transaction for crypto payment
 * Performs on-chain verification before confirming the order
 */
export async function verifyCryptoPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  assertValidPaymentAmount(request.amount);
  if (!request.transactionSignature) {
    throw ApiError.badRequest('Transaction signature required', 'MISSING_TRANSACTION_SIGNATURE');
  }
  if (!request.payerWallet) {
    throw ApiError.badRequest('Payer wallet required', 'MISSING_PAYER_WALLET');
  }

  const prisma = getPrismaClient();
  const idempotencyKey = request.idempotencyKey ?? 
    `crypto:${request.eventId}:${request.ticketId}:${request.purchaserId}:${request.transactionSignature}`;

  // Check for existing order
  const existing = await prisma.order.findFirst({
    where: { idempotencyKey },
  });

  if (existing) {
    return { order: mapPrismaOrderToPaymentOrder(existing) };
  }

  // Verify transaction on-chain
  const solanaConfig = loadSolanaConfig();
  const currency = (request.currency?.toUpperCase() === 'USDC') ? 'USDC' : 'SOL';
  
  const verification = await verifyTransaction(
    request.transactionSignature,
    request.amount,
    currency,
    solanaConfig,
    request.payerWallet
  );

  if (!verification.valid) {
    throw ApiError.badRequest(
      `Payment verification failed: ${verification.error}`,
      'PAYMENT_VERIFICATION_FAILED',
    );
  }

  // Transaction verified - create confirmed order
  const order = await prisma.order.create({
    data: {
      id: createPrefixedId('order'),
      eventId: request.eventId,
      purchaserId: request.purchaserId,
      ticketId: null,
      paymentRail: currency.toLowerCase() as 'sol' | 'usdc',
      amount: request.amount,
      currency: currency,
      status: 'confirmed',
      paymentReference: request.transactionSignature,
      idempotencyKey,
      metadata: {
        payerWallet: request.payerWallet,
        nftMode: request.nftMode || 'compressed',
        verifiedAt: new Date().toISOString(),
        verificationDetails: {
          amount: verification.amount,
          from: verification.from,
          to: verification.to,
          slot: verification.confirmations,
        },
      },
    },
    include: { ticket: true },
  });

  return { order: mapPrismaOrderToPaymentOrder(order) };
}

export function getCryptoCheckoutDetails(): {
  recipientWallet: string;
  currency: 'USDC';
  usdcMint: string;
} {
  const solanaConfig = loadSolanaConfig();
  if (!solanaConfig.treasuryWallet) {
    throw ApiError.serviceUnavailable(
      'Crypto treasury wallet is not configured',
      'CRYPTO_TREASURY_NOT_CONFIGURED',
    );
  }

  return {
    recipientWallet: solanaConfig.treasuryWallet,
    currency: 'USDC',
    usdcMint: solanaConfig.usdcMint,
  };
}

/**
 * Get payment status for an order
 */
export async function getPaymentStatus(orderId: string): Promise<{
  status: string;
  paymentReference?: string;
  checkoutUrl?: string;
}> {
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  
  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  // If Stripe and pending, check session status
  if (order.paymentRail === 'stripe' && order.status === 'pending' && order.paymentReference?.startsWith('cs_')) {
    const stripe = getStripe();
    if (stripe) {
      const session = await stripe.checkout.sessions.retrieve(order.paymentReference);
      if (session.payment_status === 'paid') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'confirmed',
            metadata: {
              ...((order.metadata as Record<string, unknown> | null) ?? {}),
              checkoutStatus: session.status,
              paymentIntentId: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id,
            } as any,
          },
        });
      }

      return {
        status: session.payment_status === 'paid' ? 'confirmed' : order.status,
        paymentReference: order.paymentReference,
        checkoutUrl: session.status === 'open' ? session.url || undefined : undefined,
      };
    }
  }

  return {
    status: order.status,
    paymentReference: order.paymentReference || undefined,
  };
}

// Helper to map Prisma Order to PaymentOrder type
function mapPrismaOrderToPaymentOrder(order: any): PaymentOrder {
  return {
    id: order.id,
    eventId: order.eventId,
    ticketId: order.ticketId,
    purchaserId: order.purchaserId,
    amount: Number(order.amount),
    currency: order.currency,
    method: order.paymentRail === 'stripe' ? 'card' : 'crypto',
    status: order.status === 'confirmed' ? 'paid' : order.status === 'pending' ? 'pending' : 'failed',
    processor: order.paymentRail === 'stripe' ? 'stripe' : 'solana',
    nftMode: order.metadata?.nftMode || 'compressed',
    paymentReference: order.paymentReference,
    idempotencyKey: order.idempotencyKey,
    receiptLabel: order.paymentRail === 'stripe' ? 'Paid with Stripe' : 'Paid with crypto',
    receiptId: null,
    fulfillmentStatus: order.ticketId ? 'completed' : 'pending',
    notificationStatus: 'pending',
    assetId: null,
    mintAddress: null,
    mintSignature: null,
    confirmedAt: order.status === 'confirmed' ? new Date(order.updatedAt).getTime() : null,
    fulfilledAt: order.ticketId ? new Date(order.updatedAt).getTime() : null,
    retryCount: 0,
    lastError: null,
    createdAt: new Date(order.createdAt).getTime(),
  };
}
