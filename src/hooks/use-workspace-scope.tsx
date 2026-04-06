import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'

const STORAGE_KEY = 'qa-orbit:workspace-visibility'

export type WorkspaceVisibility = 'mine' | 'all'

interface WorkspaceScopeContextValue {
  visibility: WorkspaceVisibility
  setVisibility: (visibility: WorkspaceVisibility) => void
  canSwitchVisibility: boolean
}

const WorkspaceScopeContext = createContext<WorkspaceScopeContextValue | null>(null)

export function WorkspaceScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const canSwitchVisibility = Boolean(user?.canViewAll)
  const [visibility, setVisibilityState] = useState<WorkspaceVisibility>('mine')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'all' && canSwitchVisibility) {
      setVisibilityState('all')
      return
    }
    setVisibilityState('mine')
  }, [canSwitchVisibility])

  function setVisibility(visibilityMode: WorkspaceVisibility) {
    const nextVisibility = canSwitchVisibility && visibilityMode === 'all' ? 'all' : 'mine'
    setVisibilityState(nextVisibility)
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, nextVisibility)
  }

  const value = useMemo(
    () => ({
      visibility,
      setVisibility,
      canSwitchVisibility,
    }),
    [visibility, canSwitchVisibility],
  )

  return <WorkspaceScopeContext.Provider value={value}>{children}</WorkspaceScopeContext.Provider>
}

export function useWorkspaceScope() {
  const context = useContext(WorkspaceScopeContext)
  if (!context) {
    throw new Error('useWorkspaceScope deve ser usado dentro de WorkspaceScopeProvider.')
  }

  return context
}
