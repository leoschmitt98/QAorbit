import { FolderTree } from 'lucide-react'
import { LoadingState } from '@/components/shared/loading-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { useEvidencesQuery } from '@/services/mock-api'
import { formatDate } from '@/utils/format'

export function EvidencePage() {
  const { data, isLoading } = useEvidencesQuery()

  if (isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Biblioteca de evidencias"
        title="Arquivos organizados por contexto operacional"
        description="Visualize prints, GIFs, videos e logs em uma estrutura pronta para auditoria e reuso."
      />

      <section className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold text-white">Estrutura de armazenamento</p>
          </div>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">storage &gt; chamados &gt; TCK-0000 &gt; quadros</div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">Os arquivos reais aparecerao conforme voce capturar e anexar evidencias.</div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {data.length > 0 ? data.map((item) => (
            <Card key={item.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge tone="info">{item.type}</Badge>
                <Badge>{item.size}</Badge>
              </div>
              <div>
                <p className="font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.projectId} · {item.moduleId} · {item.bugId}
                </p>
              </div>
              <p className="text-sm text-slate-400">Registrado em {formatDate(item.date)}</p>
            </Card>
          )) : (
            <Card className="space-y-3 md:col-span-2">
              <p className="font-semibold text-white">Nenhuma evidencia cadastrada ainda</p>
              <p className="text-sm text-slate-400">
                Quando voce anexar prints, GIFs, videos ou logs reais, eles aparecerao aqui.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}
