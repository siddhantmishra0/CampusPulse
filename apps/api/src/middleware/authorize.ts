import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@campuspulse/shared';

/**
 * Ensures the user has at least one of the allowed roles.
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role as UserRole));

    if (!hasRole) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
