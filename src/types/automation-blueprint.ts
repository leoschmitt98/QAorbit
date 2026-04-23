export type AutomationActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'radio'
  | 'submit'
  | 'validate'
  | 'wait'
  | 'navigate'

export type SelectorConfidence = 'alta' | 'media' | 'baixa' | 'revisao_manual'

export interface AutomationFrame {
  id: string
  name: string
  imageUrl: string
  timestampLabel: string
  timestampMs: number
}

export interface AutomationStepElementContext {
  elementType: string
  visibleText: string
  htmlReference: string
  elementId: string
  elementClasses: string[]
  elementName: string
  dataTestId: string
}

export interface AutomationSelectorSuggestion {
  suggestedSelector: string
  alternativeSelector: string
  selectorConfidence: SelectorConfidence
  selectorReason: string
  cypressLine: string
  needsManualReview: boolean
}

export interface AutomationBlueprintStep extends AutomationStepElementContext, AutomationSelectorSuggestion {
  id: string
  order: number
  title: string
  screen: string
  action: AutomationActionType
  actionLabel: string
  manualSelector: string
  manualAlternativeSelector: string
  typedValue: string
  expectedStepResult: string
  notes: string
  imageUrl: string
  frameId: string
}

export interface AutomationBlueprint {
  flowName: string
  system: string
  module: string
  objective: string
  preconditions: string
  testData: string
  expectedResult: string
  steps: AutomationBlueprintStep[]
}
