import type { NextApiResponse } from 'next';
import { withApiErrorHandling, ApiError } from '../../../shared/lib/apiErrors';
import { withAuth, AuthenticatedRequest } from '../../../shared/lib/auth';
import { fulfillOrder } from '../../../../lib/fulfillment';
import { getPrismaClient } from '../../../shared/lib/prisma';
import { hasPlatformAccess } from '../../../shared/lib/types';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw ApiError.methodNotAllowed();
  }

  const { orderId, ownerWallet } = req.body as { orderId?: string; ownerWallet?: string | null };
  if (!orderId?.trim()) {
    throw ApiError.badRequest('Missing required field: orderId', 'MISSING_ORDER_ID');
  }

  // Verify the user has permission to fulfill this order
  const prisma = getPrismaClient();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { purchaserId: true, event: { select: { organizerId: true } } },
  });

  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  const isPurchaser = req.user!.id === order.purchaserId;
  const isOrganizer = req.user!.id === order.event.organizerId;
  const isAdmin = hasPlatformAccess(req.user!.role);

  if (!isPurchaser && !isOrganizer && !isAdmin) {
    throw ApiError.forbidden(
      'Only the purchaser or event organizer can fulfill this order',
      'FORBIDDEN',
    );
  }

  // Call the shared fulfillment logic
  const result = await fulfillOrder(orderId, {
    ownerWallet,
    fulfilledBy: req.user!.id,
  });

  if (!result.success) {
    throw ApiError.badRequest(result.error || 'Fulfillment failed', 'FULFILLMENT_FAILED');
  }

  res.status(200).json({
    success: true,
    alreadyFulfilled: result.alreadyFulfilled,
    ticket: result.ticket,
    mintResult: result.mintResult,
  });
}

export default withApiErrorHandling(withAuth(handler));
