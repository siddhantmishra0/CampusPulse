import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';

interface ChatMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt?: Date;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed  text-primary  text-sm font-bold shrink-0">
        AI
      </div>
      <div className="bg-surface-container-lowest  border border-outline-variant  rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-outline animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  );
}

export function ConversationalFeedback() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const submissionToken = searchParams.get('token') ?? '';
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Start conversation on mount
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/conversations/start', { submissionToken });
      return res.data.data as { conversationId: string; firstMessage: string };
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages([{ role: 'ASSISTANT', content: data.firstMessage }]);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.message || 'Could not start conversation.');
    },
  });

  useEffect(() => {
    if (submissionToken) {
      startMutation.mutate();
    } else {
      setError('No submission token found. Please start from the feedback page.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/conversations/${conversationId}/messages`, { content });
      return res.data.data as { reply: string };
    },
    onMutate: (content) => {
      setMessages((prev) => [...prev, { role: 'USER', content }]);
      setIsTyping(true);
      setInput('');
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: data.reply }]);
    },
    onError: (err: any) => {
      setIsTyping(false);
      setError(err.response?.data?.error || err.message || 'Failed to send message.');
    },
  });

  // Submit conversation
  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/conversations/${conversationId}/submit`, { submissionToken });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.message || 'Failed to submit feedback.');
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-fixed to-surface-container-low  ">
        <div className="max-w-md w-full bg-surface-container-lowest  rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4 text-success">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-on-surface  mb-2">Feedback Submitted!</h2>
          <p className="text-on-surface-variant mb-6">
            Thank you for sharing. Your feedback is completely anonymous and will help improve the institution.
          </p>
          <Button className="w-full" onClick={() => navigate('/student/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading / Error screen ────────────────────────────────────────────────
  if (startMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner />
          <p className="text-on-surface-variant">Starting your feedback session…</p>
        </div>
      </div>
    );
  }

  if (error && !conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertTitle>Session Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button className="mt-4 w-full" variant="outline" onClick={() => navigate(`/student/feedback/${campaignId}`)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-surface-container-low ">
      {/* Header */}
      <header className="bg-surface-container-lowest  border-b border-outline-variant  px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(`/student/feedback/${campaignId}`)}
          className="text-on-surface-variant hover:text-on-surface :text-on-surface transition-colors"
          aria-label="Go back"
        >
          ←
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary text-sm font-bold">
          AI
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-on-surface  text-sm truncate">CampusPulse Feedback Assistant</p>
          <p className="font-body-sm text-body-sm text-success">● Conversation is anonymous</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submitMutation.mutate()}
          isLoading={submitMutation.isPending}
          disabled={messages.length < 3 || submitMutation.isPending}
          className="border-outline-variant text-on-surface-variant hover:bg-surface-container shrink-0"
        >
          Finish & Submit
        </Button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 pt-3">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-end gap-2 ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'ASSISTANT' && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed  text-primary  text-sm font-bold shrink-0">
                AI
              </div>
            )}
            <div
              className={[
                'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'USER'
                  ? 'bg-primary text-on-primary rounded-br-sm'
                  : 'bg-surface-container-lowest  border border-outline-variant  text-on-surface  rounded-bl-sm',
              ].join(' ')}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <footer className="bg-surface-container-lowest  border-t border-outline-variant  p-4">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!conversationId || sendMutation.isPending || isTyping}
            rows={2}
            placeholder="Type your response… (Enter to send, Shift+Enter for new line)"
            className="flex-1 resize-none rounded-xl border border-outline-variant  bg-surface-container-low  px-4 py-2.5 text-sm text-on-surface  placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !conversationId || sendMutation.isPending || isTyping}
            isLoading={sendMutation.isPending}
            className="rounded-xl h-12 w-12 p-0 shrink-0"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
        <p className="text-xs text-outline text-center mt-2">
          You can submit at any time using the "Finish &amp; Submit" button above.
        </p>
      </footer>
    </div>
  );
}
