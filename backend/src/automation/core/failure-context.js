import { pushWarning } from './automation-types.js'
import { sanitizeFreeText, sanitizeUrlFragments } from './log-sanitizer.js'
import { normalizeAutomationBlueprint } from './step-normalizer.js'
import { extractMainError } from '../runner/result-normalizer.js'

function detectSelectorFromLogs(logText) {
  const text = String(logText || '')
  const patterns = [
    /cy\.get\((['"`])(.+?)\1\)/i,
    /cy\.contains\((['"`])(.+?)\1(?:,\s*(['"`])(.+?)\3)?\)/i,
    /locator\((['"`])(.+?)\1\)/i,
    /By\.css\((['"`])(.+?)\1\)/i,
    /Expected to find element:\s*`([^`]+)`/i,
    /NoSuchElementError.*?selector.*?["'`]([^"'`]+)["'`]/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    return match[4] || match[2] || match[1] || ''
  }

  return ''
}

function detectFailureFromBlueprint(blueprint, logs, framework, warnings) {
  const message = extractMainError('', logs, framework) || `Falha ${framework} sem mensagem principal detectada.`
  const selector = detectSelectorFromLogs(logs)
  const lowerMessage = message.toLowerCase()
  let matchedStep = null
  let confidence = 'low'

  if (selector && Array.isArray(blueprint.steps)) {
    matchedStep = blueprint.steps.find((step) => String(step.selector || '').trim() === selector.trim()) || null
    if (matchedStep) confidence = 'high'
  }

  if (!matchedStep && Array.isArray(blueprint.steps)) {
    matchedStep =
      blueprint.steps.find((step) => {
        const targetName = String(step.targetName || '').trim().toLowerCase()
        const expected = String(step.expected || '').trim().toLowerCase()
        return (targetName && lowerMessage.includes(targetName)) || (expected && lowerMessage.includes(expected))
      }) || null

    if (matchedStep) confidence = 'medium'
  }

  if (!matchedStep) {
    pushWarning(warnings, 'step_not_mapped', `Nao foi possivel mapear com seguranca o step da falha ${framework}.`)
  }

  if (confidence === 'low') {
    pushWarning(warnings, 'low_confidence', 'Confianca baixa: revise stdout/stderr, specPath e selectors antes de aplicar a sugestao.')
  }

  return {
    message,
    selector,
    stepOrder: matchedStep?.order ?? null,
    action: matchedStep?.action || '',
    confidence,
    matchedStep,
  }
}

export function buildAutomationFailureContext(input = {}) {
  const framework = String(input.framework || input.runResult?.framework || 'cypress').toLowerCase()
  const warnings = []
  const normalized = input.blueprint
    ? normalizeAutomationBlueprint(input.blueprint, { framework, baseUrl: input.baseUrl || input.runResult?.baseUrl })
    : { blueprint: { name: 'Blueprint nao informado', framework, steps: [], baseUrl: input.baseUrl || '' }, warnings: [] }
  warnings.push(...normalized.warnings)

  const runResult = input.runResult || input
  const stdout = sanitizeFreeText(runResult.stdout || '', 5000)
  const stderr = sanitizeFreeText(runResult.stderr || '', 5000)
  const combinedLogs = [stderr, stdout].filter(Boolean).join('\n')
  if (!combinedLogs) {
    pushWarning(warnings, 'missing_logs', 'Nenhum stdout/stderr foi informado.')
  }

  const detectedFailure = detectFailureFromBlueprint(normalized.blueprint, combinedLogs, framework, warnings)
  const step = detectedFailure.matchedStep
  const command = sanitizeFreeText(runResult.command || input.command || '', 1000) || 'Nao informado'
  const specPath = sanitizeFreeText(runResult.specPath || input.specPath || '', 1000) || 'Nao informado'
  const baseUrl = sanitizeUrlFragments(runResult.baseUrl || input.baseUrl || normalized.blueprint.baseUrl || '') || 'Nao informada'

  const contextText = [
    'Voce e o Assistente QA Orbit.',
    `Analise esta falha ${framework} e sugira correcao segura.`,
    '',
    'Contexto:',
    `Framework: ${framework}`,
    `Comando: ${command}`,
    `Suite/Blueprint: ${normalized.blueprint.name || 'Nao informado'}`,
    `Spec: ${specPath}`,
    `Base URL: ${baseUrl}`,
    '',
    'Resultado:',
    `Exit code: ${Number.isFinite(Number(runResult.exitCode)) ? Number(runResult.exitCode) : 'Nao informado'}`,
    `Duracao: ${Number.isFinite(Number(runResult.durationMs)) ? `${Number(runResult.durationMs)}ms` : 'Nao informada'}`,
    '',
    'Erro principal:',
    detectedFailure.message,
    '',
    'Step provavel:',
    `Order: ${detectedFailure.stepOrder ?? 'Nao mapeado'}`,
    `Action: ${detectedFailure.action || 'Nao mapeada'}`,
    `Selector: ${detectedFailure.selector || step?.selector || 'Nao identificado'}`,
    `Target: ${step?.targetName || 'Nao identificado'}`,
    '',
    'Blueprint neutro sanitizado:',
    JSON.stringify(normalized.blueprint, null, 2),
    '',
    'stdout/stderr sanitizados:',
    combinedLogs || 'Sem logs disponiveis.',
    '',
    'Tarefas:',
    '1. Identifique a causa provavel.',
    '2. Diga se parece seletor fraco, timing, URL, dado de teste, autenticacao ou bug real.',
    '3. Sugira ajuste no blueprint neutro.',
    '4. Sugira ajuste especifico para o framework usado.',
    '5. Nao peca senha real e nao hardcode credenciais.',
  ].join('\n')

  return {
    contextText,
    detectedFailure: {
      message: detectedFailure.message,
      selector: detectedFailure.selector,
      stepOrder: detectedFailure.stepOrder,
      action: detectedFailure.action,
      confidence: detectedFailure.confidence,
    },
    warnings,
  }
}

