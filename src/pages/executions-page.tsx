import { Link } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { useExecutionsQuery } from '@/services/mock-api'
import { formatDate } from '@/utils/format'

export function ExecutionsPage() {
  const { data, isLoading } = useExecutionsQuery()

  if (isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Execucao guiada"
        title="Trilhas de validacao em andamento"
        description="Execute retestes com contexto funcional completo, checklist e rastreabilidade por resultado."
        action={<Button>Nova execucao</Button>}
      />

      <section className="grid gap-5 xl:grid-cols-3">
        {data.map((execution) => (
          <Card key={execution.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-xl font-bold text-white">{execution.id}</p>
                <p className="text-sm text-slate-500">Bug relacionado: {execution.bugId}</p>
              </div>
              <Badge
                tone={
                  execution.status === 'Aprovado'
                    ? 'success'
                    : execution.status === 'Bloqueado'
                      ? 'danger'
                      : execution.status === 'Parcial'
                        ? 'warning'
                        : 'info'
                }
              >
                {execution.status}
              </Badge>
            </div>
            <div className="grid gap-2 text-sm text-slate-400">
              <span>Tester: {execution.tester}</span>
              <span>Iniciado em: {formatDate(execution.startedAt)}</span>
              <span>{execution.checklist.length} itens no checklist</span>
            </div>
            <p className="text-sm text-slate-500">{execution.expectedResult}</p>
            <Link className="text-sm font-semibold text-accent" to={`/executions/${execution.id}`}>
              Abrir validacao
            </Link>
          </Card>
        ))}
      </section>
    </div>
  )
}
