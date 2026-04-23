import type {
  AutomationActionType,
  AutomationSelectorSuggestion,
  AutomationStepElementContext,
  SelectorConfidence,
} from '@/types/automation-blueprint'

function normalizeText(value: string) {
  return String(value || '').trim()
}

function sanitizeClassName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

function escapeContainsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function looksDynamicId(id: string) {
  const normalized = normalizeText(id).toLowerCase()
  if (!normalized) return false

  return (
    /^ext-gen\d+$/.test(normalized) ||
    /^ext-comp-\d+$/.test(normalized) ||
    /^x-gen\d+$/.test(normalized) ||
    /^.*(?:tmp|temp|auto|generated)[-_]?\d+.*$/.test(normalized) ||
    /^[a-z_-]*\d{3,}$/.test(normalized)
  )
}

export function extractContextFromHtml(htmlReference: string): Partial<AutomationStepElementContext> {
  const normalizedHtml = normalizeText(htmlReference)
  if (!normalizedHtml || typeof window === 'undefined') {
    return {}
  }

  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(normalizedHtml, 'text/html')
    const element = document.body.firstElementChild
    if (!element) return {}

    const classAttribute = normalizeText(element.getAttribute('class') || '')

    return {
      elementType: element.tagName.toLowerCase(),
      visibleText: normalizeText(element.textContent || ''),
      elementId: normalizeText(element.getAttribute('id') || ''),
      elementName: normalizeText(element.getAttribute('name') || ''),
      dataTestId:
        normalizeText(element.getAttribute('data-testid') || '') ||
        normalizeText(element.getAttribute('data-test-id') || ''),
      elementClasses: classAttribute ? classAttribute.split(/\s+/).filter(Boolean) : [],
    }
  } catch {
    return {}
  }
}

function chooseSemanticClass(elementClasses: string[]) {
  return elementClasses.find((className) => {
    const normalized = sanitizeClassName(className)
    if (!normalized) return false
    if (/^(x-|ext-|ng-|Mui|css-)/.test(normalized)) return false
    if (/\d{3,}/.test(normalized)) return false
    return normalized.length >= 6
  })
}

function buildSelectorByText(elementType: string, visibleText: string) {
  if (!normalizeText(visibleText)) return ''
  const escapedText = escapeContainsText(visibleText)
  return elementType ? `cy.contains('${elementType}', '${escapedText}')` : `cy.contains('${escapedText}')`
}

function selectorToGetExpression(selector: string) {
  if (!selector) return ''
  if (selector.startsWith('cy.')) return selector
  return `cy.get('${selector}')`
}

export function buildCypressLine(
  action: AutomationActionType,
  selector: string,
  typedValue: string,
  expectedStepResult: string,
) {
  const base = selectorToGetExpression(selector)
  if (!base) {
    return '// Revisão manual: seletor insuficiente para gerar linha Cypress'
  }

  if (action === 'click') return `${base}.click();`
  if (action === 'type') return `${base}.type('${escapeContainsText(typedValue || '')}');`
  if (action === 'select') return `${base}.select('${escapeContainsText(typedValue || '')}');`
  if (action === 'check') return `${base}.check();`
  if (action === 'uncheck') return `${base}.uncheck();`
  if (action === 'radio') return `${base}.check();`
  if (action === 'submit') return `${base}.submit();`
  if (action === 'wait') return `cy.wait(${Number(typedValue || 1000)});`
  if (action === 'navigate') return `cy.visit('${escapeContainsText(typedValue || '')}');`
  if (action === 'validate') {
    const expected = normalizeText(expectedStepResult) || normalizeText(typedValue)
    if (expected) {
      return `cy.contains('${escapeContainsText(expected)}').should('be.visible');`
    }
    return `${base}.should('be.visible');`
  }

  return `${base}.click();`
}

export function suggestSelector(
  context: AutomationStepElementContext,
  action: AutomationActionType,
  typedValue: string,
  expectedStepResult: string,
): AutomationSelectorSuggestion {
  const dataTestId = normalizeText(context.dataTestId)
  const elementId = normalizeText(context.elementId)
  const elementName = normalizeText(context.elementName)
  const visibleText = normalizeText(context.visibleText)
  const elementType = normalizeText(context.elementType)
  const semanticClass = chooseSemanticClass(context.elementClasses)
  const hasDynamicId = looksDynamicId(elementId)

  let suggestedSelector = ''
  let alternativeSelector = ''
  let selectorReason = ''
  let selectorConfidence: SelectorConfidence = 'media'

  if (dataTestId) {
    suggestedSelector = `[data-testid="${dataTestId}"]`
    alternativeSelector = elementId && !hasDynamicId ? `#${elementId}` : buildSelectorByText(elementType, visibleText)
    selectorReason = 'data-testid é o seletor mais estável e explícito para automação.'
    selectorConfidence = 'alta'
  } else if (elementId && !hasDynamicId) {
    suggestedSelector = `#${elementId}`
    alternativeSelector = elementName ? `[name="${elementName}"]` : buildSelectorByText(elementType, visibleText)
    selectorReason = 'ID com aparência estática; bom candidato para seletor principal.'
    selectorConfidence = 'alta'
  } else if (elementName) {
    suggestedSelector = `[name="${elementName}"]`
    alternativeSelector = semanticClass ? `.${semanticClass}` : buildSelectorByText(elementType, visibleText)
    selectorReason = 'Atributo name disponível e mais confiável que identificadores dinâmicos.'
    selectorConfidence = 'media'
  } else if (semanticClass) {
    suggestedSelector = `.${semanticClass}`
    alternativeSelector = buildSelectorByText(elementType, visibleText)
    selectorReason = hasDynamicId
      ? `ID "${elementId}" aparenta ser dinâmico; classe semântica é mais estável.`
      : 'Classe semântica encontrada e mais adequada para automação.'
    selectorConfidence = hasDynamicId ? 'alta' : 'media'
  } else if (visibleText) {
    suggestedSelector = buildSelectorByText(elementType, visibleText)
    alternativeSelector = elementType ? `${elementType}` : ''
    selectorReason = 'Texto visível é a melhor âncora disponível para localizar o elemento.'
    selectorConfidence = 'media'
  } else if (elementType) {
    suggestedSelector = elementType
    alternativeSelector = ''
    selectorReason = 'Apenas o tipo do elemento foi identificado; revisão manual recomendada.'
    selectorConfidence = 'baixa'
  } else {
    suggestedSelector = ''
    alternativeSelector = ''
    selectorReason = 'Não há contexto técnico suficiente para sugerir um seletor confiável.'
    selectorConfidence = 'revisao_manual'
  }

  const needsManualReview =
    !suggestedSelector || selectorConfidence === 'baixa' || selectorConfidence === 'revisao_manual'

  return {
    suggestedSelector,
    alternativeSelector,
    selectorConfidence,
    selectorReason,
    cypressLine: buildCypressLine(action, suggestedSelector || alternativeSelector, typedValue, expectedStepResult),
    needsManualReview,
  }
}
