import type { ProblemStructuring } from '@/types/domain'
import { Card } from '@/components/ui/card'

interface ProblemStructuringFormProps {
  value: ProblemStructuring
  analysisMode?: 'ticket' | 'homologation'
  onChange: (value: ProblemStructuring) => void
}

export function ProblemStructuringForm({ value, analysisMode = 'ticket', onChange }: ProblemStructuringFormProps) {
  const isHomologation = analysisMode === 'homologation'

  function update<K extends keyof ProblemStructuring>(key: K, nextValue: ProblemStructuring[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <Card className="space-y-5">
      <div>
        <p className="text-sm text-muted">Etapa 2</p>
        <h3 className="font-display text-2xl font-bold text-foreground">{isHomologation ? 'Estruturacao da validacao' : 'Estruturacao do problema'}</h3>
        <p className="mt-2 text-sm text-muted">
          {isHomologation
            ? 'Use esta etapa para organizar objetivo, criterios esperados, cobertura e massa de teste da bateria de homologacao.'
            : 'Organize o problema relatado, o comportamento esperado e o que precisa ser comprovado no reteste.'}
        </p>
      </div>

      <div className="grid gap-4">
        <TextAreaField label={isHomologation ? 'Cenario / objetivo da validacao' : 'Descricao do problema'} value={value.problemDescription} onChange={(nextValue) => update('problemDescription', nextValue)} />
        <TextAreaField label={isHomologation ? 'Analise inicial / cobertura planejada' : 'Analise inicial'} value={value.initialAnalysis} onChange={(nextValue) => update('initialAnalysis', nextValue)} />
        <div className="grid gap-4 xl:grid-cols-2">
          <TextAreaField label="Comportamento esperado" value={value.expectedBehavior} onChange={(nextValue) => update('expectedBehavior', nextValue)} />
          <TextAreaField label={isHomologation ? 'Comportamento observado durante a execucao' : 'Comportamento relatado'} value={value.reportedBehavior} onChange={(nextValue) => update('reportedBehavior', nextValue)} />
        </div>
        <TextAreaField label="Regra / documentacao relacionada" value={value.relatedDocumentation} onChange={(nextValue) => update('relatedDocumentation', nextValue)} />
        <TextAreaField label="Dados de teste" value={value.testData} onChange={(nextValue) => update('testData', nextValue)} />
      </div>
    </Card>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function TextAreaField({ label, value, onChange }: TextAreaFieldProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[120px] w-full rounded-2xl border border-border bg-black/20 p-4 text-sm text-foreground outline-none focus:border-accent/40"
      />
    </label>
  )
}
