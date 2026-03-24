import type { NextApiResponse } from 'next';
import { withApiErrorHandling, ApiError } from '../../../shared/lib/apiErrors';
import {
  createStripeCheckout,
  getCryptoCheckoutDetails,
  getPaymentStatus,
  verifyCryptoPayment,
} from '../../../shared/lib/apiHandlers';
import { withAuth, AuthenticatedRequest } from '../../../shared/lib/auth';
import { getPrismaClient } from '../../../shared/lib/prisma';
import type { PaymentRequest } from '../../../shared/lib/apiHandlers';

/**
 * Checkout API - Creates payment sessions
 * POST /api/checkout
 * 
 * Requires authentication. The purchaser is derived from the authenticated user.
 * Stripe payments return a checkout URL; crypto payments require transaction verification.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : null;
    if (!orderId) {
      throw ApiError.badRequest('Missing required query param: orderId', 'MISSING_ORDER_ID');
    }

    const prisma = getPrismaClient();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        purchaserId: true,
        event: { select: { organizerId: true } },
      },
    });
    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    const isPurchaser = req.user!.id === order.purchaserId;
    const isOrganizer = req.user!.id === order.event.organizerId;
    const isAdmin = req.user ? ['admin', 'platform'].includes(req.user.role) : false;
    if (!isPurchaser && !isOrganizer && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to view this payment', 'FORBIDDEN');
    }

    const status = await getPaymentStatus(orderId);
    return res.status(200).json(status);
  }

  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const body = req.body as Omit<PaymentRequest, 'purchaserId'> & { 
    method: 'card' | 'crypto';
    eventId: string;
    amount: number;
  };

  // Validate required fields
  if (!body.eventId || !body.amount) {
    throw ApiError.badRequest(
      'Missing required fields: eventId, amount',
      'MISSING_REQUIRED_FIELDS'
    );
  }

  // purchaserId is derived from authenticated user, not client-provided
  const paymentRequest: PaymentRequest = {
    ...body,
    purchaserId: req.user!.id,
  };

  let result;

  if (body.method === 'card') {
    // Stripe checkout
    result = await createStripeCheckout(paymentRequest);
    return res.status(200).json({
      order: result.order,
      checkoutUrl: result.checkoutUrl,
    });
  } else if (body.method === 'crypto') {
    if (!body.transactionSignature || !body.payerWallet) {
      return res.status(200).json({
        requiresPayment: true,
        crypto: getCryptoCheckoutDetails(),
      });
    }

    // Crypto payment verification
    result = await verifyCryptoPayment(paymentRequest);
    return res.status(200).json({
      order: result.order,
    });
  } else {
    throw ApiError.badRequest(
      'Invalid method. Use "card" or "crypto"',
      'INVALID_PAYMENT_METHOD'
    );
  }
}

const authenticatedHandler = withAuth(handler);

// Wrap with auth + error handling
export default withApiErrorHandling(authenticatedHandler);
