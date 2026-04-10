import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LoadingState } from '@/components/shared/loading-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useProjectScope } from '@/hooks/use-project-scope'
import { useWorkspaceScope } from '@/hooks/use-workspace-scope'
import { useCatalogProjectsQuery } from '@/services/catalog-api'
import { createDemanda, deleteDemanda, useDemandasQuery } from '@/services/demandas-api'

export function DemandasPage() {
  const { selectedProjectId } = useProjectScope()
  const { visibility } = useWorkspaceScope()
  const queryClient = useQueryClient()
  const demandasQuery = useDemandasQuery(visibility)
  const projectsQuery = useCatalogProjectsQuery()

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [projectId, setProjectId] = useState(selectedProjectId || '')
  const [status, setStatus] = useState('Rascunho')
  const [prioridade, setPrioridade] = useState('Media')
  const [responsavelId, setResponsavelId] = useState('')
  const [message, setMessage] = useState('Cadastre demandas evolutivas separadamente dos chamados, com tarefas internas de validacao e escopo.')
  const [isCreating, setIsCreating] = useState(false)
  const [busyDeleteId, setBusyDeleteId] = useState('')

  const records = (demandasQuery.data ?? []).filter((record) =>
    selectedProjectId ? record.projectId === selectedProjectId : true,
  )
  const projects = projectsQuery.data ?? []

  if (demandasQuery.isLoading || projectsQuery.isLoading) {
    return <LoadingState />
  }

  async function handleCreateDemanda(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    try {
      const created = await createDemanda({
        titulo,
        descricao,
        projectId,
        status,
        prioridade,
        responsavelId,
      })

      setMessage(`Demanda ${created.titulo} criada com sucesso.`)
      setTitulo('')
      setDescricao('')
      setResponsavelId('')
      setStatus('Rascunho')
      setPrioridade('Media')
      await queryClient.invalidateQueries({ queryKey: ['demandas'] })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel criar a demanda.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteDemanda(demandaId: string, demandaTitulo: string) {
    if (!window.confirm(`Deseja excluir a demanda "${demandaTitulo}"?`)) return

    setBusyDeleteId(demandaId)
    try {
      await deleteDemanda(demandaId)
      setMessage(`Demanda ${demandaTitulo} excluida com sucesso.`)
      await queryClient.invalidateQueries({ queryKey: ['demandas'] })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel excluir a demanda.')
    } finally {
      setBusyDeleteId('')
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Demandas"
        title="Demandas evolutivas e frentes de validacao"
        description="Organize cards de produto separados dos chamados, com visao geral da demanda e tarefas internas por portal, modulo ou frente."
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <Card className="space-y-4">
          <div>
            <p className="text-sm text-muted">Nova demanda</p>
            <h3 className="font-display text-2xl font-bold text-foreground">Cadastrar demanda</h3>
            <p className="mt-2 text-sm text-muted">{message}</p>
          </div>

          <form className="space-y-4" onSubmit={handleCreateDemanda}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Titulo</span>
              <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Faltas abonadas" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Descricao</span>
              <textarea
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                className="min-h-[140px] rounded-3xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none focus:border-accent/35"
                placeholder="Descreva o objetivo da demanda, contexto funcional e frentes previstas."
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Projeto</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
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
                <span className="text-sm font-semibold text-foreground">Responsavel ID (opcional)</span>
                <Input value={responsavelId} onChange={(event) => setResponsavelId(event.target.value)} placeholder="user-..." />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="Rascunho">Rascunho</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Concluida">Concluida</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Prioridade</span>
                <select
                  value={prioridade}
                  onChange={(event) => setPrioridade(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </label>
            </div>

            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Criando demanda...' : 'Criar demanda'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Listagem</p>
              <h3 className="font-display text-2xl font-bold text-foreground">Demandas cadastradas</h3>
            </div>
            <span className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
              {records.length} demanda(s)
            </span>
          </div>

          {records.length > 0 ? (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 transition hover:border-accent/25"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <Link to={`/demandas/${record.id}`} className="block min-w-0 flex-1">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{record.titulo}</p>
                          <p className="mt-1 text-sm text-muted">{record.projectName || 'Projeto nao informado'}</p>
                          <p className="mt-2 text-sm text-muted line-clamp-2">{record.descricao || 'Sem descricao informada.'}</p>
                          {record.ownerName ? (
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">QA responsavel: {record.ownerName}</p>
                          ) : null}
                        </div>

                        <div className="text-right text-sm text-muted">
                          <div className="flex justify-end gap-2">
                            <StatusBadge value={record.status} />
                            <StatusBadge value={record.prioridade} />
                          </div>
                          <p className="mt-2">{record.tarefasCount} tarefa(s)</p>
                          <p>{new Date(record.updatedAt).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    </Link>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        to={`/demandas/${record.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/5 px-5 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/10"
                      >
                        Abrir
                      </Link>
                      <Button
                        variant="secondary"
                        onClick={() => void handleDeleteDemanda(record.id, record.titulo)}
                        disabled={busyDeleteId === record.id}
                      >
                        {busyDeleteId === record.id ? 'Excluindo...' : 'Excluir'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
              Nenhuma demanda cadastrada ainda.
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
