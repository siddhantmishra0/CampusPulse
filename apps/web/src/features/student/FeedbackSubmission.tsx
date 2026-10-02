import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';

export function FeedbackSubmission() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  // 1. Fetch campaign details to show context
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      // Students access public/limited info about the campaign
      const res = await api.get(`/campaigns/${campaignId}`);
      return res.data.data;
    },
    enabled: !!campaignId,
  });

  // 2. Authorize Submission (Get Token)
  const authorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/feedback/authorize', { campaignId });
      return res.data.data.submissionToken as string;
    },
  });

  // 3. Submit Feedback
  const submitMutation = useMutation({
    mutationFn: async (submissionToken: string) => {
      await api.post('/feedback', {
        submissionToken,
        source: 'TRADITIONAL',
        responses: [
          { question: 'General Feedback', answer: feedback },
        ],
      });
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.message || 'Failed to submit feedback');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setError(null);
    
    try {
      // Step 1: Get anonymous token
      const token = await authorizeMutation.mutateAsync();
      // Step 2: Submit with token
      await submitMutation.mutateAsync(token);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred during submission');
    }
  };

  if (campaignLoading) return <Spinner />;
  
  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center p-8 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
          <div className="mb-4 text-green-500">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <CardTitle className="text-2xl text-green-700 dark:text-green-400 mb-2">Feedback Submitted!</CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400 text-lg">
            Thank you for sharing your thoughts. Your feedback is completely anonymous and will help improve the institution.
          </CardDescription>
          <div className="mt-8">
            <Button onClick={() => navigate('/student/dashboard')}>Return to Dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/student/dashboard')} className="mb-4">← Back to Dashboard</Button>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{campaign?.name}</h1>
        <p className="text-slate-500 mt-2">{campaign?.description}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <CardTitle>Share Your Thoughts</CardTitle>
            <CardDescription>
              Your feedback is <span className="font-semibold text-indigo-600 dark:text-indigo-400">100% anonymous</span>. We use a secure token system that disconnects your identity from your response.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Submission Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              <label htmlFor="feedback" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                What would you like to share?
              </label>
              <textarea
                id="feedback"
                name="feedback"
                required
                rows={8}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Write your feedback here..."
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 shadow-sm"
              />
              <p className="text-xs text-slate-500">
                Please be constructive. This feedback goes directly to department reviewers.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-4 pb-6">
            <Button 
              type="submit" 
              isLoading={authorizeMutation.isPending || submitMutation.isPending}
              disabled={!feedback.trim()}
              size="lg"
            >
              Submit Anonymously
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Conversational mode CTA */}
      <div className="mt-8 text-center p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-300">Prefer a conversation?</h3>
        <p className="text-indigo-700 dark:text-indigo-400 mt-2 mb-4 text-sm max-w-lg mx-auto">
          Not sure what to write? Try our AI-guided feedback assistant to help you articulate your thoughts clearly.
        </p>
        {conversationError && (
          <p className="text-red-500 text-sm mb-3">{conversationError}</p>
        )}
        <Button
          variant="outline"
          className="border-indigo-200 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          onClick={async () => {
            setConversationError(null);
            try {
              const res = await api.post('/feedback/authorize', { campaignId });
              const token = res.data.data.submissionToken as string;
              navigate(`/student/feedback/${campaignId}/chat?token=${encodeURIComponent(token)}`);
            } catch (err: any) {
              setConversationError(err.response?.data?.error || 'Failed to start conversation. Please try again.');
            }
          }}
        >
          Start AI Conversation
        </Button>
      </div>
    </div>
  );
}
