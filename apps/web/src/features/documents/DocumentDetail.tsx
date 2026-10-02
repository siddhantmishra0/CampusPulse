import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Calendar, Building2, Tag, Layers } from 'lucide-react';
import { api } from '../../lib/api';

type DocumentDetailType = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  createdAt: string;
  department?: { id: string; name: string };
  versions: {
    id: string;
    versionNumber: number;
    createdAt: string;
    _count: { chunks: number };
  }[];
};

const STATUS_STYLES: Record<string, { chip: string; label: string }> = {
  READY: { chip: 'bg-secondary-container text-on-secondary-container', label: 'READY' },
  UPLOADED: { chip: 'bg-surface-container text-on-surface-variant', label: 'QUEUED' },
  PROCESSING: { chip: 'bg-tertiary-container text-on-tertiary-container', label: 'INGESTING' },
  FAILED: { chip: 'bg-error-container text-on-error-container', label: 'FAILED' },
};

export const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: document, isLoading, error } = useQuery<DocumentDetailType>({
    queryKey: ['document', id],
    queryFn: async () => {
      const res = await api.get(`/documents/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  const card = 'rounded-xl bg-surface-container-lowest border border-outline-variant/50 shadow-sm';

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-error/40 bg-error-container px-space-lg py-4 font-body-md text-body-md text-on-error-container">
          Document not found.
        </div>
      </div>
    );
  }

  const status = STATUS_STYLES[document.status] ?? {
    chip: 'bg-surface-container text-on-surface-variant',
    label: document.status,
  };

  return (
    <div className="flex w-full flex-col gap-space-lg pb-space-xl">
      {/* Header */}
      <div className="flex items-start gap-space-md py-space-md">
        <Link
          to="/knowledge"
          title="Back to knowledge base"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight break-words">
            {document.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${status.chip}`}>
              {status.label}
            </span>
            <span className="font-mono-data text-mono-data text-outline break-all">{document.id}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 flex flex-col gap-space-md">
          <div className={`${card} p-space-lg`}>
            <h2 className="mb-3 font-title-md text-title-md text-on-surface">Overview</h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {document.description || 'No description provided.'}
            </p>
          </div>

          <div className={`${card} p-space-lg`}>
            <h2 className="mb-4 font-title-md text-title-md text-on-surface">
              Version History &amp; Processing
            </h2>
            {document.versions.length === 0 ? (
              <p className="font-body-md text-body-md text-outline py-4 text-center">
                No versions recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {document.versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-space-md"
                  >
                    <div>
                      <p className="font-title-sm text-title-sm text-on-surface">
                        Version {v.versionNumber}
                      </p>
                      <p className="font-body-sm text-body-sm text-outline">
                        Uploaded {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-title-sm text-title-sm text-primary">{v._count.chunks} chunks</p>
                      <p className="font-body-sm text-body-sm text-outline">Vector embeddings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`${card} p-space-lg`}>
          <h3 className="mb-4 font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Metadata
          </h3>
          <div className="flex flex-col gap-3 font-body-md text-body-md">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Tag className="h-4 w-4 shrink-0 text-outline" />
              <span>{document.type}</span>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Layers className="h-4 w-4 shrink-0 text-outline" />
              <span>{document.status}</span>
            </div>
            {document.department && (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Building2 className="h-4 w-4 shrink-0 text-outline" />
                <span>{document.department.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Calendar className="h-4 w-4 shrink-0 text-outline" />
              <span>{new Date(document.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};