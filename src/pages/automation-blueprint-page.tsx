import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileJson, FileText, MoveDown, MoveUp, Plus, Trash2, Upload } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/section-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import type { AutomationActionType, AutomationBlueprint, AutomationBlueprintStep } from '@/types/automation-blueprint'
import { downloadBlueprintDocx, downloadBlueprintJson, downloadBlueprintMarkdown } from '@/utils/automation-blueprint-export'
import { buildCypressLine, extractContextFromHtml, suggestSelector } from '@/utils/selector-suggestion'
import { cn } from '@/utils/cn'

const actionOptions: Array<{ value: AutomationActionType; label: string }> = [
  { value: 'click', label: 'Click' },
  { value: 'type', label: 'Type' },
  { value: 'select', label: 'Select' },
  { value: 'check', label: 'Check' },
  { value: 'uncheck', label: 'Uncheck' },
  { value: 'radio', label: 'Radio' },
  { value: 'submit', label: 'Submit' },
  { value: 'validate', label: 'Validate' },
  { value: 'wait', label: 'Wait' },
  { value: 'navigate', label: 'Navigate' },
]

const STORAGE_KEY = 'qa-orbit-automation-blueprint-draft'

function isHtmlSnippet(value: string) {
  return String(value || '').trim().startsWith('<')
}

function isFriendlyElementType(value: string) {
  const normalized = String(value || '').toLowerCase()
  return (
    normalized.includes('caixa') ||
    normalized.includes('combo') ||
    normalized.includes('select') ||
    normalized.includes('mensagem') ||
    normalized.includes('alerta')
  )
}

function createHydratedStep(step: Partial<AutomationBlueprintStep> & Pick<AutomationBlueprintStep, 'id' | 'order'>): AutomationBlueprintStep {
  const baseStep: AutomationBlueprintStep = {
    id: step.id,
    order: step.order,
    title: step.title || '',
    screen: step.screen || '',
    action: step.action || 'click',
    actionLabel: step.actionLabel || '',
    elementType: step.elementType || 'button',
    visibleText: step.visibleText || '',
    htmlReference: step.htmlReference || '',
    elementId: step.elementId || '',
    elementClasses: step.elementClasses || [],
    elementName: step.elementName || '',
    dataTestId: step.dataTestId || '',
    manualSelector: step.manualSelector || '',
    manualAlternativeSelector: step.manualAlternativeSelector || '',
    typedValue: step.typedValue || '',
    expectedStepResult: step.expectedStepResult || '',
    notes: step.notes || '',
    imageUrl: step.imageUrl || '',
    frameId: step.frameId || '',
    suggestedSelector: '',
    alternativeSelector: '',
    selectorConfidence: 'revisao_manual',
    selectorReason: '',
    cypressLine: '',
    needsManualReview: true,
  }

  const htmlFromManualSelector = isHtmlSnippet(baseStep.manualSelector) ? baseStep.manualSelector : ''
  const htmlFromNotes = isHtmlSnippet(baseStep.notes) ? baseStep.notes : ''
  const htmlReference = baseStep.htmlReference || htmlFromManualSelector || htmlFromNotes
  const extractedContext = extractContextFromHtml(htmlReference)
  const manualSelector = htmlFromManualSelector ? '' : baseStep.manualSelector
  const manualAlternativeSelector = isHtmlSnippet(baseStep.manualAlternativeSelector) ? '' : baseStep.manualAlternativeSelector

  const mergedStep: AutomationBlueprintStep = {
    ...baseStep,
    htmlReference,
    manualSelector,
    manualAlternativeSelector,
    elementType:
      extractedContext.elementType && (!baseStep.elementType || isFriendlyElementType(baseStep.elementType))
        ? extractedContext.elementType
        : baseStep.elementType,
    visibleText: baseStep.visibleText || extractedContext.visibleText || '',
    elementId: baseStep.elementId || extractedContext.elementId || '',
    elementName: baseStep.elementName || extractedContext.elementName || '',
    dataTestId: baseStep.dataTestId || extractedContext.dataTestId || '',
    elementClasses:
      baseStep.elementClasses.length > 0 ? baseStep.elementClasses : extractedContext.elementClasses || [],
  }

  const suggestion = suggestSelector(mergedStep, mergedStep.action, mergedStep.typedValue, mergedStep.expectedStepResult)
  const preferredSelector = mergedStep.manualSelector || suggestion.suggestedSelector || suggestion.alternativeSelector
  const fallbackSelector = mergedStep.manualAlternativeSelector || suggestion.alternativeSelector
  const hasManualSelector = Boolean(mergedStep.manualSelector)

  return {
    ...mergedStep,
    ...suggestion,
    suggestedSelector: preferredSelector,
    alternativeSelector: fallbackSelector,
    selectorConfidence: hasManualSelector ? 'alta' : suggestion.selectorConfidence,
    selectorReason: hasManualSelector
      ? 'Seletor principal informado manualmente pelo QA com base no DevTools.'
      : suggestion.selectorReason,
    cypressLine: buildCypressLine(mergedStep.action, preferredSelector, mergedStep.typedValue, mergedStep.expectedStepResult),
    needsManualReview: hasManualSelector ? false : suggestion.needsManualReview,
  }
}

