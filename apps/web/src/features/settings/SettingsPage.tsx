import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@campuspulse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';

export function SettingsPage() {
  const { user } = useAuth();

  const isPlatformOwner = user?.roles?.includes(UserRole.PLATFORM_OWNER);
  const isInstitutionAdmin = user?.roles?.includes(UserRole.INSTITUTION_ADMIN);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and institution settings
        </p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="institution">Institution</TabsTrigger>
          <TabsTrigger value="users" disabled={!isPlatformOwner && !isInstitutionAdmin}>
            Users
          </TabsTrigger>
          <TabsTrigger value="integrations" disabled={!isPlatformOwner}>
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <div className="flex flex-wrap gap-2">
                    {user?.roles?.map((role: string) => (
                      <Badge key={role} variant="outline">{role}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tenant ID</label>
                  <input
                    type="text"
                    value={user?.tenantId || ''}
                    disabled
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Change Password</h4>
                <p className="text-sm text-muted-foreground">
                  Password change functionality would be implemented here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="institution" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Institution Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">General</h4>
                <p className="text-sm text-muted-foreground">
                  Institution name, branding, and contact information.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Academic Structure</h4>
                <p className="text-sm text-muted-foreground">
                  Departments, subjects, semesters, and academic years management.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Campaign Defaults</h4>
                <p className="text-sm text-muted-foreground">
                  Default settings for feedback campaigns (anonymity, types, etc.).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPlatformOwner && (
                <div className="space-y-2">
                  <h4 className="font-medium">Platform Owners</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage platform-level administrators.
                  </p>
                </div>
              )}
              {isInstitutionAdmin && (
                <div className="space-y-2">
                  <h4 className="font-medium">Institution Admins</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage institution-level administrators and reviewers.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="font-medium">Faculty & Staff</h4>
                <p className="text-sm text-muted-foreground">
                  Manage faculty assignments and department associations.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Students</h4>
                <p className="text-sm text-muted-foreground">
                  View and manage student enrollments.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">LLM Providers</h4>
                <p className="text-sm text-muted-foreground">
                  Configure AI providers for conversational feedback analysis (Groq, OpenAI, etc.).
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  SSO providers (SAML, OIDC, Google, Microsoft).
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Email, SMS, and push notification providers.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium">Webhooks</h4>
                <p className="text-sm text-muted-foreground">
                  Outbound webhooks for campaign events, issue updates, etc.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}