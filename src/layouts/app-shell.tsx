import { Outlet } from 'react-router-dom'
import { ProjectScopeProvider } from '@/hooks/use-project-scope'
import { Sidebar } from '@/components/navigation/sidebar'
import { Topbar } from '@/components/navigation/topbar'

export function AppShell() {
  return (
    <ProjectScopeProvider>
      <div className="min-h-screen bg-background bg-glow text-foreground">
        <div className="lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Topbar />
            <main className="px-4 py-6 lg:px-8 lg:py-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </ProjectScopeProvider>
  )
}