function createEmptyStep(order: number): AutomationBlueprintStep {
  return createHydratedStep({
    id: `manual-flow-step-${Date.now()}-${order}`,
    order,
    title: `Passo ${order}`,
    screen: '',
    action: 'click',
    actionLabel: '',
    elementType: 'button',
    visibleText: '',
    htmlReference: '',
    elementId: '',
    elementClasses: [],
    elementName: '',
    dataTestId: '',
    manualSelector: '',
    manualAlternativeSelector: '',
    typedValue: '',
    expectedStepResult: '',
    notes: '',
    imageUrl: '',
    frameId: '',
  })
}

const exampleBlueprint: AutomationBlueprint = {
  flowName: 'Fluxo manual com DevTools',
  system: 'Aplicacao web',
  module: 'Agendamento',
  objective: 'Montar um documento tecnico passo a passo para outra IA devolver o Cypress pronto.',
  preconditions: 'Usuario autenticado e tela correta aberta.',
  testData: 'Base homologacao | Usuario de teste',
  expectedResult: 'Fluxo documentado com seletores manuais confiaveis.',
  steps: [
    createHydratedStep({
      id: 'manual-flow-example-1',
      order: 1,
      title: 'Clicar em Adicionar Parcial',
      screen: 'Configuracao de Modelos de Avaliacao',
      action: 'click',
      actionLabel: 'Botao principal para incluir uma nova parcial',
      elementType: 'button',
      visibleText: 'Adicionar Parcial',
      manualSelector: '.gvux-configavaliacao-adicionar',
      manualAlternativeSelector: "cy.contains('button', 'Adicionar Parcial')",
      expectedStepResult: 'Formulario da parcial aberto',
      notes: 'Seletor coletado manualmente do DevTools.',
    }),
  ],
}

function hydrateBlueprint(blueprint: AutomationBlueprint): AutomationBlueprint {
  const steps = Array.isArray(blueprint.steps) ? blueprint.steps : []

  return {
    flowName: blueprint.flowName || '',
    system: blueprint.system || '',
    module: blueprint.module || '',
    objective: blueprint.objective || '',
    preconditions: blueprint.preconditions || '',
    testData: blueprint.testData || '',
    expectedResult: blueprint.expectedResult || '',
    steps: steps.map((step, index) =>
      createHydratedStep({
        ...step,
        id: step.id || `manual-flow-step-${Date.now()}-${index + 1}`,
        order: index + 1,
      }),
    ),
  }
}

