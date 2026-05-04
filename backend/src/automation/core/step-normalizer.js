import {
  AUTOMATION_FRAMEWORKS,
  AUTOMATION_LANGUAGES,
  AUTOMATION_PATTERNS,
  AUTOMATION_STEP_ACTIONS,
  AUTOMATION_TYPES,
  pushWarning,
  sanitizeSlug,
} from './automation-types.js'

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  return allowed.includes(normalized) ? normalized : fallback
}

function mapLegacyAction(action) {
  switch (String(action || '').trim()) {
    case 'type':
      return 'fill'
    case 'assertVisible':
      return 'assertText'
    case 'submit':
      return 'click'
    case 'check':
    case 'uncheck':
      return 'click'
    default:
      return String(action || 'click').trim()
  }
}

function normalizeLegacyStep(step = {}, index) {
  const target = step.target || {}
  const action = mapLegacyAction(step.action)

  return {
    action: AUTOMATION_STEP_ACTIONS.includes(action) ? action : 'click',
    targetName: String(target.text || target.selector || step.name || `Passo ${index + 1}`).trim(),
    selector: String(target.selector || '').trim(),
    value: step.value == null ? '' : String(step.value),
    expected: step.expected == null ? String(target.text || step.expectedResult || '').trim() : String(step.expected),
    notes: String(step.warning || step.improvementSuggestion || '').trim(),
    order: Number(step.order || index + 1),
    legacyTarget: target,
    legacyAction: step.action,
  }
}

function normalizeNeutralStep(step = {}, index) {
  const action = normalizeChoice(step.action, AUTOMATION_STEP_ACTIONS, 'click')

  return {
    action,
    targetName: String(step.targetName || step.selector || `Passo ${index + 1}`).trim(),
    selector: String(step.selector || '').trim(),
    value: step.value == null ? '' : String(step.value),
    expected: step.expected == null ? '' : String(step.expected),
    notes: String(step.notes || '').trim(),
    order: Number(step.order || index + 1),
  }
}

export function normalizeAutomationBlueprint(input = {}, options = {}) {
  const warnings = []
  const isLegacy = !input.framework && Array.isArray(input.steps) && input.steps.some((step) => step?.target)
  const name = String(input.name || input.flowName || options.suiteName || 'Automacao QA Orbit').trim()
  const framework = normalizeChoice(options.framework || input.framework, AUTOMATION_FRAMEWORKS, 'cypress')
  const languageFallback = framework === 'playwright' ? 'typescript' : 'javascript'
  const language = normalizeChoice(options.language || input.language, AUTOMATION_LANGUAGES, languageFallback)
  const type = normalizeChoice(options.type || input.type, AUTOMATION_TYPES, 'web-e2e')
  const pattern = normalizeChoice(options.pattern || input.pattern, AUTOMATION_PATTERNS, 'simple')
  const baseUrl = String(options.baseUrl || input.baseUrl || input.startUrl || '').trim()
  const specName = String(options.specName || input.specName || `${sanitizeSlug(name)}.spec.js`).trim()
  const sourceSteps = Array.isArray(input.steps) ? input.steps : []
  const steps = sourceSteps
    .map((step, index) => (isLegacy ? normalizeLegacyStep(step, index) : normalizeNeutralStep(step, index)))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))

  if (type !== 'web-e2e') {
    pushWarning(warnings, 'type_future', 'API, performance e security ja estao modelados, mas a geracao inicial atende Web E2E.', null)
  }

  if (!AUTOMATION_FRAMEWORKS.includes(framework)) {
    pushWarning(warnings, 'framework_fallback', 'Framework nao suportado. Cypress foi usado como fallback.', null)
  }

  if (!baseUrl) {
    pushWarning(warnings, 'missing_base_url', 'Blueprint sem baseUrl/startUrl. Informe a Base URL ao executar.', null)
  }

  if (!steps.length) {
    const error = new Error('Blueprint sem steps para gerar automacao.')
    error.statusCode = 400
    throw error
  }

  for (const step of steps) {
    if (!step.selector && !['visit', 'assertUrl', 'wait'].includes(step.action)) {
      pushWarning(warnings, 'missing_selector', 'Step sem selector para acao web.', step.order)
    }

    if (step.action === 'fill' && !step.value) {
      pushWarning(warnings, 'missing_value', 'Step fill sem value.', step.order)
    }

    if ((step.action === 'assertText' || step.action === 'assertUrl') && !step.expected) {
      pushWarning(warnings, 'missing_expected', 'Step de assert sem expected.', step.order)
    }
  }

  return {
    blueprint: {
      id: String(input.id || '').trim() || undefined,
      name,
      type,
      framework,
      language,
      pattern,
      baseUrl,
      specName,
      project: input.project,
      environment: input.environment,
      steps,
    },
    warnings,
  }
}

