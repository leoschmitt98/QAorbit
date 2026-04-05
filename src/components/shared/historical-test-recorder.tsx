import { Card } from '@/components/ui/card'
import { GlowButton } from '@/components/ui/glow-button'
import type { AutomationFramework, HistoricalTestMetadataDraft, Module, PortalArea, ReuseCriticality } from '@/types/domain'
import { cn } from '@/utils/cn'

interface HistoricalTestRecorderProps {
  value: HistoricalTestMetadataDraft
  modules: Module[]
  portalArea: PortalArea
  mainModuleId: string
  onChange: (value: HistoricalTestMetadataDraft) => void
  onSave: (finalizeAfter: boolean) => void
  isSaving: boolean
  message: string
}

const criticalities: ReuseCriticality[] = ['Baixa', 'Media', 'Alta']
const frameworks: AutomationFramework[] = ['Cypress', 'Playwright', 'Outro']

export function HistoricalTestRecorder({
  value,
  modules,
  portalArea,
  mainModuleId,
  onChange,
  onSave,
  isSaving,
  message,
}: HistoricalTestRecorderProps) {
  const selectedMainModule = modules.find((item) => item.id === mainModuleId)?.name ?? mainModuleId ?? '-'

  function update<K extends keyof HistoricalTestMetadataDraft>(key: K, nextValue: HistoricalTestMetadataDraft[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  function toggleTag(rawTag: string) {
    const tag = rawTag.trim()
    if (!tag) return

    update(
      'tags',
      value.tags.includes(tag) ? value.tags.filter((item) => item !== tag) : [...value.tags, tag],
    )
  }

  function updateTags(input: string) {
    update(
      'tags',
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
  }

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-muted">Base historica</p>
        <h3 className="font-display text-2xl font-bold text-foreground">Salvar teste no historico</h3>
        <p className="mt-2 text-sm text-muted">
          Transforme este chamado em memoria reutilizavel por modulo, cenario e automacao para futuras analises de impacto.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InfoField label="Modulo principal" value={selectedMainModule} />
        <InfoField label="Portal / Area" value={portalArea || '-'} />
        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm font-semibold text-foreground">Fluxo / cenario testado</span>
          <input
            value={value.flowScenario}
            onChange={(event) => update('flowScenario', event.target.value)}
            placeholder="Ex: confirmacao de agendamento com alteracao de status"
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Bug vinculado (opcional)</span>
          <input
            value={value.bugId}
            onChange={(event) => update('bugId', event.target.value)}
            placeholder="BUG-142824"
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Caminho do spec Cypress</span>
          <input
            value={value.specPath}
            onChange={(event) => update('specPath', event.target.value)}
            placeholder="cypress/e2e/agendamento/confirmacao-status.cy.ts"
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
            disabled={!value.hasAutomation}
          />
        </label>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold text-foreground">Criticidade historica</span>
        <div className="flex flex-wrap gap-3">
          {criticalities.map((criticality) => (
            <button
              key={criticality}
              type="button"
              onClick={() => update('criticality', criticality)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition',
                value.criticality === criticality
                  ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                  : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
              )}
            >
              {criticality}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold text-foreground">Tags</span>
        <input
          value={value.tags.join(', ')}
          onChange={(event) => updateTags(event.target.value)}
          placeholder="regressao, status, agendamento"
          className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
        />
        <div className="flex flex-wrap gap-3">
          {['regressao', 'critico', 'cadastro', 'financeiro', 'status', 'fluxo-ui'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition',
                value.tags.includes(tag)
                  ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                  : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Tem automacao?</span>
          <div className="flex gap-3">
            {[true, false].map((option) => (
              <button
                key={String(option)}
                type="button"
                onClick={() => update('hasAutomation', option)}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-sm transition',
                  value.hasAutomation === option
                    ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                    : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
                )}
              >
                {option ? 'Sim' : 'Nao'}
              </button>
            ))}
          </div>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Framework</span>
          <select
            value={value.automationFramework}
            onChange={(event) => update('automationFramework', event.target.value as AutomationFramework)}
            disabled={!value.hasAutomation}
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40 disabled:opacity-50"
          >
            {frameworks.map((framework) => (
              <option key={framework} value={framework}>
                {framework}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <GlowButton onClick={() => onSave(false)} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar no historico'}
        </GlowButton>
        <GlowButton onClick={() => onSave(true)} disabled={isSaving}>
          {isSaving ? 'Finalizando...' : 'Finalizar e salvar no historico'}
        </GlowButton>
      </div>

      <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
        {message}
      </div>
    </Card>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  )
}
