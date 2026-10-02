import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@campuspulse/shared';

/**
 * Extracts and validates the tenant context for a request.
 * If user is PLATFORM_OWNER, they can specify a tenant in the header X-Tenant-ID.
 * Otherwise, the tenant is strictly bound to their token's tenantId.
 */
export const resolveTenant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const requestedTenantId = req.headers['x-tenant-id'] as string;
  const isPlatformOwner = req.user.roles.includes(UserRole.PLATFORM_OWNER);

  if (isPlatformOwner) {
    // Platform owner can act on any tenant they specify
    req.resolvedTenantId = requestedTenantId;
    return next();
  }

  // Regular users are strictly bound to their own tenant
  if (!req.user.tenantId) {
    return res.status(403).json({ success: false, error: 'User is not associated with any tenant' });
  }

  // Prevent cross-tenant access attempts
  if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
    return res.status(403).json({ success: false, error: 'Cross-tenant access forbidden' });
  }

  req.resolvedTenantId = req.user.tenantId;
  next();
};
