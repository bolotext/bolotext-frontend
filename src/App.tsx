import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { Page } from '@/components/layout/Page'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import type { Abilities } from '@/lib/permissions'
import LoginPage from '@/pages/LoginPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const AgentsPage = lazy(() => import('@/pages/agents/AgentsPage'))
const AgentDetailPage = lazy(() => import('@/pages/agents/AgentDetailPage'))
const ProvidersPage = lazy(() => import('@/pages/ProvidersPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const OrganizationsPage = lazy(() => import('@/pages/organizations/OrganizationsPage'))
const OrganizationDetailPage = lazy(() => import('@/pages/organizations/OrganizationDetailPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error, refreshUser, logout } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!user && error) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <ErrorState error={error} onRetry={() => refreshUser()} />
        <Button variant="ghost" onClick={() => logout()}>
          Sign in again
        </Button>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function RequireAbility({ ability, children }: { ability: keyof Omit<Abilities, 'role' | 'can'>; children: ReactNode }) {
  const { abilities } = useAuth()
  if (!abilities[ability]) {
    return (
      <Page>
        <EmptyState
          icon={<ShieldOff />}
          title="You don't have access to this page"
          description="Your role in this organization doesn't include this area. Ask an admin if you need access."
        />
      </Page>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:agentId/:tab?" element={<AgentDetailPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route
            path="users"
            element={
              <RequireAbility ability="viewUsers">
                <UsersPage />
              </RequireAbility>
            }
          />
          <Route
            path="organizations"
            element={
              <RequireAbility ability="viewOrganizations">
                <OrganizationsPage />
              </RequireAbility>
            }
          />
          <Route
            path="organizations/:orgId"
            element={
              <RequireAbility ability="viewOrganizations">
                <OrganizationDetailPage />
              </RequireAbility>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <Page>
                <EmptyState title="Page not found" description="The page you're looking for doesn't exist." />
              </Page>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
