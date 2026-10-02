import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';

export function StudentDashboard() {
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['student-campaigns'],
    queryFn: async () => {
      const res = await api.get('/student/campaigns');
      return res.data.data;
    },
  });

  const { data: updates, isLoading: updatesLoading } = useQuery({
    queryKey: ['student-updates'],
    queryFn: async () => {
      const res = await api.get('/student/updates');
      return res.data.data;
    },
  });

  if (campaignsLoading || updatesLoading) return <Spinner />;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Student Dashboard</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mt-2">Your voice matters. Share your feedback anonymously.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-200 dark:border-slate-800 pb-2">
            Active Feedback Requests
          </h2>
          
          {campaigns?.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
              You're all caught up! There are no active feedback requests for you right now.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns?.map((campaign: any) => (
                <Card key={campaign.id} className="hover:border-indigo-500 transition-colors">
                  <CardHeader>
                    <CardTitle>{campaign.name}</CardTitle>
                    <CardDescription>{campaign.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-500 space-y-1">
                      {campaign.department && <div>Department: <span className="font-medium text-slate-900 dark:text-slate-100">{campaign.department.name}</span></div>}
                      {campaign.subject && <div>Subject: <span className="font-medium text-slate-900 dark:text-slate-100">{campaign.subject.name}</span></div>}
                      <div>Closes: <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(campaign.endAt).toLocaleDateString()}</span></div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50 dark:bg-slate-900/50 pt-4 pb-4">
                    <Link to={`/student/feedback/${campaign.id}`} className="w-full">
                      <Button className="w-full">Give Feedback</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 border-b border-slate-200 dark:border-slate-800 pb-2">
            Institutional Updates
          </h2>
          
          {updates?.length === 0 ? (
            <div className="text-slate-500 text-sm">No recent updates published yet.</div>
          ) : (
            <div className="space-y-4">
              {updates?.map((update: any) => (
                <Card key={update.id} className="bg-slate-50 dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">{update.title}</CardTitle>
                    <CardDescription className="text-xs">{new Date(update.publishedAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="py-2 px-4 text-sm text-slate-700 dark:text-slate-300">
                    <p className="line-clamp-3">{update.content}</p>
                  </CardContent>
                  <CardFooter className="py-2 px-4">
                    <Button variant="ghost" size="sm" className="h-8 text-xs p-0 text-indigo-600 dark:text-indigo-400">Read more →</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
