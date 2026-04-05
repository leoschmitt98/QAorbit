import { Copy, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import type { PromptAnalysisMode } from '@/types/domain'
import { cn } from '@/utils/cn'

interface PromptViewerProps {
  prompt: string
  response: string
  onResponseChange: (value: string) => void
  onCopy: () => void
  mode: PromptAnalysisMode
  onModeChange: (mode: PromptAnalysisMode) => void
  promptNotes: string[]
}

const modeOptions: Array<{
  value: PromptAnalysisMode
  label: string
  description: string
}> = [
  {
    value: 'diagnostico_funcional',
    label: 'Diagnostico funcional',
    description: 'Valida aderencia a regra de negocio, documentacao e cobertura do reteste.',
  },
  {
    value: 'diagnostico_repositorio',
    label: 'Diagnostico no repositorio',
    description: 'Leva o contexto do chamado para o Codex investigar implementacao e impacto no codigo.',
  },
  {
    value: 'testeplan_gherkin',
    label: 'Teste plan Gherkin',
    description: 'Converte chamado, regra e fluxo validado em cenarios Given/When/Then reutilizaveis.',
  },
  {
    value: 'avaliacao_cypress',
    label: 'Avaliacao Cypress',
    description: 'Foca em decidir se vale automatizar e em qual escopo um spec deve nascer.',
  },
]

export function PromptViewer({
  prompt,
  response,
  onResponseChange,
  onCopy,
  mode,
  onModeChange,
  promptNotes,
}: PromptViewerProps) {
  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted">Prompt gerado automaticamente</p>
            <h3 className="font-display text-xl font-bold text-foreground">Builder de prompt cirurgico</h3>
          </div>
          <div className="flex gap-3">
            <GlowButton onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </GlowButton>
            <GlowButton>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir no GPT
            </GlowButton>
          </div>
        </div>

        <div className="grid gap-3">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={cn(
                'rounded-2xl border p-4 text-left transition',
                mode === option.value
                  ? 'border-accent/40 bg-accent/10 shadow-glow'
                  : 'border-border bg-white/[0.02] hover:border-accent/20',
              )}
            >
              <p className="text-sm font-semibold text-foreground">{option.label}</p>
              <p className="mt-1 text-sm text-muted">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Por que este prompt tende a responder melhor</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {promptNotes.map((note) => (
              <span
                key={note}
                className="rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted"
              >
                {note}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-black/20 p-5 text-sm leading-7 text-foreground">
          {prompt || 'O prompt sera montado automaticamente conforme o wizard for preenchido.'}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted">Resposta da IA</p>
          <h3 className="font-display text-xl font-bold text-foreground">Colar resposta manualmente</h3>
        </div>
        <textarea
          value={response}
          onChange={(event) => onResponseChange(event.target.value)}
          className="min-h-[200px] w-full rounded-3xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
          placeholder="Cole aqui a devolutiva do GPT para vincular com projeto, modulo e bug."
        />
      </Card>
    </div>
  )
}
