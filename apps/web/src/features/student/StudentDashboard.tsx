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
        <h1 className="text-3xl font-bold tracking-tight text-on-surface ">Student Dashboard</h1>
        <p className="text-lg text-on-surface-variant  mt-2">Your voice matters. Share your feedback anonymously.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold text-on-surface  border-b border-outline-variant  pb-2">
            Active Feedback Requests
          </h2>
          
          {campaigns?.length === 0 ? (
            <div className="bg-surface-container-low  rounded-xl border border-dashed border-outline-variant  p-8 text-center text-on-surface-variant">
              You're all caught up! There are no active feedback requests for you right now.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns?.map((campaign: any) => (
                <Card key={campaign.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle>{campaign.name}</CardTitle>
                    <CardDescription>{campaign.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-on-surface-variant space-y-1">
                      {campaign.department && <div>Department: <span className="font-medium text-on-surface ">{campaign.department.name}</span></div>}
                      {campaign.subject && <div>Subject: <span className="font-medium text-on-surface ">{campaign.subject.name}</span></div>}
                      <div>Closes: <span className="font-medium text-on-surface ">{new Date(campaign.endAt).toLocaleDateString()}</span></div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-surface-container-low  pt-4 pb-4">
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
          <h2 className="text-xl font-semibold text-on-surface  border-b border-outline-variant  pb-2">
            Institutional Updates
          </h2>
          
          {updates?.length === 0 ? (
            <div className="text-on-surface-variant text-sm">No recent updates published yet.</div>
          ) : (
            <div className="space-y-4">
              {updates?.map((update: any) => (
                <Card key={update.id} className="bg-surface-container-low  shadow-sm border-outline-variant ">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm">{update.title}</CardTitle>
                    <CardDescription className="text-xs">{new Date(update.publishedAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="py-2 px-4 text-sm text-on-surface ">
                    <p className="line-clamp-3">{update.content}</p>
                  </CardContent>
                  <CardFooter className="py-2 px-4">
                    <Button variant="ghost" size="sm" className="h-8 text-xs p-0 text-primary ">Read more →</Button>
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
