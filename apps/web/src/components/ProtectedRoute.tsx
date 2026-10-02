import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { UserRole } from '@campuspulse/shared';
import { Spinner } from './ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = user.roles.some((role) => allowedRoles.includes(role as UserRole));
    if (!hasRole) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-md text-center shadow-sm">
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p>You don't have permission to view this page.</p>
            <Button className="mt-4" onClick={() => window.history.back()}>Go Back</Button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// Temporary Button import for this file only (assuming it's available)
import { Button } from './ui/Button';
