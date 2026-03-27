import type { NextApiRequest, NextApiResponse } from 'next';
import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { handleStateApi } from '../../../shared/lib/apiHandlers';
import { withAuth } from '../../../shared/lib/auth';

const authenticatedHandler = withAuth(handleStateApi);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = typeof req.body?.action === 'string' ? req.body.action : '';
  if (action === 'settings:get') {
    return handleStateApi(req, res);
  }

  return authenticatedHandler(req, res);
}

export default withApiErrorHandling(handler);
