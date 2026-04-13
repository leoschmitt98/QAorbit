import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  useCatalogModulesQuery,
  useCatalogProjectPortalsQuery,
  useCatalogProjectsQuery,
} from '@/services/catalog-api'
import {
  createDemandaTarefa,
  deleteDemanda,
  deleteDemandaCenario,
  deleteDemandaTarefa,
  downloadDemandaCenariosDocx,
  updateDemanda,
  updateDemandaTarefa,
  useDemandaDetailQuery,
} from '@/services/demandas-api'
import type { DemandaCenarioRecord, DemandaTarefaRecord } from '@/types/domain'

const selectClass =
  'h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40'
const textareaClass =
  'min-h-[120px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/35'

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: React.ReactNode
  helper?: string
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {helper ? <span className="block text-xs text-muted">{helper}</span> : null}
    </label>
  )
}

function TreeNode({
  label,
  meta,
  children,
}: {
  label: string
  meta?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-3 h-[calc(100%-0.5rem)] w-px bg-border" />
      <div className="absolute left-2 top-3 h-px w-3 bg-border" />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white/[0.02] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{label}</span>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </div>
  )
}

export function DemandaDetailPage() {
  const { demandaId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detailQuery = useDemandaDetailQuery(demandaId)
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(detailQuery.data?.projectId || '')
  const portalsQuery = useCatalogProjectPortalsQuery(detailQuery.data?.projectId || '')

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('Rascunho')
  const [prioridade, setPrioridade] = useState('Media')
  const [responsavelId, setResponsavelId] = useState('')
  const [message, setMessage] = useState(
    'A demanda agora funciona como uma arvore operacional: tarefas em pilha vertical e cenarios resumidos, com abertura dedicada para detalhamento.',
  )

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPortalId, setNewTaskPortalId] = useState('')
  const [newTaskModuleId, setNewTaskModuleId] = useState('')
  const [newTaskStatus, setNewTaskStatus] = useState('Pendente')
  const [newTaskOrder, setNewTaskOrder] = useState('1')

  const [isSavingDemand, setIsSavingDemand] = useState(false)
  const [isDeletingDemand, setIsDeletingDemand] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState('')
  const [busyScenarioId, setBusyScenarioId] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([])
  const [expandedScenarioIds, setExpandedScenarioIds] = useState<string[]>([])
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [isExportingScenariosDoc, setIsExportingScenariosDoc] = useState(false)

  useEffect(() => {
    if (!detailQuery.data) return
    setTitulo(detailQuery.data.titulo)
    setDescricao(detailQuery.data.descricao || '')
    setProjectId(detailQuery.data.projectId)
    setStatus(detailQuery.data.status)
    setPrioridade(detailQuery.data.prioridade)
    setResponsavelId(detailQuery.data.responsavelId || '')
  }, [detailQuery.data])

  useEffect(() => {
    if (!detailQuery.data?.tarefas?.length) {
      setExpandedTaskIds([])
      return
    }

    setExpandedTaskIds((current) => {
      const validIds = current.filter((id) => detailQuery.data?.tarefas.some((task) => task.id === id))
      return validIds.length > 0 ? validIds : detailQuery.data!.tarefas.map((task) => task.id)
    })
  }, [detailQuery.data])

  const projects = projectsQuery.data ?? []
  const portals = portalsQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const detail = detailQuery.data

  const modulesByPortal = useMemo(() => {
    return modules.reduce<Record<string, typeof modules>>((accumulator, module) => {
      const key = module.portalId || '__no_portal__'
      accumulator[key] = accumulator[key] ? [...accumulator[key], module] : [module]
      return accumulator
    }, {})
  }, [modules])

  if (detailQuery.isLoading || projectsQuery.isLoading || portalsQuery.isLoading) {
    return <LoadingState />
  }

  if (!detail) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Demanda nao encontrada</p>
        <p className="text-sm text-muted">A demanda pode ter sido removida ou nao estar acessivel no escopo atual.</p>
      </Card>
    )
  }

  async function refreshDetail() {
    await queryClient.invalidateQueries({ queryKey: ['demanda', demandaId] })
    await queryClient.invalidateQueries({ queryKey: ['demandas'] })
  }

  function toggleTask(taskId: string) {
    setExpandedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    )
  }

  function toggleScenario(scenarioId: string) {
    setExpandedScenarioIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    )
  }

  function toggleSelectedScenario(scenarioId: string) {
    setSelectedScenarioIds((current) =>
      current.includes(scenarioId) ? current.filter((id) => id !== scenarioId) : [...current, scenarioId],
    )
  }

  async function handleSaveDemanda() {
    setIsSavingDemand(true)
    try {
      await updateDemanda(demandaId, {
        titulo,
        descricao,
        projectId,
        status,
        prioridade,
        responsavelId,
      })
      setMessage('Dados da demanda atualizados com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a demanda.')
    } finally {
      setIsSavingDemand(false)
    }
  }

  async function handleCreateTask() {
    setIsCreatingTask(true)
    try {
      const created = await createDemandaTarefa(demandaId, {
        titulo: newTaskTitle,
        descricao: newTaskDescription,
        portalId: newTaskPortalId || undefined,
        moduleId: newTaskModuleId || undefined,
        status: newTaskStatus,
        ordem: Number(newTaskOrder || 1),
      })
      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskPortalId('')
      setNewTaskModuleId('')
      setNewTaskStatus('Pendente')
      setNewTaskOrder(String((detailQuery.data?.tarefas?.length || 0) + 2))
      setExpandedTaskIds((current) => [...new Set([...current, created.id])])
      setMessage('Tarefa adicionada na demanda com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a tarefa.')
    } finally {
      setIsCreatingTask(false)
    }
  }

  async function handleSaveTask(taskId: string, payload: Parameters<typeof updateDemandaTarefa>[2]) {
    setBusyTaskId(taskId)
    try {
      await updateDemandaTarefa(demandaId, taskId, payload)
      setMessage('Tarefa atualizada com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a tarefa.')
    } finally {
      setBusyTaskId('')
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!window.confirm('Deseja excluir esta tarefa e tudo que estiver abaixo dela na arvore?')) return
    setBusyTaskId(taskId)
    try {
      await deleteDemandaTarefa(demandaId, taskId)
      setExpandedTaskIds((current) => current.filter((id) => id !== taskId))
      setMessage('Tarefa excluida com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir a tarefa.')
    } finally {
      setBusyTaskId('')
    }
  }

  async function handleDeleteScenario(taskId: string, scenarioId: string) {
    if (!window.confirm('Deseja excluir este cenario e suas evidencias/quadros?')) return
    setBusyScenarioId(scenarioId)
    try {
      await deleteDemandaCenario(demandaId, taskId, scenarioId)
      setExpandedScenarioIds((current) => current.filter((id) => id !== scenarioId))
      setMessage('Cenario excluido com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o cenario.')
    } finally {
      setBusyScenarioId('')
    }
  }

  async function handleDeleteDemanda() {
    if (!window.confirm('Deseja excluir esta demanda inteira? Todas as tarefas, cenarios e evidencias vinculadas serao removidas.')) return
    setIsDeletingDemand(true)
    try {
      await deleteDemanda(demandaId)
      await queryClient.invalidateQueries({ queryKey: ['demandas'] })
      navigate('/demandas')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir a demanda.')
      setIsDeletingDemand(false)
    }
  }

  async function handleExportSelectedScenarios() {
    if (selectedScenarioIds.length === 0) {
      setMessage('Selecione ao menos um cenario para gerar o documento.')
      return
    }

    setIsExportingScenariosDoc(true)
    try {
      const result = await downloadDemandaCenariosDocx(demandaId, selectedScenarioIds)
      setMessage(`Documento dos cenarios gerado com sucesso: ${result.fileName}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o documento dos cenarios.')
    } finally {
      setIsExportingScenariosDoc(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Demandas"
        title={detail.titulo}
        description="Estrutura em arvore: demanda no topo, tarefas expansivas no corpo e cenarios empilhados dentro de cada tarefa."
        action={<Button variant="secondary" onClick={() => navigate('/demandas')}>Voltar para lista</Button>}
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Cabecalho da demanda</p>
            <h2 className="font-display text-2xl font-bold text-foreground">Dados basicos</h2>
            <p className="mt-2 text-sm text-muted">{message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={detail.status} />
            <StatusBadge value={detail.prioridade} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="Titulo">
            <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} />
          </Field>

          <Field label="Projeto">
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={selectClass}>
              <option value="">Selecione</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Descricao" helper="Resumo funcional e recorte da demanda.">
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className={textareaClass}
              placeholder="Descreva o objetivo da demanda, contexto funcional e impactos previstos."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
                <option value="Rascunho">Rascunho</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluida">Concluida</option>
              </select>
            </Field>

            <Field label="Prioridade">
              <select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className={selectClass}>
                <option value="Baixa">Baixa</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </Field>

            <Field label="Responsavel ID" helper="Opcional nesta etapa.">
              <Input value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} placeholder="user-..." />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSaveDemanda()} disabled={isSavingDemand}>
            {isSavingDemand ? 'Salvando...' : 'Salvar demanda'}
          </Button>
          <Button variant="secondary" onClick={() => void handleDeleteDemanda()} disabled={isDeletingDemand}>
            {isDeletingDemand ? 'Excluindo...' : 'Excluir demanda'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted">Nova tarefa</p>
          <h2 className="font-display text-2xl font-bold text-foreground">Adicionar frente de validacao</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr,1fr,220px,220px,180px,140px] xl:items-end">
          <Field label="Titulo">
            <Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Ex.: Diario de classe" />
          </Field>

          <Field label="Descricao">
            <Input value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} placeholder="Escopo rapido da tarefa" />
          </Field>

          <Field label="Portal">
            <select
              value={newTaskPortalId}
              onChange={(event) => {
                setNewTaskPortalId(event.target.value)
                setNewTaskModuleId('')
              }}
              className={selectClass}
            >
              <option value="">Nao informado</option>
              {portals.map((portal) => (
                <option key={portal.id} value={portal.id}>
                  {portal.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modulo">
            <select value={newTaskModuleId} onChange={(event) => setNewTaskModuleId(event.target.value)} className={selectClass}>
              <option value="">Nao informado</option>
              {(newTaskPortalId ? modulesByPortal[newTaskPortalId] || [] : []).map((module) => (
                <option key={module.id} value={module.id}>
                  {module.portalNome ? `${module.portalNome} / ${module.nome}` : module.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select value={newTaskStatus} onChange={(event) => setNewTaskStatus(event.target.value)} className={selectClass}>
              <option value="Pendente">Pendente</option>
              <option value="Em validacao">Em validacao</option>
              <option value="Concluida">Concluida</option>
            </select>
          </Field>

          <Field label="Ordem">
            <Input value={newTaskOrder} onChange={(event) => setNewTaskOrder(event.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleCreateTask()} disabled={isCreatingTask}>
            {isCreatingTask ? 'Adicionando...' : 'Adicionar tarefa'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Arvore da demanda</p>
            <h2 className="font-display text-2xl font-bold text-foreground">Demanda &gt; Tarefas &gt; Cenarios &gt; Bugs</h2>
            <p className="mt-2 text-sm text-muted">
              Os cenarios agora ficam em lista um abaixo do outro. Ao abrir um item, voce ve o resumo e entra na tela dedicada para editar GIF, quadros e evidencias.
            </p>
          </div>
          <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
            {detail.tarefas.length} tarefa(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-sm text-muted">
            Selecione os cenarios que devem entrar no Word com os passos extraidos dos GIFs.
          </p>
          <Button
            onClick={() => void handleExportSelectedScenarios()}
            disabled={isExportingScenariosDoc || selectedScenarioIds.length === 0}
          >
            {isExportingScenariosDoc
              ? 'Gerando documento...'
              : `Gerar DOC dos cenarios (${selectedScenarioIds.length})`}
          </Button>
        </div>

        <div className="space-y-5">
          {detail.tarefas.length > 0 ? (
            detail.tarefas.map((task) => (
              <TaskTreeCard
                key={task.id}
                demandaId={demandaId}
                task={task}
                modules={modules}
                portals={portals}
                busy={busyTaskId === task.id}
                busyScenarioId={busyScenarioId}
                expanded={expandedTaskIds.includes(task.id)}
                expandedScenarioIds={expandedScenarioIds}
                selectedScenarioIds={selectedScenarioIds}
                onToggle={() => toggleTask(task.id)}
                onToggleScenario={toggleScenario}
                onToggleSelectedScenario={toggleSelectedScenario}
                onOpenScenario={(scenarioId) => navigate(`/demandas/${demandaId}/tarefas/${task.id}/cenarios/${scenarioId}`)}
                onCreateScenario={() => navigate(`/demandas/${demandaId}/tarefas/${task.id}/cenarios/novo`)}
                onSaveTask={(payload) => void handleSaveTask(task.id, payload)}
                onDeleteTask={() => void handleDeleteTask(task.id)}
                onDeleteScenario={(scenarioId) => void handleDeleteScenario(task.id, scenarioId)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Nenhuma tarefa cadastrada ainda. Crie a primeira frente acima para montar a arvore da demanda.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function TaskTreeCard({
  demandaId,
  task,
  modules,
  portals,
  busy,
  busyScenarioId,
  expanded,
  expandedScenarioIds,
  selectedScenarioIds,
  onToggle,
  onToggleScenario,
  onToggleSelectedScenario,
  onOpenScenario,
  onCreateScenario,
  onSaveTask,
  onDeleteTask,
  onDeleteScenario,
}: {
  demandaId: string
  task: DemandaTarefaRecord
  modules: Array<{ id: string; nome: string; portalId?: string; portalNome?: string }>
  portals: Array<{ id: string; nome: string }>
  busy: boolean
  busyScenarioId: string
  expanded: boolean
  expandedScenarioIds: string[]
  selectedScenarioIds: string[]
  onToggle: () => void
  onToggleScenario: (scenarioId: string) => void
  onToggleSelectedScenario: (scenarioId: string) => void
  onOpenScenario: (scenarioId: string) => void
  onCreateScenario: () => void
  onSaveTask: (payload: {
    titulo: string
    descricao: string
    portalId?: string
    moduleId?: string
    status: string
    ordem: number
  }) => void
  onDeleteTask: () => void
  onDeleteScenario: (scenarioId: string) => void
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [descricao, setDescricao] = useState(task.descricao || '')
  const [portalId, setPortalId] = useState(task.portalId || '')
  const [moduleId, setModuleId] = useState(task.moduleId || '')
  const [status, setStatus] = useState(task.status)
  const [ordem, setOrdem] = useState(String(task.ordem))

  useEffect(() => {
    setTitulo(task.titulo)
    setDescricao(task.descricao || '')
    setPortalId(task.portalId || '')
    setModuleId(task.moduleId || '')
    setStatus(task.status)
    setOrdem(String(task.ordem))
  }, [task.id, task.titulo, task.descricao, task.portalId, task.moduleId, task.status, task.ordem])

  const scenarioCount = task.cenarios?.length || 0

  return (
    <TreeNode
      label={expanded ? 'Tarefa aberta' : 'Tarefa'}
      meta={
        <>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent/35"
          >
            {expanded ? 'Recolher' : 'Expandir'}
          </button>
          <span className="text-sm font-semibold text-foreground">{task.ordem}. {task.titulo}</span>
          <StatusBadge value={task.status} />
          <span className="text-xs uppercase tracking-[0.14em] text-muted">{scenarioCount} cenario(s)</span>
        </>
      }
    >
      {expanded ? (
        <Card className="space-y-5 border-border/80 bg-black/10">
          <div className="grid gap-4 xl:grid-cols-[1.2fr,1.2fr,220px,220px,180px,140px] xl:items-end">
            <Field label="Titulo">
              <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            </Field>

            <Field label="Descricao">
              <Input value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Escopo rapido" />
            </Field>

            <Field label="Portal">
              <select
                value={portalId}
                onChange={(event) => {
                  setPortalId(event.target.value)
                  setModuleId('')
                }}
                className={selectClass}
              >
                <option value="">Nao informado</option>
                {portals.map((portal) => (
                  <option key={portal.id} value={portal.id}>
                    {portal.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modulo">
              <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} className={selectClass}>
                <option value="">Nao informado</option>
                {(portalId ? modules.filter((module) => module.portalId === portalId) : []).map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.portalNome ? `${module.portalNome} / ${module.nome}` : module.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as DemandaTarefaRecord['status'])}
                className={selectClass}
              >
                <option value="Pendente">Pendente</option>
                <option value="Em validacao">Em validacao</option>
                <option value="Concluida">Concluida</option>
              </select>
            </Field>

            <Field label="Ordem">
              <Input value={ordem} onChange={(event) => setOrdem(event.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() =>
                onSaveTask({
                  titulo,
                  descricao,
                  portalId: portalId || undefined,
                  moduleId: moduleId || undefined,
                  status,
                  ordem: Number(ordem || 1),
                })
              }
              disabled={busy}
            >
              {busy ? 'Salvando...' : 'Salvar tarefa'}
            </Button>
            <Button variant="secondary" onClick={onDeleteTask} disabled={busy}>
              Excluir tarefa
            </Button>
          </div>

          <TreeNode
            label="Cenarios"
            meta={
              <>
                <span className="text-sm text-foreground">{scenarioCount} total</span>
                <Button onClick={onCreateScenario}>Adicionar cenario</Button>
              </>
            }
          >
            {task.cenarios && task.cenarios.length > 0 ? (
              <div className="space-y-3">
                {task.cenarios.map((scenario) => (
                  <ScenarioSummaryCard
                    key={scenario.id}
                    demandaId={demandaId}
                    taskId={task.id}
                    scenario={scenario}
                    expanded={expandedScenarioIds.includes(scenario.id)}
                    selected={selectedScenarioIds.includes(scenario.id)}
                    busy={busyScenarioId === scenario.id}
                    onToggle={() => onToggleScenario(scenario.id)}
                    onToggleSelected={() => onToggleSelectedScenario(scenario.id)}
                    onOpen={() => onOpenScenario(scenario.id)}
                    onDelete={() => onDeleteScenario(scenario.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
                Nenhum cenario cadastrado ainda nesta tarefa.
              </div>
            )}
          </TreeNode>

          <TreeNode
            label="Bugs"
            meta={<span className="text-xs uppercase tracking-[0.14em] text-muted">Em breve</span>}
          >
            <div className="rounded-2xl border border-dashed border-border bg-white/[0.02] px-4 py-4 text-sm text-muted">
              Esta ramificacao ja foi reservada para bugs vinculados por tarefa/cenario, mas a integracao ainda nao foi ativada nesta etapa.
            </div>
          </TreeNode>
        </Card>
      ) : null}
    </TreeNode>
  )
}

function ScenarioSummaryCard({
  scenario,
  expanded,
  selected,
  busy,
  onToggle,
  onToggleSelected,
  onOpen,
  onDelete,
}: {
  demandaId: string
  taskId: string
  scenario: DemandaCenarioRecord
  expanded: boolean
  selected: boolean
  busy: boolean
  onToggle: () => void
  onToggleSelected: () => void
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <TreeNode
      label="Cenario"
      meta={
        <>
          <label className="inline-flex items-center gap-2 rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              className="h-4 w-4 rounded border-border bg-black/20 accent-[#a3ff12]"
            />
            DOC
          </label>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent/35"
          >
            {expanded ? 'Recolher' : 'Expandir'}
          </button>
          <span className="text-sm font-semibold text-foreground">{scenario.titulo}</span>
          <StatusBadge value={scenario.status} />
          <span className="text-xs uppercase tracking-[0.14em] text-muted">
            {(scenario.evidencias?.length || 0)} evidencia(s) / {(scenario.frames?.length || 0)} quadro(s)
          </span>
        </>
      }
    >
      {expanded ? (
        <Card className="space-y-4 border-border/70 bg-black/10">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Descricao</p>
              <p className="mt-2 text-sm text-foreground">{scenario.descricao || 'Sem descricao informada.'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Observacoes</p>
              <p className="mt-2 text-sm text-foreground">{scenario.observacoes || 'Sem observacoes informadas.'}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <InfoPill label="Status" value={scenario.status} />
            <InfoPill label="Evidencias" value={String(scenario.evidencias?.length || 0)} />
            <InfoPill label="Quadros" value={String(scenario.frames?.length || 0)} />
            <InfoPill label="Atualizado" value={new Date(scenario.updatedAt).toLocaleDateString('pt-BR')} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={onOpen}>Abrir cenario</Button>
            <Button variant="secondary" onClick={onDelete} disabled={busy}>
              {busy ? 'Excluindo...' : 'Excluir cenario'}
            </Button>
          </div>
        </Card>
      ) : null}
    </TreeNode>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  )
}
