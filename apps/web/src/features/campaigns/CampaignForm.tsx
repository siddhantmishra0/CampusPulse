import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';

export function CampaignForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Note: For a complete implementation, these would be populated from the API
  // via react-select or similar autocomplete components.
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data.data;
    },
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    campaignType: 'SUBJECT',
    startAt: '',
    endAt: '',
    departmentId: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        campaignType: data.campaignType,
        startAt: new Date(data.startAt).toISOString(),
        endAt: new Date(data.endAt).toISOString(),
      };

      // Only include departmentId if selected
      if (data.departmentId) payload['departmentId'] = data.departmentId;

      const res = await api.post('/campaigns', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
    onError: (err: any) => {
      const details = err.response?.data?.details as { path?: (string | number)[]; message?: string }[] | undefined;
      const detailText = details?.map((d) => d.message).filter(Boolean).join(' ');
      setError(detailText || err.response?.data?.error || err.message || 'Failed to create campaign');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="title"
                name="title"
                required
                minLength={3}
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Fall 2026 Mid-Semester Feedback"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="campaignType" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Campaign Type <span className="text-red-500">*</span>
              </label>
              <select
                id="campaignType"
                name="campaignType"
                value={formData.campaignType}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:text-slate-50 dark:bg-slate-900"
              >
                <option value="SUBJECT">Subject</option>
                <option value="FACULTY">Faculty</option>
                <option value="DEPARTMENT">Department</option>
                <option value="SERVICE">Service</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:text-slate-50 dark:focus:ring-indigo-400"
                placeholder="Describe the purpose of this feedback campaign..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="startAt" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <Input
                  id="startAt"
                  name="startAt"
                  type="datetime-local"
                  required
                  value={formData.startAt}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="endAt" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  End Date & Time <span className="text-red-500">*</span>
                </label>
                <Input
                  id="endAt"
                  name="endAt"
                  type="datetime-local"
                  required
                  value={formData.endAt}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="departmentId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Target Department (Optional)
              </label>
              <select
                id="departmentId"
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-700 dark:text-slate-50 dark:bg-slate-900"
              >
                <option value="">All Departments (Institution-wide)</option>
                {departments?.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-3 bg-slate-50 dark:bg-slate-900/50 py-4">
            <Button type="button" variant="outline" onClick={() => navigate('/campaigns')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Create Campaign
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
