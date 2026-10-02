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

// Chart fills stay saturated, but these same hues are also used as *text* on a
// white card, where the bright variants fall below WCAG AA (amber-500 is only
// ~2.1:1). Text uses these darker, equivalent-hue variants instead.
const SENTIMENT_TEXT_COLORS: Record<string, string> = {
  POSITIVE: '#046c4e',
  NEUTRAL:  '#7a4a00',
  NEGATIVE: '#b3261e',
  MIXED:    '#4c1d95',
};

const CATEGORY_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
const CATEGORY_TEXT_COLORS = ['#5b21b6', '#0e7490', '#7a4a00', '#046c4e', '#b3261e', '#9d174d'];

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
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm shadow-lg">
      <p className="font-title-sm text-title-sm text-on-surface">{name}</p>
      <p className="text-on-surface-variant">{value} submissions</p>
    </div>
  );
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm shadow-lg">
      <p className="mb-0.5 font-title-sm text-title-sm text-on-surface">{label}</p>
      <p className="text-primary">Confidence: {(payload[0].value * 100).toFixed(0)}%</p>
    </div>
  );
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-surface-container ${className ?? ''}`} />
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
    <div className="flex w-full flex-col gap-space-lg pb-space-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/admin/analytics"
            id="back-to-analytics"
            title="Back to analytics"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Campaign Analytics
            </h1>
            <p className="font-mono-data text-mono-data text-outline break-all">{campaignId}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2">
            <CalendarDays className="h-4 w-4 text-outline" />
            <input
              id="analytics-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-body-sm text-body-sm text-on-surface outline-none"
            />
            <span className="text-outline">→</span>
            <input
              id="analytics-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-body-sm text-body-sm text-on-surface outline-none"
            />
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <button
              id="export-csv"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-title-sm text-title-sm text-on-surface transition-colors hover:bg-surface-container hover:border-outline-variant"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              id="export-json"
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-title-sm text-title-sm text-on-surface transition-colors hover:bg-surface-container hover:border-outline-variant"
            >
              <Download className="h-3.5 w-3.5" /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-space-lg">

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-error/40 bg-error-container p-space-lg text-center font-body-md text-body-md text-on-error-container">
            Failed to load analytics data. Ensure the API is running and the campaign has submissions.
          </div>
        )}

        {/* ── Top KPI Row ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-space-lg">
                <Skeleton className="mb-3 h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {/* Total */}
            <AnalyticsCard title="Total Submissions" gradient>
              <p className="font-headline-xl text-headline-xl text-on-surface">{totalSubmissions}</p>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">across all sentiments</p>
            </AnalyticsCard>

            {/* Sentiment KPIs */}
            {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => (
              <AnalyticsCard
                key={s}
                title={s.charAt(0) + s.slice(1).toLowerCase()}
                icon={SENTIMENT_ICONS[s]}
              >
                <p className="font-headline-xl text-headline-xl" style={{ color: SENTIMENT_TEXT_COLORS[s] }}>
                  {data.sentiment[s] ?? 0}
                </p>
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {totalSubmissions > 0
                    ? `${(((data.sentiment[s] ?? 0) / totalSubmissions) * 100).toFixed(1)}% of total`
                    : '—'}
                </p>
              </AnalyticsCard>
            ))}
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
          {/* Sentiment Pie */}
          <AnalyticsCard title="Sentiment Distribution" subtitle="Breakdown by response sentiment" icon={<Smile className="h-4 w-4" />}>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : sentimentChartData.length === 0 ? (
              <p className="py-space-xl text-center font-body-md text-body-md text-outline">No data yet</p>
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
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {sentimentChartData.map((entry) => (
                      <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? '#777587'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    formatter={(val) => <span className="font-body-sm text-body-sm text-on-surface-variant">{val}</span>}
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
              <p className="py-space-xl text-center font-body-md text-body-md text-outline">No topics extracted yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topicsChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c7c4d8" horizontal={false} />
                  <XAxis type="number" domain={[0, 1]} tick={{ fill: '#777587', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#464555', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(74,68,227,0.06)' }} />
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
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
          {/* Issues Table */}
          <AnalyticsCard title="Identified Issues" subtitle="Grouped by category" icon={<AlertTriangle className="h-4 w-4" />}>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : issueChartData.length === 0 ? (
              <p className="py-space-lg text-center font-body-md text-body-md text-outline">No issues identified yet</p>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {issueChartData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      <span className="font-title-sm text-title-sm text-on-surface capitalize">
                        {name.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 font-label-sm text-label-sm font-bold"
                      style={{
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] + '20',
                        color: CATEGORY_TEXT_COLORS[i % CATEGORY_TEXT_COLORS.length],
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
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : data?.latestSummary ? (
              <p className="font-body-lg text-body-lg leading-relaxed text-on-surface">{data.latestSummary}</p>
            ) : (
              <div className="flex flex-col items-center justify-center py-space-lg text-center">
                <Zap className="mb-2 h-8 w-8 text-outline" />
                <p className="font-body-md text-body-md text-on-surface-variant">
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
