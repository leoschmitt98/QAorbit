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
  createDemandaCenario,
  createDemandaCenarioEvidencia,
  createDemandaTarefa,
  deleteDemanda,
  deleteDemandaCenario,
  deleteDemandaCenarioEvidencia,
  deleteDemandaTarefa,
  updateDemanda,
  updateDemandaCenario,
  updateDemandaTarefa,
  useDemandaDetailQuery,
} from '@/services/demandas-api'
import type {
  DemandaCenarioRecord,
  DemandaCenarioStatus,
  DemandaCenarioTipo,
  DemandaTarefaRecord,
} from '@/types/domain'

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

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
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
    'Estruture a demanda em formato de arvore: dados gerais no topo, tarefas expansivas no meio e cenarios/evidencias organizados dentro de cada frente.',
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
  const [busyScenarioKey, setBusyScenarioKey] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([])

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

  async function handleCreateScenario(
    tarefaId: string,
    payload: {
      titulo: string
      descricao: string
      tipo: DemandaCenarioTipo
      status: DemandaCenarioStatus
      observacoes: string
    },
  ) {
    const busyKey = `${tarefaId}:create`
    setBusyScenarioKey(busyKey)
    try {
      await createDemandaCenario(demandaId, tarefaId, payload)
      setMessage('Cenario criado com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar o cenario.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleSaveScenario(
    tarefaId: string,
    cenarioId: string,
    payload: {
      titulo: string
      descricao: string
      tipo: DemandaCenarioTipo
      status: DemandaCenarioStatus
      observacoes: string
    },
  ) {
    const busyKey = `${tarefaId}:${cenarioId}`
    setBusyScenarioKey(busyKey)
    try {
      await updateDemandaCenario(demandaId, tarefaId, cenarioId, payload)
      setMessage('Cenario atualizado com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o cenario.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleDeleteScenario(tarefaId: string, cenarioId: string) {
    if (!window.confirm('Deseja excluir este cenario e suas evidencias?')) return
    const busyKey = `${tarefaId}:${cenarioId}`
    setBusyScenarioKey(busyKey)
    try {
      await deleteDemandaCenario(demandaId, tarefaId, cenarioId)
      setMessage('Cenario excluido com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o cenario.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleCreateEvidence(
    tarefaId: string,
    cenarioId: string,
    file: File,
    legenda: string,
    ordem: number,
  ) {
    const busyKey = `${tarefaId}:${cenarioId}:upload`
    setBusyScenarioKey(busyKey)
    try {
      const arquivoDataUrl = await fileToDataUrl(file)
      await createDemandaCenarioEvidencia(demandaId, tarefaId, cenarioId, {
        nomeArquivo: file.name,
        arquivoDataUrl,
        legenda,
        ordem,
      })
      setMessage('Evidencia anexada com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel anexar a evidencia.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleDeleteEvidence(tarefaId: string, cenarioId: string, evidenciaId: string) {
    if (!window.confirm('Deseja remover esta evidencia do cenario?')) return
    const busyKey = `${tarefaId}:${cenarioId}:${evidenciaId}`
    setBusyScenarioKey(busyKey)
    try {
      await deleteDemandaCenarioEvidencia(demandaId, tarefaId, cenarioId, evidenciaId)
      setMessage('Evidencia removida com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover a evidencia.')
    } finally {
      setBusyScenarioKey('')
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Demandas"
        title={detail.titulo}
        description="A demanda agora fica distribuida em uma leitura mais operacional: cabecalho no topo, criacao de tarefa logo abaixo e arvore completa preenchendo a tela com tarefas expansivas."
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
            <Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Ex.: Portal Config" />
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
              As tarefas agora ficam uma embaixo da outra, preenchendo a tela e com expansao propria. Dentro de cada ramo, os cenarios e evidencias continuam editaveis.
            </p>
          </div>
          <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
            {detail.tarefas.length} tarefa(s)
          </span>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-accent/20 bg-accent/6 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Demanda
              </span>
              <p className="font-display text-2xl font-bold text-foreground">{detail.titulo}</p>
              <StatusBadge value={detail.status} />
              <StatusBadge value={detail.prioridade} />
            </div>
            {detail.descricao ? <p className="mt-3 text-sm text-muted">{detail.descricao}</p> : null}
          </div>

          {detail.tarefas.length > 0 ? (
            detail.tarefas
              .slice()
              .sort((left, right) => left.ordem - right.ordem)
              .map((task) => (
                <TaskTreeCard
                  key={task.id}
                  task={task}
                  modules={modules}
                  portals={portals}
                  busy={busyTaskId === task.id}
                  busyScenarioKey={busyScenarioKey}
                  expanded={expandedTaskIds.includes(task.id)}
                  onToggle={() => toggleTask(task.id)}
                  onSaveTask={(payload) => void handleSaveTask(task.id, payload)}
                  onDeleteTask={() => void handleDeleteTask(task.id)}
                  onCreateScenario={(payload) => void handleCreateScenario(task.id, payload)}
                  onSaveScenario={(cenarioId, payload) => void handleSaveScenario(task.id, cenarioId, payload)}
                  onDeleteScenario={(cenarioId) => void handleDeleteScenario(task.id, cenarioId)}
                  onCreateEvidence={(cenarioId, file, legenda, ordem) => void handleCreateEvidence(task.id, cenarioId, file, legenda, ordem)}
                  onDeleteEvidence={(cenarioId, evidenciaId) => void handleDeleteEvidence(task.id, cenarioId, evidenciaId)}
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
  task,
  modules,
  portals,
  busy,
  busyScenarioKey,
  expanded,
  onToggle,
  onSaveTask,
  onDeleteTask,
  onCreateScenario,
  onSaveScenario,
  onDeleteScenario,
  onCreateEvidence,
  onDeleteEvidence,
}: {
  task: DemandaTarefaRecord
  modules: Array<{ id: string; nome: string; portalId?: string; portalNome?: string }>
  portals: Array<{ id: string; nome: string }>
  busy: boolean
  busyScenarioKey: string
  expanded: boolean
  onToggle: () => void
  onSaveTask: (payload: {
    titulo: string
    descricao: string
    portalId?: string
    areaId?: string
    moduleId?: string
    status: string
    ordem: number
  }) => void
  onDeleteTask: () => void
  onCreateScenario: (payload: {
    titulo: string
    descricao: string
    tipo: DemandaCenarioTipo
    status: DemandaCenarioStatus
    observacoes: string
  }) => void
  onSaveScenario: (
    cenarioId: string,
    payload: {
      titulo: string
      descricao: string
      tipo: DemandaCenarioTipo
      status: DemandaCenarioStatus
      observacoes: string
    },
  ) => void
  onDeleteScenario: (cenarioId: string) => void
  onCreateEvidence: (cenarioId: string, file: File, legenda: string, ordem: number) => void
  onDeleteEvidence: (cenarioId: string, evidenciaId: string) => void
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [descricao, setDescricao] = useState(task.descricao || '')
  const [portalId, setPortalId] = useState(task.portalId || '')
  const [moduleId, setModuleId] = useState(task.moduleId || '')
  const [status, setStatus] = useState(task.status)
  const [ordem, setOrdem] = useState(String(task.ordem))

  const [newScenarioTitle, setNewScenarioTitle] = useState('')
  const [newScenarioDescription, setNewScenarioDescription] = useState('')
  const [newScenarioType, setNewScenarioType] = useState<DemandaCenarioTipo>('auxiliar')
  const [newScenarioStatus, setNewScenarioStatus] = useState<DemandaCenarioStatus>('parcial')
  const [newScenarioNotes, setNewScenarioNotes] = useState('')

  useEffect(() => {
    setTitulo(task.titulo)
    setDescricao(task.descricao || '')
    setPortalId(task.portalId || '')
    setModuleId(task.moduleId || '')
    setStatus(task.status)
    setOrdem(String(task.ordem))
  }, [task.id, task.titulo, task.descricao, task.portalId, task.moduleId, task.status, task.ordem])

  const scenarioCount = task.cenarios?.length || 0
  const principalCount = task.cenarios?.filter((scenario) => scenario.tipo === 'principal').length || 0

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
                <span className="text-xs uppercase tracking-[0.14em] text-muted">
                  {principalCount} principal / {Math.max(0, scenarioCount - principalCount)} auxiliares
                </span>
              </>
            }
          >
            <Card className="space-y-4 border-border/70 bg-black/10">
              <div className="grid gap-4 xl:grid-cols-[1.2fr,220px,180px] xl:items-end">
                <Field label="Titulo do cenario">
                  <Input
                    value={newScenarioTitle}
                    onChange={(event) => setNewScenarioTitle(event.target.value)}
                    placeholder="Ex.: Parametro marcado"
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={newScenarioType}
                    onChange={(event) => setNewScenarioType(event.target.value as DemandaCenarioTipo)}
                    className={selectClass}
                  >
                    <option value="auxiliar">Auxiliar</option>
                    <option value="principal">Principal</option>
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={newScenarioStatus}
                    onChange={(event) => setNewScenarioStatus(event.target.value as DemandaCenarioStatus)}
                    className={selectClass}
                  >
                    <option value="parcial">Parcial</option>
                    <option value="passou">Passou</option>
                    <option value="falhou">Falhou</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Field label="Descricao">
                  <textarea
                    value={newScenarioDescription}
                    onChange={(event) => setNewScenarioDescription(event.target.value)}
                    className={textareaClass}
                    placeholder="Descreva rapidamente o fluxo validado neste cenario."
                  />
                </Field>

                <Field label="Observacoes">
                  <textarea
                    value={newScenarioNotes}
                    onChange={(event) => setNewScenarioNotes(event.target.value)}
                    className={textareaClass}
                    placeholder="Opcional"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    onCreateScenario({
                      titulo: newScenarioTitle,
                      descricao: newScenarioDescription,
                      tipo: newScenarioType,
                      status: newScenarioStatus,
                      observacoes: newScenarioNotes,
                    })
                  }
                  disabled={busyScenarioKey === `${task.id}:create`}
                >
                  {busyScenarioKey === `${task.id}:create` ? 'Adicionando...' : 'Adicionar cenario'}
                </Button>
              </div>
            </Card>

            {task.cenarios && task.cenarios.length > 0 ? (
              <div className="space-y-4">
                {task.cenarios.map((scenario) => (
                  <ScenarioTreeCard
                    key={scenario.id}
                    scenario={scenario}
                    busy={busyScenarioKey.startsWith(`${task.id}:${scenario.id}`)}
                    onSave={(payload) => onSaveScenario(scenario.id, payload)}
                    onDelete={() => onDeleteScenario(scenario.id)}
                    onCreateEvidence={(file, legenda, evidenceOrder) => onCreateEvidence(scenario.id, file, legenda, evidenceOrder)}
                    onDeleteEvidence={(evidenciaId) => onDeleteEvidence(scenario.id, evidenciaId)}
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
              Esta coluna da arvore ja foi reservada para bugs vinculados por tarefa/cenario, mas a integracao ainda nao foi ativada nesta etapa.
            </div>
          </TreeNode>
        </Card>
      ) : null}
    </TreeNode>
  )
}

function ScenarioTreeCard({
  scenario,
  busy,
  onSave,
  onDelete,
  onCreateEvidence,
  onDeleteEvidence,
}: {
  scenario: DemandaCenarioRecord
  busy: boolean
  onSave: (payload: {
    titulo: string
    descricao: string
    tipo: DemandaCenarioTipo
    status: DemandaCenarioStatus
    observacoes: string
  }) => void
  onDelete: () => void
  onCreateEvidence: (file: File, legenda: string, ordem: number) => void
  onDeleteEvidence: (evidenciaId: string) => void
}) {
  const [titulo, setTitulo] = useState(scenario.titulo)
  const [descricao, setDescricao] = useState(scenario.descricao || '')
  const [tipo, setTipo] = useState<DemandaCenarioTipo>(scenario.tipo)
  const [status, setStatus] = useState<DemandaCenarioStatus>(scenario.status)
  const [observacoes, setObservacoes] = useState(scenario.observacoes || '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [legenda, setLegenda] = useState('')
  const [ordem, setOrdem] = useState(String((scenario.evidencias?.length || 0) + 1))

  useEffect(() => {
    setTitulo(scenario.titulo)
    setDescricao(scenario.descricao || '')
    setTipo(scenario.tipo)
    setStatus(scenario.status)
    setObservacoes(scenario.observacoes || '')
  }, [scenario.id, scenario.titulo, scenario.descricao, scenario.tipo, scenario.status, scenario.observacoes])

  const isUploading = busy && selectedFile !== null

  return (
    <TreeNode
      label={scenario.tipo === 'principal' ? 'Cenario principal' : 'Cenario auxiliar'}
      meta={
        <>
          <span className="text-sm font-semibold text-foreground">{scenario.titulo}</span>
          <StatusBadge value={scenario.status} />
        </>
      }
    >
      <Card className="space-y-4 border-border/70 bg-black/10">
        <div className="grid gap-4 xl:grid-cols-[1.25fr,220px,180px] xl:items-end">
          <Field label="Titulo">
            <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} />
          </Field>

          <Field label="Tipo">
            <select value={tipo} onChange={(event) => setTipo(event.target.value as DemandaCenarioTipo)} className={selectClass}>
              <option value="principal">Principal</option>
              <option value="auxiliar">Auxiliar</option>
            </select>
          </Field>

          <Field label="Status">
            <select value={status} onChange={(event) => setStatus(event.target.value as DemandaCenarioStatus)} className={selectClass}>
              <option value="passou">Passou</option>
              <option value="falhou">Falhou</option>
              <option value="parcial">Parcial</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="Descricao">
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              className={textareaClass}
              placeholder="Descreva o fluxo validado neste cenario."
            />
          </Field>

          <Field label="Observacoes">
            <textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              className={textareaClass}
              placeholder="Observacoes do QA"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onSave({ titulo, descricao, tipo, status, observacoes })} disabled={busy}>
            {busy ? 'Salvando...' : 'Salvar cenario'}
          </Button>
          <Button variant="secondary" onClick={onDelete} disabled={busy}>
            Excluir cenario
          </Button>
        </div>

        <TreeNode
          label="Evidencias"
          meta={
            <span className="text-xs uppercase tracking-[0.14em] text-muted">
              {(scenario.evidencias?.length || 0)} item(ns)
            </span>
          }
        >
          <Card className="space-y-4 border-border/70 bg-black/10">
            <div className="grid gap-4 xl:grid-cols-[1fr,1fr,140px,auto] xl:items-end">
              <Field label="Arquivo">
                <Input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
              </Field>

              <Field label="Legenda">
                <Input value={legenda} onChange={(event) => setLegenda(event.target.value)} placeholder="Opcional" />
              </Field>

              <Field label="Ordem">
                <Input value={ordem} onChange={(event) => setOrdem(event.target.value)} />
              </Field>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    if (!selectedFile) return
                    onCreateEvidence(selectedFile, legenda, Number(ordem || 1))
                    setSelectedFile(null)
                    setLegenda('')
                    setOrdem(String((scenario.evidencias?.length || 0) + 2))
                  }}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? 'Enviando...' : 'Adicionar evidencia'}
                </Button>
              </div>
            </div>
          </Card>

          {scenario.evidencias && scenario.evidencias.length > 0 ? (
            <div className="space-y-3">
              {scenario.evidencias.map((evidence) => {
                const isImage = evidence.tipoArquivo?.toLowerCase().startsWith('image/')
                return (
                  <div key={evidence.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground">{evidence.nomeArquivo}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted">
                          Criado em {new Date(evidence.createdAt).toLocaleString('pt-BR')}
                        </p>
                        {evidence.legenda ? <p className="text-sm text-muted">{evidence.legenda}</p> : null}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <a
                          href={evidence.urlArquivo}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent/8 px-4 text-sm font-semibold text-foreground transition hover:border-accent/45"
                        >
                          Abrir
                        </a>
                        <Button variant="secondary" onClick={() => onDeleteEvidence(evidence.id)} disabled={busy}>
                          Excluir
                        </Button>
                      </div>
                    </div>

                    {isImage ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black/20">
                        <img src={evidence.urlArquivo} alt={evidence.nomeArquivo} className="max-h-80 w-full object-contain" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Nenhuma evidencia cadastrada neste cenario.
            </div>
          )}
        </TreeNode>
      </Card>
    </TreeNode>
  )
}
