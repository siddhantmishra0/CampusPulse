import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, ListChecks,
  Plus, Send, Zap, ChevronDown, ChevronRight, Calendar,
  User, Building2, Tag,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type PublishedUpdate = {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
};

type ImprovementAction = {
  id: string;
  title: string;
  description: string;
  status: string;
  notes?: string;
  targetDate?: string;
  owner?: { id: string; firstName: string; lastName: string };
  publishedUpdates: PublishedUpdate[];
};

type Issue = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  sourceFeedbackCount: number;
  sentimentDistribution?: Record<string, number>;
  assignedDepartment?: { id: string; name: string };
  assignedReviewer?: { id: string; firstName: string; lastName: string };
  sourceCampaigns: { id: string; title: string }[];
  actions: ImprovementAction[];
  createdAt: string;
  updatedAt: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  IDENTIFIED:    { label: 'Identified',     color: '#f59e0b', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  UNDER_REVIEW:  { label: 'Under Review',   color: '#06b6d4', bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  ACTION_PLANNED:{ label: 'Action Planned', color: '#8b5cf6', bg: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  IN_PROGRESS:   { label: 'In Progress',    color: '#3b82f6', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  RESOLVED:      { label: 'Resolved',       color: '#10b981', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  ARCHIVED:      { label: 'Archived',       color: '#6b7280', bg: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

const ACTION_STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  PLANNED:     { label: 'Planned',     bg: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  COMPLETED:   { label: 'Completed',   bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const ISSUE_STATUSES = ['IDENTIFIED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'];

// ─── Sub-Components ───────────────────────────────────────────────────────────

const MetaItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
      <Icon className="h-4 w-4 text-slate-400" />
    </div>
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
    </div>
  </div>
);

const ActionCard = ({
  action,
  onPublishUpdate,
}: {
  action: ImprovementAction;
  issueId: string;
  onPublishUpdate: (actionId: string, title: string, content: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const cfg = ACTION_STATUS_CONFIG[action.status] ?? ACTION_STATUS_CONFIG['PLANNED'];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.06]">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg}`}>
            {cfg.label}
          </span>
          <span className="text-sm font-semibold text-white">{action.title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4">
          <p className="mb-4 text-sm text-slate-400">{action.description}</p>
          {action.notes && (
            <p className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-xs italic text-slate-400">{action.notes}</p>
          )}
          <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
            {action.owner && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {action.owner.firstName} {action.owner.lastName}
              </span>
            )}
            {action.targetDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(action.targetDate).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Published updates timeline */}
          {action.publishedUpdates.length > 0 && (
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Updates</p>
              <ol className="relative border-l border-white/10">
                {action.publishedUpdates.map(u => (
                  <li key={u.id} className="mb-6 ml-4">
                    <div className="absolute -left-1.5 h-3 w-3 rounded-full border border-violet-500/60 bg-violet-600/40" />
                    <p className="text-xs text-slate-500">{new Date(u.publishedAt).toLocaleString()}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{u.title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{u.content}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Publish Update Form */}
          {!showUpdateForm ? (
            <button
              id={`publish-update-${action.id}`}
              onClick={() => setShowUpdateForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-400 transition hover:text-violet-300"
            >
              <Plus className="h-3.5 w-3.5" /> Publish update
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold text-slate-300">Publish Update</p>
              <input
                type="text"
                placeholder="Update title"
                value={updateTitle}
                onChange={e => setUpdateTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
              />
              <textarea
                placeholder="Describe the progress…"
                value={updateContent}
                onChange={e => setUpdateContent(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
              />
              <div className="flex gap-2">
                <button
                  id={`submit-update-${action.id}`}
                  onClick={() => {
                    if (updateTitle && updateContent) {
                      onPublishUpdate(action.id, updateTitle, updateContent);
                      setUpdateTitle('');
                      setUpdateContent('');
                      setShowUpdateForm(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"
                >
                  <Send className="h-3.5 w-3.5" /> Publish
                </button>
                <button
                  onClick={() => setShowUpdateForm(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const IssueDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showActionForm, setShowActionForm] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const isAdmin = user?.roles?.some(r =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN', 'DEPARTMENT_REVIEWER'].includes(r as string)
  );

  const { data: issue, isLoading, error } = useQuery<Issue>({
    queryKey: ['issue', id],
    queryFn: async () => {
      const res = await api.get(`/issues/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/issues/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', id] }),
  });

  const createActionMutation = useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) =>
      api.post(`/issues/${id}/actions`, { title, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', id] });
      setShowActionForm(false);
      setActionTitle('');
      setActionDesc('');
    },
  });

  const publishUpdateMutation = useMutation({
    mutationFn: ({ actionId, title, content }: { actionId: string; title: string; content: string }) =>
      api.post(`/issues/${id}/actions/${actionId}/updates`, { title, content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading issue…</p>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-red-400">
        Failed to load issue.
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG['IDENTIFIED'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-8 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to="/issues"
                id="back-to-issues"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{issue.title}</h1>
                <p className="text-xs font-mono text-slate-500">{issue.id}</p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <select
                  id="status-select"
                  value={newStatus || issue.status}
                  onChange={e => {
                    setNewStatus(e.target.value);
                    updateStatusMutation.mutate(e.target.value);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
                >
                  {ISSUE_STATUSES.map(s => (
                    <option key={s} value={s} className="bg-slate-900">{STATUS_CONFIG[s]?.label ?? s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
        {/* Meta + Description */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusCfg.bg}`}>
                  <span className="mr-1.5 h-2 w-2 rounded-full" style={{ background: statusCfg.color }} />
                  {statusCfg.label}
                </span>
                <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-300 capitalize">
                  {issue.category.replace(/_/g, ' ').toLowerCase()}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{issue.description}</p>
            </div>

            {/* Source Campaigns */}
            {issue.sourceCampaigns.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Source Campaigns</p>
                <div className="flex flex-wrap gap-2">
                  {issue.sourceCampaigns.map(c => (
                    <Link
                      key={c.id}
                      to={`/campaigns/${c.id}`}
                      className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 transition hover:bg-violet-500/20"
                    >
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Meta Sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <div className="space-y-4">
                <MetaItem icon={Tag} label="Category" value={issue.category.replace(/_/g, ' ')} />
                {issue.assignedDepartment && (
                  <MetaItem icon={Building2} label="Department" value={issue.assignedDepartment.name} />
                )}
                {issue.assignedReviewer && (
                  <MetaItem icon={User} label="Reviewer"
                    value={`${issue.assignedReviewer.firstName} ${issue.assignedReviewer.lastName}`}
                  />
                )}
                {issue.sourceFeedbackCount > 0 && (
                  <MetaItem icon={Zap} label="Source Feedback" value={`${issue.sourceFeedbackCount} submissions`} />
                )}
                <MetaItem icon={Clock} label="Created" value={new Date(issue.createdAt).toLocaleDateString()} />
              </div>
            </div>
          </div>
        </div>

        {/* Improvement Actions */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-violet-400" />
              <h2 className="text-lg font-bold text-white">Improvement Actions</h2>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-400">
                {issue.actions.length}
              </span>
            </div>
            {isAdmin && (
              <button
                id="add-action-btn"
                onClick={() => setShowActionForm(true)}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"
              >
                <Plus className="h-4 w-4" /> Add Action
              </button>
            )}
          </div>

          {/* Add Action Form */}
          {showActionForm && (
            <div className="mb-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
              <p className="mb-3 text-sm font-semibold text-white">New Improvement Action</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Action title"
                  value={actionTitle}
                  onChange={e => setActionTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
                />
                <textarea
                  placeholder="Describe the action plan…"
                  value={actionDesc}
                  onChange={e => setActionDesc(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
                />
                <div className="flex gap-2">
                  <button
                    id="submit-action-btn"
                    onClick={() => {
                      if (actionTitle && actionDesc)
                        createActionMutation.mutate({ title: actionTitle, description: actionDesc });
                    }}
                    disabled={createActionMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {createActionMutation.isPending ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowActionForm(false); setActionTitle(''); setActionDesc(''); }}
                    className="rounded-xl border border-white/10 px-5 py-2 text-xs text-slate-400 transition hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {issue.actions.length === 0 && !showActionForm && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-16 text-center">
              <CheckCircle2 className="mb-3 h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-500">No actions planned yet.</p>
              {isAdmin && (
                <button
                  onClick={() => setShowActionForm(true)}
                  className="mt-3 text-xs font-medium text-violet-400 transition hover:text-violet-300"
                >
                  + Add the first action
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {issue.actions.map(action => (
              <ActionCard
                key={action.id}
                action={action}
                issueId={issue.id}
                onPublishUpdate={(actionId, title, content) =>
                  publishUpdateMutation.mutate({ actionId, title, content })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
