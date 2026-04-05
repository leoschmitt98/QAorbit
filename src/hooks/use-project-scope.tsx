import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'qa-orbit:selected-project-id'

interface ProjectScopeContextValue {
  selectedProjectId: string
  setSelectedProjectId: (projectId: string) => void
}

const ProjectScopeContext = createContext<ProjectScopeContextValue | null>(null)

export function ProjectScopeProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY) || ''
    setSelectedProjectIdState(stored)
  }, [])

  function setSelectedProjectId(projectId: string) {
    setSelectedProjectIdState(projectId)
    if (typeof window === 'undefined') return

    if (projectId) {
      window.localStorage.setItem(STORAGE_KEY, projectId)
      return
    }

    window.localStorage.removeItem(STORAGE_KEY)
  }

  const value = useMemo(
    () => ({
      selectedProjectId,
      setSelectedProjectId,
    }),
    [selectedProjectId],
  )

  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>
}

export function useProjectScope() {
  const context = useContext(ProjectScopeContext)
  if (!context) {
    throw new Error('useProjectScope deve ser usado dentro de ProjectScopeProvider.')
  }

  return context
}
