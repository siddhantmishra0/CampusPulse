import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  startAt: string;
  endAt: string;
  department?: { id: string; name: string };
  subject?: { id: string; name: string };
}

export function CampaignList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await api.get('/campaigns');
      return res.data.data as Campaign[];
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <div className="text-red-500">Failed to load campaigns</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Feedback Campaigns</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your institution's feedback collection campaigns.</p>
        </div>
        <Link to="/campaigns/new">
          <Button>Create Campaign</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            No campaigns found. Create your first campaign to get started.
          </div>
        ) : (
          data?.map((campaign) => (
            <Card key={campaign.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={
                    campaign.status === 'ACTIVE' ? 'success' :
                    campaign.status === 'DRAFT' ? 'secondary' :
                    campaign.status === 'CLOSED' ? 'default' :
                    'outline'
                  }>
                    {campaign.status}
                  </Badge>
                </div>
                <CardTitle>{campaign.name}</CardTitle>
                <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm space-y-1">
                  {campaign.department && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{campaign.department.name}</span>
                    </div>
                  )}
                  {campaign.subject && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subject:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{campaign.subject.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Starts:</span>
                    <span className="text-slate-900 dark:text-slate-100">{new Date(campaign.startAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Link to={`/campaigns/${campaign.id}`} className="w-full">
                  <Button variant="outline" className="w-full">View Details</Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
