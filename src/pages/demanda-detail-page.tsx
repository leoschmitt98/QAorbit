import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCatalogAreasQuery, useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import {
  createDemandaCenario,
  createDemandaCenarioEvidencia,
  createDemandaTarefa,
  deleteDemandaCenario,
  deleteDemandaCenarioEvidencia,
  deleteDemandaTarefa,
  updateDemanda,
  updateDemandaCenario,
  updateDemandaTarefa,
  useDemandaDetailQuery,
} from '@/services/demandas-api'
import type { DemandaCenarioRecord, DemandaCenarioStatus, DemandaCenarioTipo } from '@/types/domain'

type TaskPayload = { titulo: string; descricao: string; areaId: string; moduleId: string; status: string; ordem: number }
type ScenarioPayload = { titulo: string; descricao: string; tipo: string; status: string; observacoes: string }

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
  const areasQuery = useCatalogAreasQuery()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('Rascunho')
  const [prioridade, setPrioridade] = useState('Media')
  const [responsavelId, setResponsavelId] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskAreaId, setNewTaskAreaId] = useState('')
  const [newTaskModuleId, setNewTaskModuleId] = useState('')
  const [newTaskStatus, setNewTaskStatus] = useState('Pendente')
  const [message, setMessage] = useState(
    'Mantenha a demanda isolada dos chamados. Use as tarefas para dividir frentes por portal, modulo ou escopo de validacao.',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState('')
  const [busyScenarioKey, setBusyScenarioKey] = useState('')
  const modulesQuery = useCatalogModulesQuery(projectId || detailQuery.data?.projectId || '')

  useEffect(() => {
    if (!detailQuery.data) return
    setTitulo(detailQuery.data.titulo)
    setDescricao(detailQuery.data.descricao)
    setProjectId(detailQuery.data.projectId)
    setStatus(detailQuery.data.status)
    setPrioridade(detailQuery.data.prioridade)
    setResponsavelId(detailQuery.data.responsavelId || '')
  }, [detailQuery.data])

  const areas = areasQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const allModules = modulesQuery.data ?? []
  const newTaskModules = useMemo(
    () =>
      allModules.filter((module) => {
        if (!newTaskAreaId || !module.portalNome) return true
        return module.portalNome === areas.find((area) => area.id === newTaskAreaId)?.nome
      }),
    [allModules, areas, newTaskAreaId],
  )

  if (detailQuery.isLoading || projectsQuery.isLoading || areasQuery.isLoading || modulesQuery.isLoading) return <LoadingState />
  if (!detailQuery.data) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Demanda nao encontrada</p>
        <p className="text-sm text-muted">Essa demanda pode ter sido removida ou voce nao tem acesso a ela.</p>
      </Card>
    )
  }

  const detail = detailQuery.data
  const refreshDetail = async () => {
    await queryClient.invalidateQueries({ queryKey: ['demanda', demandaId] })
    await queryClient.invalidateQueries({ queryKey: ['demandas'] })
  }

  async function handleSaveDemanda() {
    setIsSaving(true)
    try {
      await updateDemanda(demandaId, { titulo, descricao, projectId, status, prioridade, responsavelId })
      setMessage('Dados basicos da demanda atualizados com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a demanda.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddTask() {
    setIsAddingTask(true)
    try {
      await createDemandaTarefa(demandaId, {
        titulo: newTaskTitle,
        descricao: newTaskDescription,
        areaId: newTaskAreaId,
        moduleId: newTaskModuleId,
        status: newTaskStatus,
      })
      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskAreaId('')
      setNewTaskModuleId('')
      setNewTaskStatus('Pendente')
      setMessage('Tarefa criada com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a tarefa.')
    } finally {
      setIsAddingTask(false)
    }
  }

  async function handleUpdateTask(tarefaId: string, payload: TaskPayload) {
    setEditingTaskId(tarefaId)
    try {
      await updateDemandaTarefa(demandaId, tarefaId, payload)
      setMessage('Tarefa atualizada com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a tarefa.')
    } finally {
      setEditingTaskId('')
    }
  }

  async function handleDeleteTask(tarefaId: string) {
    if (!window.confirm('Deseja remover esta tarefa da demanda?')) return
    setEditingTaskId(tarefaId)
    try {
      await deleteDemandaTarefa(demandaId, tarefaId)
      setMessage('Tarefa removida com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover a tarefa.')
    } finally {
      setEditingTaskId('')
    }
  }

  async function handleCreateScenario(tarefaId: string, payload: ScenarioPayload) {
    setBusyScenarioKey(`create:${tarefaId}`)
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

  async function handleUpdateScenario(tarefaId: string, cenarioId: string, payload: ScenarioPayload) {
    setBusyScenarioKey(`update:${cenarioId}`)
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
    if (!window.confirm('Deseja remover este cenario da tarefa?')) return
    setBusyScenarioKey(`delete:${cenarioId}`)
    try {
      await deleteDemandaCenario(demandaId, tarefaId, cenarioId)
      setMessage('Cenario removido com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o cenario.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleCreateScenarioEvidence(
    tarefaId: string,
    cenarioId: string,
    payload: { file: File; legenda: string },
  ) {
    setBusyScenarioKey(`evidence-create:${cenarioId}`)
    try {
      const arquivoDataUrl = await fileToDataUrl(payload.file)
      await createDemandaCenarioEvidencia(demandaId, tarefaId, cenarioId, {
        nomeArquivo: payload.file.name,
        arquivoDataUrl,
        legenda: payload.legenda,
      })
      setMessage('Evidencia anexada com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel anexar a evidencia.')
    } finally {
      setBusyScenarioKey('')
    }
  }

  async function handleDeleteScenarioEvidence(tarefaId: string, cenarioId: string, evidenciaId: string) {
    if (!window.confirm('Deseja remover esta evidencia do cenario?')) return
    setBusyScenarioKey(`evidence-delete:${evidenciaId}`)
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Demandas"
        title={detail.titulo}
        description="Mantenha a demanda principal separada dos chamados e use as tarefas para decompor frentes de validacao ou escopo."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Cabecalho da demanda</p>
              <h2 className="font-display text-xl font-bold text-foreground">Dados basicos</h2>
            </div>
            <div className="flex gap-2">
              <StatusBadge value={detail.status} />
              <StatusBadge value={detail.prioridade} />
            </div>
          </div>

          <div className="grid gap-4">
            <Field label="Titulo"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
            <Field label="Descricao">
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className={textareaClass('min-h-[160px]')} />
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Projeto">
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
                  <option value="">Selecione</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.nome}</option>)}
                </select>
              </Field>
              <Field label="Responsavel ID">
                <Input value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Concluida">Concluida</option>
                </select>
              </Field>
              <Field label="Prioridade">
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={selectClass}>
                  <option value="Baixa">Baixa</option><option value="Media">Media</option><option value="Alta">Alta</option>
                </select>
              </Field>
            </div>
            <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">{message}</div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSaveDemanda()} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar dados basicos'}</Button>
              <Button variant="secondary" onClick={() => navigate('/demandas')}>Voltar para lista</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div><p className="text-sm text-muted">Tarefas internas</p><h2 className="font-display text-xl font-bold text-foreground">Adicionar tarefa</h2></div>
            <div className="grid gap-4">
              <Field label="Titulo"><Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Ex.: Portal do Professor" /></Field>
              <Field label="Descricao"><textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} className={textareaClass('min-h-[120px]')} /></Field>
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Area / Portal">
                  <select value={newTaskAreaId} onChange={(e) => { setNewTaskAreaId(e.target.value); setNewTaskModuleId('') }} className={selectClass}>
                    <option value="">Nao informada</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
                  </select>
                </Field>
                <Field label="Modulo">
                  <select value={newTaskModuleId} onChange={(e) => setNewTaskModuleId(e.target.value)} className={selectClass}>
                    <option value="">Nao informado</option>
                    {newTaskModules.map((module) => <option key={module.id} value={module.id}>{module.portalNome ? `${module.portalNome} / ${module.nome}` : module.nome}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)} className={selectClass}>
                    <option value="Pendente">Pendente</option><option value="Em validacao">Em validacao</option><option value="Concluida">Concluida</option>
                  </select>
                </Field>
              </div>
              <Button onClick={() => void handleAddTask()} disabled={isAddingTask}>{isAddingTask ? 'Criando tarefa...' : 'Adicionar tarefa'}</Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <div><p className="text-sm text-muted">Tarefas cadastradas</p><h2 className="font-display text-xl font-bold text-foreground">{detail.tarefas.length} tarefa(s)</h2></div>
            {detail.tarefas.length > 0 ? (
              <div className="space-y-4">
                {detail.tarefas.map((tarefa) => (
                  <TaskCard
                    key={tarefa.id}
                    tarefa={tarefa}
                    areas={areas}
                    modules={allModules}
                    busy={editingTaskId === tarefa.id}
                    busyScenarioKey={busyScenarioKey}
                    onSave={(payload) => void handleUpdateTask(tarefa.id, payload)}
                    onDelete={() => void handleDeleteTask(tarefa.id)}
                  onCreateScenario={(payload) => void handleCreateScenario(tarefa.id, payload)}
                  onUpdateScenario={(cenarioId, payload) => void handleUpdateScenario(tarefa.id, cenarioId, payload)}
                  onDeleteScenario={(cenarioId) => void handleDeleteScenario(tarefa.id, cenarioId)}
                  onCreateEvidence={(cenarioId, payload) => void handleCreateScenarioEvidence(tarefa.id, cenarioId, payload)}
                  onDeleteEvidence={(cenarioId, evidenciaId) => void handleDeleteScenarioEvidence(tarefa.id, cenarioId, evidenciaId)}
                />
              ))}
              </div>
            ) : <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">Nenhuma tarefa cadastrada ainda.</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}

function TaskCard({
  tarefa, areas, modules, busy, busyScenarioKey, onSave, onDelete, onCreateScenario, onUpdateScenario, onDeleteScenario, onCreateEvidence, onDeleteEvidence,
}: {
  tarefa: { id: string; titulo: string; descricao: string; areaId?: string; moduleId?: string; status: string; ordem: number; cenarios?: DemandaCenarioRecord[] }
  areas: Array<{ id: string; nome: string }>
  modules: Array<{ id: string; nome: string; portalNome?: string }>
  busy: boolean
  busyScenarioKey: string
  onSave: (payload: TaskPayload) => void
  onDelete: () => void
  onCreateScenario: (payload: ScenarioPayload) => void
  onUpdateScenario: (cenarioId: string, payload: ScenarioPayload) => void
  onDeleteScenario: (cenarioId: string) => void
  onCreateEvidence: (cenarioId: string, payload: { file: File; legenda: string }) => void
  onDeleteEvidence: (cenarioId: string, evidenciaId: string) => void
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao)
  const [areaId, setAreaId] = useState(tarefa.areaId || '')
  const [moduleId, setModuleId] = useState(tarefa.moduleId || '')
  const [status, setStatus] = useState(tarefa.status)
  const [ordem, setOrdem] = useState(tarefa.ordem)
  const [newScenarioTitle, setNewScenarioTitle] = useState('')
  const [newScenarioDescription, setNewScenarioDescription] = useState('')
  const [newScenarioType, setNewScenarioType] = useState<DemandaCenarioTipo>('auxiliar')
  const [newScenarioStatus, setNewScenarioStatus] = useState<DemandaCenarioStatus>('parcial')
  const [newScenarioObservations, setNewScenarioObservations] = useState('')

  useEffect(() => {
    setTitulo(tarefa.titulo); setDescricao(tarefa.descricao); setAreaId(tarefa.areaId || ''); setModuleId(tarefa.moduleId || ''); setStatus(tarefa.status); setOrdem(tarefa.ordem)
  }, [tarefa.id, tarefa.titulo, tarefa.descricao, tarefa.areaId, tarefa.moduleId, tarefa.status, tarefa.ordem])

  const filteredModules = useMemo(
    () => modules.filter((module) => !areaId || !module.portalNome || module.portalNome === areas.find((area) => area.id === areaId)?.nome),
    [modules, areaId, areas],
  )

  async function handleCreateScenario() {
    await onCreateScenario({
      titulo: newScenarioTitle,
      descricao: newScenarioDescription,
      tipo: newScenarioType,
      status: newScenarioStatus,
      observacoes: newScenarioObservations,
    })
    setNewScenarioTitle(''); setNewScenarioDescription(''); setNewScenarioType('auxiliar'); setNewScenarioStatus('parcial'); setNewScenarioObservations('')
  }

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[90px,1fr]">
          <Field label="Ordem"><Input value={String(ordem)} onChange={(e) => setOrdem(Number(e.target.value || 0))} /></Field>
          <Field label="Titulo"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
        </div>
        <Field label="Descricao"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className={textareaClass('min-h-[100px]')} /></Field>
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Area">
            <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setModuleId('') }} className={selectClass}>
              <option value="">Nao informada</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
            </select>
          </Field>
          <Field label="Modulo">
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={selectClass}>
              <option value="">Nao informado</option>{filteredModules.map((module) => <option key={module.id} value={module.id}>{module.portalNome ? `${module.portalNome} / ${module.nome}` : module.nome}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="Pendente">Pendente</option><option value="Em validacao">Em validacao</option><option value="Concluida">Concluida</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onSave({ titulo, descricao, areaId, moduleId, status, ordem })} disabled={busy}>{busy ? 'Salvando...' : 'Salvar tarefa'}</Button>
          <Button variant="secondary" onClick={onDelete} disabled={busy}>Excluir</Button>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-black/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm text-muted">Cenarios</p><h3 className="font-display text-lg font-bold text-foreground">{tarefa.cenarios?.length ?? 0} cenario(s)</h3></div>
            <p className="text-right text-xs text-muted">Um cenario principal por tarefa.<br />Cenarios auxiliares ilimitados.</p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-white/[0.02] p-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.9fr]">
              <Field label="Titulo do cenario"><Input value={newScenarioTitle} onChange={(e) => setNewScenarioTitle(e.target.value)} placeholder="Ex.: Validar parametro salvo corretamente" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <select value={newScenarioType} onChange={(e) => setNewScenarioType(e.target.value as DemandaCenarioTipo)} className={selectClass}>
                    <option value="principal">Principal</option><option value="auxiliar">Auxiliar</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select value={newScenarioStatus} onChange={(e) => setNewScenarioStatus(e.target.value as DemandaCenarioStatus)} className={selectClass}>
                    <option value="passou">Passou</option><option value="falhou">Falhou</option><option value="parcial">Parcial</option>
                  </select>
                </Field>
              </div>
            </div>
            <Field label="Descricao"><textarea value={newScenarioDescription} onChange={(e) => setNewScenarioDescription(e.target.value)} className={textareaClass('min-h-[90px]')} placeholder="Descreva rapidamente o fluxo validado neste cenario." /></Field>
            <Field label="Observacoes"><textarea value={newScenarioObservations} onChange={(e) => setNewScenarioObservations(e.target.value)} className={textareaClass('min-h-[80px]')} placeholder="Opcional" /></Field>
            <Button onClick={() => void handleCreateScenario()} disabled={busyScenarioKey === `create:${tarefa.id}`}>{busyScenarioKey === `create:${tarefa.id}` ? 'Criando cenario...' : 'Adicionar cenario'}</Button>
          </div>

          {tarefa.cenarios && tarefa.cenarios.length > 0 ? (
            <div className="space-y-3">
              {tarefa.cenarios.map((cenario) => (
                <ScenarioCard
                  key={cenario.id}
                  cenario={cenario}
                  busy={busyScenarioKey === `update:${cenario.id}` || busyScenarioKey === `delete:${cenario.id}` || busyScenarioKey === `evidence-create:${cenario.id}`}
                  busyScenarioKey={busyScenarioKey}
                  onSave={(payload) => onUpdateScenario(cenario.id, payload)}
                  onDelete={() => onDeleteScenario(cenario.id)}
                  onCreateEvidence={(payload) => onCreateEvidence(cenario.id, payload)}
                  onDeleteEvidence={(evidenciaId) => onDeleteEvidence(cenario.id, evidenciaId)}
                />
              ))}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">Nenhum cenario cadastrado nesta tarefa ainda.</div>}
        </div>
      </div>
    </div>
  )
}

function ScenarioCard({
  cenario, busy, busyScenarioKey, onSave, onDelete, onCreateEvidence, onDeleteEvidence,
}: {
  cenario: DemandaCenarioRecord
  busy: boolean
  busyScenarioKey: string
  onSave: (payload: ScenarioPayload) => void
  onDelete: () => void
  onCreateEvidence: (payload: { file: File; legenda: string }) => void
  onDeleteEvidence: (evidenciaId: string) => void
}) {
  const [titulo, setTitulo] = useState(cenario.titulo)
  const [descricao, setDescricao] = useState(cenario.descricao)
  const [tipo, setTipo] = useState<DemandaCenarioTipo>(cenario.tipo)
  const [status, setStatus] = useState<DemandaCenarioStatus>(cenario.status)
  const [observacoes, setObservacoes] = useState(cenario.observacoes)
  const [selectedEvidenceFile, setSelectedEvidenceFile] = useState<File | null>(null)
  const [evidenceCaption, setEvidenceCaption] = useState('')

  useEffect(() => {
    setTitulo(cenario.titulo); setDescricao(cenario.descricao); setTipo(cenario.tipo); setStatus(cenario.status); setObservacoes(cenario.observacoes)
  }, [cenario.id, cenario.titulo, cenario.descricao, cenario.tipo, cenario.status, cenario.observacoes])

  async function handleCreateEvidence() {
    if (!selectedEvidenceFile) return
    await onCreateEvidence({ file: selectedEvidenceFile, legenda: evidenceCaption })
    setSelectedEvidenceFile(null)
    setEvidenceCaption('')
  }

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm text-muted">Cenario</p><h4 className="font-display text-lg font-bold text-foreground">{cenario.titulo || 'Sem titulo'}</h4></div>
          <div className="flex gap-2"><StatusBadge value={tipo} /><StatusBadge value={status} /></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr,0.9fr]">
          <Field label="Titulo"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as DemandaCenarioTipo)} className={selectClass}>
                <option value="principal">Principal</option><option value="auxiliar">Auxiliar</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as DemandaCenarioStatus)} className={selectClass}>
                <option value="passou">Passou</option><option value="falhou">Falhou</option><option value="parcial">Parcial</option>
              </select>
            </Field>
          </div>
        </div>
        <Field label="Descricao"><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className={textareaClass('min-h-[90px]')} /></Field>
        <Field label="Observacoes"><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={textareaClass('min-h-[80px]')} /></Field>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onSave({ titulo, descricao, tipo, status, observacoes })} disabled={busy}>{busy ? 'Salvando...' : 'Salvar cenario'}</Button>
          <Button variant="secondary" onClick={onDelete} disabled={busy}>Excluir cenario</Button>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-black/10 p-4">
          <div>
            <p className="text-sm text-muted">Evidencias</p>
            <h5 className="font-display text-base font-bold text-foreground">{cenario.evidencias?.length ?? 0} evidencia(s)</h5>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-white/[0.02] p-4">
            <Field label="Arquivo">
              <Input
                type="file"
                onChange={(event) => setSelectedEvidenceFile(event.target.files?.[0] ?? null)}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
            </Field>
            <Field label="Legenda opcional">
              <Input value={evidenceCaption} onChange={(event) => setEvidenceCaption(event.target.value)} placeholder="Ex.: Tela apos salvar com sucesso" />
            </Field>
            <Button onClick={() => void handleCreateEvidence()} disabled={!selectedEvidenceFile || busyScenarioKey === `evidence-create:${cenario.id}`}>
              {busyScenarioKey === `evidence-create:${cenario.id}` ? 'Anexando evidencia...' : 'Adicionar evidencia'}
            </Button>
          </div>

          {cenario.evidencias && cenario.evidencias.length > 0 ? (
            <div className="space-y-3">
              {cenario.evidencias.map((evidencia) => {
                const isImage = evidencia.tipoArquivo?.startsWith('image/')
                return (
                  <div key={evidencia.id} className="rounded-2xl border border-border bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{evidencia.nomeArquivo}</p>
                        <p className="text-xs text-muted">{new Date(evidencia.createdAt).toLocaleString('pt-BR')}</p>
                        {evidencia.legenda ? <p className="text-sm text-muted">{evidencia.legenda}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => window.open(evidencia.urlArquivo, '_blank', 'noopener,noreferrer')}>
                          Abrir
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => onDeleteEvidence(evidencia.id)}
                          disabled={busyScenarioKey === `evidence-delete:${evidencia.id}`}
                        >
                          {busyScenarioKey === `evidence-delete:${evidencia.id}` ? 'Removendo...' : 'Excluir evidencia'}
                        </Button>
                      </div>
                    </div>
                    {isImage ? (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-black/20 p-2">
                        <img src={evidencia.urlArquivo} alt={evidencia.nomeArquivo} className="max-h-48 w-full rounded-xl object-contain" />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Nenhuma evidencia cadastrada neste cenario ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-semibold text-foreground">{label}</span>{children}</label>
}

const selectClass =
  'h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40'

function textareaClass(extra: string) {
  return `${extra} rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35`
}
