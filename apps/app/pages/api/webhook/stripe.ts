import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, withApiErrorHandling } from '../../../../shared/lib/apiErrors';
import { handleStripeWebhook } from '../../../../shared/lib/apiHandlers';

/**
 * Stripe webhook handler
 * Receives payment completion events from Stripe
 */

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for signature verification
  },
};

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    throw ApiError.badRequest('Missing stripe-signature header', 'MISSING_STRIPE_SIGNATURE');
  }

  try {
    const rawBody = await buffer(req);
    await handleStripeWebhook(rawBody.toString(), signature);
    res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('signature verification failed')) {
      throw ApiError.unauthorized('Invalid webhook signature', 'INVALID_SIGNATURE');
    }

    throw error;
  }
}

export default withApiErrorHandling(handler);
