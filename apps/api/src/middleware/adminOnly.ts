import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@campuspulse/shared';

/**
 * Middleware that ensures the authenticated user has an admin role.
 * For this project, admin roles are considered to be PLATFORM_OWNER or INSTITUTION_ADMIN.
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const adminRoles = [UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN];
  const hasAdminRole = req.user.roles.some((role) => adminRoles.includes(role as UserRole));
  if (!hasAdminRole) {
    res.status(403).json({ success: false, error: 'Admin privileges required' });
    return;
  }
  next();
};
