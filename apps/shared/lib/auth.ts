import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError } from './apiErrors';
import { getPrismaClient } from './prisma';
import { verifySession } from './secureAuth';
import type { UserRole } from './types';
import { hasPlatformAccess } from './types';

const SESSION_COOKIE = 'nfticket_session';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email: string | null;
    role: UserRole;
  };
  sessionId?: string;
}

/**
 * Extract session token from cookies or Authorization header
 */
function getSessionToken(req: NextApiRequest): string | null {
  if (req.cookies?.[SESSION_COOKIE]) {
    return req.cookies[SESSION_COOKIE] ?? null;
  }

  // Check cookie first
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const match = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
    if (match) {
      return decodeURIComponent(match.slice(`${SESSION_COOKIE}=`.length));
    }
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Serialize session cookie with security flags
 */
export function serializeSessionCookie(token: string | null, maxAge?: number): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  
  if (!token) {
    // Clear cookie
    return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureFlag}`;
  }
  
  const age = maxAge || 7 * 24 * 60 * 60; // 7 days default
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureFlag}`;
}

/**
 * Middleware to require authentication
 * Verifies the session token and attaches user info to the request
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  next: () => Promise<void>
): Promise<void> {
  const token = getSessionToken(req);

  if (!token) {
    throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  let session;
  try {
    session = await verifySession(token);
  } catch (error) {
    res.setHeader('Set-Cookie', serializeSessionCookie(null));

    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.serviceUnavailable(
      'Authentication service is unavailable',
      'AUTH_SERVICE_UNAVAILABLE',
    );
  }
  
  if (!session) {
    // Clear invalid cookie
    res.setHeader('Set-Cookie', serializeSessionCookie(null));
    throw ApiError.unauthorized('Invalid session', 'INVALID_SESSION');
  }

  req.user = {
    id: session.userId,
    email: session.email,
    role: session.role,
  };
  req.sessionId = session.sessionId;
  
  await next();
}

/**
 * Verify that the authenticated user owns the resource or is an admin
 */
export function requireOwnership(
  req: AuthenticatedRequest,
  ownerId: string,
  allowAdmin: boolean = true
): void {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  const isOwner = req.user.id === ownerId;
  const isAdmin = allowAdmin && hasPlatformAccess(req.user.role);

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      'You do not have permission to access this resource',
      'FORBIDDEN'
    );
  }
}

/**
 * Verify that the authenticated user is an organizer for the event
 */
export async function requireEventOrganizer(
  req: AuthenticatedRequest,
  eventId: string
): Promise<void> {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  const prisma = getPrismaClient();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  if (!event) {
    throw ApiError.notFound('Event not found', 'EVENT_NOT_FOUND');
  }

  const isOrganizer = event.organizerId === req.user.id;
  const isAdmin = hasPlatformAccess(req.user.role);

  if (!isOrganizer && !isAdmin) {
    throw ApiError.forbidden(
      'Only the event organizer can perform this action',
      'FORBIDDEN'
    );
  }
}

/**
 * Higher-order function to wrap API handlers with authentication
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await requireAuth(req as AuthenticatedRequest, res, async () => {
      await handler(req as AuthenticatedRequest, res);
    });
  };
}

/**
 * Optional auth - attaches user if authenticated, but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  next: () => Promise<void>
): Promise<void> {
  const token = getSessionToken(req);
  
  if (token) {
    const session = await verifySession(token);
    if (session) {
      req.user = {
        id: session.userId,
        email: session.email,
        role: session.role,
      };
      req.sessionId = session.sessionId;
    }
  }
  
  await next();
}
