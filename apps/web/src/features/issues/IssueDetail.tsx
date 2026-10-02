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
// Status colours mirror IssueBoard so the two views read identically.

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  IDENTIFIED:     { label: 'Identified',     dot: 'bg-error',     bg: 'bg-error-container text-on-error-container' },
  UNDER_REVIEW:   { label: 'Under Review',   dot: 'bg-tertiary',  bg: 'bg-tertiary-container text-on-tertiary-container' },
  ACTION_PLANNED: { label: 'Action Planned', dot: 'bg-primary',   bg: 'bg-primary-container text-on-primary-container' },
  IN_PROGRESS:    { label: 'In Progress',    dot: 'bg-primary',   bg: 'bg-primary-container text-on-primary-container' },
  RESOLVED:       { label: 'Resolved',       dot: 'bg-secondary', bg: 'bg-secondary-container text-on-secondary-container' },
  ARCHIVED:       { label: 'Archived',       dot: 'bg-outline',   bg: 'bg-surface-container text-on-surface-variant' },
};

const ACTION_STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  PLANNED:     { label: 'Planned',     bg: 'bg-surface-container text-on-surface-variant' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-primary-container text-on-primary-container' },
  COMPLETED:   { label: 'Completed',   bg: 'bg-secondary-container text-on-secondary-container' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-error-container text-on-error-container' },
};

const ISSUE_STATUSES = ['IDENTIFIED', 'UNDER_REVIEW', 'ACTION_PLANNED', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'];

const card = 'rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm';
const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-body-md text-on-surface placeholder-outline outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';

// ─── Sub-Components ───────────────────────────────────────────────────────────

const MetaItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface-container">
      <Icon className="h-4 w-4 text-on-surface-variant" />
    </div>
    <div>
      <p className="font-body-sm text-body-sm text-outline">{label}</p>
      <p className="font-title-sm text-title-sm text-on-surface">{value}</p>
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
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest transition-colors hover:border-outline-variant">
      <button
        className="flex w-full items-center justify-between gap-3 px-space-md py-space-md text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-label-sm text-label-sm font-semibold ${cfg.bg}`}>
            {cfg.label}
          </span>
          <span className="font-title-sm text-title-sm text-on-surface truncate">{action.title}</span>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant" />}
      </button>

      {open && (
        <div className="border-t border-outline-variant/50 px-space-md pb-space-md pt-space-sm">
          <p className="mb-3 font-body-md text-body-md text-on-surface-variant">{action.description}</p>
          {action.notes && (
            <p className="mb-3 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2 font-body-sm text-body-sm italic text-on-surface-variant">
              {action.notes}
            </p>
          )}
          <div className="mb-3 flex flex-wrap gap-4 font-body-sm text-body-sm text-outline">
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
            <div className="mb-3">
              <p className="mb-2 font-label-sm text-label-sm uppercase tracking-wider text-outline">Updates</p>
              <ol className="relative border-l-2 border-outline-variant">
                {action.publishedUpdates.map(u => (
                  <li key={u.id} className="mb-4 ml-4">
                    <div className="absolute -left-[5px] h-2 w-2 rounded-full bg-primary" />
                    <p className="font-body-sm text-body-sm text-outline">{new Date(u.publishedAt).toLocaleString()}</p>
                    <p className="mt-0.5 font-title-sm text-title-sm text-on-surface">{u.title}</p>
                    <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{u.content}</p>
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
              className="flex items-center gap-1.5 font-title-sm text-title-sm text-primary transition hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Publish update
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
              <p className="font-title-sm text-title-sm text-on-surface">Publish Update</p>
              <input
                type="text"
                placeholder="Update title"
                value={updateTitle}
                onChange={e => setUpdateTitle(e.target.value)}
                className={inputClass}
              />
              <textarea
                placeholder="Describe the progress…"
                value={updateContent}
                onChange={e => setUpdateContent(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
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
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-label-sm text-label-sm font-semibold text-on-primary transition hover:bg-primary/90"
                >
                  <Send className="h-3.5 w-3.5" /> Publish
                </button>
                <button
                  onClick={() => setShowUpdateForm(false)}
                  className="rounded-lg border border-outline-variant px-4 py-2 font-label-sm text-label-sm text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-body-md text-body-md text-on-surface-variant">Loading issue…</p>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-error/40 bg-error-container px-space-lg py-4 font-body-md text-body-md text-on-error-container">
          Failed to load issue.
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG['IDENTIFIED'];

  return (
    <div className="flex w-full flex-col gap-space-lg pb-space-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/issues"
            id="back-to-issues"
            title="Back to issues"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight break-words">
              {issue.title}
            </h1>
            <p className="font-mono-data text-mono-data text-outline break-all">{issue.id}</p>
          </div>
        </div>

        {isAdmin && (
          <select
            id="status-select"
            value={newStatus || issue.status}
            onChange={e => {
              setNewStatus(e.target.value);
              updateStatusMutation.mutate(e.target.value);
            }}
            className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 font-title-sm text-title-sm text-on-surface outline-none focus:border-primary"
          >
            {ISSUE_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Meta + Description */}
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-space-md">
          <div className={`${card} p-space-lg`}>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 font-label-sm text-label-sm font-semibold ${statusCfg.bg}`}>
                <span className={`mr-1.5 h-2 w-2 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
              <span className="rounded-full bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface-variant capitalize">
                {issue.category.replace(/_/g, ' ').toLowerCase()}
              </span>
            </div>
            <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">
              {issue.description}
            </p>
          </div>

          {/* Source Campaigns */}
          {issue.sourceCampaigns.length > 0 && (
            <div className={`${card} p-space-md`}>
              <p className="mb-3 font-label-sm text-label-sm uppercase tracking-wider text-outline">
                Source Campaigns
              </p>
              <div className="flex flex-wrap gap-2">
                {issue.sourceCampaigns.map(c => (
                  <Link
                    key={c.id}
                    to={`/campaigns/${c.id}`}
                    className="rounded-full border border-primary/30 bg-primary-fixed px-3 py-1 font-body-sm text-body-sm text-primary transition hover:bg-primary-fixed-dim"
                  >
                    {c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Meta Sidebar */}
        <div className={`${card} p-space-md`}>
          <p className="mb-3 font-label-sm text-label-sm uppercase tracking-wider text-outline">Details</p>
          <div className="flex flex-col gap-3">
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

      {/* Improvement Actions */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <h2 className="font-title-md text-title-md text-on-surface">Improvement Actions</h2>
            <span className="rounded-full bg-primary-container px-2 py-0.5 font-label-sm text-label-sm font-semibold text-on-primary-container">
              {issue.actions.length}
            </span>
          </div>
          {isAdmin && (
            <button
              id="add-action-btn"
              onClick={() => setShowActionForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-title-sm text-title-sm font-semibold text-on-primary transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Action
            </button>
          )}
        </div>

        {/* Add Action Form */}
        {showActionForm && (
          <div className="rounded-xl border border-primary/40 bg-primary-fixed p-space-md">
            <p className="mb-3 font-title-sm text-title-sm text-on-primary-fixed">New Improvement Action</p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Action title"
                value={actionTitle}
                onChange={e => setActionTitle(e.target.value)}
                className={inputClass}
              />
              <textarea
                placeholder="Describe the action plan…"
                value={actionDesc}
                onChange={e => setActionDesc(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
              />
              <div className="flex gap-2">
                <button
                  id="submit-action-btn"
                  onClick={() => {
                    if (actionTitle && actionDesc)
                      createActionMutation.mutate({ title: actionTitle, description: actionDesc });
                  }}
                  disabled={createActionMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-title-sm text-title-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {createActionMutation.isPending ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowActionForm(false); setActionTitle(''); setActionDesc(''); }}
                  className="rounded-lg border border-outline-variant px-5 py-2 font-title-sm text-title-sm text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {issue.actions.length === 0 && !showActionForm && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest py-space-xl text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-outline" />
            <p className="font-body-md text-body-md text-outline">No actions planned yet.</p>
            {isAdmin && (
              <button
                onClick={() => setShowActionForm(true)}
                className="mt-2 font-title-sm text-title-sm text-primary transition hover:underline"
              >
                + Add the first action
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
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
  );
};