function loadStoredBlueprint(): AutomationBlueprint {
  if (typeof window === 'undefined') return exampleBlueprint

  try {
    const rawDraft = window.localStorage.getItem(STORAGE_KEY)
    if (!rawDraft) return exampleBlueprint
    return hydrateBlueprint(JSON.parse(rawDraft) as AutomationBlueprint)
  } catch {
    return exampleBlueprint
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm text-muted">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function AutomationBlueprintPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const initialBlueprintRef = useRef<AutomationBlueprint | null>(null)
  if (!initialBlueprintRef.current) {
    initialBlueprintRef.current = loadStoredBlueprint()
  }

  const [blueprint, setBlueprint] = useState<AutomationBlueprint>(() => initialBlueprintRef.current || exampleBlueprint)
  const [selectedStepId, setSelectedStepId] = useState<string>(() => initialBlueprintRef.current?.steps[0]?.id || '')
  const [saveStatus, setSaveStatus] = useState('Rascunho salvo neste navegador')

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blueprint))
      setSaveStatus('Rascunho salvo automaticamente neste navegador')
    } catch {
      setSaveStatus('Nao foi possivel salvar automaticamente neste navegador')
    }
  }, [blueprint])

  const selectedStep = blueprint.steps.find((step) => step.id === selectedStepId) || null

  const consolidatedCypress = useMemo(
    () => blueprint.steps.map((step) => step.cypressLine || '// passo sem linha Cypress').join('\n'),
    [blueprint.steps],
  )

  function updateBlueprint<K extends keyof AutomationBlueprint>(key: K, value: AutomationBlueprint[K]) {
    setBlueprint((current) => ({ ...current, [key]: value }))
  }

  function updateStep(stepId: string, updater: (step: AutomationBlueprintStep) => AutomationBlueprintStep) {
    setBlueprint((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === stepId ? createHydratedStep(updater(step)) : step)),
    }))
  }

  function addStep() {
    setBlueprint((current) => {
      const step = createEmptyStep(current.steps.length + 1)
      setSelectedStepId(step.id)
      return {
        ...current,
        steps: [...current.steps, step],
      }
    })
  }

  function duplicateStep(stepId: string) {
    setBlueprint((current) => {
      const sourceIndex = current.steps.findIndex((step) => step.id === stepId)
      if (sourceIndex < 0) return current

      const sourceStep = current.steps[sourceIndex]
      const duplicatedStep = createHydratedStep({
        ...sourceStep,
        id: `manual-flow-step-${Date.now()}-${current.steps.length + 1}`,
        order: current.steps.length + 1,
        title: `${sourceStep.title || `Passo ${sourceStep.order}`} (copia)`,
      })

      const nextSteps = [
        ...current.steps,
        duplicatedStep,
      ].map((step, index) => createHydratedStep({ ...step, order: index + 1 }))

      setSelectedStepId(duplicatedStep.id)

      return {
        ...current,
        steps: nextSteps,
      }
    })
  }

  function removeStep(stepId: string) {
    setBlueprint((current) => {
      const nextSteps = current.steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => createHydratedStep({ ...step, order: index + 1 }))

      const nextSelected = nextSteps[0]?.id || ''
      setSelectedStepId((currentSelected) => (currentSelected === stepId ? nextSelected : currentSelected))

      return {
        ...current,
        steps: nextSteps,
      }
    })
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    setBlueprint((current) => {
      const steps = [...current.steps]
      const index = steps.findIndex((step) => step.id === stepId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= steps.length) return current

      const temp = steps[index]
      steps[index] = steps[targetIndex]
      steps[targetIndex] = temp

      return {
        ...current,
        steps: steps.map((step, orderIndex) => createHydratedStep({ ...step, order: orderIndex + 1 })),
      }
    })
  }

  async function copyPreview() {
    await navigator.clipboard.writeText(consolidatedCypress)
  }

  async function importBlueprintJson(file: File) {
    try {
      const content = await file.text()
      const importedBlueprint = hydrateBlueprint(JSON.parse(content) as AutomationBlueprint)
      setBlueprint(importedBlueprint)
      setSelectedStepId(importedBlueprint.steps[0]?.id || '')
      setSaveStatus('JSON importado e salvo automaticamente neste navegador')
    } catch {
      setSaveStatus('Nao foi possivel importar o JSON selecionado')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Blueprint de Automacao"
        title="Fluxo manual para documentar a automacao"
        description="Monte um passo a passo sem GIF: adicione passos manuais, informe o nome do botao, o seletor retirado do DevTools e a legenda do passo. No final, exporte em Word para enviar para outra ferramenta ou IA."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copyPreview()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Cypress
            </Button>
            <Button variant="secondary" onClick={() => downloadBlueprintJson(blueprint)}>
              <FileJson className="mr-2 h-4 w-4" />
              Exportar JSON
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Importar JSON
            </Button>
            <Button variant="secondary" onClick={() => downloadBlueprintMarkdown(blueprint)}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar Markdown
            </Button>
            <Button onClick={() => void downloadBlueprintDocx(blueprint)}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Word
            </Button>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importBlueprintJson(file)
        }}
      />

      <div className="rounded-2xl border border-accent/20 bg-accent/8 px-4 py-3 text-sm text-muted">
        {saveStatus}. Se recarregar a pagina neste mesmo navegador, o rascunho sera recuperado automaticamente.
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do fluxo">
              <Input value={blueprint.flowName} onChange={(event) => updateBlueprint('flowName', event.target.value)} />
            </Field>
            <Field label="Sistema / local de teste">
              <Input value={blueprint.system} onChange={(event) => updateBlueprint('system', event.target.value)} />
            </Field>
            <Field label="Modulo">
              <Input value={blueprint.module} onChange={(event) => updateBlueprint('module', event.target.value)} />
            </Field>
            <Field label="Resultado esperado final">
              <Input value={blueprint.expectedResult} onChange={(event) => updateBlueprint('expectedResult', event.target.value)} />
            </Field>
          </div>

          <Field label="Objetivo do fluxo">
            <textarea
              value={blueprint.objective}
              onChange={(event) => updateBlueprint('objective', event.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
              placeholder="Explique o que esse fluxo precisa provar."
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pre-condicoes">
              <textarea
                value={blueprint.preconditions}
                onChange={(event) => updateBlueprint('preconditions', event.target.value)}
                className="min-h-[110px] w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                placeholder="Usuario logado, pagina aberta, massa pronta..."
              />
            </Field>
            <Field label="Massa de teste">
              <textarea
                value={blueprint.testData}
                onChange={(event) => updateBlueprint('testData', event.target.value)}
                className="min-h-[110px] w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                placeholder="Base, unidade, usuario, parametros..."
              />
            </Field>
          </div>

          <Card className="space-y-4 border border-border/80 bg-white/[0.02]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-muted">Passos manuais</p>
                <h2 className="font-display text-xl font-bold text-foreground">Construcao do fluxo</h2>
                <p className="mt-1 text-sm text-muted">Use o botao abaixo para criar passos sem GIF e documentar cada clique manualmente.</p>
              </div>
              <Button variant="secondary" onClick={addStep}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar passo manual
              </Button>
            </div>

            <div className="grid gap-3">
              {blueprint.steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition',
                    selectedStep?.id === step.id ? 'border-accent/35 bg-accent/10 shadow-glow' : 'border-border bg-white/[0.02] hover:border-accent/20',
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Passo {step.order}</p>
                      <p className="font-semibold text-foreground">{step.title || 'Passo sem titulo'}</p>
                      <p className="text-sm text-muted">{step.actionLabel || 'Sem legenda do passo'}</p>
                      <p className="text-xs text-muted">{step.suggestedSelector || 'Sem seletor principal definido'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={step.selectorConfidence} />
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          duplicateStep(step.id)
                        }}
                        title="Copiar passo"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          moveStep(step.id, -1)
                        }}
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          moveStep(step.id, 1)
                        }}
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeStep(step.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="text-sm text-muted">Editor do passo</p>
              <h2 className="font-display text-xl font-bold text-foreground">Detalhes tecnicos do passo</h2>
            </div>

            {selectedStep ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Titulo do passo">
                    <Input value={selectedStep.title} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, title: event.target.value }))} />
                  </Field>
                  <Field label="Tela / modulo">
                    <Input value={selectedStep.screen} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, screen: event.target.value }))} />
                  </Field>
                  <Field label="Acao executada">
                    <select
                      value={selectedStep.action}
                      onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, action: event.target.value as AutomationActionType }))}
                      className="h-11 w-full rounded-2xl border border-border bg-black/20 px-4 text-sm text-foreground outline-none transition focus:border-accent/40"
                    >
                      {actionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Legenda do passo">
                    <Input value={selectedStep.actionLabel} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, actionLabel: event.target.value }))} />
                  </Field>
                  <Field label="Nome do botao / elemento">
                    <Input value={selectedStep.visibleText} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, visibleText: event.target.value }))} />
                  </Field>
                  <Field label="Tipo do elemento">
                    <Input value={selectedStep.elementType} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, elementType: event.target.value }))} />
                  </Field>
                  <Field label="Seletor manual retirado do DevTools">
                    <Input value={selectedStep.manualSelector} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, manualSelector: event.target.value }))} />
                  </Field>
                  <Field label="Seletor alternativo manual">
                    <Input
                      value={selectedStep.manualAlternativeSelector}
                      onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, manualAlternativeSelector: event.target.value }))}
                    />
                  </Field>
                  <Field label="ID identificado">
                    <Input value={selectedStep.elementId} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, elementId: event.target.value }))} />
                  </Field>
                  <Field label="Name identificado">
                    <Input value={selectedStep.elementName} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, elementName: event.target.value }))} />
                  </Field>
                  <Field label="data-testid identificado">
                    <Input value={selectedStep.dataTestId} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, dataTestId: event.target.value }))} />
                  </Field>
                  <Field label="Classes identificadas">
                    <Input
                      value={selectedStep.elementClasses.join(' ')}
                      onChange={(event) =>
                        updateStep(selectedStep.id, (current) => ({
                          ...current,
                          elementClasses: event.target.value.split(/\s+/).map((item) => item.trim()).filter(Boolean),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Valor digitado">
                    <Input value={selectedStep.typedValue} onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, typedValue: event.target.value }))} />
                  </Field>
                  <Field label="Resultado esperado do passo">
                    <Input
                      value={selectedStep.expectedStepResult}
                      onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, expectedStepResult: event.target.value }))}
                    />
                  </Field>
                </div>

                <Field label="HTML de referencia">
                  <textarea
                    value={selectedStep.htmlReference}
                    onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, htmlReference: event.target.value }))}
                    className="min-h-[120px] w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                    placeholder="Cole aqui o HTML cru retirado do DevTools, se quiser complementar."
                  />
                </Field>

                <Field label="Observacoes do passo">
                  <textarea
                    value={selectedStep.notes}
                    onChange={(event) => updateStep(selectedStep.id, (current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-[120px] w-full rounded-2xl border border-border bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent/40"
                    placeholder="Descreva o contexto do clique, cuidado com seletor dinamico e o que a IA precisa observar."
                  />
                </Field>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-white/[0.02] p-4 text-sm text-muted">
                Adicione um passo manual para comecar a documentacao.
              </div>
            )}
          </Card>

          {selectedStep ? (
            <Card className="space-y-4">
              <div>
                <p className="text-sm text-muted">Preview tecnico</p>
                <h2 className="font-display text-xl font-bold text-foreground">Seletor e comando Cypress</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Seletor principal</p>
                  <p className="mt-2 text-sm text-foreground">{selectedStep.suggestedSelector || '-'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Seletor alternativo</p>
                  <p className="mt-2 text-sm text-foreground">{selectedStep.alternativeSelector || '-'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Confianca</p>
                  <StatusBadge value={selectedStep.selectorConfidence} />
                </div>
                <p className="mt-3 text-sm text-muted">{selectedStep.selectorReason || 'Sem justificativa ainda.'}</p>
              </div>

              <div className="rounded-2xl border border-border bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Linha Cypress gerada</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-foreground">{selectedStep.cypressLine || '// passo sem linha Cypress'}</pre>
              </div>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Preview final</p>
                <h2 className="font-display text-xl font-bold text-foreground">Fluxo Cypress consolidado</h2>
              </div>
              <Button variant="secondary" onClick={() => void copyPreview()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-black/30 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-foreground">{consolidatedCypress}</pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
