import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ProjectScopeProvider } from '@/hooks/use-project-scope'
import { Sidebar } from '@/components/navigation/sidebar'
import { Topbar } from '@/components/navigation/topbar'

export function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const storedValue = window.localStorage.getItem('qa-orbit-sidebar-collapsed')
    setIsSidebarCollapsed(storedValue === 'true')
  }, [])

  useEffect(() => {
    window.localStorage.setItem('qa-orbit-sidebar-collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  return (
    <ProjectScopeProvider>
      <div className="min-h-screen bg-background bg-glow text-foreground">
        <div className="lg:flex">
          <Sidebar collapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed((current) => !current)} />
          <div className="min-w-0 flex-1">
            <Topbar collapsed={isSidebarCollapsed} onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)} />
            <main className="px-4 py-6 lg:px-8 lg:py-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </ProjectScopeProvider>
  )
}
