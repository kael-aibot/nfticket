import type { NextApiRequest, NextApiResponse } from 'next';
import { handleResaleApi } from '../../../shared/lib/apiHandlers';
import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { withAuth } from '../../../shared/lib/auth';

const authenticatedHandler = withAuth(handleResaleApi);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    return authenticatedHandler(req, res);
  }

  return handleResaleApi(req, res);
}

export default withApiErrorHandling(handler);
