import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserRole } from '@campuspulse/shared';

// Pages & Layouts
import { AppShell } from './features/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { NotFound } from './pages/NotFound';

// Phase 3 Features
import { CampaignList } from './features/campaigns/CampaignList';
import { CampaignForm } from './features/campaigns/CampaignForm';
import { CampaignDetail } from './features/campaigns/CampaignDetail';
import { StudentDashboard } from './features/student/StudentDashboard';
import { FeedbackSubmission } from './features/student/FeedbackSubmission';
import { ConversationalFeedback } from './features/student/ConversationalFeedback';
import { AnalyticsDashboard } from './features/admin/AnalyticsDashboard';
import { AnalyticsDetail } from './features/admin/AnalyticsDetail';
import { IssueBoard } from './features/issues/IssueBoard';
import { IssueDetail } from './features/issues/IssueDetail';
import { KnowledgeBase } from './features/documents/KnowledgeBase';
import { DocumentDetail } from './features/documents/DocumentDetail';
import { SettingsPage } from './features/settings/SettingsPage';
import { OwnerPage } from './features/owner/OwnerPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes inside AppShell */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* Fallback general dashboard */}
              <Route path="dashboard" element={
                <div className="p-8">
                  <h1 className="text-2xl font-bold">Welcome to CampusPulse</h1>
                  <p className="mt-2 text-on-surface-variant">Select an option from the sidebar to get started.</p>
                </div>
              } />

              {/* Admin/Faculty Routes */}
              <Route path="campaigns">
                <Route index element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]}>
                    <CampaignList />
                  </ProtectedRoute>
                } />
                <Route path="new" element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]}>
                    <CampaignForm />
                  </ProtectedRoute>
                } />
                <Route path=":id" element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]}>
                    <CampaignDetail />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Student Routes */}
              <Route path="student">
                <Route path="dashboard" element={
                  <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                    <StudentDashboard />
                  </ProtectedRoute>
                } />
                <Route path="feedback/:campaignId" element={
                  <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                    <FeedbackSubmission />
                  </ProtectedRoute>
                } />
                <Route path="feedback/:campaignId/chat" element={
                  <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                    <ConversationalFeedback />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Issue Tracker Routes */}
              <Route path="issues">
                <Route index element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]}>
                    <IssueBoard />
                  </ProtectedRoute>
                } />
                <Route path=":id" element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY, UserRole.STUDENT]}>
                    <IssueDetail />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Knowledge Base Routes — reviewer-only. The documents API and the
                  sidebar nav both restrict these to owner/admin/reviewer, so the
                  route guard must not admit FACULTY or the page renders 403s. */}
              <Route path="knowledge">
                <Route index element={
                  <ProtectedRoute allowedRoles={[UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]}>
                    <KnowledgeBase />
                  </ProtectedRoute>
                } />
                <Route path=":id" element={
                  <ProtectedRoute allowedRoles={[UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER]}>
                    <DocumentDetail />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Admin Analytics Routes */}
              <Route path="admin">
                <Route path="analytics" element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]}>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                } />
                <Route path="analytics/:campaignId" element={
                  <ProtectedRoute allowedRoles={[UserRole.INSTITUTION_ADMIN, UserRole.DEPARTMENT_REVIEWER, UserRole.FACULTY]}>
                    <AnalyticsDetail />
                  </ProtectedRoute>
                } />
              </Route>

            {/* Platform Owner Routes */}
            <Route path="owner" element={
              <ProtectedRoute allowedRoles={[UserRole.PLATFORM_OWNER]}>
                <OwnerPage />
              </ProtectedRoute>
            } />

            {/* Settings Route */}
            <Route path="settings" element={
                <ProtectedRoute allowedRoles={[UserRole.PLATFORM_OWNER, UserRole.INSTITUTION_ADMIN]}>
                  <SettingsPage />
                </ProtectedRoute>
              } />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
