import type { ComplementaryScenario, Module, ProblemStructuring, RetestExecutionDraft, TicketContext } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import { formatDate } from '@/utils/format'

interface EvidenceBuilderProps {
  title: string
  ticket: TicketContext
  problem: ProblemStructuring
  retest: RetestExecutionDraft
  scenarios: ComplementaryScenario[]
  modules: Module[]
  createdAt: string
  exportMessage?: string
  isExporting?: boolean
  onExport: () => void
}

export function EvidenceBuilder({
  title,
  ticket,
  problem,
  retest,
  scenarios,
  modules,
  createdAt,
  exportMessage,
  isExporting,
  onExport,
}: EvidenceBuilderProps) {
  const moduleName = modules.find((item) => item.id === ticket.moduleId)?.name ?? ticket.moduleId

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Etapa 5</p>
          <h3 className="font-display text-2xl font-bold text-foreground">Consolidacao da evidencia</h3>
        </div>
        <GlowButton onClick={onExport} disabled={isExporting || !ticket.ticketId}>
          {isExporting ? 'Gerando Word...' : 'Gerar Word'}
        </GlowButton>
      </div>

      <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
        {exportMessage ||
          'O documento sera gerado com base no progresso salvo do chamado e nas imagens reais armazenadas em disco.'}
      </div>

      <div className="rounded-3xl border border-border bg-black/20 p-5">
        <div className="space-y-5 text-sm leading-7 text-foreground">
          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Resumo do chamado</p>
            <p className="mt-2 font-semibold">{title}</p>
            <p>
              {ticket.ticketId} · {moduleName} · {ticket.environment} · {ticket.version} · consolidado em{' '}
              {formatDate(createdAt)}
            </p>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Contexto</p>
            <p>{problem.problemDescription}</p>
            <p>Esperado: {problem.expectedBehavior}</p>
            <p>Relatado: {problem.reportedBehavior}</p>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Passos executados</p>
            {retest.steps.map((step, index) => (
              <p key={step.id}>
                {index + 1}. Quadros:{' '}
                {step.frameIds
                  .map((frameId) => retest.frames.find((frame) => frame.id === frameId))
                  .filter(Boolean)
                  .map((frame, frameIndex) => `quadro ${frameIndex + 1}${frame!.description?.trim() ? ` - ${frame!.description}` : ''}`)
                  .join(' | ') || 'sem quadro associado'}{' '}
                Status: {step.status}
              </p>
            ))}
          </section>

          {retest.frames.some((frame) => frame.description?.trim()) ? (
            <section>
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Quadros descritivos</p>
              {retest.frames
                .filter((frame) => frame.description?.trim())
                .map((frame, index) => (
                  <p key={frame.id}>
                    {index + 1}. {frame.description}
                  </p>
                ))}
            </section>
          ) : null}

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Resultado do reteste</p>
            <p>Status final: {retest.status}</p>
            <p>{retest.obtainedBehavior}</p>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Cenarios adicionais</p>
            {scenarios.map((scenario) => (
              <p key={scenario.id}>
                {scenario.description} Esperado: {scenario.expectedResult} Obtido: {scenario.obtainedResult} Status:{' '}
                {scenario.status}
              </p>
            ))}
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Lista de anexos</p>
            <p>
              {[ticket.documentoBaseName, ...ticket.supportAttachments, retest.gifName, ...retest.uploads]
                .filter(Boolean)
                .join(', ')}
            </p>
          </section>
        </div>
      </div>
    </Card>
  )
}
