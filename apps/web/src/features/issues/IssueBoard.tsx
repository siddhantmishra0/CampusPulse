import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Filter,
  Layers, ListChecks, RefreshCw, Search, Zap, ArrowRight, Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

type Issue = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  sourceFeedbackCount: number;
  assignedDepartment?: { id: string; name: string };
  assignedReviewer?: { id: string; firstName: string; lastName: string };
  _count?: { actions: number };
  createdAt: string;
};

type FeedbackIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  analysis: {
    id: string;
    sentiment: string;
    summary: string;
    submission: {
      id: string;
      campaignId: string;
      campaign: { id: string; title: string };
    };
  };
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'IDENTIFIED',    label: 'Identified',      color: '#f59e0b', bg: 'bg-amber-500/20  text-amber-400  border-amber-500/30'  },
  { key: 'UNDER_REVIEW',  label: 'Under Review',    color: '#06b6d4', bg: 'bg-cyan-500/20   text-cyan-400   border-cyan-500/30'   },
  { key: 'ACTION_PLANNED',label: 'Action Planned',  color: '#8b5cf6', bg: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  { key: 'IN_PROGRESS',   label: 'In Progress',     color: '#3b82f6', bg: 'bg-blue-500/20   text-blue-400   border-blue-500/30'   },
  { key: 'RESOLVED',      label: 'Resolved',        color: '#10b981', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'},
];

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUSES.find(s => s.key === status) ?? STATUSES[0];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.bg}`}>
      {s.label}
    </span>
  );
};

const CategoryBadge = ({ category }: { category: string }) => (
  <Badge variant="outline" className="text-xs capitalize">
    {category.replace(/_/g, ' ').toLowerCase()}
  </Badge>
);

const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5">
    <div className="mb-3 h-3 w-24 rounded-full bg-white/10" />
    <div className="mb-2 h-5 w-3/4 rounded-full bg-white/10" />
    <div className="h-3 w-1/2 rounded-full bg-white/10" />
  </div>
);

const SkeletonFeedbackCard = () => (
  <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5">
    <div className="mb-3 h-3 w-3/4 rounded-full bg-white/10" />
    <div className="mb-2 h-4 w-1/2 rounded-full bg-white/10" />
    <div className="h-3 w-1/3 rounded-full bg-white/10" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const IssueBoard = () => {
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState('');
  const [filterCategory, setFilterCat] = useState('');

  const params = new URLSearchParams();
  if (filterStatus) params.set('status', filterStatus);
  if (filterCategory) params.set('category', filterCategory);

  const { data: issues, isLoading, refetch } = useQuery<Issue[]>({
    queryKey: ['issues', filterStatus, filterCategory],
    queryFn: async () => {
      const res = await api.get(`/issues?${params.toString()}`);
      return res.data?.data ?? [];
    },
  });

  const filtered = issues?.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by status for column view
  const grouped = STATUSES.reduce<Record<string, Issue[]>>((acc, s) => {
    acc[s.key] = (filtered ?? []).filter(i => i.status === s.key);
    return acc;
  }, {});

  const totalCount = issues?.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-8 py-8 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Issue Tracker</h1>
                <p className="mt-0.5 text-sm text-slate-400">
                  {totalCount} issue{totalCount !== 1 ? 's' : ''} across all campaigns
                </p>
              </div>
            </div>
            <button
              id="refresh-issues"
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="issue-search"
                type="text"
                placeholder="Search issues…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                id="filter-status"
                value={filterStatus}
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent text-sm text-slate-300 outline-none"
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <select
                id="filter-category"
                value={filterCategory}
                onChange={e => setFilterCat(e.target.value)}
                className="bg-transparent text-sm text-slate-300 outline-none"
              >
                <option value="">All Categories</option>
                {['ACADEMIC', 'FACILITY', 'ADMINISTRATIVE', 'FACULTY', 'STUDENT_SERVICES', 'INFRASTRUCTURE', 'OTHER'].map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="mx-auto max-w-screen-2xl overflow-x-auto px-8 py-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="flex gap-4 min-w-max">
            {STATUSES.map(col => (
              <div key={col.key} className="flex w-72 flex-shrink-0 flex-col gap-3">
                {/* Column Header */}
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-300">
                    {grouped[col.key]?.length ?? 0}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {grouped[col.key]?.length === 0 && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] py-10 text-center">
                      <p className="text-xs text-slate-600">No issues</p>
                    </div>
                  )}
                  {grouped[col.key]?.map(issue => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.id}`}
                      id={`issue-card-${issue.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-500/30 hover:bg-white/[0.08] hover:shadow-xl hover:shadow-violet-500/10"
                    >
                      {/* glow */}
                      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: col.color + '30' }}
                      />
                      <div className="relative">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={issue.status} />
                          <CategoryBadge category={issue.category} />
                        </div>
                        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-white">
                          {issue.title}
                        </h3>
                        <p className="mb-3 line-clamp-2 text-xs text-slate-400">{issue.description}</p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            {issue.sourceFeedbackCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-500" />
                                {issue.sourceFeedbackCount}
                              </span>
                            )}
                            {(issue._count?.actions ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <ListChecks className="h-3 w-3 text-violet-400" />
                                {issue._count?.actions}
                              </span>
                            )}
                            {issue.assignedDepartment && (
                              <span className="truncate max-w-[80px]">{issue.assignedDepartment.name}</span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (filtered?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">No issues found</p>
            <p className="mt-1 text-sm text-slate-600">
              {search ? 'Try a different search term.' : 'Issues are automatically created from AI-analysed feedback.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
