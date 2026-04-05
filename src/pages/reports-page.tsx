import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Relatorios"
        title="Indicadores operacionais"
        description="Base pronta para evoluir com KPIs, exportacoes e analytics de regressao por modulo."
      />
      <section className="grid gap-6 xl:grid-cols-3">
        {[
          ['Taxa de aprovacao', '87%', 'Ultimos 30 dias'],
          ['Tempo medio de reteste', '3.8h', 'Execucoes finalizadas'],
          ['Reincidencia por modulo', 'Financeiro', 'Maior concentracao atual'],
        ].map(([title, value, helper]) => (
          <Card key={title} className="space-y-2">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="font-display text-4xl font-bold text-white">{value}</p>
            <p className="text-sm text-slate-500">{helper}</p>
          </Card>
        ))}
      </section>
    </div>
  )
}
