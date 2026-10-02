import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, Download, Smile, Frown, Meh, Zap,
  Tag, AlertTriangle, BarChart2, CalendarDays,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AnalyticsCard } from '../../components/AnalyticsCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type Sentiment = Record<string, number>;
type Topic = { name: string; confidence: number };
type Issues = Record<string, number>;
type OverallSummary = {
  sentiment: Sentiment;
  topTopics: Topic[];
  issueCounts: Issues;
  latestSummary: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#10b981',
  NEUTRAL:  '#f59e0b',
  NEGATIVE: '#ef4444',
  MIXED:    '#8b5cf6',
};

const CATEGORY_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

const SENTIMENT_ICONS: Record<string, React.ReactNode> = {
  POSITIVE: <Smile className="h-5 w-5" />,
  NEUTRAL:  <Meh className="h-5 w-5" />,
  NEGATIVE: <Frown className="h-5 w-5" />,
  MIXED:    <Zap className="h-5 w-5" />,
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-xl border border-white/20 bg-slate-900/90 px-4 py-3 text-sm shadow-xl backdrop-blur-md">
      <p className="font-medium text-white">{name}</p>
      <p className="text-slate-400">{value} submissions</p>
    </div>
  );
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/20 bg-slate-900/90 px-4 py-3 text-sm shadow-xl backdrop-blur-md">
      <p className="mb-1 font-medium text-white">{label}</p>
      <p className="text-violet-400">Confidence: {(payload[0].value * 100).toFixed(0)}%</p>
    </div>
  );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const AnalyticsDetail = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);

  const fetchSummary = async (): Promise<OverallSummary> => {
    const res = await api.get(`/analytics/${campaignId}/summary?${params.toString()}`);
    return res.data?.data;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-summary', campaignId, startDate, endDate],
    queryFn: fetchSummary,
    enabled: !!campaignId,
  });

  const handleExport = async (format: 'csv' | 'json') => {
    const res = await api.get(`/analytics/${campaignId}/export?format=${format}&${params.toString()}`, {
      responseType: format === 'csv' ? 'blob' : 'json',
    });
    if (format === 'csv') {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${campaignId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(res.data?.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${campaignId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Shape data for charts
  const sentimentChartData = data
    ? Object.entries(data.sentiment)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  const topicsChartData = data
    ? data.topTopics.map((t) => ({ name: t.name.length > 18 ? t.name.slice(0, 18) + '…' : t.name, confidence: t.confidence }))
    : [];

  const issueChartData = data
    ? Object.entries(data.issueCounts).map(([name, value]) => ({ name, value }))
    : [];

  const totalSubmissions = data
    ? Object.values(data.sentiment).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-8 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Back + Title */}
            <div className="flex items-center gap-4">
              <Link
                to="/admin/analytics"
                id="back-to-analytics"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                <BarChart2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Campaign Analytics</h1>
                <p className="text-xs text-slate-500 font-mono">{campaignId}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date range */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                  id="analytics-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-300 outline-none [color-scheme:dark]"
                />
                <span className="text-slate-600">→</span>
                <input
                  id="analytics-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-300 outline-none [color-scheme:dark]"
                />
              </div>

              {/* Export */}
              <div className="flex gap-2">
                <button
                  id="export-csv"
                  onClick={() => handleExport('csv')}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  id="export-json"
                  onClick={() => handleExport('json')}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                >
                  <Download className="h-3.5 w-3.5" /> JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-400">
            Failed to load analytics data. Ensure the API is running and the campaign has submissions.
          </div>
        )}

        {/* ── Top KPI Row ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Skeleton className="mb-3 h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total */}
            <AnalyticsCard title="Total Submissions" gradient>
              <p className="text-4xl font-bold text-white">{totalSubmissions}</p>
              <p className="mt-1 text-xs text-slate-500">across all sentiments</p>
            </AnalyticsCard>

            {/* Sentiment KPIs */}
            {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => (
              <AnalyticsCard
                key={s}
                title={s.charAt(0) + s.slice(1).toLowerCase()}
                icon={SENTIMENT_ICONS[s]}
              >
                <p className="text-4xl font-bold" style={{ color: SENTIMENT_COLORS[s] }}>
                  {data.sentiment[s] ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {totalSubmissions > 0
                    ? `${(((data.sentiment[s] ?? 0) / totalSubmissions) * 100).toFixed(1)}% of total`
                    : '—'}
                </p>
              </AnalyticsCard>
            ))}
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sentiment Pie */}
          <AnalyticsCard title="Sentiment Distribution" subtitle="Breakdown by response sentiment" icon={<Smile className="h-4 w-4" />}>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : sentimentChartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sentimentChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sentimentChartData.map((entry) => (
                      <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(val) => <span className="text-sm text-slate-300">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </AnalyticsCard>

          {/* Topics Bar */}
          <AnalyticsCard title="Top Topics" subtitle="Ranked by AI confidence score" icon={<Tag className="h-4 w-4" />}>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : topicsChartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-500">No topics extracted yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topicsChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" domain={[0, 1]} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="confidence" radius={[0, 6, 6, 0]}>
                    {topicsChartData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsCard>
        </div>

        {/* ── Issues + Summary Row ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Issues Table */}
          <AnalyticsCard title="Identified Issues" subtitle="Grouped by category" icon={<AlertTriangle className="h-4 w-4" />}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : issueChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No issues identified yet</p>
            ) : (
              <div className="divide-y divide-white/5">
                {issueChartData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-slate-200 capitalize">
                        {name.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] + '20',
                        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AnalyticsCard>

          {/* AI Summary */}
          <AnalyticsCard title="AI Summary" subtitle="Latest generated summary" gradient icon={<Zap className="h-4 w-4" />}>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : data?.latestSummary ? (
              <p className="text-base leading-relaxed text-slate-200">{data.latestSummary}</p>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Zap className="mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">
                  AI summary will appear here once feedback submissions are analyzed by the worker.
                </p>
              </div>
            )}
          </AnalyticsCard>
        </div>
      </div>
    </div>
  );
};
