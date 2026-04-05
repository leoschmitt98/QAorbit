import { useQuery } from '@tanstack/react-query'
import { activities, agents, bugs, dashboardMetrics, documents, evidences, executions, modules, projects, qaFlows } from '@/data/mock-data'

const delay = async <T,>(data: T) =>
  new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), 120)
  })

export function useDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () =>
      delay({
        metrics: dashboardMetrics,
        projects,
        modules,
        bugs,
        documents,
        evidences,
        activities,
        executions,
        qaFlows,
      }),
  })
}

export function useProjectsQuery() {
  return useQuery({ queryKey: ['projects'], queryFn: async () => delay(projects) })
}

export function useProjectQuery(projectId?: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () =>
      delay({
        project: projects.find((item) => item.id === projectId) ?? null,
        modules: modules.filter((item) => item.projectId === projectId),
        documents: documents.filter((item) => item.projectId === projectId),
        bugs: bugs.filter((item) => item.projectId === projectId),
        evidences: evidences.filter((item) => item.projectId === projectId),
      }),
    enabled: Boolean(projectId),
  })
}

export function useDocumentsQuery() {
  return useQuery({ queryKey: ['documents'], queryFn: async () => delay(documents) })
}

export function useDocumentQuery(documentId?: string) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => delay(documents.find((item) => item.id === documentId) ?? null),
    enabled: Boolean(documentId),
  })
}

export function useBugsQuery() {
  return useQuery({ queryKey: ['bugs'], queryFn: async () => delay(bugs) })
}

export function useBugQuery(bugId?: string) {
  return useQuery({
    queryKey: ['bug', bugId],
    queryFn: async () =>
      delay({
        bug: bugs.find((item) => item.id === bugId) ?? null,
        execution: executions.find((item) => item.bugId === bugId) ?? null,
        evidences: evidences.filter((item) => item.bugId === bugId),
        relatedBugs: bugs.filter((item) => item.id !== bugId),
      }),
    enabled: Boolean(bugId),
  })
}

export function useExecutionsQuery() {
  return useQuery({ queryKey: ['executions'], queryFn: async () => delay(executions) })
}

export function useExecutionQuery(executionId?: string) {
  return useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => delay(executions.find((item) => item.id === executionId) ?? null),
    enabled: Boolean(executionId),
  })
}

export function useEvidencesQuery() {
  return useQuery({ queryKey: ['evidences'], queryFn: async () => delay(evidences) })
}

export function useAgentsQuery() {
  return useQuery({ queryKey: ['agents'], queryFn: async () => delay(agents) })
}

export function useQaFlowsQuery() {
  return useQuery({ queryKey: ['qa-flows'], queryFn: async () => delay(qaFlows) })
}
