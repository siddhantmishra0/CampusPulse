import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Department = { id: string; name: string; code: string };

type Issue = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  sourceFeedbackCount: number;
  assignedDepartmentId: string | null;
  assignedReviewerId: string | null;
  assignedDepartment?: { id: string; name: string } | null;
  assignedReviewer?: { id: string; firstName: string; lastName: string } | null;
  actions?: any[];
  _count?: { actions: number };
};

const STATUSES = ['IDENTIFIED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'];

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  IDENTIFIED: { label: 'Identified', dot: 'bg-error', chip: 'bg-error-container text-on-error-container' },
  UNDER_REVIEW: { label: 'Under Review', dot: 'bg-tertiary', chip: 'bg-tertiary-container text-on-tertiary-container' },
  ACTION_PLANNED: { label: 'Action Planned', dot: 'bg-primary', chip: 'bg-primary-container text-on-primary-container' },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-primary', chip: 'bg-primary-container text-on-primary-container' },
  RESOLVED: { label: 'Resolved', dot: 'bg-secondary', chip: 'bg-secondary-container text-on-secondary-container' },
  ARCHIVED: { label: 'Archived', dot: 'bg-outline', chip: 'bg-surface-container-high text-outline' },
};

const RESOLVED = ['RESOLVED', 'ARCHIVED'];

function shortRef(id: string) {
  return `ISSUE-${id.slice(0, 4).toUpperCase()}`;
}

