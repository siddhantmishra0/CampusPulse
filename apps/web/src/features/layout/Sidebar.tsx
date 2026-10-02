import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, PieChart, Settings, FileText, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Example of role-based navigation logic
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY', 'STUDENT'] },
    { href: '/campaigns', label: 'Campaigns', icon: MessageSquare, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY'] },
    { href: '/issues', label: 'Issues', icon: CheckSquare, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'] },
    { href: '/knowledge', label: 'Knowledge Base', icon: FileText, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'] },
    { href: '/admin/analytics', label: 'Analytics', icon: PieChart, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY'] },
    { href: '/settings', label: 'Settings', icon: Settings, roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    item.roles.some(role => user?.roles?.includes(role as any))
  ).map(item => {
    // Redirect Student dashboard to their specific dashboard route
    if (item.label === 'Dashboard' && user?.roles?.includes('STUDENT' as any) && user.roles.length === 1) {
      return { ...item, href: '/student/dashboard' };
    }
    return item;
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 py-4">
        <Link
          to="/dashboard"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <span className="sr-only">CampusPulse</span>
          <MessageSquare className="h-4 w-4 transition-all group-hover:scale-110" />
        </Link>
        
        {visibleNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:text-foreground md:h-8 md:w-8",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
