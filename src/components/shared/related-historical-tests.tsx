import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { HistoricalTestRecommendation } from '@/types/domain'
import { cn } from '@/utils/cn'

interface RelatedHistoricalTestsProps {
  records: HistoricalTestRecommendation[]
  isLoading: boolean
  enabled: boolean
}

export function RelatedHistoricalTests({ records, isLoading, enabled }: RelatedHistoricalTestsProps) {
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm text-muted">Regressao e impacto</p>
        <h3 className="font-display text-xl font-bold text-foreground">Testes historicos parecidos</h3>
        <p className="mt-2 text-sm text-muted">
          Sugestoes automaticas com base no modulo, local de teste, cenario e problema atual para ajudar a antecipar impacto antes da correcao seguir para a master.
        </p>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
          Preencha projeto, modulo principal, local de teste e um resumo do cenario ou problema para buscar historicos relacionados.
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
          Buscando historicos relacionados...
        </div>
      ) : records.length > 0 ? (
        <div className="space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className={cn(
                'rounded-2xl border bg-white/[0.02] p-4',
                record.type === 'regressao_sugerida'
                  ? 'border-accent/35 bg-accent/10 shadow-glow'
                  : 'border-border',
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{record.chamado}</p>
                    <StatusBadge
                      value={record.type === 'regressao_sugerida' ? 'Regressao sugerida' : 'Historico relacionado'}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {record.portalAreaLabel || '-'} · {record.fluxoCenario || 'Sem cenario informado'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={record.resultadoFinal} />
                  {record.temAutomacao ? <StatusBadge value={record.frameworkAutomacao || 'Automacao'} /> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-5">
                <InfoPill label="Projeto" value={record.projeto || '-'} />
                <InfoPill label="Modulo" value={record.modulo || '-'} />
                <InfoPill label="Impactos" value={record.modulosImpactados.join(', ') || '-'} />
                <InfoPill label="Automacao" value={record.automacao === 'sim' ? 'Sim' : 'Nao'} />
                <InfoPill label="Spec" value={record.spec || '-'} />
              </div>

              <p className="mt-4 line-clamp-3 text-sm text-muted">{record.resumoProblema || 'Sem resumo informado.'}</p>

              <div className="mt-4 rounded-2xl border border-border bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Score de impacto</p>
                <p className="mt-2 font-semibold text-foreground">{record.impactScore}</p>
                {record.bugId ? <p className="mt-2 text-sm text-muted">Bug vinculado: {record.bugId}</p> : null}
              </div>

              {record.matchReasons.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {record.matchReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.18em] text-muted">
                  {record.type === 'regressao_sugerida' ? 'Candidato de regressao' : 'Historico relacionado'}
                </span>
                <Link
                  to={`/historical-tests/${encodeURIComponent(record.id)}`}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow"
                >
                  Ver detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
          Nenhum historico relacionado encontrado ate o momento.
        </div>
      )}
    </Card>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
