import type { NextApiRequest, NextApiResponse } from 'next';
import { handleTicketsApi } from '../../../shared/lib/apiHandlers';
import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { withAuth } from '../../../shared/lib/auth';

const authenticatedHandler = withAuth(handleTicketsApi);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    return authenticatedHandler(req, res);
  }

  return handleTicketsApi(req, res);
}

export default withApiErrorHandling(handler);
