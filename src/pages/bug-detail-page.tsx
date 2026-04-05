import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BugEvidenceCapture } from '@/components/shared/bug-evidence-capture'
import { LoadingState } from '@/components/shared/loading-state'
import { GlowButton } from '@/components/ui/glow-button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { downloadBugDocx, saveBug, useBugQuery } from '@/services/bug-api'
import { listSavedFlows, loadFlowProgress } from '@/services/flow-progress-api'
import type {
  BugEvidenceDraft,
  BugPriority,
  BugReproductionStep,
  BugSeverity,
  BugStatus,
  QaFlowDraftPayload,
} from '@/types/domain'
import { formatDate } from '@/utils/format'

const severities: BugSeverity[] = ['Leve', 'Moderada', 'Alta', 'Bloqueante']
const priorities: BugPriority[] = ['Baixa', 'Media', 'Alta', 'Critica']
const statuses: BugStatus[] = ['Novo', 'Em analise', 'Pronto para dev', 'Corrigido', 'Concluido']
const emptyBugEvidence: BugEvidenceDraft = { gifName: '', gifPreviewUrl: '', frames: [] }

export function BugDetailPage() {
  const { bugId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isCreateMode = !bugId
  const selectedTicketFromQuery = searchParams.get('ticketId')?.trim() || ''

  const savedFlowsQuery = useQuery({
    queryKey: ['saved-flows-for-bug'],
    queryFn: listSavedFlows,
  })
  const bugQuery = useBugQuery(bugId)

  const [selectedTicketId, setSelectedTicketId] = useState(selectedTicketFromQuery)
  const [workflow, setWorkflow] = useState<QaFlowDraftPayload | null>(null)
  const [currentBugId, setCurrentBugId] = useState(bugId || '')
  const [title, setTitle] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [obtainedBehavior, setObtainedBehavior] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('Moderada')
  const [priority, setPriority] = useState<BugPriority>('Media')
  const [status, setStatus] = useState<BugStatus>('Novo')
  const [steps, setSteps] = useState<BugReproductionStep[]>([{ id: `bug-step-${Date.now()}`, order: 1, description: '', observedResult: '' }])
  const [evidence, setEvidence] = useState<BugEvidenceDraft>(emptyBugEvidence)
  const [message, setMessage] = useState('Selecione um chamado salvo para herdar o contexto do bug.')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!isCreateMode && bugQuery.data) {
      const { bug, workflow: bugWorkflow } = bugQuery.data
      setCurrentBugId(bug.id)
      setSelectedTicketId(bug.ticketId)
      setWorkflow(bugWorkflow)
      setTitle(bug.title)
      setExpectedBehavior(bug.expectedBehavior)
      setObtainedBehavior(bug.obtainedBehavior)
      setSeverity(bug.severity)
      setPriority(bug.priority)
      setStatus(bug.status)
      setEvidence(bug.evidence || emptyBugEvidence)
      setSteps(
        bug.reproductionSteps.length > 0
          ? bug.reproductionSteps
          : [{ id: `bug-step-${Date.now()}`, order: 1, description: '', observedResult: '' }],
      )
      setMessage(`Bug ${bug.id} carregado com o contexto herdado do chamado ${bug.ticketId}.`)
    }
  }, [bugQuery.data, isCreateMode])

  useEffect(() => {
    if (!isCreateMode || !selectedTicketId) return

    void (async () => {
      try {
        const draft = await loadFlowProgress(selectedTicketId)
        setWorkflow(draft)
        setMessage(`Contexto do chamado ${selectedTicketId} carregado. Agora voce pode registrar o bug e a reproducao.`)
      } catch (error) {
        setWorkflow(null)
        setMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar o contexto do chamado.')
      }
    })()
  }, [isCreateMode, selectedTicketId])

  const savedFlows = savedFlowsQuery.data ?? []
  const inheritedContext = useMemo(() => {
    if (!workflow) return []
    return [
      ['Numero do chamado', workflow.ticket.ticketId],
      ['Titulo do chamado', workflow.ticket.title],
      ['Projeto', workflow.ticket.projectId],
      ['Modulo principal', workflow.ticket.moduleId],
      ['Portal / Area', workflow.ticket.portalArea],
      ['Ambiente', workflow.ticket.environment],
      ['Versao / Hotfix', workflow.ticket.version],
      ['Origem', workflow.ticket.origin],
      ['Base', workflow.ticket.baseReference || '-'],
      ['DLL / URL', workflow.ticket.accessUrl || '-'],
      ['Usuario', workflow.ticket.username || '-'],
      ['Senha', workflow.ticket.password || '-'],
      ['Empresa', workflow.ticket.companyCode || '-'],
      ['Unidade', workflow.ticket.unitCode || '-'],
      ['Branch', workflow.ticket.branchName || '-'],
      ['Changelog do dev', workflow.ticket.developerChangelog || '-'],
      ['Descricao do problema', workflow.ticket.customerProblemDescription],
      ['Analise inicial', workflow.problem.initialAnalysis || '-'],
      ['Documento base', workflow.ticket.documentoBaseName || '-'],
    ]
  }, [workflow])

  if (!isCreateMode && bugQuery.isLoading) {
    return <LoadingState />
  }

  if (!isCreateMode && bugQuery.error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Relato de bug"
          title="Bug nao encontrado"
          description="Nao foi possivel localizar este bug vinculado. Verifique o ID ou retorne para a listagem."
        />
        <Card className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
          {bugQuery.error instanceof Error ? bugQuery.error.message : 'Erro ao carregar o bug.'}
        </Card>
      </div>
    )
  }

  async function persistBug() {
    if (!selectedTicketId) {
      throw new Error('Selecione um chamado salvo antes de cadastrar o bug.')
    }

    if (!currentBugId.trim()) {
      throw new Error('Informe o ID do bug antes de salvar.')
    }

    const normalizedSteps = steps
      .map((step, index) => ({ ...step, order: index + 1, description: step.description.trim(), observedResult: step.observedResult?.trim() || '' }))
      .filter((step) => step.description)

    if (normalizedSteps.length === 0) {
      throw new Error('Cadastre pelo menos um passo de reproducao para salvar o bug.')
    }

    const response = await saveBug(currentBugId, {
      ticketId: selectedTicketId,
      title,
      expectedBehavior,
      obtainedBehavior,
      severity,
      priority,
      status,
      reproductionSteps: normalizedSteps,
      evidence,
    })
    setSteps(response.bug.reproductionSteps)
    setEvidence(response.bug.evidence)
    return response.bug
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const bug = await persistBug()
      setMessage(`Bug ${bug.id} salvo com sucesso e vinculado ao chamado ${bug.ticketId}.`)
      if (isCreateMode) {
        navigate(`/bugs/${encodeURIComponent(bug.id)}`, { replace: true })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o bug.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const bug = await persistBug()
      await downloadBugDocx(bug.id)
      setMessage(`Word do bug ${bug.id} gerado com sucesso.`)
      if (isCreateMode) {
        navigate(`/bugs/${encodeURIComponent(bug.id)}`, { replace: true })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o Word do bug.')
    } finally {
      setIsExporting(false)
    }
  }

  function updateStep(index: number, partial: Partial<BugReproductionStep>) {
    const next = [...steps]
    next[index] = { ...next[index], ...partial, order: index + 1 }
    setSteps(next)
  }

  function addStep() {
    setSteps((current) => [
      ...current,
      {
        id: `bug-step-${Date.now()}-${current.length + 1}`,
        order: current.length + 1,
        description: '',
        observedResult: '',
      },
    ])
  }

  function removeStep(index: number) {
    setSteps((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((step, nextIndex) => ({ ...step, order: nextIndex + 1 })),
    )
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= steps.length) return
    const next = [...steps]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setSteps(next.map((step, stepIndex) => ({ ...step, order: stepIndex + 1 })))
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Relato de bug"
        title={isCreateMode ? 'Novo bug vinculado a chamado' : `${currentBugId} · Workspace do bug`}
        description="Herde o contexto do chamado, descreva o comportamento do bug e cadastre o passo a passo para reproducao do problema."
        action={
          <div className="flex flex-wrap gap-3">
            <GlowButton onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar bug'}
            </GlowButton>
            <GlowButton onClick={() => void handleExport()} disabled={isExporting || !currentBugId.trim()}>
              {isExporting ? 'Gerando Word...' : 'Gerar Word do bug'}
            </GlowButton>
          </div>
        }
      />

      <Card className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
        {message}
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Vinculo com chamado</p>
            <h3 className="font-display text-xl font-bold text-foreground">Contexto herdado</h3>
          </div>

          {isCreateMode ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Chamado vinculado</span>
              <select
                value={selectedTicketId}
                onChange={(event) => setSelectedTicketId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                <option value="">Selecione um chamado salvo</option>
                {savedFlows.map((flow) => (
                  <option key={flow.ticketId} value={flow.ticketId}>
                    {flow.ticketId} · {flow.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3">
            {inheritedContext.length > 0 ? (
              inheritedContext.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-black/20 px-4 py-3">
                  <p className="text-sm text-muted">{label}</p>
                  <p className="mt-2 font-semibold text-foreground">{value || '-'}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-muted">
                Selecione um chamado salvo para puxar automaticamente o contexto do bug.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Cadastro do bug</p>
            <h3 className="font-display text-xl font-bold text-foreground">Dados principais</h3>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="ID do bug">
              <Input value={currentBugId} onChange={(event) => setCurrentBugId(event.target.value)} placeholder="BUG-0001" />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as BugStatus)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                {statuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Titulo do bug">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Status do agendamento permanece incorreto no painel admin" />
          </Field>

          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Severidade">
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as BugSeverity)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                {severities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as BugPriority)}
                className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
              >
                {priorities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Comportamento esperado">
            <textarea
              value={expectedBehavior}
              onChange={(event) => setExpectedBehavior(event.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </Field>

          <Field label="Comportamento obtido">
            <textarea
              value={obtainedBehavior}
              onChange={(event) => setObtainedBehavior(event.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
            />
          </Field>

          {!isCreateMode && bugQuery.data?.bug ? (
            <div className="rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm">
              <p className="text-muted">Criado em</p>
              <p className="mt-2 font-semibold text-foreground">{formatDate(bugQuery.data.bug.createdAt)}</p>
            </div>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Reproducao do bug</p>
              <h3 className="font-display text-xl font-bold text-foreground">Passo a passo obrigatorio</h3>
            </div>
            <GlowButton onClick={addStep}>+ adicionar passo</GlowButton>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="space-y-4 rounded-3xl border border-border bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted/70">Passo {index + 1}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'up')}
                      className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'down')}
                      className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
                    >
                      Descer
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="rounded-xl border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <Field label="Descricao do passo">
                  <textarea
                    value={step.description}
                    onChange={(event) => updateStep(index, { description: event.target.value })}
                    className="min-h-[96px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
                  />
                </Field>

                <Field label="Resultado observado (opcional)">
                  <textarea
                    value={step.observedResult || ''}
                    onChange={(event) => updateStep(index, { observedResult: event.target.value })}
                    className="min-h-[96px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
                  />
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-sm text-muted">Resumo rapido</p>
            <h3 className="font-display text-xl font-bold text-foreground">Sinalizacao operacional do bug</h3>
          </div>

          <div className="rounded-2xl border border-accent/15 bg-accent/8 p-4">
            <p className="text-sm font-semibold text-foreground">Resumo rapido do bug</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge value={status} />
              <StatusBadge value={severity} />
              <StatusBadge value={priority} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-muted">
            {evidence.frames.length > 0
              ? `${evidence.frames.length} quadro(s) visual(is) do bug ja capturados para o Word do dev.`
              : 'Nenhum quadro do bug foi capturado ainda. Use o GIF abaixo para montar a evidência específica do problema.'}
          </div>
        </Card>
      </section>

      <BugEvidenceCapture ticketId={selectedTicketId} bugId={currentBugId} value={evidence} onChange={setEvidence} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  )
}
