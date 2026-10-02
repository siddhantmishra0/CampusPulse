import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';

interface CampaignDetail {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  startAt: string;
  endAt: string;
  createdAt: string;
  department?: { id: string; name: string };
  subject?: { id: string; name: string; code: string };
  faculty?: { id: string; firstName: string; lastName: string };
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading, error } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const res = await api.get(`/campaigns/${id}`);
      return res.data.data as CampaignDetail;
    },
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: async (action: 'schedule' | 'activate' | 'close' | 'archive') => {
      await api.post(`/campaigns/${id}/transition`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !campaign) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load campaign details.</AlertDescription>
      </Alert>
    );
  }

  const handleAction = (action: 'schedule' | 'activate' | 'close' | 'archive') => {
    if (confirm(`Are you sure you want to ${action} this campaign?`)) {
      transitionMutation.mutate(action);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/campaigns')}>← Back</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-on-surface ">{campaign.name}</h1>
          <p className="text-on-surface-variant">Created on {new Date(campaign.createdAt).toLocaleDateString()}</p>
        </div>
        <Badge variant={
          campaign.status === 'ACTIVE' ? 'success' :
          campaign.status === 'DRAFT' ? 'secondary' :
          campaign.status === 'CLOSED' ? 'default' :
          'outline'
        } className="text-lg py-1 px-3">
          {campaign.status}
        </Badge>
      </div>

      <div className="bg-surface-container-lowest  rounded-xl border border-outline-variant  overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant ">
          <h3 className="text-lg font-medium text-on-surface ">Campaign Overview</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider mb-1">Description</h4>
            <p className="text-on-surface ">{campaign.description}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider mb-1">Schedule</h4>
              <p className="text-on-surface ">
                <span className="font-medium">Starts:</span> {new Date(campaign.startAt).toLocaleString()}
                <br />
                <span className="font-medium">Ends:</span> {new Date(campaign.endAt).toLocaleString()}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wider mb-1">Targeting</h4>
              <ul className="space-y-1 text-on-surface ">
                {campaign.department && <li><span className="font-medium">Department:</span> {campaign.department.name}</li>}
                {campaign.subject && <li><span className="font-medium">Subject:</span> {campaign.subject.name} ({campaign.subject.code})</li>}
                {campaign.faculty && <li><span className="font-medium">Faculty:</span> {campaign.faculty.firstName} {campaign.faculty.lastName}</li>}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-surface-container-low  border-t border-outline-variant  flex justify-end space-x-3">
          {campaign.status === 'DRAFT' && (
            <>
              <Button variant="outline" onClick={() => handleAction('schedule')} isLoading={transitionMutation.isPending}>Schedule</Button>
              <Button onClick={() => handleAction('activate')} isLoading={transitionMutation.isPending}>Activate Now</Button>
            </>
          )}
          {campaign.status === 'SCHEDULED' && (
            <Button onClick={() => handleAction('activate')} isLoading={transitionMutation.isPending}>Activate Now</Button>
          )}
          {campaign.status === 'ACTIVE' && (
            <Button variant="destructive" onClick={() => handleAction('close')} isLoading={transitionMutation.isPending}>Close Campaign</Button>
          )}
          {campaign.status === 'CLOSED' && (
            <Button variant="outline" onClick={() => handleAction('archive')} isLoading={transitionMutation.isPending}>Archive</Button>
          )}
        </div>
      </div>
      
      {/* Analytics Dashboard (Phase 6 placeholder) */}
      <div className="bg-surface-container-lowest  rounded-xl border border-outline-variant  p-6 flex items-center justify-center min-h-[200px] text-on-surface-variant">
        Analytics and Insights for this campaign will appear here (Phase 6)
      </div>
    </div>
  );
}