function relative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Opened today';
  if (days === 1) return 'Opened 1 day ago';
  if (days < 7) return `Opened ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'Opened 1 week ago' : `Opened ${weeks} weeks ago`;
}

export const IssueBoard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', category: '', assignedDepartmentId: '' });

  const canManage = user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string));

  const { data: issues, isLoading, isFetching, refetch, isError, error } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: async () => (await api.get('/issues')).data.data ?? [],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data.data ?? [],
    enabled: canManage,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    setFormError(null);
  };

  const createIssue = useMutation({
    mutationFn: async () => {
      await api.post('/issues', {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        ...(draft.assignedDepartmentId ? { assignedDepartmentId: draft.assignedDepartmentId } : {}),
      });
    },
    onSuccess: () => {
      setDraft({ title: '', description: '', category: '', assignedDepartmentId: '' });
      setShowCreate(false);
      invalidate();
    },
    onError: (e: any) => setFormError(e.response?.data?.error || e.message || 'Failed to create issue'),
  });

  const patchIssue = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      await api.patch(`/issues/${id}`, body);
    },
    onSuccess: invalidate,
    onError: (e: any) => setFormError(e.response?.data?.error || e.message || 'Failed to update issue'),
  });

  const counts = useMemo(() => {
    const base: Record<string, number> = { ALL: 0, OPEN: 0, RESOLVED: 0 };
    (issues ?? []).forEach((i) => {
      base.ALL += 1;
      if (RESOLVED.includes(i.status)) base.RESOLVED += 1;
      else base.OPEN += 1;
    });
    return base;
  }, [issues]);

  const deptCounts = useMemo(() => {
    const m: Record<string, number> = { '': issues?.length ?? 0 };
    (issues ?? []).forEach((i) => {
      if (i.assignedDepartmentId) m[i.assignedDepartmentId] = (m[i.assignedDepartmentId] ?? 0) + 1;
    });
    return m;
  }, [issues]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (issues ?? []).filter((i) => {
      if (statusFilter === 'OPEN' && RESOLVED.includes(i.status)) return false;
      if (!['ALL', 'OPEN'].includes(statusFilter) && i.status !== statusFilter) return false;
      if (deptFilter && i.assignedDepartmentId !== deptFilter) return false;
      if (!q) return true;
      return [i.title, i.description, i.category, i.assignedDepartment?.name ?? '']
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [issues, statusFilter, deptFilter, search]);

  const submitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createIssue.mutate();
  };

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Top Header Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-md border-b border-outline-variant/70 mb-space-lg">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-xs">
            <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              {counts.OPEN} Open
            </span>
            <span className="font-mono-data text-mono-data text-outline">{counts.ALL} total</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">Issue Tracker &amp; Continuous Improvement</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Track and resolve structural themes identified across student feedback campaigns.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`h-10 px-space-md rounded-lg font-title-sm text-title-sm transition-colors flex items-center gap-1.5 ${
              showFilter ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            <span>Filter</span>
          </button>
          {canManage && (
            <button
              onClick={() => { setShowCreate(true); setFormError(null); }}
              className="h-10 px-space-md rounded-lg bg-primary text-on-primary font-title-sm text-title-sm shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Manual Issue</span>
            </button>
          )}
        </div>
      </div>

      {(formError || isError) && (
        <div className="mb-space-md rounded-lg border border-error/40 bg-error-container px-space-md py-3 font-body-sm text-body-sm text-on-error-container">
          {formError || (error as any)?.response?.data?.error || 'Failed to load issues'}
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-on-surface/40 p-space-lg overflow-y-auto">
          <form
            onSubmit={submitDraft}
            className="mt-24 w-full max-w-lg rounded-2xl bg-surface-container-lowest shadow-xl border border-outline-variant flex flex-col gap-space-md"
          >
            <div className="px-space-lg pt-space-lg">
              <h2 className="font-title-md text-title-md text-on-surface">Create Manual Issue</h2>
            </div>
            <div className="px-space-lg flex flex-col gap-space-sm">
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="issueTitle">Title *</label>
                <input id="issueTitle" required value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
                  placeholder="e.g. Lab ventilation in Block C" />
              </div>
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="issueCategory">Category *</label>
                <input id="issueCategory" required value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
                  placeholder="e.g. FACILITIES" />
              </div>
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="issueDept">Assign Department</label>
                <select id="issueDept" value={draft.assignedDepartmentId}
                  onChange={(e) => setDraft({ ...draft, assignedDepartmentId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary">
                  <option value="">Unassigned</option>
                  {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-label-sm text-label-sm text-on-surface-variant" htmlFor="issueDesc">Description *</label>
                <textarea id="issueDesc" required rows={4} value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Describe the problem and its impact." />
              </div>
            </div>
            <div className="px-space-lg pb-space-lg flex justify-end gap-space-sm">
              <button type="button" onClick={() => setShowCreate(false)}
                className="h-10 px-space-md rounded-lg border border-outline-variant text-title-sm font-title-sm text-on-surface hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={createIssue.isPending}
                className="h-10 px-space-md rounded-lg bg-primary text-on-primary text-title-sm font-title-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                {createIssue.isPending ? 'Creating...' : 'Create Issue'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-space-lg items-start">
        {/* LEFT NAV PANEL */}
        <div className="lg:col-span-1 flex flex-col gap-space-md sticky top-24">
          <div className="p-space-sm rounded-xl bg-surface-container-low border border-outline-variant flex flex-col">
            <h3 className="px-space-sm py-2 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Resolution Status</h3>
            {[
              { key: 'ALL', label: 'All Issues', icon: 'view_list' },
              { key: 'OPEN', label: 'Active & Assigned', icon: 'flag' },
              { key: 'RESOLVED', label: 'Closed Loop', icon: 'check_circle' },
            ].map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`flex items-center justify-between px-space-sm py-2 rounded-lg transition-colors ${
                  statusFilter === f.key ? 'bg-surface-container text-on-surface font-semibold' : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">{f.icon}</span>
                  <span className="font-title-sm text-title-sm">{f.label}</span>
                </div>
                <span className="font-mono-data text-mono-data text-outline">
                  {f.key === 'RESOLVED' ? counts.RESOLVED : f.key === 'OPEN' ? counts.OPEN : counts.ALL}
                </span>
              </button>
            ))}

            {showFilter && (
              <div className="mt-space-xs pt-space-xs border-t border-outline-variant flex flex-col gap-0.5">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                    className={`flex items-center justify-between px-space-sm py-1.5 rounded transition-colors ${
                      statusFilter === s ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-highest'
                    }`}>
                    <span className="flex items-center gap-2 font-title-sm text-title-sm">
                      <span className={`h-2 w-2 rounded-full ${STATUS_META[s]?.dot ?? 'bg-outline'}`} />
                      {STATUS_META[s]?.label ?? s}
                    </span>
                    <span className="font-mono-data text-mono-data text-outline">
                      {(issues ?? []).filter((i) => i.status === s).length}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-space-sm rounded-xl bg-surface-container-low border border-outline-variant flex flex-col">
            <h3 className="px-space-sm py-2 font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Department Scope</h3>
            <button
              onClick={() => setDeptFilter('')}
              className={`flex items-center px-space-sm py-2 rounded-lg transition-colors gap-2 ${
                deptFilter === '' ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}>
              <span className="h-2 w-2 rounded-full bg-outline"></span>
              <span className="font-title-sm text-title-sm flex-1 text-left">All Departments</span>
              <span className="font-mono-data text-mono-data text-outline">{deptCounts[''] ?? 0}</span>
            </button>
            {departments?.map((d) => (
              <button key={d.id} onClick={() => setDeptFilter(deptFilter === d.id ? '' : d.id)}
                className={`flex items-center px-space-sm py-2 rounded-lg transition-colors gap-2 ${
                  deptFilter === d.id ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}>
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                <span className="font-title-sm text-title-sm flex-1 text-left truncate">{d.name}</span>
                <span className="font-mono-data text-mono-data text-outline">{deptCounts[d.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT MAIN PANEL */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          <div className="flex flex-col sm:flex-row gap-space-sm">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-outline pointer-events-none">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Search issues by summary, category or department..."
                type="text"
              />
            </div>
            <button onClick={() => refetch()} disabled={isFetching} title="Refresh"
              className="h-11 w-11 shrink-0 rounded-xl bg-surface-container-lowest border border-outline-variant shadow-sm text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center disabled:opacity-50">
              <span className={`material-symbols-outlined text-[20px] ${isFetching ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>

          {(deptFilter || search) && (
            <div className="flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">filter_alt</span>
              <span>{visible.length} of {issues?.length ?? 0} shown</span>
              <button onClick={() => { setDeptFilter(''); setSearch(''); }}
                className="text-primary hover:underline font-title-sm text-title-sm">Clear</button>
            </div>
          )}

          {isLoading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading issues...</p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/70 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-outline block mb-2">task_alt</span>
              <p className="font-title-md text-title-md text-on-surface">No issues found</p>
              <p className="font-body-sm text-body-sm text-outline mt-1">
                {issues?.length ? 'Adjust your filters or search term.' : 'Create a manual issue or promote an AI-detected feedback issue.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-space-sm">
              {visible.map((issue) => {
                const meta = STATUS_META[issue.status] ?? STATUS_META.IDENTIFIED;
                const isClosed = RESOLVED.includes(issue.status);
                return (
                  <div key={issue.id}
                    className={`p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-outline-variant flex flex-col gap-space-md ${isClosed ? 'opacity-80' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-data text-mono-data text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                            {shortRef(issue.id)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant">
                            {issue.category}
                          </span>
                          {issue.sourceFeedbackCount > 0 && (
                            <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm">
                              {issue.sourceFeedbackCount} responses
                            </span>
                          )}
                        </div>
                        <Link to={`/issues/${issue.id}`} className="hover:underline">
                          <h2 className={`font-title-md text-title-md text-lg ${isClosed ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                            {issue.title}
                          </h2>
                        </Link>
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed max-w-2xl mt-1">
                          {issue.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`px-3 py-1 rounded-full font-title-sm text-title-sm flex items-center gap-1.5 border border-outline-variant/70 ${meta.chip}`}>
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          {meta.label.toUpperCase()}
                        </span>
                        <span className="font-mono-data text-mono-data text-outline">{relative(issue.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-space-md pt-2 border-t border-outline-variant/70">
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Department:</span>
                        {issue.assignedDepartment ? (
                          <span className="font-title-sm text-title-sm text-on-surface">{issue.assignedDepartment.name}</span>
                        ) : (
                          <span className="font-title-sm text-title-sm text-outline italic">Unassigned</span>
                        )}
                      </div>
                      <div className="w-px h-4 bg-surface-container-highest"></div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Reviewer:</span>
                        {issue.assignedReviewer ? (
                          <span className="font-title-sm text-title-sm text-on-surface">
                            {issue.assignedReviewer.firstName} {issue.assignedReviewer.lastName}
                          </span>
                        ) : (
                          <span className="font-title-sm text-title-sm text-outline italic">Unassigned</span>
                        )}
                      </div>
                      <div className="w-px h-4 bg-surface-container-highest"></div>
                      <span className="flex items-center gap-1 font-title-sm text-title-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">checklist</span>
                        {issue._count?.actions ?? issue.actions?.length ?? 0} Actions
                      </span>

                      <div className="ml-auto flex items-center gap-2">
                        {canManage && (
                          <select
                            value={issue.status}
                            onChange={(e) => patchIssue.mutate({ id: issue.id, body: { status: e.target.value } })}
                            disabled={patchIssue.isPending}
                            title="Change status"
                            className="h-8 px-2 rounded-lg bg-surface-container text-body-sm text-body-sm text-on-surface border border-outline-variant focus:outline-none focus:border-primary"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => navigate(`/issues/${issue.id}`)}
                          className="h-8 px-3 rounded-lg border border-outline-variant text-title-sm font-title-sm text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          Details
                        </button>
                        {canManage && !isClosed && (
                          <button
                            onClick={() => {
                              if (confirm(`Archive "${issue.title}"?`)) patchIssue.mutate({ id: issue.id, body: { status: 'ARCHIVED' } });
                            }}
                            disabled={patchIssue.isPending}
                            title="Archive issue"
                            className="h-8 w-8 rounded-lg border border-error/40 text-error hover:bg-error-container transition-colors flex items-center justify-center disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">archive</span>
                          </button>
                        )}
                      </div>
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
};
