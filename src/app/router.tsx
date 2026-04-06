import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/layouts/app-shell'
import { useAuth } from '@/hooks/use-auth'
import { BugDetailPage } from '@/pages/bug-detail-page'
import { BugsPage } from '@/pages/bugs-page'
import { CentralAgentsPage } from '@/pages/central-agents-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { DocumentDetailPage } from '@/pages/document-detail-page'
import { EvidencePage } from '@/pages/evidence-page'
import { ExecutionDetailPage } from '@/pages/execution-detail-page'
import { ExecutionsPage } from '@/pages/executions-page'
import { FlowHistoryPage } from '@/pages/flow-history-page'
import { FunctionalBasePage } from '@/pages/functional-base-page'
import { HistoricalTestDetailPage } from '@/pages/historical-test-detail-page'
import { HistoricalTestsPage } from '@/pages/historical-tests-page'
import { NewAnalysisPage } from '@/pages/new-analysis-page'
import { ProjectDetailPage } from '@/pages/project-detail-page'
import { ProjectsPage } from '@/pages/projects-page'
import { ReportsPage } from '@/pages/reports-page'
import { SettingsPage } from '@/pages/settings-page'
import { LoginPage } from '@/pages/login-page'

function ProtectedApp() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen bg-background bg-glow" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppShell />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedApp />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'agents', element: <CentralAgentsPage /> },
      { path: 'analysis/new', element: <NewAnalysisPage /> },
      { path: 'flows/history', element: <FlowHistoryPage /> },
      { path: 'historical-tests', element: <HistoricalTestsPage /> },
      { path: 'historical-tests/:recordId', element: <HistoricalTestDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'functional-base', element: <FunctionalBasePage /> },
      { path: 'functional-base/:documentId', element: <DocumentDetailPage /> },
      { path: 'bugs', element: <BugsPage /> },
      { path: 'bugs/new', element: <BugDetailPage /> },
      { path: 'bugs/:bugId', element: <BugDetailPage /> },
      { path: 'executions', element: <ExecutionsPage /> },
      { path: 'executions/:executionId', element: <ExecutionDetailPage /> },
      { path: 'evidences', element: <EvidencePage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
