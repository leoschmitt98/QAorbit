import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { DemandaScenarioEvidenceCapture } from '@/components/shared/demanda-scenario-evidence-capture'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  createDemandaCenario,
  createDemandaCenarioEvidencia,
  deleteDemandaCenario,
  deleteDemandaCenarioEvidencia,
  updateDemandaCenario,
  useDemandaDetailQuery,
  useDemandaScenarioDetailQuery,
} from '@/services/demandas-api'
import type { DemandaCenarioRecord, DemandaCenarioStatus } from '@/types/domain'

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

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

const emptyScenario: DemandaCenarioRecord = {
  id: '',
  demandaId: '',
  demandaTarefaId: '',
  titulo: '',
  descricao: '',
  tipo: 'auxiliar',
  status: 'parcial',
  observacoes: '',
  createdAt: '',
  updatedAt: '',
  evidencias: [],
  frames: [],
  gifName: '',
  gifPreviewUrl: '',
}

export function DemandaScenarioPage() {
  const { demandaId = '', tarefaId = '', cenarioId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const normalizedPathname = location.pathname.replace(/\/+$/, '')
  const isNew = cenarioId === 'novo' || normalizedPathname.endsWith('/cenarios/novo')
  const detailQuery = useDemandaDetailQuery(demandaId)
  const scenarioQuery = useDemandaScenarioDetailQuery(demandaId, tarefaId, isNew ? undefined : cenarioId)

  const [scenarioDraft, setScenarioDraft] = useState<DemandaCenarioRecord>(emptyScenario)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [legenda, setLegenda] = useState('')
  const [ordem, setOrdem] = useState('1')
  const [message, setMessage] = useState(
    'Use esta tela para concentrar o cenario: dados funcionais, evidencias e narrativa visual por GIF/quadros.',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false)

  const detail = detailQuery.data
  const task = detail?.tarefas.find((item) => item.id === tarefaId)
  const fallbackScenario = !isNew ? task?.cenarios?.find((item) => item.id === cenarioId) ?? null : null
  const resolvedScenario = scenarioQuery.data ?? fallbackScenario

  useEffect(() => {
    if (isNew) {
      setScenarioDraft({
        ...emptyScenario,
        demandaId,
        demandaTarefaId: tarefaId,
      })
      setOrdem('1')
      return
    }

    if (!resolvedScenario) return
    setScenarioDraft({
      ...resolvedScenario,
      evidencias: resolvedScenario.evidencias ?? [],
      frames: resolvedScenario.frames ?? [],
    })
    setOrdem(String((resolvedScenario.evidencias?.length || 0) + 1))
  }, [demandaId, tarefaId, isNew, resolvedScenario])

  if (detailQuery.isLoading || (!isNew && scenarioQuery.isLoading)) {
    return <LoadingState />
  }

  if (!detail || !task) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Contexto da demanda nao encontrado</p>
        <p className="text-sm text-muted">A demanda ou a tarefa podem nao estar acessiveis no escopo atual.</p>
      </Card>
    )
  }

  if (!isNew && !resolvedScenario) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Cenario nao encontrado</p>
        <p className="text-sm text-muted">
          {scenarioQuery.error instanceof Error
            ? scenarioQuery.error.message
            : 'O cenario pode ter sido removido ou nao estar acessivel neste workspace.'}
        </p>
      </Card>
    )
  }

  async function refreshAll(nextScenarioId?: string) {
    await queryClient.invalidateQueries({ queryKey: ['demanda', demandaId] })
    await queryClient.invalidateQueries({ queryKey: ['demandas'] })
    if (nextScenarioId) {
      await queryClient.invalidateQueries({
        queryKey: ['demanda', demandaId, 'tarefa', tarefaId, 'cenario', nextScenarioId],
      })
    } else if (cenarioId && cenarioId !== 'novo') {
      await queryClient.invalidateQueries({
        queryKey: ['demanda', demandaId, 'tarefa', tarefaId, 'cenario', cenarioId],
      })
    }
  }

  async function handleSaveScenario() {
    setIsSaving(true)
    try {
      if (isNew) {
        const created = await createDemandaCenario(demandaId, tarefaId, {
          titulo: scenarioDraft.titulo,
          descricao: scenarioDraft.descricao,
          status: scenarioDraft.status,
          observacoes: scenarioDraft.observacoes,
        })
        setMessage('Cenario criado com sucesso. Agora voce pode anexar evidencias e extrair quadros do GIF.')
        await refreshAll(created.id)
        navigate(`/demandas/${demandaId}/tarefas/${tarefaId}/cenarios/${created.id}`, { replace: true })
        return
      }

      await updateDemandaCenario(demandaId, tarefaId, cenarioId || '', {
        titulo: scenarioDraft.titulo,
        descricao: scenarioDraft.descricao,
        status: scenarioDraft.status,
        observacoes: scenarioDraft.observacoes,
      })
      setMessage('Cenario atualizado com sucesso.')
      await refreshAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o cenario.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteScenario() {
    if (isNew) {
      navigate(`/demandas/${demandaId}`)
      return
    }

    if (!window.confirm('Deseja excluir este cenario e todo o seu conteudo visual?')) return

    setIsDeleting(true)
    try {
      await deleteDemandaCenario(demandaId, tarefaId, cenarioId || '')
      await refreshAll()
      navigate(`/demandas/${demandaId}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir o cenario.')
      setIsDeleting(false)
    }
  }

  async function handleCreateEvidence() {
    if (!selectedFile || isNew) return

    setIsUploadingEvidence(true)
    try {
      const arquivoDataUrl = await fileToDataUrl(selectedFile)
      const created = await createDemandaCenarioEvidencia(demandaId, tarefaId, cenarioId || '', {
        nomeArquivo: selectedFile.name,
        arquivoDataUrl,
        legenda,
        ordem: Number(ordem || 1),
      })

      setScenarioDraft((current) => ({
        ...current,
        evidencias: [...(current.evidencias ?? []), created],
      }))
      setSelectedFile(null)
      setLegenda('')
      setOrdem(String((scenarioDraft.evidencias?.length || 0) + 2))
      setMessage('Evidencia anexada com sucesso.')
      await refreshAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel anexar a evidencia.')
    } finally {
      setIsUploadingEvidence(false)
    }
  }

  async function handleDeleteEvidence(evidenciaId: string) {
    if (isNew) return
    if (!window.confirm('Deseja remover esta evidencia?')) return

    try {
      await deleteDemandaCenarioEvidencia(demandaId, tarefaId, cenarioId || '', evidenciaId)
      setScenarioDraft((current) => ({
        ...current,
        evidencias: (current.evidencias ?? []).filter((item) => item.id !== evidenciaId),
      }))
      setMessage('Evidencia removida com sucesso.')
      await refreshAll()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover a evidencia.')
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Demandas"
        title={isNew ? 'Novo cenario' : scenarioDraft.titulo || 'Detalhe do cenario'}
        description="Tela dedicada para montar o cenario com calma: dados do fluxo, evidencias anexadas e narracao visual por GIF/quadros."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/demandas/${demandaId}`)}>
              Voltar para demanda
            </Button>
          </div>
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Contexto</p>
            <h2 className="font-display text-2xl font-bold text-foreground">{detail.titulo}</h2>
            <p className="mt-2 text-sm text-muted">Tarefa: {task.ordem}. {task.titulo}</p>
            <p className="mt-2 text-sm text-muted">{message}</p>
          </div>
          {!isNew ? (
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={scenarioDraft.status} />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <p className="text-sm text-muted">Dados do cenario</p>
          <h2 className="font-display text-2xl font-bold text-foreground">Escopo funcional</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr,220px] xl:items-end">
          <Field label="Titulo">
            <Input
              value={scenarioDraft.titulo}
              onChange={(event) => setScenarioDraft((current) => ({ ...current, titulo: event.target.value }))}
              placeholder="Ex.: Parametro marcado"
            />
          </Field>

          <Field label="Status">
            <select
              value={scenarioDraft.status}
              onChange={(event) =>
                setScenarioDraft((current) => ({ ...current, status: event.target.value as DemandaCenarioStatus }))
              }
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
              value={scenarioDraft.descricao}
              onChange={(event) => setScenarioDraft((current) => ({ ...current, descricao: event.target.value }))}
              className={textareaClass}
              placeholder="Descreva o fluxo validado neste cenario."
            />
          </Field>

          <Field label="Observacoes">
            <textarea
              value={scenarioDraft.observacoes}
              onChange={(event) => setScenarioDraft((current) => ({ ...current, observacoes: event.target.value }))}
              className={textareaClass}
              placeholder="Observacoes do QA"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleSaveScenario()} disabled={isSaving}>
            {isSaving ? 'Salvando...' : isNew ? 'Criar cenario' : 'Salvar cenario'}
          </Button>
          <Button variant="secondary" onClick={() => void handleDeleteScenario()} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : isNew ? 'Cancelar' : 'Excluir cenario'}
          </Button>
        </div>
      </Card>

      {!isNew ? (
        <>
          <DemandaScenarioEvidenceCapture
            demandaId={demandaId}
            tarefaId={tarefaId}
            scenario={scenarioDraft}
            onChange={(nextScenario) => setScenarioDraft(nextScenario)}
          />

          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Evidencias do cenario</p>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  {(scenarioDraft.evidencias?.length || 0)} evidencia(s)
                </h2>
              </div>
            </div>

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
                <Button onClick={() => void handleCreateEvidence()} disabled={!selectedFile || isUploadingEvidence}>
                  {isUploadingEvidence ? 'Enviando...' : 'Adicionar evidencia'}
                </Button>
              </div>
            </div>

            {scenarioDraft.evidencias && scenarioDraft.evidencias.length > 0 ? (
              <div className="space-y-3">
                {scenarioDraft.evidencias.map((evidence) => {
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
                          <Button variant="secondary" onClick={() => void handleDeleteEvidence(evidence.id)}>
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
          </Card>
        </>
      ) : (
        <Card className="rounded-3xl border border-dashed border-border bg-white/[0.02] p-6 text-sm text-muted">
          Crie o cenario primeiro. Depois desta gravacao inicial, a tela libera upload de GIF, extracao de quadros e anexos de evidencia.
        </Card>
      )}
    </div>
  )
}
