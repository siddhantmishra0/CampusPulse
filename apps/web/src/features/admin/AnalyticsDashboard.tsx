import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Campaign = {
  id: string;
  title: string;
  status: string;
  campaignType: string;
  department?: { id: string; name: string } | null;
  subject?: { code: string; name: string } | null;
  _count?: { feedbackSubmissions: number };
};

type Overview = {
  totalSubmissions: number;
  submissionsBySource: { CONVERSATIONAL: number; TRADITIONAL: number };
  sentiment: { POSITIVE: number; NEUTRAL: number; NEGATIVE: number; MIXED: number };
  campaigns: Record<string, number>;
  totalCampaigns: number;
  topTopics: { name: string; confidence: number }[];
  issues: { open: number; closed: number; total: number };
  lastAnalyzedAt: string | null;
};

type Summary = {
  sentiment: { POSITIVE: number; NEUTRAL: number; NEGATIVE: number; MIXED: number };
  topTopics: { name: string; confidence: number }[];
  issueCounts: Record<string, number>;
  latestSummary: string | null;
};

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

function relative(iso: string | null) {
  if (!iso) return 'No analyses yet';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Last analyzed just now';
  if (mins < 60) return `Last analyzed ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last analyzed ${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `Last analyzed ${Math.floor(hrs / 24)} days ago`;
}

export const AnalyticsDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const overviewQ = useQuery<Overview>({
    queryKey: ['analytics-overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data.data,
  });

  const campaignsQ = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get('/campaigns')).data.data ?? [],
  });

  const overview = overviewQ.data;
  const campaigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (campaignsQ.data ?? []).filter((c) => {
      if (scope && c.department?.id !== scope) return false;
      if (!q) return true;
      return [c.title, c.department?.name ?? '', c.subject?.name ?? ''].some((v) =>
        v.toLowerCase().includes(q));
    });
  }, [campaignsQ.data, query, scope]);

  // Per-campaign AI synthesis for the cards shown.
  const summaries = useQueries({
    queries: campaigns.slice(0, 8).map((c) => ({
      queryKey: ['analytics-summary', c.id],
      queryFn: async (): Promise<Summary> =>
        (await api.get(`/analytics/${c.id}/summary`)).data.data,
      enabled: !!c.id,
      staleTime: 30_000,
    })),
  });

  const departments = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    (campaignsQ.data ?? []).forEach((c) => {
      if (c.department) seen.set(c.department.id, { id: c.department.id, name: c.department.name });
    });
    return [...seen.values()];
  }, [campaignsQ.data]);

  const totals = useMemo(() => {
    const sent = overview?.sentiment ?? { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, MIXED: 0 };
    const analysed = sent.POSITIVE + sent.NEUTRAL + sent.NEGATIVE + sent.MIXED;
    const src = overview?.submissionsBySource ?? { CONVERSATIONAL: 0, TRADITIONAL: 0 };
    const srcTotal = src.CONVERSATIONAL + src.TRADITIONAL;
    return {
      analysed,
      pos: pct(sent.POSITIVE, analysed),
      neu: pct(sent.NEUTRAL, analysed),
      neg: pct(sent.NEGATIVE, analysed),
      convo: pct(src.CONVERSATIONAL, srcTotal),
      trad: pct(src.TRADITIONAL, srcTotal),
      srcTotal,
    };
  }, [overview]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    summaries.forEach((s) => s.refetch());
  };

  const exportCsv = async (campaign: Campaign) => {
    setExportError(null);
    setExporting(campaign.id);
    try {
      const res = await api.get(`/analytics/${campaign.id}/export`, { params: { format: 'csv' } });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${campaign.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e.response?.data?.error || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const cardBase = 'p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col justify-between';

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-md">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-xs">
            <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              Continuous Quality Loop
            </span>
            <span className="font-mono-data text-mono-data text-outline">Live telemetry</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Analytics Hub</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Institutional intelligence powered by LLM sentiment &amp; topic extraction across campus cohorts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm self-start md:self-auto">
          <span className="h-10 px-space-md rounded-lg bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex items-center gap-2 text-on-surface font-title-sm text-title-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">campaign</span>
            <span>{overview?.totalCampaigns ?? 0} campaigns</span>
          </span>
          <button
            onClick={refresh}
            disabled={overviewQ.isFetching}
            title="Refresh"
            className="h-10 w-10 rounded-lg bg-surface-container-lowest border border-outline-variant/50 shadow-sm text-on-surface hover:text-primary transition-all flex items-center justify-center disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${overviewQ.isFetching ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {(exportError || overviewQ.isError) && (
        <div className="mb-space-md rounded-lg border border-error/40 bg-error-container px-space-md py-3 font-body-sm text-body-sm text-on-error-container">
          {exportError || 'Failed to load analytics overview'}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mt-space-sm mb-space-lg">
        <div className={`${cardBase} relative overflow-hidden`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Total Submissions</span>
              <span className="font-headline-xl text-headline-xl text-on-surface mt-1 tracking-tight">
                {overviewQ.isLoading ? '—' : (overview?.totalSubmissions ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">inbox</span>
            </div>
          </div>
          <div className="mt-space-md text-body-sm text-body-sm text-on-surface-variant">
            {overview?.submissionsBySource.CONVERSATIONAL ?? 0} conversational · {overview?.submissionsBySource.TRADITIONAL ?? 0} traditional
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Sentiment (analysed)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">{totals.pos}%</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">Positive</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[22px]">mood</span>
            </div>
          </div>
          <div className="mt-space-md flex flex-col gap-1.5">
            <div className="w-full h-2.5 rounded-full bg-surface-container flex overflow-hidden">
              <div className="bg-secondary h-full" style={{ width: `${totals.pos}%` }} title={`${totals.pos}% Positive`}></div>
              <div className="bg-surface-variant h-full" style={{ width: `${totals.neu}%` }} title={`${totals.neu}% Neutral`}></div>
              <div className="bg-error h-full" style={{ width: `${totals.neg}%` }} title={`${totals.neg}% Negative`}></div>
            </div>
            <div className="flex justify-between font-mono-data text-mono-data text-on-surface-variant pt-0.5">
              <span className="text-secondary">{totals.pos}% Pos</span>
              <span>{totals.neu}% Neu</span>
              <span className="text-error">{totals.neg}% Neg</span>
            </div>
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Campaign Engagement</span>
              <span className="font-headline-xl text-headline-xl text-on-surface mt-1 tracking-tight">
                {overview?.campaigns.ACTIVE ?? 0} Running
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[22px]">hub</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Scheduled</span>
              <span className="font-title-sm text-title-sm text-on-surface">{overview?.campaigns.SCHEDULED ?? 0}</span>
            </div>
            <div className="text-right">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Drafts</span>
              <span className="font-mono-data text-mono-data text-primary font-semibold block">{overview?.campaigns.DRAFT ?? 0}</span>
            </div>
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Action Loop</span>
              <span className="font-headline-xl text-headline-xl text-error mt-1 tracking-tight">
                {overview?.issues.open ?? 0} Open
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-on-error-container">
              <span className="material-symbols-outlined text-[22px]">flag_circle</span>
            </div>
          </div>
          <div className="mt-space-md flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                {overview?.issues.closed ?? 0} Resolved
              </span>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                {overview?.issues.open ?? 0} Active
              </span>
            </div>
            <button
              onClick={() => navigate('/issues')}
              className="font-mono-data text-mono-data text-primary hover:underline font-semibold"
            >
              View
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* LEFT: campaign list */}
        <div className="xl:col-span-8 flex flex-col gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col gap-space-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline pointer-events-none">search</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
                  placeholder="Search campaigns by title, department or subject..."
                  type="text"
                />
              </div>
              {departments.length > 0 && (
                <div className="relative">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="h-10 px-space-md pr-8 rounded-lg bg-surface-container-lowest border border-outline-variant text-title-sm font-title-sm text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {(scope || query) && (
              <div className="flex items-center gap-2 text-body-sm text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                <span>{campaigns.length} of {campaignsQ.data?.length ?? 0} campaigns</span>
                <button onClick={() => { setScope(''); setQuery(''); }}
                  className="text-primary hover:underline font-title-sm text-title-sm">Clear</button>
              </div>
            )}
          </div>

          {campaignsQ.isLoading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/70 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-outline block mb-2">analytics</span>
              <p className="font-title-md text-title-md text-on-surface">No campaigns match</p>
              <p className="font-body-sm text-body-sm text-outline mt-1">Adjust the search or department filter.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-space-md">
              {campaigns.map((c, idx) => {
                const s = summaries[idx]?.data;
                const responses = c._count?.feedbackSubmissions ?? 0;
                const analysed = s ? s.sentiment.POSITIVE + s.sentiment.NEGATIVE + s.sentiment.NEUTRAL + s.sentiment.MIXED : 0;
                const issueTotal = s ? Object.values(s.issueCounts).reduce((a, b) => a + b, 0) : 0;
                return (
                  <div key={c.id} className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm hover:shadow-md transition-all flex flex-col gap-space-md group">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-data text-mono-data text-primary px-1.5 py-0.5 rounded bg-primary-fixed">
                            {c.subject?.code ?? c.campaignType}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                            {c.department?.name ?? 'Institution-wide'}
                          </span>
                        </div>
                        <Link to={`/campaigns/${c.id}`} className="group-hover:underline">
                          <h2 className="font-title-md text-title-md text-on-surface mt-1">{c.title}</h2>
                        </Link>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {c.subject?.name ?? 'No subject linked'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 shrink-0 ${
                        c.status === 'ACTIVE'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {c.status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-secondary"></span>}
                        {c.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-space-sm p-space-md rounded-lg bg-surface-container-low">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Responses</span>
                        <span className="font-title-md text-title-md text-on-surface mt-0.5">{responses}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Analysed</span>
                        <span className="font-title-md text-title-md text-on-surface mt-0.5">{analysed}</span>
                      </div>
                      <div className="col-span-2 md:col-span-1 flex flex-col">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">AI Flags</span>
                        <span className={`font-title-md text-title-md mt-0.5 ${issueTotal > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {issueTotal} Extracted
                        </span>
                      </div>
                    </div>

                    {s?.latestSummary && (
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider pt-0.5">AI Synthesis:</span>
                        <p className="text-body-sm text-body-sm text-on-surface-variant flex-1 min-w-[240px] line-clamp-2">
                          {s.latestSummary}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-space-sm pt-space-xs">
                      <span className="font-mono-data text-mono-data text-outline">
                        {analysed > 0
                          ? `${analysed} analysed · ${s?.topTopics?.length ?? 0} clusters`
                          : 'No analysis yet'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportCsv(c)}
                          disabled={exporting === c.id}
                          title="Export analytics as CSV"
                          className="px-3 py-2 rounded-lg border border-outline-variant text-title-sm font-title-sm text-on-surface hover:bg-surface-container transition-all disabled:opacity-50"
                        >
                          {exporting === c.id ? 'Exporting...' : 'Export CSV'}
                        </button>
                        <Link
                          to={`/admin/analytics/${c.id}`}
                          className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface font-title-sm text-title-sm transition-all flex items-center gap-1"
                        >
                          <span>Explore Deep-Dive</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: aggregates */}
        <div className="xl:col-span-4 flex flex-col gap-space-md">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-tertiary">psychology</span>
                <h3 className="font-title-md text-title-md text-on-surface">Extracted Topic Clusters</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                LLM
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Semantic groupings extracted across all analysed student responses.
            </p>
            {overview?.topTopics?.length ? (
              <div className="flex flex-col gap-2 pt-1">
                {overview.topTopics.map((t) => {
                  const conf = Number(t.confidence ?? 0);
                  return (
                    <div key={t.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-body-sm font-body-sm">
                        <span className="text-on-surface">{t.name}</span>
                        <span className="font-mono-data text-mono-data text-outline">{Math.round(conf * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                        <div className="bg-tertiary h-full" style={{ width: `${Math.round(conf * 100)}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-body-sm text-body-sm text-outline py-4 text-center">
                No topics extracted yet — they appear once feedback has been analysed.
              </p>
            )}
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">forum</span>
                <h3 className="font-title-md text-title-md text-on-surface">Submission Modality</h3>
              </div>
              <span className="font-mono-data text-mono-data text-outline">
                {totals.srcTotal} total
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-body-sm font-body-sm">
                <span className="text-primary font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                  Conversational AI ({totals.convo}%)
                </span>
                <span className="text-outline">{overview?.submissionsBySource.CONVERSATIONAL ?? 0}</span>
              </div>
              <div className="w-full h-3 rounded-full bg-surface-container flex overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${totals.convo}%` }}></div>
                <div className="bg-surface-variant h-full transition-all" style={{ width: `${totals.trad}%` }}></div>
              </div>
              <div className="flex items-center justify-between text-body-sm font-body-sm">
                <span className="text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">checklist</span>
                  Traditional ({totals.trad}%)
                </span>
                <span className="text-outline">{overview?.submissionsBySource.TRADITIONAL ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col gap-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface">Analysis Pipeline</h3>
            <div className="flex flex-col gap-2 mt-space-xs">
              <div className="w-full px-space-md py-3 rounded-lg bg-surface-container flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">schedule</span>
                  <span className="font-title-sm text-title-sm text-on-surface">Last analysis run</span>
                </div>
                <span className="font-mono-data text-mono-data text-outline">{relative(overview?.lastAnalyzedAt ?? null)}</span>
              </div>
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm flex flex-col gap-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface">Quick Actions</h3>
            <div className="flex flex-col gap-2 mt-space-xs">
              <button
                onClick={() => navigate('/campaigns')}
                className="w-full h-11 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-title-sm text-title-sm transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">campaign</span>
                  <span>Manage Campaigns</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary">arrow_forward</span>
              </button>
              <button
                onClick={() => navigate('/knowledge')}
                className="w-full h-11 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-title-sm text-title-sm transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">folder</span>
                  <span>Search Knowledge Base</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
