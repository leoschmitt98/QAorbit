import { useParams } from 'react-router-dom'
import { LoadingState } from '@/components/shared/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { useFunctionalDocumentQuery } from '@/services/functional-docs-api'
import { formatDate } from '@/utils/format'

export function DocumentDetailPage() {
  const { documentId } = useParams()
  const documentQuery = useFunctionalDocumentQuery(documentId)
  const data = documentQuery.data

  if (documentQuery.isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Detalhe documental"
        title={data.title}
        description={data.summary || 'Documento funcional vinculado ao módulo.'}
        action={
          data.downloadUrl ? (
            <a href={data.downloadUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">Abrir arquivo</Button>
            </a>
          ) : undefined
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs font-semibold text-foreground">
              {data.type}
            </span>
            <span className="inline-flex rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-foreground">
              {data.version}
            </span>
            {data.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-semibold text-muted"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="space-y-4 text-sm leading-7 text-muted">
            <p>
              Este documento fica vinculado ao projeto e ao módulo para servir como base funcional reutilizável em chamados,
              prompts para o Codex, diagnósticos técnicos e histórico operacional.
            </p>
            <p>
              O ideal é manter aqui casos de uso, regras de negócio, critérios de aceite e fluxos conhecidos que realmente
              ajudam o QA e o dev a entender o comportamento correto do módulo.
            </p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <p className="text-sm text-muted">Metadados</p>
            <div className="grid gap-3 text-sm text-foreground">
              <span>Projeto: {data.projectName || data.projectId}</span>
              <span>Modulo: {data.moduleName || data.moduleId}</span>
              <span>Autor: {data.author || 'QA Orbit'}</span>
              <span>Atualizado em: {formatDate(data.updatedAt)}</span>
              <span>Arquivo: {data.fileName || '-'}</span>
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-sm text-muted">Arquivo vinculado</p>
            <div className="rounded-3xl border border-dashed border-accent/25 bg-accent/6 p-6">
              <p className="font-semibold text-foreground">{data.fileName || 'Sem arquivo informado'}</p>
              <p className="mt-2 text-sm text-muted">
                O arquivo físico está salvo no storage do QA Orbit e pode ser reutilizado nos chamados e prompts do módulo.
              </p>
              {data.downloadUrl ? (
                <a
                  href={data.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl border border-accent/25 bg-accent/8 px-4 text-sm font-semibold text-foreground"
                >
                  Baixar documento
                </a>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
