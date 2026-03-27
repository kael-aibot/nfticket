import type { NftMode, PaymentMethod, PaymentOrder } from './types';

export interface PaymentRequest {
  amount: number;
  currency?: string;
  eventId: string;
  purchaserId: string;
  ticketId: string;
  method: PaymentMethod;
  nftMode?: NftMode;
  idempotencyKey?: string;
  paymentReference?: string;
  payerWallet?: string;
  transactionSignature?: string;
  returnUrl?: string;
}

export interface CryptoCheckoutDetails {
  recipientWallet: string;
  currency: 'USDC';
  usdcMint: string;
}

export interface PaymentResult {
  order?: PaymentOrder;
  receiptLabel: string;
  checkoutUrl?: string;
  requiresPayment?: boolean;
  crypto?: CryptoCheckoutDetails;
}

export interface PaymentStatusResult {
  status: string;
  paymentReference?: string;
  checkoutUrl?: string;
}

export interface FulfillmentResult {
  success: boolean;
  alreadyFulfilled?: boolean;
  ticket?: unknown;
  order?: unknown;
  mintResult?: {
    signature: string;
    assetId: string;
    mintAddress: string | null;
    finality?: 'pending' | 'finalized' | string;
  };
}

export interface PaymentService {
  submitPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPaymentStatus(orderId: string): Promise<PaymentStatusResult>;
  fulfillOrder(orderId: string, ownerWallet?: string | null): Promise<FulfillmentResult>;
}

interface ApiErrorResponse {
  error?: boolean;
  message?: string;
  code?: string;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const { headers, ...restInit } = init ?? {};
  let response: Response;
  try {
    response = await fetch(input, {
      ...restInit,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error('Network error while contacting payment services');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? ((await response.json()) as T | ApiErrorResponse) : null;

  if (!response.ok) {
    const message =
      (payload as ApiErrorResponse | null)?.message
      ?? (response.status === 401 ? 'Authentication required' : null)
      ?? (response.status === 403 ? 'You do not have permission to complete this action' : null)
      ?? (response.status >= 500 ? 'Payment service is unavailable right now' : null)
      ?? 'Payment request failed';
    throw new Error(message);
  }

  return payload as T;
}

export function createPaymentService(): PaymentService {
  return {
    async submitPayment(request) {
      const response = await requestJson<{
        order?: PaymentOrder;
        checkoutUrl?: string;
        requiresPayment?: boolean;
        crypto?: CryptoCheckoutDetails;
      }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          eventId: request.eventId,
          ticketId: request.ticketId,
          method: request.method,
          nftMode: request.nftMode,
          idempotencyKey: request.idempotencyKey,
          paymentReference: request.paymentReference,
          payerWallet: request.payerWallet,
          transactionSignature: request.transactionSignature,
          returnUrl: request.returnUrl,
        }),
      });

      return {
        order: response.order,
        checkoutUrl: response.checkoutUrl,
        requiresPayment: response.requiresPayment,
        crypto: response.crypto,
        receiptLabel: request.method === 'card' ? 'Paid with card via Stripe' : 'Paid with crypto',
      };
    },

    async getPaymentStatus(orderId) {
      return requestJson<PaymentStatusResult>(`/api/checkout?orderId=${encodeURIComponent(orderId)}`, {
        method: 'GET',
      });
    },

    async fulfillOrder(orderId, ownerWallet) {
      return requestJson<FulfillmentResult>('/api/fulfill', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          ownerWallet,
        }),
      });
    },
  };
}
