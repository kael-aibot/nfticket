import type { NextApiRequest, NextApiResponse } from 'next';
import { handleEventsApi } from '../../../shared/lib/apiHandlers';
import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { withAuth } from '../../../shared/lib/auth';

const authenticatedHandler = withAuth(handleEventsApi);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    return authenticatedHandler(req, res);
  }

  return handleEventsApi(req, res);
}

export default withApiErrorHandling(handler);
