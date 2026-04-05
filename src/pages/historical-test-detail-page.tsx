import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { SectionHeader } from '@/components/ui/section-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { useCatalogModulesQuery, useCatalogProjectsQuery } from '@/services/catalog-api'
import { loadHistoricalTest } from '@/services/historical-tests-api'

export function HistoricalTestDetailPage() {
  const { recordId = '' } = useParams()
  const recordQuery = useQuery({
    queryKey: ['historical-test', recordId],
    queryFn: () => loadHistoricalTest(recordId),
    enabled: Boolean(recordId),
  })
  const projectsQuery = useCatalogProjectsQuery()
  const modulesQuery = useCatalogModulesQuery(recordQuery.data?.projectId || '')

  const record = recordQuery.data
  const projectName = projectsQuery.data?.find((item) => item.id === record?.projectId)?.nome ?? record?.projectId ?? '-'
  const mainModuleName = modulesQuery.data?.find((item) => item.id === record?.modulePrincipalId)?.nome ?? record?.modulePrincipalId ?? '-'

  if (!record) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-foreground">Carregando registro historico...</p>
        <p className="text-sm text-muted">Assim que o registro for carregado, os detalhes aparecem aqui.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Historico de testes"
        title={record.fluxoCenario}
        description="Consulte o contexto completo do teste historico, evidencias registradas e referencias prontas para futura analise de impacto."
      />

      <Card className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-display text-2xl font-bold text-foreground">{record.ticketId}</p>
            <p className="mt-2 text-sm text-muted">
              {projectName} · {mainModuleName} · {record.portalArea || '-'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={record.resultadoFinal} />
            <StatusBadge value={record.criticidade} />
            {record.temAutomacao ? <StatusBadge value={record.frameworkAutomacao || 'Automacao'} /> : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <InfoBlock label="Chamado vinculado" value={record.ticketId} />
          <InfoBlock label="Bug vinculado" value={record.bugId || '-'} />
          <InfoBlock label="Modulos impactados" value={String(record.modulosImpactados.length)} />
          <InfoBlock label="Criado em" value={new Date(record.dataCriacao).toLocaleString('pt-BR')} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="space-y-5">
          <SectionTitle text="Contexto funcional" />
          <DetailLine label="Resumo do problema" value={record.resumoProblema || '-'} multiline />
          <DetailLine label="Comportamento esperado" value={record.comportamentoEsperado || '-'} multiline />
          <DetailLine label="Comportamento obtido" value={record.comportamentoObtido || '-'} multiline />
          <DetailLine label="Tags" value={record.tags.join(', ') || '-'} />
          <DetailLine label="Automacao" value={record.temAutomacao ? record.frameworkAutomacao || 'Sim' : 'Nao'} />
          <DetailLine label="Caminho do spec" value={record.caminhoSpec || '-'} />
        </Card>

        <Card className="space-y-5">
          <SectionTitle text="Acoes e rastreabilidade" />
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/analysis/new?ticketId=${encodeURIComponent(record.ticketId)}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-accent/35 bg-accent/12 px-4 text-sm font-semibold text-foreground shadow-glow"
            >
              Abrir chamado
            </Link>
            {record.bugId ? (
              <Link
                to={`/bugs/${encodeURIComponent(record.bugId)}`}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.02] px-4 text-sm font-semibold text-foreground transition hover:border-accent/20"
              >
                Abrir bug
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {record.documentoWordUrl ? (
              <a
                href={record.documentoWordUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.02] px-4 text-sm font-semibold text-foreground transition hover:border-accent/20"
              >
                Word do chamado
              </a>
            ) : null}
            {record.bugWordUrl ? (
              <a
                href={record.bugWordUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/[0.02] px-4 text-sm font-semibold text-foreground transition hover:border-accent/20"
              >
                Word do bug
              </a>
            ) : null}
          </div>
          <div className="rounded-2xl border border-accent/15 bg-accent/8 p-4">
            <p className="text-sm font-semibold text-foreground">Analisar impacto historico</p>
            <p className="mt-2 text-sm text-muted">
              Estrutura pronta para montar contexto com modulo atual, cenario, registros parecidos, modulos impactados e automacao existente.
            </p>
            <div className="mt-4">
              <GlowButton disabled>Analisar impacto historico</GlowButton>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-5">
        <SectionTitle text="Evidencias historicas" />
        {record.evidencias.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {record.evidencias.map((frame, index) => (
              <div key={frame.id} className="rounded-3xl border border-border bg-white/[0.02] p-3">
                <img src={frame.imageUrl} alt={frame.name} className="h-48 w-full rounded-2xl object-contain" />
                <p className="mt-3 font-semibold text-foreground">Passo {index + 1}</p>
                {frame.description ? <p className="mt-2 text-sm text-muted">{frame.description}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhuma evidencia visual foi registrada neste historico.</p>
        )}
      </Card>
    </div>
  )
}

function SectionTitle({ text }: { text: string }) {
  return <p className="font-display text-xl font-bold text-foreground">{text}</p>
}

function DetailLine({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 font-semibold text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
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
