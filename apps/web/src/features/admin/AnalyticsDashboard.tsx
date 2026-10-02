import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart2, ChevronRight, Search, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { useState } from 'react';

type Campaign = {
  id: string;
  title: string;
  description?: string;
  status: string;
  campaignType: string;
  _count?: { feedbackSubmissions: number };
};

const fetchCampaigns = async (): Promise<Campaign[]> => {
  const res = await api.get('/campaigns');
  return res.data?.data ?? [];
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    CLOSED: 'bg-red-500/20 text-red-400 border-red-500/30',
    DRAFT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    SCHEDULED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    ARCHIVED: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? colors.DRAFT}`}
    >
      {status}
    </span>
  );
};

const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-6">
    <div className="mb-4 h-4 w-1/3 rounded-full bg-white/10" />
    <div className="mb-2 h-6 w-2/3 rounded-full bg-white/10" />
    <div className="h-4 w-1/2 rounded-full bg-white/10" />
  </div>
);

export const AnalyticsDashboard = () => {
  const { data: campaigns, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: fetchCampaigns });
  const [search, setSearch] = useState('');

  const filtered = campaigns?.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-8 py-8 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
              <BarChart2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Analytics Hub</h1>
              <p className="mt-0.5 text-sm text-slate-400">
                Select a campaign to view AI-powered insights
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-6 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="analytics-search"
              type="text"
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
            />
          </div>
        </div>
      </div>

      {/* Campaign Grid */}
      <div className="mx-auto max-w-6xl px-8 py-10">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TrendingUp className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">No campaigns found</p>
            <p className="mt-1 text-sm text-slate-600">
              {search ? 'Try a different search term.' : 'Create a campaign to see analytics here.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/admin/analytics/${c.id}`}
                id={`campaign-card-${c.id}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:bg-white/10 hover:shadow-2xl hover:shadow-violet-500/10"
              >
                {/* glow */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl transition-all duration-500 group-hover:bg-violet-600/20" />

                <div className="relative">
                  <div className="mb-3 flex items-start justify-between">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-slate-500 capitalize">{c.campaignType?.replace(/_/g, ' ')}</span>
                  </div>
                  <h2 className="mb-1 text-lg font-semibold text-white line-clamp-2">{c.title}</h2>
                  {c.description && (
                    <p className="mb-4 text-sm text-slate-400 line-clamp-2">{c.description}</p>
                  )}
                  {c._count && (
                    <p className="mb-4 text-xs text-slate-500">
                      {c._count.feedbackSubmissions} submissions
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs font-medium text-violet-400 transition-colors group-hover:text-violet-300">
                    View analytics
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
