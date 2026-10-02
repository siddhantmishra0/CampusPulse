import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex-1 font-semibold text-lg">
        {/* Mobile menu toggle would go here */}
      </div>
      <div className="flex items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">Logged in as:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        ) : (
          <Link to="/login">
            <Button size="sm">Log in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
