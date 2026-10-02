import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState('');

  const isReviewer = user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string));

  // Notifications are derived from live operational state rather than a
  // separate feed, so the badge always reflects reality.
  const { data: alerts } = useQuery({
    queryKey: ['navbar-alerts'],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!isReviewer) return [] as { id: string; text: string; to: string; tone: string }[];
      const [docs, issues] = await Promise.all([
        api.get('/documents').then((r) => (r.data?.data ?? []) as any[]).catch(() => []),
        api.get('/issues').then((r) => (r.data?.data ?? []) as any[]).catch(() => []),
      ]);
      const out: { id: string; text: string; to: string; tone: string }[] = [];
      const failed = docs.filter((d) => d.status === 'FAILED');
      const ingesting = docs.filter((d) => ['UPLOADED', 'PROCESSING'].includes(d.status));
      const openIssues = issues.filter((i) => !['RESOLVED', 'ARCHIVED'].includes(i.status));
      if (failed.length) {
        out.push({
          id: 'doc-failed',
          text: `${failed.length} document${failed.length === 1 ? '' : 's'} failed to ingest`,
          to: '/knowledge', tone: 'text-error',
        });
      }
      if (ingesting.length) {
        out.push({
          id: 'doc-ingesting',
          text: `${ingesting.length} document${ingesting.length === 1 ? '' : 's'} being indexed`,
          to: '/knowledge', tone: 'text-on-surface-variant',
        });
      }
      if (openIssues.length) {
        out.push({
          id: 'issues-open',
          text: `${openIssues.length} open issue${openIssues.length === 1 ? '' : 's'} awaiting action`,
          to: '/issues', tone: 'text-primary',
        });
      }
      return out;
    },
  });

  const notificationCount = alerts?.length ?? 0;

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/60 z-40">
      <div className="h-16 w-full px-space-lg flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <span className="font-title-md text-title-md text-on-surface hidden sm:inline">CampusPulse AI</span>
          <div className="relative flex items-center w-80 lg:w-96">
            <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline pointer-events-none">search</span>
            <input
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search the knowledge base..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  navigate(`/knowledge?q=${encodeURIComponent(search.trim())}`);
                  setSearch('');
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-space-md">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-secondary-container text-on-secondary-container">
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                <span className="font-label-sm text-label-sm font-semibold">{user.roles?.[0] || 'User'}</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((v) => !v)}
                  title="Notifications"
                  aria-expanded={showNotifications}
                  className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl overflow-hidden z-50">
                    <div className="px-space-md py-3 border-b border-outline-variant flex items-center justify-between">
                      <span className="font-title-sm text-title-sm text-on-surface">Notifications</span>
                      <button
                        onClick={() => setShowNotifications(false)}
                        title="Close"
                        className="text-on-surface-variant hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {(alerts?.length ?? 0) === 0 ? (
                        <p className="px-space-md py-6 text-center font-body-sm text-body-sm text-outline">
                          Nothing needs your attention.
                        </p>
                      ) : (
                        alerts!.map((a) => (
                          <Link
                            key={a.id}
                            to={a.to}
                            onClick={() => setShowNotifications(false)}
                            className="flex items-start gap-2 px-space-md py-3 hover:bg-surface-container-low transition-colors border-b border-outline-variant last:border-0"
                          >
                            <span className={`material-symbols-outlined text-[18px] ${a.tone}`}>info</span>
                            <span className="font-body-sm text-body-sm text-on-surface">{a.text}</span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-6 w-px bg-surface-container-high"></div>
              <div className="flex items-center gap-space-sm">
                <div className="flex flex-col text-right hidden lg:flex">
                  <span className="font-title-sm text-title-sm text-on-surface leading-tight">{user.email}</span>
                  <button onClick={logout} className="font-label-sm text-label-sm text-error hover:underline text-right" type="button">Log out</button>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </div>
              </div>
            </>
          ) : (
            <Link to="/login" className="h-9 px-4 rounded-lg bg-primary text-on-primary font-title-sm text-title-sm flex items-center">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
