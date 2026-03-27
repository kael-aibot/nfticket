import { BlockchainEnvironment, prepareUsdcTransfer, solToLamports } from './blockchain';

export type PaymentRail = 'stripe' | 'sol' | 'usdc';

export interface PaymentEnvironment {
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  stripeConnectPlatformAccount?: string;
  enableStripe: boolean;
  enableSol: boolean;
  enableUsdc: boolean;
}

export interface BaseCheckoutRequest {
  amount: number;
  currency: string;
  eventId: string;
  ticketId: string;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutRequest extends BaseCheckoutRequest {
  rail: 'stripe';
  statementDescriptor?: string;
}

export interface CryptoCheckoutRequest extends BaseCheckoutRequest {
  rail: 'sol' | 'usdc';
  payerWallet: string;
  recipientWallet: string;
}

export type CheckoutRequest = StripeCheckoutRequest | CryptoCheckoutRequest;

export interface CheckoutDescriptor {
  rail: PaymentRail;
  status: 'requires_action';
  amount: number;
  currency: string;
  reference: string;
  metadata: Record<string, string>;
  stripe?: {
    mode: 'payment';
    statementDescriptor?: string;
    successUrl: string;
    cancelUrl: string;
    connectAccount?: string;
  };
  crypto?: {
    recipientWallet: string;
    amountRaw: string;
    asset: 'SOL' | 'USDC';
    mint?: string;
  };
}

export interface PaymentCoordinator {
  getEnabledRails(): PaymentRail[];
  createCheckout(request: CheckoutRequest): CheckoutDescriptor;
}

export function parsePaymentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): PaymentEnvironment {
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripePublishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeConnectPlatformAccount: env.STRIPE_CONNECT_PLATFORM_ACCOUNT,
    enableStripe: parseBooleanFlag(env.PAYMENTS_ENABLE_STRIPE, true),
    enableSol: parseBooleanFlag(env.PAYMENTS_ENABLE_SOL, true),
    enableUsdc: parseBooleanFlag(env.PAYMENTS_ENABLE_USDC, true),
  };
}

export function createPaymentCoordinator(params: {
  payments: PaymentEnvironment;
  blockchain: BlockchainEnvironment;
}): PaymentCoordinator {
  return {
    getEnabledRails() {
      return getEnabledRails(params.payments);
    },
    createCheckout(request) {
      assertRailEnabled(request.rail, params.payments);

      if (request.rail === 'stripe') {
        return createStripeCheckoutDescriptor(request, params.payments);
      }

      return createCryptoCheckoutDescriptor(request, params.blockchain);
    },
  };
}

export function getEnabledRails(environment: PaymentEnvironment): PaymentRail[] {
  const rails: PaymentRail[] = [];

  if (environment.enableStripe && environment.stripeSecretKey) {
    rails.push('stripe');
  }

  if (environment.enableSol) {
    rails.push('sol');
  }

  if (environment.enableUsdc) {
    rails.push('usdc');
  }

  return rails;
}

export function createStripeCheckoutDescriptor(
  request: StripeCheckoutRequest,
  environment: PaymentEnvironment,
): CheckoutDescriptor {
  if (!environment.stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }

  validateCheckoutAmount(request.amount);

  return {
    rail: 'stripe',
    status: 'requires_action',
    amount: request.amount,
    currency: request.currency.toLowerCase(),
    reference: buildPaymentReference(request.eventId, request.ticketId, request.customerId, 'stripe'),
    metadata: buildCheckoutMetadata(request),
    stripe: {
      mode: 'payment',
      statementDescriptor: request.statementDescriptor,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl,
      connectAccount: environment.stripeConnectPlatformAccount,
    },
  };
}

export function createCryptoCheckoutDescriptor(
  request: CryptoCheckoutRequest,
  blockchain: BlockchainEnvironment,
): CheckoutDescriptor {
  validateCheckoutAmount(request.amount);

  if (request.rail === 'sol') {
    return {
      rail: 'sol',
      status: 'requires_action',
      amount: request.amount,
      currency: request.currency.toLowerCase(),
      reference: buildPaymentReference(request.eventId, request.ticketId, request.customerId, 'sol'),
      metadata: buildCheckoutMetadata(request),
      crypto: {
        recipientWallet: request.recipientWallet,
        amountRaw: String(solToLamports(request.amount)),
        asset: 'SOL',
      },
    };
  }

  const transfer = prepareUsdcTransfer({
    payer: request.payerWallet,
    recipient: request.recipientWallet,
    amountUi: request.amount,
    environment: blockchain,
  });

  return {
    rail: 'usdc',
    status: 'requires_action',
    amount: request.amount,
    currency: request.currency.toLowerCase(),
    reference: buildPaymentReference(request.eventId, request.ticketId, request.customerId, 'usdc'),
    metadata: buildCheckoutMetadata(request),
    crypto: {
      recipientWallet: request.recipientWallet,
      amountRaw: transfer.amountRaw.toString(),
      asset: 'USDC',
      mint: transfer.mint.toBase58(),
    },
  };
}

function buildCheckoutMetadata(request: BaseCheckoutRequest): Record<string, string> {
  return {
    eventId: request.eventId,
    ticketId: request.ticketId,
    customerId: request.customerId,
  };
}

function buildPaymentReference(
  eventId: string,
  ticketId: string,
  customerId: string,
  rail: PaymentRail,
): string {
  return [rail, eventId.trim(), ticketId.trim(), customerId.trim()].join(':');
}

function assertRailEnabled(rail: PaymentRail, environment: PaymentEnvironment): void {
  const enabledRails = getEnabledRails(environment);

  if (!enabledRails.includes(rail)) {
    throw new Error(`Payment rail "${rail}" is not enabled`);
  }
}

function validateCheckoutAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}
