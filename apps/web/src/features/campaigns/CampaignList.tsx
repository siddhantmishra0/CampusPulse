import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  campaignType: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  departmentId: string | null;
  department?: { id: string; name: string; code: string } | null;
  subject?: { id: string; name: string; code: string } | null;
  _count?: { feedbackSubmissions: number };
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'SCHEDULED' | 'CLOSED' | 'ARCHIVED';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All Campaigns' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'ARCHIVED', label: 'Archived' },
];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-secondary-container text-on-secondary-container',
  DRAFT: 'bg-surface-variant text-on-surface-variant',
  SCHEDULED: 'bg-tertiary-container text-on-tertiary-container',
  CLOSED: 'bg-surface-container text-on-surface-variant',
  ARCHIVED: 'bg-surface-container-high text-outline',
};

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'ends today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function CampaignList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string));
  const canDelete = user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN'].includes(r as string));

  const { data: campaigns, isLoading, isError, error, refetch, isFetching } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data ?? [],
  });

  const counts = useMemo(() => {
    const base: Record<string, number> = { ALL: 0 };
    (campaigns ?? []).forEach((c) => {
      base.ALL += 1;
      base[c.status] = (base[c.status] ?? 0) + 1;
    });
    return base;
  }, [campaigns]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (campaigns ?? []).filter((c) => {
      if (status !== 'ALL' && c.status !== status) return false;
      if (!q) return true;
      return [c.title, c.description ?? '', c.department?.name ?? '', c.subject?.name ?? '']
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [campaigns, status, query]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['campaigns'] });

  const transition = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      await api.post(`/campaigns/${id}/transition`, { action });
    },
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (e: any) => setActionError(e.response?.data?.error || e.message || 'Action failed'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/campaigns/${id}`); },
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (e: any) => setActionError(e.response?.data?.error || e.message || 'Delete failed'),
  });

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Top Header Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-md border-b border-outline-variant/70 mb-space-lg">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-xs">
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              {counts.ACTIVE ?? 0} Active
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">Feedback Campaigns</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Configure, launch, and monitor student feedback surveys.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => { setStatus('CLOSED'); setQuery(''); }}
            className="h-10 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-title-sm text-title-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Past Campaigns</span>
          </button>
          {canManage && (
            <button
              onClick={() => navigate('/campaigns/new')}
              className="h-10 px-space-md rounded-lg bg-primary text-on-primary font-title-sm text-title-sm shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Campaign</span>
            </button>
          )}
        </div>
      </div>

      {(actionError || isError) && (
        <div className="mb-space-md rounded-lg border border-error/40 bg-error-container px-space-md py-3 font-body-sm text-body-sm text-on-error-container">
          {actionError || (error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load campaigns'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-space-lg items-start">
        {/* LEFT NAV PANEL - Quick Filters */}
        <div className="lg:col-span-1 flex flex-col gap-space-md sticky top-24">
          <div className="p-space-sm rounded-xl bg-surface-container-low border border-outline-variant flex flex-col">
            <h3 className="px-space-sm py-2 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Campaign Status</h3>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`flex items-center justify-between px-space-sm py-2 rounded-lg transition-colors ${
                  status === f.key
                    ? 'bg-surface-container text-on-surface font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                <span className="font-title-sm text-title-sm">{f.label}</span>
                <span className="font-mono-data text-mono-data text-outline">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="p-space-lg rounded-xl bg-primary-container text-on-primary-container flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">insights</span>
              <h3 className="font-title-md text-title-md">Analytics Ready</h3>
            </div>
            <p className="font-body-sm text-body-sm leading-relaxed">
              Open a campaign's insights to review sentiment, top topics and issues derived from student feedback.
            </p>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="mt-1 w-full py-2 rounded-lg bg-on-primary-container text-primary-container font-title-sm text-title-sm hover:opacity-90 transition-opacity"
            >
              Go to Analytics
            </button>
          </div>
        </div>

        {/* RIGHT MAIN PANEL */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          <div className="flex flex-col sm:flex-row gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-outline pointer-events-none">search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Search campaigns by name, scope or department..."
                type="text"
              />
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
              className="h-11 w-11 shrink-0 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>

          {isLoading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading campaigns...</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/70 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-outline block mb-2">campaign</span>
              <p className="font-title-md text-title-md text-on-surface">No campaigns found</p>
              <p className="font-body-sm text-body-sm text-outline mt-1">
                {campaigns?.length
                  ? 'Try a different status filter or clear the search.'
                  : 'Create your first feedback campaign to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {visible.map((c) => {
                const submissions = c._count?.feedbackSubmissions ?? 0;
                const due = daysUntil(c.endAt);
                const isDraft = c.status === 'DRAFT';
                return (
                  <div
                    key={c.id}
                    className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant hover:border-primary/50 hover:shadow-md transition-all flex flex-col gap-space-md"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 ${STATUS_STYLES[c.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                          {c.status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>}
                          {c.status}
                        </span>
                        <span className="font-mono-data text-mono-data text-outline">{c.campaignType}</span>
                      </div>
                      <Link to={`/campaigns/${c.id}`} className="hover:underline">
                        <h2 className="font-title-md text-title-md text-on-surface text-lg">{c.title}</h2>
                      </Link>
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                        {c.description || 'No description provided.'}
                      </p>
                      {(c.department || c.subject) && (
                        <div className="flex flex-wrap gap-1.5">
                          {c.department && (
                            <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                              {c.department.name}
                            </span>
                          )}
                          {c.subject && (
                            <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                              {c.subject.code}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
                      <div className="flex items-center justify-between font-body-sm text-body-sm">
                        <span className="text-on-surface-variant">Responses</span>
                        <span className="text-on-surface font-semibold">{submissions}</span>
                      </div>
                      <div className="flex items-center justify-between font-body-sm text-body-sm mt-1">
                        <span className="text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">event</span>
                          {c.status === 'ACTIVE' && due ? `Closes ${due}` : new Date(c.endAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 mt-auto">
                      <Link
                        to={`/admin/analytics/${c.id}`}
                        className="flex-1 py-2 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface font-title-sm text-title-sm transition-colors flex items-center justify-center gap-1"
                      >
                        View Insights
                        <span className="material-symbols-outlined text-[16px]">trending_up</span>
                      </Link>

                      {canManage && isDraft && (
                        <button
                          onClick={() => transition.mutate({ id: c.id, action: 'activate' })}
                          disabled={transition.isPending}
                          title="Publish this campaign"
                          className="flex-1 py-2 rounded-lg bg-primary text-on-primary font-title-sm text-title-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                          Launch
                        </button>
                      )}
                      {canManage && c.status === 'ACTIVE' && (
                        <button
                          onClick={() => transition.mutate({ id: c.id, action: 'close' })}
                          disabled={transition.isPending}
                          title="Close this campaign"
                          className="flex-1 py-2 rounded-lg bg-surface-variant text-on-surface font-title-sm text-title-sm hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                          Close
                        </button>
                      )}
                      {canManage && isDraft && (
                        <button
                          onClick={() => navigate(`/campaigns/${c.id}`)}
                          title="Edit configuration"
                          className="flex-1 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface font-title-sm text-title-sm transition-colors flex items-center justify-center"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && ['DRAFT', 'CLOSED', 'ARCHIVED'].includes(c.status) && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${c.title}"? This cannot be undone.`)) remove.mutate(c.id);
                          }}
                          disabled={remove.isPending}
                          title="Delete campaign"
                          className="py-2 px-3 rounded-lg border border-error/40 text-error font-title-sm text-title-sm hover:bg-error-container transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
