import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, Plus, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';

type Tenant = { id: string; name: string; domain: string | null; isActive: boolean; createdAt: string };
type Role = { id: string; name: string; description: string | null };
type PlatformUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  tenantId: string | null;
  tenant: { id: string; name: string } | null;
  roles: { role: { id: string; name: string } }[];
};

const fieldClass =
  'flex h-10 w-full rounded-md border border-outline-variant bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60   ';
const labelClass = 'block text-sm font-medium text-on-surface ';

export function OwnerPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tenantForm, setTenantForm] = useState({ name: '', domain: '' });
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [userForm, setUserForm] = useState({
    email: '', password: '', firstName: '', lastName: '',
    roles: [] as string[],
  });
  const [roleEdits, setRoleEdits] = useState<Record<string, string[]>>({});

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get('/tenants')).data.data,
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['platform-roles'],
    queryFn: async () => (await api.get('/users/roles')).data.data,
  });

  const { data: users } = useQuery<PlatformUser[]>({
    queryKey: ['platform-users'],
    queryFn: async () => (await api.get('/users')).data.data,
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { name: tenantForm.name };
      if (tenantForm.domain.trim()) body.domain = tenantForm.domain.trim();
      return (await api.post('/tenants', body)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setTenantForm({ name: '', domain: '' });
      setError(null);
      setSuccess('Institute created.');
    },
    onError: (e: any) => setError(e.response?.data?.error || e.message),
  });

  const createUser = useMutation({
    mutationFn: async () => {
      return (await api.post('/users', {
        tenantId: selectedTenantId,
        email: userForm.email,
        password: userForm.password,
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        roles: userForm.roles,
      })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      setUserForm({ email: '', password: '', firstName: '', lastName: '', roles: [] });
      setError(null);
      setSuccess('User created and roles assigned.');
    },
    onError: (e: any) => setError(e.response?.data?.error || e.message),
  });

  const updateRoles = useMutation({
    mutationFn: async (userId: string) => {
      return (await api.patch(`/users/${userId}/roles`, { roles: roleEdits[userId] })).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      setRoleEdits({});
      setError(null);
      setSuccess('Roles updated. The user must sign in again for them to take effect.');
    },
    onError: (e: any) => {
      setError(e.response?.data?.error || e.message);
      setRoleEdits({});
    },
  });

  const toggle = (list: string[], role: string) =>
    list.includes(role) ? list.filter((r) => r !== role) : [...list, role];

  const effectiveRoles = (u: PlatformUser) => roleEdits[u.id] ?? u.roles.map((r) => r.role.name);
  const isDirty = (u: PlatformUser) =>
    roleEdits[u.id] !== undefined &&
    [...roleEdits[u.id]].sort().join() !== u.roles.map((r) => r.role.name).sort().join();

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface ">
          <ShieldCheck className="h-6 w-6 text-primary" /> Platform Administration
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant ">
          Create institutes and manage which roles each user holds.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Institutes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-outline-variant ">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left text-xs uppercase text-on-surface-variant ">
                <tr>
                  <th className="px-4 py-2">Institute</th>
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">Users</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants?.map((t) => (
                  <tr key={t.id} className="border-t border-outline-variant ">
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-on-surface-variant">{t.domain || '—'}</td>
                    <td className="px-4 py-2 text-on-surface-variant">
                      {users?.filter((u) => u.tenantId === t.id).length ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      <span className={t.isActive ? 'text-emerald-600' : 'text-outline'}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {tenants?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                      No institutes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-outline-variant pt-4 ">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="tenantName">Institute Name *</label>
              <Input
                id="tenantName"
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                placeholder="e.g. Thakur College of Engineering and Technology"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="tenantDomain">Domain (Optional)</label>
              <Input
                id="tenantDomain"
                value={tenantForm.domain}
                onChange={(e) => setTenantForm({ ...tenantForm, domain: e.target.value })}
                placeholder="e.g. tcet.edu"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end bg-surface-container-low py-4 ">
          <Button
            type="button"
            disabled={tenantForm.name.trim().length < 2 || createTenant.isPending}
            isLoading={createTenant.isPending}
            onClick={() => createTenant.mutate()}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Create Institute
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Add User
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="userTenant">Institute *</label>
            <select
              id="userTenant"
              className={fieldClass}
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              <option value="">Select an institute</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="userFirstName">First Name *</label>
              <Input id="userFirstName" value={userForm.firstName}
                onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="userLastName">Last Name *</label>
              <Input id="userLastName" value={userForm.lastName}
                onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="userEmail">Email *</label>
              <Input id="userEmail" type="email" value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="userPassword">Temporary Password *</label>
              <Input id="userPassword" type="password" value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required minLength={8} placeholder="Min. 8 characters" />
            </div>
          </div>

          <div className="space-y-2">
            <span className={labelClass}>Roles *</span>
            <div className="flex flex-wrap gap-2">
              {roles?.map((r) => {
                const on = userForm.roles.includes(r.name);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setUserForm({ ...userForm, roles: toggle(userForm.roles, r.name) })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      on
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary  '
                    }`}
                    title={r.description ?? undefined}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end bg-surface-container-low py-4 ">
          <Button
            type="button"
            disabled={!selectedTenantId || userForm.roles.length === 0 || createUser.isPending}
            isLoading={createUser.isPending}
            onClick={() => createUser.mutate()}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Create User
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> User Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {users?.map((u) => {
            const current = effectiveRoles(u);
            return (
              <div key={u.id} className="rounded-lg border border-outline-variant p-4 ">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-on-surface ">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="text-sm text-on-surface-variant">{u.email}</span>
                  <span className="rounded bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant  ">
                    {u.tenant?.name ?? 'No institute'}
                  </span>
                  {!u.isActive && (
                    <span className="rounded bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">Inactive</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {roles?.map((r) => {
                    const on = current.includes(r.name);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRoleEdits({ ...roleEdits, [u.id]: toggle(current, r.name) })}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                          on
                            ? 'border-primary bg-primary-fixed text-primary  '
                            : 'border-outline-variant text-on-surface-variant '
                        }`}
                        title={r.description ?? undefined}
                      >
                        {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {r.name}
                      </button>
                    );
                  })}
                  {isDirty(u) && (
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={updateRoles.isPending}
                      isLoading={updateRoles.isPending}
                      onClick={() => updateRoles.mutate(u.id)}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {users?.length === 0 && (
            <p className="py-6 text-center text-sm text-on-surface-variant">No users yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}