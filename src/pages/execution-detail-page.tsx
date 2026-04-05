import { Paperclip, UploadCloud, Video } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { useExecutionQuery } from '@/services/mock-api'

const finalStatuses = ['Aprovado', 'Reprovado', 'Bloqueado', 'Parcial'] as const
const evidenceActions = [
  { label: 'Anexar print', icon: Paperclip },
  { label: 'Anexar GIF', icon: Paperclip },
  { label: 'Anexar video', icon: Video },
  { label: 'Anexar log', icon: Paperclip },
]

export function ExecutionDetailPage() {
  const { executionId } = useParams()
  const { data, isLoading } = useExecutionQuery(executionId)

  if (isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Fluxo de teste"
        title={`Execucao ${data.id}`}
        description="Valide o bug com checklist guiado, referencia funcional, observacoes e pacote de evidencias."
        action={<Button>Salvar execucao</Button>}
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Resumo</p>
              <h2 className="font-display text-xl font-bold text-white">{data.bugId}</h2>
            </div>
            <Badge tone="info">{data.status}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Checklist de validacao</p>
              <ul className="mt-3 space-y-3 text-sm text-slate-400">
                {data.checklist.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Passos do teste</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-400">
                {data.steps.map((item, index) => (
                  <li key={item} className="rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2">
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Resultado esperado</p>
              <p className="mt-2 text-sm text-slate-400">{data.expectedResult}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Resultado obtido</p>
              <p className="mt-2 text-sm text-slate-400">{data.obtainedResult}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Observacoes</p>
              <p className="mt-2 text-sm text-slate-400">{data.notes}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-sm text-slate-400">Status final</p>
            <div className="grid grid-cols-2 gap-3">
              {finalStatuses.map((status) => (
                <button
                  key={status}
                  className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-accent/40"
                >
                  {status}
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-white">Area de evidencias</p>
            </div>
            <div className="grid gap-3">
              {evidenceActions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="flex items-center justify-between rounded-2xl border border-dashed border-accent/20 bg-accent/6 px-4 py-4 text-sm text-slate-300"
                >
                  <span>{label}</span>
                  <Icon className="h-4 w-4 text-accent" />
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              Estrutura simulada: Projeto &gt; Modulo &gt; Chamado &gt; Evidencias
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
