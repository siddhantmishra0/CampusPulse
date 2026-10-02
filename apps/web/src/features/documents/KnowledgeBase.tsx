import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText, Search, Upload, FileUp, Database, Sparkles, AlertCircle,
  FileBadge2, Trash2
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type Document = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
  versions: {
    id: string;
    versionNumber: number;
    createdAt: string;
  }[];
};

type SearchResult = {
  id: string;
  chunkText: string;
  pageNumber: number | null;
  documentVersionId: string;
  documentTitle: string;
  documentType: string;
  score: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const KnowledgeBase = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.some(r => ['PLATFORM_OWNER', 'INSTITUTION_ADMIN'].includes(r as string));

  const [activeTab, setActiveTab] = useState<'documents' | 'search'>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('POLICY');

  // Fetch Documents
  const { data: documents, isLoading: isLoadingDocs } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents');
      return res.data?.data ?? [];
    },
  });

  // Fetch Search Results
  const { data: searchResults, isLoading: isSearching, refetch: performSearch } = useQuery<SearchResult[]>({
    queryKey: ['semantic-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await api.post('/documents/search', { query: searchQuery, limit: 10 });
      return res.data?.data ?? [];
    },
    enabled: false, // only run on manual trigger
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name);
      formData.append('type', uploadType);
      
      return api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setIsUploading(false);
      setUploadFile(null);
      setUploadTitle('');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-8 py-8 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Knowledge Base</h1>
                <p className="mt-0.5 text-sm text-slate-400">Institutional memory and semantic search</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsUploading(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                <Upload className="h-4 w-4" /> Upload Document
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('documents')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'border-b-2 border-indigo-500 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All Documents
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === 'search'
                  ? 'border-b-2 border-indigo-500 text-white'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-400" /> Semantic Search
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-8 py-8">
        {/* Upload Modal (Simple Inline for now) */}
        {isUploading && (
          <div className="mb-8 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6 backdrop-blur-md">
            <h2 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
              <FileUp className="h-5 w-5 text-indigo-400" /> Upload New Document
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">File</label>
                <input
                  type="file"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500/20 file:px-4 file:py-1 file:text-xs file:font-semibold file:text-indigo-300"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Title</label>
                <input
                  type="text"
                  placeholder="Optional (defaults to filename)"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                <select
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50 [&>option]:bg-slate-900"
                >
                  {['POLICY', 'SYLLABUS', 'GUIDELINE', 'REPORT', 'OTHER'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={!uploadFile || uploadMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {uploadMutation.isPending ? 'Uploading & Processing...' : 'Upload & Process'}
              </button>
              <button
                onClick={() => { setIsUploading(false); setUploadFile(null); }}
                className="rounded-xl border border-white/10 px-5 py-2 text-sm text-slate-300 transition hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Documents */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {isLoadingDocs ? (
              <p className="text-slate-400">Loading documents...</p>
            ) : documents?.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-24 text-center">
                <FileBadge2 className="mb-4 h-12 w-12 text-slate-600" />
                <p className="text-lg font-medium text-slate-400">No documents yet</p>
                <p className="mt-1 text-sm text-slate-600">Upload your first institutional document to enable RAG.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents?.map(doc => (
                  <div key={doc.id} className="group relative rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.07]">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          doc.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 
                          doc.status === 'PROCESSING' ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {doc.status}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to archive this document?')) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            className="hidden h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-red-500/20 hover:text-red-400 group-hover:flex"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Link to={`/knowledge/${doc.id}`} className="block hover:underline">
                      <h3 className="mb-1 truncate text-base font-semibold text-white">{doc.title}</h3>
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="rounded bg-white/5 px-2 py-0.5">{doc.type}</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Semantic Search */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ask a question or search for concepts (e.g., 'What is the late policy?')"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && performSearch()}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-base text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
              <button
                onClick={() => performSearch()}
                disabled={!searchQuery.trim() || isSearching}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Found {searchResults.length} relevant excerpts.</p>
                {searchResults.map((result) => (
                  <div key={result.id} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                    <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-400" />
                        <span className="font-semibold text-indigo-300">{result.documentTitle}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5">{result.documentType}</span>
                        {result.pageNumber && <span>Page {result.pageNumber}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        Match Score: {(result.score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200">{result.chunkText}</p>
                  </div>
                ))}
              </div>
            )}

            {searchResults?.length === 0 && searchQuery && !isSearching && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <AlertCircle className="mb-2 h-8 w-8 text-slate-500" />
                <p>No highly relevant results found. Try rephrasing your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
