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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-red-400">
        Document not found.
      </div>
    );
  }

  // latestVersion variable removed as it was unused

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="border-b border-white/10 bg-white/5 px-8 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-4">
            <Link
              to="/knowledge"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{document.title}</h1>
              <p className="text-xs font-mono text-slate-500">{document.id}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Overview</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {document.description || 'No description provided.'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Version History & Processing</h2>
              <div className="space-y-4">
                {document.versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/5">
                    <div>
                      <p className="font-semibold text-white">Version {v.versionNumber}</p>
                      <p className="text-xs text-slate-400">Uploaded {new Date(v.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-indigo-400">{v._count.chunks} chunks</p>
                      <p className="text-xs text-slate-500">Vector Embeddings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Metadata</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 text-slate-300">
                  <Tag className="h-4 w-4 text-slate-500" /> {document.type}
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Layers className="h-4 w-4 text-slate-500" /> {document.status}
                </div>
                {document.department && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <Building2 className="h-4 w-4 text-slate-500" /> {document.department.name}
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-300">
                  <Calendar className="h-4 w-4 text-slate-500" /> {new Date(document.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
