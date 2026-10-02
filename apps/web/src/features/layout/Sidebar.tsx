import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  // Shares the ['issues'] cache key with the Issue Board.
  const { data: issues } = useQuery<any[]>({
    queryKey: ['issues'],
    queryFn: async () => (await api.get('/issues')).data.data ?? [],
    enabled: !!user && user.roles?.some((r) =>
      ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string)),
    staleTime: 30_000,
  });

  const openIssues = (issues ?? []).filter(
    (i) => !['RESOLVED', 'ARCHIVED'].includes(i.status)
  ).length;

  const canReview = !!user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string));
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY', 'STUDENT'] },
    { href: '/admin/analytics', label: 'Analytics Hub', icon: 'bar_chart', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY'] },
    { href: '/issues', label: 'Issue Tracker', icon: 'flag', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'], badge: 'issues' },
    { href: '/knowledge', label: 'Knowledge Base', icon: 'folder', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'], extra: <span className="font-label-sm text-label-sm text-outline">RAG Store</span> },
    { href: '/campaigns', label: 'Feedback Campaigns', icon: 'assignment', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER', 'FACULTY'] },
    { href: '/owner', label: 'Platform Administration', icon: 'domain', roles: ['PLATFORM_OWNER'] },
    { href: '/settings', label: 'Settings', icon: 'settings', roles: ['PLATFORM_OWNER', 'INSTITUTION_ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    item.roles.some(role => user?.roles?.includes(role as any))
  ).map(item => {
    if (item.label === 'Dashboard' && user?.roles?.includes('STUDENT' as any) && user.roles.length === 1) {
      return { ...item, href: '/student/dashboard' };
    }
    return item;
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-surface-container-lowest border-r border-outline-variant/60 z-50 flex flex-col justify-between">
      <div className="flex flex-col">
        <div className="p-space-md flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-title-md text-title-md text-on-surface">CampusPulse</span>
                <span className="px-1.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm tracking-wide uppercase">Academic Pro</span>
              </div>
            </div>
          </div>
          <div className="mt-space-xs p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Tenant Scope</span>
            </div>
            <div className="font-title-sm text-title-sm text-on-surface truncate">Demo University</div>
            <div className="flex items-center justify-between font-mono-data text-mono-data text-on-surface-variant">
              <span>demo.campuspulse.local</span>
              <span className="px-1.5 py-0.2 rounded bg-surface-variant text-on-surface-variant font-label-sm text-label-sm">Higher Ed</span>
            </div>
          </div>
        </div>
        
        <nav className="flex flex-col gap-1 px-space-md mt-space-xs">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center justify-between px-space-md py-2.5 rounded-lg transition-colors",
                  isActive ? "bg-primary-container text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="font-title-sm text-title-sm">{item.label}</span>
                </div>
                {item.badge === 'issues' && openIssues > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">
                    {openIssues} Open
                  </span>
                ) : item.extra}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-space-md flex flex-col gap-space-sm bg-surface-container-low/50">
        <div className="p-space-sm rounded-lg border border-outline-variant/50 bg-surface-container-low flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary"></span>
            <span className="font-label-sm text-label-sm text-on-surface font-semibold">All Services Operational</span>
          </div>
          <span className="font-mono-data text-mono-data text-on-surface-variant truncate">BullMQ + pgvector active</span>
        </div>
        <div className="flex items-center justify-between px-space-xs">
          {/* These routes are reviewer-only in the API, so only surface them to
              roles that can actually open them. */}
          {canReview ? (
            <>
              <Link to="/knowledge" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">menu_book</span>Knowledge Base
              </Link>
              <Link to="/issues" className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">help_outline</span>Get Help
              </Link>
            </>
          ) : (
            <span className="font-body-sm text-body-sm text-outline">
              Need access? Ask your institution admin.
            </span>
          )}
          <span className="font-mono-data text-mono-data text-outline">v2.4.1</span>
        </div>
      </div>
    </aside>
  );
}
