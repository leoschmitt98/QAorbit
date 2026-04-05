import type { FlowReuseClassification, Module, ReuseCriticality } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { cn } from '@/utils/cn'

interface FlowReuseClassifierProps {
  value: FlowReuseClassification
  modules: Module[]
  onChange: (value: FlowReuseClassification) => void
}

const criticalities: ReuseCriticality[] = ['Baixa', 'Media', 'Alta']

export function FlowReuseClassifier({ value, modules, onChange }: FlowReuseClassifierProps) {
  function update<K extends keyof FlowReuseClassification>(key: K, nextValue: FlowReuseClassification[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  function toggleModule(moduleId: string) {
    update(
      'impactedModuleIds',
      value.impactedModuleIds.includes(moduleId)
        ? value.impactedModuleIds.filter((item) => item !== moduleId)
        : [...value.impactedModuleIds, moduleId],
    )
  }

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-muted">Etapa 6</p>
        <h3 className="font-display text-2xl font-bold text-foreground">Classificacao para reuso</h3>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BooleanField label="Salvar como fluxo reutilizavel" value={value.reusable} onChange={(nextValue) => update('reusable', nextValue)} />
        <BooleanField label="Candidato a automacao" value={value.automationCandidate} onChange={(nextValue) => update('automationCandidate', nextValue)} />
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Modulo principal</span>
          <select
            value={value.mainModuleId}
            onChange={(event) => update('mainModuleId', event.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
          >
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Nome do possivel teste automatizado</span>
          <input
            value={value.automationName}
            onChange={(event) => update('automationName', event.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
          />
        </label>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold text-foreground">Criticidade</span>
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
        <span className="text-sm font-semibold text-foreground">Modulos impactados</span>
        <div className="flex flex-wrap gap-3">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => toggleModule(module.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition',
                value.impactedModuleIds.includes(module.id)
                  ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                  : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
              )}
            >
              {module.name}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface BooleanFieldProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

function BooleanField({ label, value, onChange }: BooleanFieldProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="flex gap-3">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-2xl border px-4 py-3 text-sm transition',
              value === option
                ? 'border-accent/35 bg-accent/12 text-foreground shadow-glow'
                : 'border-border bg-white/[0.02] text-muted hover:border-accent/20',
            )}
          >
            {option ? 'Sim' : 'Nao'}
          </button>
        ))}
      </div>
    </div>
  )
}
