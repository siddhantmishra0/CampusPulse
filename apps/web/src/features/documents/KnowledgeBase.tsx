import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

type Document = {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  chunkCount: number;
  versions: { id: string; versionNumber: number }[];
};

type Source = {
  chunkId: string;
  documentTitle: string;
  documentType: string;
  pageNumber: number | null;
  score: number;
};

type AskResponse = { answer: string; sources: Source[]; grounded: boolean };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  grounded?: boolean;
};

const PENDING = ['UPLOADED', 'PROCESSING'];

const STATUS_STYLES: Record<string, { chip: string; label: string }> = {
  READY: { chip: 'bg-secondary-container text-on-secondary-container', label: 'READY' },
  UPLOADED: { chip: 'bg-surface-variant text-on-surface-variant', label: 'QUEUED' },
  PROCESSING: { chip: 'bg-tertiary-container text-on-tertiary-container', label: 'INGESTING' },
  FAILED: { chip: 'bg-error-container text-on-error-container', label: 'FAILED' },
};

export const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'store'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('POLICY');
  const scrollRef = useRef<HTMLDivElement>(null);

  const canManage = user?.roles?.some((r) =>
    ['PLATFORM_OWNER', 'INSTITUTION_ADMIN'].includes(r as string));

  const { data: documents, isLoading: loadingDocs, isFetching } = useQuery<Document[]>({
    queryKey: ['documents'],
    queryFn: async () => (await api.get('/documents')).data.data ?? [],
    refetchInterval: (query) => {
      const docs = query.state.data as Document[] | undefined;
      return docs?.some((d) => PENDING.includes(d.status)) ? 3000 : false;
    },
  });

  const readyCount = documents?.filter((d) => d.status === 'READY').length ?? 0;
  const totalChunks = useMemo(
    () => (documents ?? []).reduce((sum, d) => sum + (d.chunkCount ?? 0), 0),
    [documents]
  );
  const isPending = documents?.some((d) => PENDING.includes(d.status)) ?? false;

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const res = await api.post('/documents/ask', { question, limit: 6 });
      return res.data.data as AskResponse;
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ask.isPending]);

  const send = (text: string) => {
    const question = text.trim();
    if (!question || ask.isPending) return;
    setError(null);
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    ask.mutate(question, {
      onSuccess: (data) => {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: data.answer,
            sources: data.sources,
            grounded: data.grounded,
          },
        ]);
      },
      onError: (e: any) => {
        setError(e.response?.data?.error || e.message || 'The assistant is unavailable right now.');
        setMessages((m) => m.filter((msg) => msg.id !== userMsg.id));
        setInput(question);
      },
    });
  };

  // The navbar search navigates here with ?q=... — run it once on arrival.
  const initialQuestion = useRef(new URLSearchParams(window.location.search).get('q'));
  useEffect(() => {
    const q = initialQuestion.current;
    initialQuestion.current = null;
    if (q) send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name);
      fd.append('type', type);
      await api.post('/documents/upload', fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowUpload(false);
      setFile(null);
      setTitle('');
      setError(null);
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Upload failed'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/documents/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
    onError: (e: any) => setError(e.response?.data?.error || 'Delete failed'),
  });

  const greeting: ChatMessage = {
    id: 'greeting',
    role: 'assistant',
    text: readyCount > 0
      ? `Hello! I'm the CampusPulse Policy Assistant. I have indexed ${readyCount} document${readyCount === 1 ? '' : 's'} (${totalChunks} searchable chunks). Ask me anything about them and I'll answer using only what those documents say.`
      : isPending
        ? "Documents are still being indexed. Ask me something in a moment — the page updates automatically."
        : 'No documents have been indexed yet. Upload a policy or syllabus from the Document Store tab and I can answer questions about it.',
  };

  const thread = messages.length === 0 ? [greeting] : messages;

  return (
    <div className="flex flex-col w-full pb-space-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md py-space-md border-b border-outline-variant/70 mb-space-lg">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-xs">
            <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              RAG Pipeline Active
            </span>
            <span className="font-mono-data text-mono-data text-outline">
              {readyCount} ready · {totalChunks} chunks
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">Knowledge Base &amp; RAG Assistant</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Answers are generated with semantic search over ingested documents and grounded in cited sources.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto p-1 rounded-lg bg-surface-container-low border border-outline-variant-high">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-space-md py-1.5 rounded-md font-title-sm text-title-sm transition-all ${activeTab === 'chat' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            RAG Assistant
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`px-space-md py-1.5 rounded-md font-title-sm text-title-sm transition-all ${activeTab === 'store' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Document Store
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-space-md rounded-lg border border-error/40 bg-error-container px-space-md py-3 font-body-sm text-body-sm text-on-error-container flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} title="Dismiss">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── RAG Assistant ── */}
      {activeTab === 'chat' && (
        <div className="lg:col-span-8 flex flex-col gap-space-md h-[calc(100vh-260px)] min-h-[540px]">
          <div className="flex-1 flex flex-col bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="px-space-md py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-title-sm text-on-surface leading-tight">Policy Assistant</span>
                  <span className="font-label-sm text-label-sm text-primary flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${ask.isPending ? 'bg-tertiary animate-pulse' : 'bg-secondary'}`}></span>
                    {ask.isPending ? 'Thinking...' : `${readyCount} document${readyCount === 1 ? '' : 's'} indexed`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setMessages([]); setError(null); }}
                disabled={messages.length === 0}
                title="Clear conversation"
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-space-md flex flex-col gap-space-lg">
              {thread.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end max-w-[85%]' : 'max-w-[90%]'}`}>
                    <div className={`p-space-md rounded-2xl font-body-md text-body-md leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-tr-sm bg-primary text-on-primary'
                        : 'rounded-tl-sm bg-surface-container-low text-on-surface'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <div className="p-space-sm rounded-xl border border-outline-variant/70 bg-surface-container-lowest flex flex-col gap-2 w-full">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">format_quote</span>
                          Sources Cited ({m.sources.length})
                        </span>
                        <div className="flex flex-col gap-2">
                          {m.sources.map((s, i) => (
                            <div key={s.chunkId} className="flex items-start gap-2 p-2 rounded bg-surface-variant/30">
                              <span className="font-mono-data text-mono-data text-tertiary mt-0.5">[{i + 1}]</span>
                              <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">description</span>
                              <div className="flex flex-col">
                                <span className="font-title-sm text-title-sm text-on-surface">{s.documentTitle}</span>
                                <span className="font-mono-data text-mono-data text-on-surface-variant">
                                  {s.pageNumber ? `Page ${s.pageNumber}` : 'Whole document'} · {Math.round(s.score * 100)}% match
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.role === 'assistant' && m.grounded === false && (
                      <span className="font-mono-data text-mono-data text-outline">
                        No source cleared the relevance threshold — answer withheld to avoid guessing.
                      </span>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 mt-1">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    </div>
                  )}
                </div>
              ))}

              {ask.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  </div>
                  <div className="px-space-md py-3 rounded-2xl rounded-tl-sm bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Searching the knowledge base and composing an answer...
                  </div>
                </div>
              )}
            </div>

            <div className="p-space-md border-t border-outline-variant bg-surface-container-lowest">
              <div className="relative flex items-end gap-2 bg-surface-container-low border border-outline-variant/70 rounded-2xl p-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder={readyCount > 0 ? 'Ask a question about campus policies...' : 'Upload a document first to enable questions...'}
                  className="w-full max-h-32 min-h-[44px] bg-transparent border-none resize-none px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
                />
                <div className="flex items-center pb-1 pr-1 gap-1 shrink-0">
                  <button
                    onClick={() => { setActiveTab('store'); setShowUpload(true); }}
                    title="Add a document"
                    className="w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">attach_file</span>
                  </button>
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || ask.isPending}
                    title="Send question"
                    className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="font-mono-data text-mono-data text-outline">Gemini embeddings · 1536-dim · pgvector cosine</span>
                <span className="font-label-sm text-label-sm text-outline">Enter to send · Shift+Enter for a new line</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Store ── */}
      {activeTab === 'store' && (
        <div className="flex flex-col gap-space-md">
          {canManage && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowUpload((v) => !v)}
                className="h-10 px-space-md rounded-lg bg-primary text-on-primary font-title-sm text-title-sm shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Upload Document
              </button>
            </div>
          )}

          {showUpload && canManage && (
            <form
              onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}
              className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant flex flex-col gap-space-md"
            >
              <h3 className="font-title-md text-title-md text-on-surface">Add to the vector store</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                <div className="md:col-span-1 space-y-2">
                  <label htmlFor="kbFile" className="font-label-sm text-label-sm text-on-surface-variant">File *</label>
                  <input
                    id="kbFile" type="file" required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-body-sm text-body-sm text-on-surface file:mr-3 file:rounded-full file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-label-sm file:font-semibold file:text-on-primary-container"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="kbTitle" className="font-label-sm text-label-sm text-on-surface-variant">Title</label>
                  <input
                    id="kbTitle" value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Defaults to filename"
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="kbType" className="font-label-sm text-label-sm text-on-surface-variant">Type</label>
                  <select
                    id="kbType" value={type} onChange={(e) => setType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-body-md text-on-surface focus:outline-none focus:border-primary"
                  >
                    {['POLICY', 'SYLLABUS', 'GUIDELINE', 'REPORT', 'OTHER'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowUpload(false)}
                  className="h-10 px-space-md rounded-lg border border-outline-variant text-title-sm font-title-sm text-on-surface hover:bg-surface-container transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!file || upload.isPending}
                  className="h-10 px-space-md rounded-lg bg-primary text-on-primary text-title-sm font-title-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {upload.isPending ? 'Uploading...' : 'Upload & Ingest'}
                </button>
              </div>
            </form>
          )}

          {loadingDocs ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading documents...</p>
          ) : !documents?.length ? (
            <div className="rounded-xl border border-dashed border-outline-variant/70 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-outline block mb-2">folder_open</span>
              <p className="font-title-md text-title-md text-on-surface">No documents indexed</p>
              <p className="font-body-sm text-body-sm text-outline mt-1">
                {canManage ? 'Upload a policy or syllabus to make it searchable.' : 'Ask an administrator to upload documents.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => {
                const meta = STATUS_STYLES[doc.status] ?? { chip: 'bg-surface-container text-on-surface-variant', label: doc.status };
                const pending = PENDING.includes(doc.status);
                return (
                  <div key={doc.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    pending ? 'bg-surface-container border-surface-variant relative overflow-hidden' : 'bg-surface-container-low border-transparent hover:border-outline-variant/70'
                  } group`}>
                    {pending && <div className="absolute bottom-0 left-0 h-0.5 bg-primary animate-pulse w-1/3"></div>}
                    <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                      doc.status === 'FAILED' ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'
                    }`}>
                      <span className={`material-symbols-outlined text-[20px] ${pending ? 'animate-spin' : ''}`}>
                        {doc.status === 'FAILED' ? 'error' : 'picture_as_pdf'}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                      <span className="font-title-sm text-title-sm text-on-surface truncate" title={doc.title}>{doc.title}</span>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded font-label-sm text-label-sm font-semibold ${meta.chip}`}>{meta.label}</span>
                        <span className="font-mono-data text-mono-data text-outline">{doc.type}</span>
                        <span className="w-1 h-1 rounded-full bg-outline"></span>
                        <span className="font-mono-data text-mono-data text-outline">{doc.chunkCount} chunks</span>
                        <span className="font-mono-data text-mono-data text-outline">· v{doc.versions[0]?.versionNumber ?? 1}</span>
                        <span className="font-mono-data text-mono-data text-outline">· {new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                      {doc.status === 'FAILED' && (
                        <span className="text-body-sm text-body-sm text-on-error-container mt-1">
                          Ingestion failed — this document cannot be searched.
                        </span>
                      )}
                      {doc.status === 'READY' && (
                        <button
                          onClick={() => {
                            setActiveTab('chat');
                            setInput(`What does "${doc.title}" say about `);
                          }}
                          className="self-start mt-1.5 text-body-sm text-body-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">question_answer</span>
                          Ready to query — ask about this document
                        </button>
                      )}
                    </div>
                    {canManage && !pending && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${doc.title}"? Its chunks and stored file will be removed permanently.`)) {
                            remove.mutate(doc.id);
                          }
                        }}
                        disabled={remove.isPending}
                        title="Remove from index"
                        className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all p-1 disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant flex flex-col gap-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface">Store Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              <div className="p-2 rounded bg-surface-container-low flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Documents</span>
                <span className="font-title-md text-title-md text-on-surface mt-0.5">{documents?.length ?? 0}</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Embeddings</span>
                <span className="font-title-md text-title-md text-on-surface mt-0.5">{totalChunks}</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Dimension</span>
                <span className="font-title-md text-title-md text-on-surface mt-0.5">1536</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Status</span>
                <span className={`font-title-md text-title-md mt-0.5 ${isPending ? 'text-tertiary' : 'text-secondary'}`}>
                  {isPending ? 'Indexing' : 'Idle'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
                disabled={isFetching}
                className="text-body-sm text-body-sm text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${isFetching ? 'animate-spin' : ''}`}>refresh</span>
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
