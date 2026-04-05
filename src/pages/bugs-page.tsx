import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectScope } from '@/hooks/use-project-scope'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useBugsQuery } from '@/services/bug-api'
import { formatDate } from '@/utils/format'

export function BugsPage() {
  const { data, isLoading } = useBugsQuery()
  const { selectedProjectId } = useProjectScope()
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () =>
      (data ?? []).filter((bug) => {
        if (selectedProjectId && bug.projectId !== selectedProjectId) return false

        return [bug.id, bug.ticketId, bug.title, bug.status, bug.projectName, bug.moduleName]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      }),
    [data, search, selectedProjectId],
  )

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Registro de bugs"
        title="Bugs vinculados a chamados salvos"
        description="Abra um bug a partir do contexto real do chamado, detalhe a reproducao e gere um Word voltado para o time de desenvolvimento."
        action={
          <Link to="/bugs/new">
            <Button>Novo bug vinculado</Button>
          </Link>
        }
      />

      <Card className="grid gap-4 lg:grid-cols-[1fr,auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por ID do bug, chamado, titulo, projeto, modulo ou status..."
        />
        <div className="rounded-2xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted">
          {filtered.length} bug(s) encontrado(s)
        </div>
      </Card>

      {filtered.length > 0 ? (
        <section className="grid gap-4">
          {filtered.map((bug) => (
            <Card key={bug.id} className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-display text-2xl font-bold text-foreground">{bug.title}</p>
                  <p className="mt-2 text-sm text-muted">
                    {bug.id} · chamado {bug.ticketId} · {bug.projectName} · {bug.moduleName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={bug.status} />
                  <StatusBadge value={bug.priority} />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-4">
                <InfoBlock label="Severidade" value={bug.severity} />
                <InfoBlock label="Criado em" value={formatDate(bug.createdAt)} />
                <InfoBlock label="Atualizado em" value={formatDate(bug.updatedAt)} />
                <div className="flex items-end">
                  <Link to={`/bugs/${encodeURIComponent(bug.id)}`} className="text-sm font-semibold text-accent">
                    Abrir workspace do bug
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="space-y-3">
          <p className="font-display text-2xl font-bold text-foreground">Nenhum bug vinculado ainda</p>
          <p className="text-sm text-muted">
            Crie o primeiro bug a partir de um chamado salvo para centralizar contexto, reproducao e devolutiva para desenvolvimento.
          </p>
        </Card>
      )}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  )
}
