import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { SectionHeader } from '@/components/ui/section-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCatalogAreasQuery, useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import {
  createTestPlanStep,
  deleteTestPlanStep,
  finalizeTestPlan,
  updateTestPlan,
  updateTestPlanStep,
  useTestPlanDetailQuery,
} from '@/services/test-plans-api'

export function TestPlanDetailPage() {
  const { testPlanId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const detailQuery = useTestPlanDetailQuery(testPlanId)
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(detailQuery.data?.projectId || '')
  const areasQuery = useCatalogAreasQuery()

  const [titulo, setTitulo] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [projectId, setProjectId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [tipo, setTipo] = useState('')
  const [criticidade, setCriticidade] = useState('')
  const [incluirEmRegressao, setIncluirEmRegressao] = useState(false)
  const [newStepAction, setNewStepAction] = useState('')
  const [newStepExpected, setNewStepExpected] = useState('')
  const [message, setMessage] = useState(
    'Edite o rascunho do Test Plan, monte os passos manualmente no formato que fizer sentido para o seu time e finalize somente quando estiver consistente.',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [editingStepId, setEditingStepId] = useState('')

  useEffect(() => {
    if (!detailQuery.data) return
    setTitulo(detailQuery.data.titulo)
    setObjetivo(detailQuery.data.objetivo)
    setProjectId(detailQuery.data.projectId)
    setModuleId(detailQuery.data.moduleId)
    setAreaId(detailQuery.data.areaId || '')
    setTipo(detailQuery.data.tipo || 'escopo')
    setCriticidade(detailQuery.data.criticidade || '')
    setIncluirEmRegressao(detailQuery.data.incluirEmRegressao)
  }, [detailQuery.data])

  if (detailQuery.isLoading) {
    return <LoadingState />
  }

  if (!detailQuery.data) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Test Plan nao encontrado</p>
        <p className="text-sm text-muted">Esse rascunho pode ter sido removido ou voce nao tem acesso a ele.</p>
      </Card>
    )
  }

  const detail = detailQuery.data
  const projects = projectsQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const areas = areasQuery.data ?? []

  async function refreshDetail() {
    await queryClient.invalidateQueries({ queryKey: ['test-plan', testPlanId] })
    await queryClient.invalidateQueries({ queryKey: ['test-plans'] })
  }

  async function handleSaveBasics() {
    setIsSaving(true)
    try {
      await updateTestPlan(testPlanId, {
        titulo,
        objetivo,
        projectId,
        moduleId,
        areaId,
        tipo,
        criticidade,
        incluirEmRegressao,
      })
      setMessage('Dados basicos do Test Plan atualizados com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o Test Plan.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddStep() {
    setIsAddingStep(true)
    try {
      await createTestPlanStep(testPlanId, {
        acao: newStepAction,
        resultadoEsperado: newStepExpected,
      })
      setNewStepAction('')
      setNewStepExpected('')
      setMessage('Step criado com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar o step.')
    } finally {
      setIsAddingStep(false)
    }
  }

  async function handleUpdateStep(stepId: string, acao: string, resultadoEsperado: string, ordem: number) {
    setEditingStepId(stepId)
    try {
      await updateTestPlanStep(testPlanId, stepId, { acao, resultadoEsperado, ordem })
      setMessage('Step atualizado com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o step.')
    } finally {
      setEditingStepId('')
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!window.confirm('Deseja remover este step do Test Plan?')) return
    setEditingStepId(stepId)
    try {
      await deleteTestPlanStep(testPlanId, stepId)
      setMessage('Step removido com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o step.')
    } finally {
      setEditingStepId('')
    }
  }

  async function handleFinalize() {
    setIsFinalizing(true)
    try {
      await finalizeTestPlan(testPlanId)
      setMessage('Test Plan finalizado com sucesso.')
      await refreshDetail()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel finalizar o Test Plan.')
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Test Plans"
        title={detail.titulo}
        description="Rascunho gerado a partir do fluxo do QA Orbit. Edite os dados basicos, monte os passos manualmente em formato livre ou Gherkin e finalize quando o plano estiver pronto."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Cabecalho do plano</p>
              <h2 className="font-display text-xl font-bold text-foreground">Dados basicos</h2>
            </div>
            <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
              {detail.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
            </span>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Titulo</span>
              <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Objetivo</span>
              <textarea
                value={objetivo}
                onChange={(event) => setObjetivo(event.target.value)}
                className="min-h-[120px] rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Projeto</span>
                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value)
                    setModuleId('')
                  }}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="">Selecione</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Modulo</span>
                <select
                  value={moduleId}
                  onChange={(event) => setModuleId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="">Selecione</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.portalNome ? `${module.portalNome} / ${module.nome}` : module.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Area</span>
                <select
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="">Nao informada</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Criticidade</span>
                <select
                  value={criticidade}
                  onChange={(event) => setCriticidade(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="">Nao definida</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Tipo</span>
              <Input value={tipo} onChange={(event) => setTipo(event.target.value)} placeholder="escopo" />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={incluirEmRegressao}
                onChange={(event) => setIncluirEmRegressao(event.target.checked)}
                className="h-4 w-4 rounded border-border bg-black/20 accent-[#a3ff12]"
              />
              <span>Preparar para incluir em regressao futuramente</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void handleSaveBasics()} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar dados basicos'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/test-plans')}>
                Voltar para lista
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Steps manuais</p>
              <h2 className="font-display text-xl font-bold text-foreground">Montagem do Test Plan</h2>
              <p className="mt-2 text-sm text-muted">{message}</p>
            </div>

            <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Em Gherkin, voce pode usar o primeiro campo para <span className="font-semibold text-foreground">Dado / E / Quando</span> ou deixa-lo em branco
              quando quiser registrar apenas o <span className="font-semibold text-foreground">Entao / resultado esperado</span>.
            </div>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Contexto / dado / quando (opcional)</span>
                <textarea
                  value={newStepAction}
                  onChange={(event) => setNewStepAction(event.target.value)}
                  placeholder="Ex.: Dado que o usuario acesse a configuracao de modelos..."
                  className="min-h-[140px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Entao / resultado esperado</span>
                <textarea
                  value={newStepExpected}
                  onChange={(event) => setNewStepExpected(event.target.value)}
                  placeholder="Ex.: Entao o sistema deve exibir o tipo de avaliacao corretamente."
                  className="min-h-[140px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void handleAddStep()} disabled={isAddingStep}>
                  {isAddingStep ? 'Adicionando...' : 'Adicionar step'}
                </Button>
                <Button onClick={() => void handleFinalize()} disabled={isFinalizing || detail.steps.length < 1}>
                  {isFinalizing ? 'Finalizando...' : 'Finalizar Test Plan'}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Steps cadastrados</p>
                <h2 className="font-display text-xl font-bold text-foreground">{detail.steps.length} step(s)</h2>
              </div>
            </div>

            {detail.steps.length > 0 ? (
              <div className="space-y-4">
                {detail.steps.map((step) => (
                  <EditableStepCard
                    key={step.id}
                    step={step}
                    busy={editingStepId === step.id}
                    onSave={(payload) => void handleUpdateStep(step.id, payload.acao, payload.resultadoEsperado, payload.ordem)}
                    onDelete={() => void handleDeleteStep(step.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
                Nenhum step cadastrado ainda. Nesta V1, os steps sao criados manualmente aqui mesmo.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

interface EditableStepCardProps {
  step: {
    id: string
    ordem: number
    acao: string
    resultadoEsperado: string
  }
  busy: boolean
  onSave: (payload: { ordem: number; acao: string; resultadoEsperado: string }) => void
  onDelete: () => void
}

function EditableStepCard({ step, busy, onSave, onDelete }: EditableStepCardProps) {
  const [ordem, setOrdem] = useState(step.ordem)
  const [acao, setAcao] = useState(step.acao)
  const [resultadoEsperado, setResultadoEsperado] = useState(step.resultadoEsperado)

  useEffect(() => {
    setOrdem(step.ordem)
    setAcao(step.acao)
    setResultadoEsperado(step.resultadoEsperado)
  }, [step.id, step.ordem, step.acao, step.resultadoEsperado])

  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[120px,1fr] lg:items-start">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Ordem</span>
            <Input value={String(ordem)} onChange={(event) => setOrdem(Number(event.target.value || 0))} />
          </label>

          <div className="rounded-2xl border border-border bg-black/10 px-4 py-3 text-xs uppercase tracking-[0.16em] text-muted">
            Step {ordem} no formato livre do time. O primeiro bloco pode ficar vazio quando o foco estiver apenas no resultado esperado.
          </div>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Contexto / dado / quando (opcional)</span>
          <textarea
            value={acao}
            onChange={(event) => setAcao(event.target.value)}
            className="min-h-[120px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Entao / resultado esperado</span>
          <textarea
            value={resultadoEsperado}
            onChange={(event) => setResultadoEsperado(event.target.value)}
            className="min-h-[120px] w-full rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onSave({ ordem, acao, resultadoEsperado })} disabled={busy}>
            {busy ? 'Salvando...' : `Salvar step ${ordem}`}
          </Button>
          <Button variant="secondary" onClick={onDelete} disabled={busy}>
            Excluir
          </Button>
        </div>
      </div>
    </div>
  )
}
