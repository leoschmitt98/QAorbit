import type { ComplementaryScenario, Module, RetestStatus } from '@/types/domain'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/utils/cn'

interface ComplementaryScenariosFormProps {
  scenarios: ComplementaryScenario[]
  modules: Module[]
  impactedModuleIds: string[]
  onScenariosChange: (value: ComplementaryScenario[]) => void
  onImpactedModulesChange: (value: string[]) => void
}

const statuses: RetestStatus[] = ['Aprovado', 'Reprovado', 'Parcial', 'Bloqueado']

export function ComplementaryScenariosForm({
  scenarios,
  modules,
  impactedModuleIds,
  onScenariosChange,
  onImpactedModulesChange,
}: ComplementaryScenariosFormProps) {
  function updateScenario(index: number, partial: Partial<ComplementaryScenario>) {
    const next = [...scenarios]
    next[index] = { ...next[index], ...partial }
    onScenariosChange(next)
  }

  function addScenario() {
    onScenariosChange([
      ...scenarios,
      {
        id: `scn-${scenarios.length + 1}`,
        description: '',
        moduleId: modules[0]?.id ?? '',
        expectedResult: '',
        obtainedResult: '',
        status: 'Parcial',
      },
    ])
  }

  function toggleImpactedModule(moduleId: string) {
    onImpactedModulesChange(
      impactedModuleIds.includes(moduleId)
        ? impactedModuleIds.filter((item) => item !== moduleId)
        : [...impactedModuleIds, moduleId],
    )
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Etapa 4</p>
          <h3 className="font-display text-2xl font-bold text-foreground">Cenarios complementares</h3>
        </div>
        <button className="text-sm font-semibold text-accent" onClick={addScenario} type="button">
          Adicionar cenario
        </button>
      </div>

      <div className="space-y-4">
        {scenarios.map((scenario, index) => (
          <div key={scenario.id} className="space-y-4 rounded-3xl border border-border bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted/70">Cenario {index + 1}</p>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Descricao do cenario</span>
              <textarea
                value={scenario.description}
                onChange={(event) => updateScenario(index, { description: event.target.value })}
                className="min-h-[100px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
              />
            </label>
            <div className="grid gap-4 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Modulo relacionado</span>
                <select
                  value={scenario.moduleId}
                  onChange={(event) => updateScenario(index, { moduleId: event.target.value })}
                  className="h-12 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none focus:border-accent/40"
                >
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm font-semibold text-foreground">Status</span>
                <div className="grid gap-3 md:grid-cols-4">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateScenario(index, { status })}
                      className={cn(
                        'rounded-2xl border px-3 py-3 text-left transition',
                        scenario.status === status
                          ? 'border-accent/35 bg-accent/12 shadow-glow'
                          : 'border-border bg-white/[0.02] hover:border-accent/20',
                      )}
                    >
                      <StatusBadge value={status} />
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Resultado esperado</span>
                <textarea
                  value={scenario.expectedResult}
                  onChange={(event) => updateScenario(index, { expectedResult: event.target.value })}
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Resultado obtido</span>
                <textarea
                  value={scenario.obtainedResult}
                  onChange={(event) => updateScenario(index, { obtainedResult: event.target.value })}
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold text-foreground">Modulos possivelmente impactados</span>
        <div className="flex flex-wrap gap-3">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => toggleImpactedModule(module.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition',
                impactedModuleIds.includes(module.id)
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
