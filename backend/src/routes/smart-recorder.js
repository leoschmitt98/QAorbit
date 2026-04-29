import crypto from 'node:crypto'
import { Router } from 'express'
import { canAccessOwnedRecord } from '../lib/auth.js'
import { createRequest, getPool, sql } from '../db.js'

const router = Router()
const TEXT_LIMIT = 500
const SELECTOR_LIMIT = 1000
const VALUE_LIMIT = 2000
const CAPTURE_TOKEN_TTL_MINUTES = 30
const allowedActions = new Set(['click', 'type', 'select', 'check', 'uncheck', 'submit'])

let schemaReadyPromise

function normalizeString(value, maxLength = null) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return maxLength ? normalized.slice(0, maxLength) : normalized
}

function normalizeMultiline(value, maxLength = null) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  return maxLength ? normalized.slice(0, maxLength) : normalized
}

function toNullableInt(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

function cssEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}

function cssSingleQuote(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')
}

function cssAttribute(name, value) {
  return `[${name}='${cssSingleQuote(value)}']`
}

function safeHtmlAttribute(name, value) {
  const normalized = normalizeString(value, 120)
  if (!normalized) return ''
  return `${name}="${cssEscape(normalized)}"`
}

function sanitizeHtmlSnippet(input = {}) {
  const tagName = normalizeString(input.tagName, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'element'
  const allowedAttributes = [
    safeHtmlAttribute('data-testid', input.dataTestId),
    safeHtmlAttribute('data-cy', input.dataCy),
    safeHtmlAttribute('data-test', input.dataTest),
    safeHtmlAttribute('id', input.elementId),
    safeHtmlAttribute('name', input.elementName),
    safeHtmlAttribute('aria-label', input.ariaLabel),
    safeHtmlAttribute('type', input.elementType),
  ].filter(Boolean)

  return `<${tagName}${allowedAttributes.length ? ` ${allowedAttributes.join(' ')}` : ''}>`.slice(0, 300)
}

function normalizeAction(action) {
  const normalized = normalizeString(action || 'click', 40).toLowerCase()
  if (normalized === 'assertion' || normalized === 'assertvisible') return 'assertVisible'
  if (normalized === 'asserttext') return 'assertText'
  return allowedActions.has(normalized) ? normalized : 'click'
}

function chooseSelector(input) {
  const dataTestId = normalizeString(input.dataTestId, 250)
  if (dataTestId) return { selector: cssAttribute('data-testid', dataTestId), reason: 'data-testid' }

  const dataCy = normalizeString(input.dataCy, 250)
  if (dataCy) return { selector: cssAttribute('data-cy', dataCy), reason: 'data-cy' }

  const dataTest = normalizeString(input.dataTest, 250)
  if (dataTest) return { selector: cssAttribute('data-test', dataTest), reason: 'data-test' }

  const elementId = normalizeString(input.elementId, 250)
  if (elementId) return { selector: `#${cssEscape(elementId)}`, reason: 'id' }

  const elementName = normalizeString(input.elementName, 250)
  const tagName = normalizeString(input.tagName, 80).toLowerCase()
  if (elementName) return { selector: `${tagName || 'input'}[name='${cssSingleQuote(elementName)}']`, reason: 'name' }

  const ariaLabel = normalizeString(input.ariaLabel, 250)
  if (ariaLabel) return { selector: cssAttribute('aria-label', ariaLabel), reason: 'aria-label' }

  const elementText = normalizeString(input.elementText, 120)
  if (['button', 'a'].includes(tagName) && elementText) return { selector: tagName, reason: 'texto visivel' }

  const elementType = normalizeString(input.elementType, 80).toLowerCase()
  if (tagName === 'input' && ['password', 'email', 'text'].includes(elementType)) {
    return { selector: `input[type='${cssSingleQuote(elementType)}']`, reason: 'input type' }
  }

  const fallback = normalizeString(input.selectorFallback, SELECTOR_LIMIT)
  if (fallback) return { selector: fallback, reason: 'css curto' }

  return { selector: tagName || '*', reason: 'tag html' }
}

function buildFallbackSelector(input) {
  const tagName = normalizeString(input.tagName, 80).toLowerCase() || '*'
  const elementType = normalizeString(input.elementType, 80)
  if (elementType && tagName === 'input') return `${tagName}[type='${cssSingleQuote(elementType)}']`
  return tagName
}

function parseContainsSelector(selector) {
  const match = normalizeString(selector, SELECTOR_LIMIT).match(/^([a-z0-9_-]+):contains\((['"])(.*?)\2\)$/i)
  if (!match) return null
  return { tagName: match[1].toLowerCase(), text: normalizeString(match[3], 120) }
}

function isDynamicText(value) {
  return /carregando|entrando|salvando|aguarde|processando|enviando|loading|saving/i.test(normalizeString(value, 120))
}

function looksSensitiveSelectorValue(value) {
  const normalized = normalizeString(value, 250)
  return /token|secret|authorization|cookie|session/i.test(normalized) || /@/.test(normalized) || /^[a-f0-9]{24,}$/i.test(normalized)
}

function isStableId(value) {
  const normalized = normalizeString(value, 250)
  if (!normalized || looksSensitiveSelectorValue(normalized)) return false
  if (/^[0-9]+$/.test(normalized)) return false
  if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i.test(normalized)) return false
  if (normalized.length > 80) return false
  return true
}

function isWeakCssSelector(selector) {
  const normalized = normalizeString(selector, SELECTOR_LIMIT)
  if (!normalized) return true
  if (normalized.includes(':contains(')) return true
  if (/^\/\//.test(normalized) || normalized.startsWith('/html')) return true
  if (/:nth-child|:nth-of-type/i.test(normalized)) return true
  if ((normalized.match(/>/g) || []).length >= 3) return true
  if (/\.[a-z0-9_-]*(?:[a-f0-9]{6,}|btn|button|primary|active|disabled)[a-z0-9_-]*/i.test(normalized)) return true
  return false
}

function variableNameFromValue(value) {
  const match = normalizeString(value).match(/^\{\{([^{}]+)\}\}$/)
  return match ? match[1] : null
}

function slugForTestId(step) {
  const base = normalizeString(step.elementText || step.title || step.elementName || step.ariaLabel || step.action || 'elemento', 80)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'elemento'
}

function warningForQuality(quality) {
  return quality === 'weak' ? 'Este seletor pode quebrar facilmente. Recomenda-se adicionar data-testid no sistema.' : ''
}

function normalizeCypressTarget(step) {
  const tagName = normalizeString(step.tagName, 80).toLowerCase()
  const elementType = normalizeString(step.elementType, 80).toLowerCase()
  const selector = normalizeString(step.selectorRecommended, SELECTOR_LIMIT)
  const fallbackSelector = normalizeString(step.selectorFallback, SELECTOR_LIMIT) || buildFallbackSelector(step)
  const containsSelector = parseContainsSelector(selector)
  const elementText = normalizeString(step.elementText || containsSelector?.text, 120)

  const dataTestId = normalizeString(step.dataTestId, 250)
  if (dataTestId && !looksSensitiveSelectorValue(dataTestId)) {
    return {
      strategy: 'css',
      selector: cssAttribute('data-testid', dataTestId),
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'strong',
      warning: '',
      improvementSuggestion: '',
    }
  }

  const dataCy = normalizeString(step.dataCy, 250)
  if (dataCy && !looksSensitiveSelectorValue(dataCy)) {
    return {
      strategy: 'css',
      selector: cssAttribute('data-cy', dataCy),
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'strong',
      warning: '',
      improvementSuggestion: '',
    }
  }

  const dataTest = normalizeString(step.dataTest, 250)
  if (dataTest && !looksSensitiveSelectorValue(dataTest)) {
    return {
      strategy: 'css',
      selector: cssAttribute('data-test', dataTest),
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'strong',
      warning: '',
      improvementSuggestion: '',
    }
  }

  const elementId = normalizeString(step.elementId, 250)
  if (isStableId(elementId)) {
    return {
      strategy: 'css',
      selector: `#${cssEscape(elementId)}`,
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'strong',
      warning: '',
      improvementSuggestion: '',
    }
  }

  const elementName = normalizeString(step.elementName, 250)
  if (elementName && !looksSensitiveSelectorValue(elementName)) {
    return {
      strategy: 'css',
      selector: `${tagName || 'input'}[name='${cssSingleQuote(elementName)}']`,
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
    }
  }

  const ariaLabel = normalizeString(step.ariaLabel, 250)
  if (ariaLabel && !isDynamicText(ariaLabel) && !looksSensitiveSelectorValue(ariaLabel)) {
    return {
      strategy: 'css',
      selector: cssAttribute('aria-label', ariaLabel),
      text: null,
      recommendedCommand: 'get',
      fallbackSelector,
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
    }
  }

  const roleName = normalizeString(step.roleName, 120)
  if (roleName && elementText && !isDynamicText(elementText)) {
    return {
      strategy: 'text',
      selector: `[role='${cssSingleQuote(roleName)}']`,
      text: elementText,
      recommendedCommand: 'contains',
      fallbackSelector: selector && !selector.includes(':contains(') ? selector : fallbackSelector,
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
    }
  }

  const textTagName = containsSelector?.tagName || tagName
  if (['button', 'a'].includes(textTagName) && elementText && !isDynamicText(elementText)) {
    return {
      strategy: 'text',
      selector: textTagName,
      text: elementText,
      recommendedCommand: 'contains',
      fallbackSelector: textTagName,
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
    }
  }

  if (tagName === 'input' && ['password', 'email', 'text'].includes(elementType)) {
    const inputSelector = `input[type='${cssSingleQuote(elementType)}']`
    return {
      strategy: 'css',
      selector: inputSelector,
      text: null,
      recommendedCommand: 'get',
      fallbackSelector: fallbackSelector || inputSelector,
      selectorQuality: 'medium',
      warning: '',
      improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
    }
  }

  const safeFallback = selector && !isWeakCssSelector(selector) ? selector : fallbackSelector || tagName || '*'
  const quality = isWeakCssSelector(safeFallback) ? 'weak' : 'medium'
  return {
    strategy: 'css',
    selector: safeFallback,
    text: null,
    recommendedCommand: 'get',
    fallbackSelector: fallbackSelector || safeFallback,
    selectorQuality: quality,
    warning: warningForQuality(quality),
    improvementSuggestion: `Adicionar data-testid='${slugForTestId(step)}'`,
  }
}

function isSensitiveField(input) {
  const text = [
    input.elementType,
    input.elementId,
    input.elementName,
    input.ariaLabel,
    input.elementText,
    input.selectorRecommended,
    input.selectorFallback,
  ]
    .map((value) => normalizeString(value).toLowerCase())
    .join(' ')

  return /password|senha|token|secret|authorization|cookie|session/.test(text)
}

function normalizeCapturedValue(input) {
  const action = normalizeAction(input.action)
  const elementType = normalizeString(input.elementType, 80).toLowerCase()
  const valueMode = normalizeString(input.valueMode, 40) || (elementType === 'password' ? 'variable' : 'literal')

  if (!['type', 'select', 'check', 'uncheck'].includes(action)) {
    return { value: '', valueMode: '' }
  }

  if (elementType === 'password') {
    return { value: '{{password}}', valueMode: 'variable' }
  }

  if (isSensitiveField(input)) {
    return { value: '{{sensitiveValue}}', valueMode: 'variable' }
  }

  const rawValue = normalizeString(input.inputValue, VALUE_LIMIT)
  if (valueMode === 'variable') {
    return { value: rawValue.startsWith('{{') ? rawValue : `{{${rawValue || 'valor'}}}`, valueMode: 'variable' }
  }

  return { value: rawValue, valueMode: 'literal' }
}

function mapSession(row, steps = []) {
  return {
    id: row.Id,
    projectId: row.ProjetoId ? String(row.ProjetoId) : '',
    projectName: row.ProjectName || '',
    name: row.NomeFluxo || '',
    startUrl: row.UrlInicial || '',
    environment: row.Ambiente || '',
    status: row.Status || 'recording',
    notes: row.Observacoes || '',
    createdByUserId: row.CriadoPorUsuarioId || '',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : null,
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : null,
    finalizedAt: row.FinalizadoEm ? new Date(row.FinalizadoEm).toISOString() : null,
    steps,
  }
}

function mapStep(row) {
  return {
    id: row.Id,
    sessionId: row.SessionId,
    order: Number(row.Ordem || 0),
    action: row.Action || 'click',
    title: row.Title || '',
    currentUrl: row.CurrentUrl || '',
    selectorRecommended: row.SelectorRecommended || '',
    selectorFallback: row.SelectorFallback || '',
    selectorReason: row.SelectorReason || '',
    elementText: row.ElementText || '',
    tagName: row.TagName || '',
    elementType: row.ElementType || '',
    elementId: row.ElementId || '',
    elementName: row.ElementName || '',
    dataTestId: row.DataTestId || '',
    dataCy: row.DataCy || '',
    dataTest: row.DataTest || '',
    ariaLabel: row.AriaLabel || '',
    roleName: row.RoleName || '',
    classes: row.Classes || '',
    inputValue: row.InputValue || '',
    valueMode: row.ValueMode || '',
    htmlSnippet: row.HtmlSnippet || '',
    expectedResult: row.ExpectedResult || '',
    notes: row.Notes || '',
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : null,
  }
}

function buildBlueprint(session, steps) {
  return {
    id: session.id,
    name: session.name,
    project: {
      id: Number(session.projectId || 0),
      name: session.projectName,
    },
    startUrl: session.startUrl,
    environment: session.environment,
    steps: steps.map((step) => {
      const target = normalizeCypressTarget(step)
      return {
        order: step.order,
        action: step.action === 'assertion' ? 'assertVisible' : step.action,
        target: {
          strategy: target.strategy,
          selector: target.selector,
          text: target.text,
          recommendedCommand: target.recommendedCommand,
          fallbackSelector: target.fallbackSelector,
        },
        value: step.inputValue || null,
        variableName: variableNameFromValue(step.inputValue),
        expectedResult: step.expectedResult || '',
        selectorQuality: target.selectorQuality,
        warning: target.warning,
        improvementSuggestion: target.improvementSuggestion,
      }
    }),
  }
}

function buildPageObjectSuggestion(steps) {
  const seen = new Set()
  const lines = ['export const page = {']
  for (const step of steps) {
    const target = normalizeCypressTarget(step)
    if (target.strategy !== 'css' || target.selectorQuality !== 'strong' || seen.has(target.selector)) continue
    seen.add(target.selector)
    const keyBase = normalizeString(step.title || step.action || 'elemento')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('') || `element${seen.size}`
    lines.push(`  ${keyBase}: '${target.selector}',`)
  }
  lines.push('}')
  return lines.join('\n')
}

function buildCypressStepsSuggestion(steps) {
  const valueExpression = (step) => {
    const rawValue = step.inputValue || ''
    const variableMatch = rawValue.match(/^\{\{([^{}]+)\}\}$/)
    if (variableMatch) return `Cypress.env('${variableMatch[1].replace(/'/g, "\\'")}')`
    return `'${rawValue.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  return steps
    .map((step) => {
      const target = normalizeCypressTarget(step)
      const getTarget = target.recommendedCommand === 'contains'
        ? `cy.contains('${target.selector}', '${String(target.text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`
        : `cy.get('${target.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`
      if (step.action === 'type') return `${getTarget}.should('be.visible').clear().type(${valueExpression(step)}, { log: false })`
      if (step.action === 'select') return `${getTarget}.should('be.visible').select(${valueExpression(step)})`
      if (step.action === 'check') return `${getTarget}.should('be.visible').check()`
      if (step.action === 'uncheck') return `${getTarget}.should('be.visible').uncheck()`
      if (step.action === 'submit') return `${getTarget}.should('be.visible').submit()`
      if (step.action === 'assertion' || step.action === 'assertVisible') return `${getTarget}.should('be.visible')`
      if (step.action === 'assertText') return `${getTarget}.should('contain.text', ${valueExpression(step)})`
      return `${getTarget}.should('be.visible').click()`
    })
    .join('\n')
}

function buildPrompt(session, blueprint) {
  return [
    'Voce e Codex trabalhando em um repositorio Cypress externo.',
    '',
    `Projeto: ${session.projectName || session.projectId}`,
    `Fluxo: ${session.name}`,
    `Ambiente: ${session.environment || 'nao informado'}`,
    `URL inicial: ${session.startUrl}`,
    '',
    'Objetivo:',
    '- Criar um teste Cypress a partir do blueprint abaixo.',
    '- Usar cy.get() quando target.recommendedCommand for get.',
    '- Usar cy.contains(selector, text) quando target.recommendedCommand for contains.',
    "- Nunca usar cy.get('button:contains(...)'); texto visivel deve ser cy.contains(selector, text).",
    '- Usar Cypress.env() para valores parametrizados, como {{password}} e {{usuario}}.',
    '- Nao hardcodar login, senha, tokens ou dados sensiveis.',
    '- Criar Page Object somente com seletores fortes, preferindo data-testid, data-cy ou data-test.',
    '- Quando selectorQuality for weak, sugerir melhoria no sistema alvo antes de consolidar a automacao.',
    '- Evitar seletores frageis: nth-child, nth-of-type, classes visuais, caminhos longos e texto dinamico.',
    '- Salvar o teste no repositorio Cypress externo do projeto.',
    '- Preservar nomes claros para steps e comandos.',
    '',
    'Blueprint JSON:',
    JSON.stringify(blueprint, null, 2),
  ].join('\n')
}

async function ensureSmartRecorderSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool()
      if (!pool) return
      await createRequest(pool).query(`
        IF OBJECT_ID('dbo.SmartRecorderSessions', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.SmartRecorderSessions (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            ProjetoId INT NOT NULL,
            NomeFluxo NVARCHAR(250) NOT NULL,
            UrlInicial NVARCHAR(1000) NOT NULL,
            Ambiente NVARCHAR(120) NULL,
            Status NVARCHAR(40) NOT NULL CONSTRAINT DF_SmartRecorderSessions_Status DEFAULT ('recording'),
            Observacoes NVARCHAR(MAX) NULL,
            CaptureToken NVARCHAR(120) NULL,
            CaptureTokenExpiresAt DATETIME2(0) NULL,
            CriadoPorUsuarioId NVARCHAR(120) NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_SmartRecorderSessions_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_SmartRecorderSessions_AtualizadoEm DEFAULT (SYSDATETIME()),
            FinalizadoEm DATETIME2(0) NULL,
            CONSTRAINT FK_SmartRecorderSessions_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id)
          );
          CREATE INDEX IX_SmartRecorderSessions_ProjetoId ON dbo.SmartRecorderSessions (ProjetoId, AtualizadoEm DESC);
          CREATE INDEX IX_SmartRecorderSessions_CriadoPorUsuarioId ON dbo.SmartRecorderSessions (CriadoPorUsuarioId);
        END;

        IF COL_LENGTH('dbo.SmartRecorderSessions', 'CaptureToken') IS NULL
          ALTER TABLE dbo.SmartRecorderSessions ADD CaptureToken NVARCHAR(120) NULL;

        IF COL_LENGTH('dbo.SmartRecorderSessions', 'CaptureTokenExpiresAt') IS NULL
          ALTER TABLE dbo.SmartRecorderSessions ADD CaptureTokenExpiresAt DATETIME2(0) NULL;

        IF OBJECT_ID('dbo.SmartRecorderSteps', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.SmartRecorderSteps (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            SessionId NVARCHAR(120) NOT NULL,
            Ordem INT NOT NULL,
            Action NVARCHAR(40) NOT NULL,
            Title NVARCHAR(250) NULL,
            CurrentUrl NVARCHAR(1000) NULL,
            SelectorRecommended NVARCHAR(1000) NULL,
            SelectorFallback NVARCHAR(1000) NULL,
            SelectorReason NVARCHAR(500) NULL,
            ElementText NVARCHAR(500) NULL,
            TagName NVARCHAR(80) NULL,
            ElementType NVARCHAR(80) NULL,
            ElementId NVARCHAR(250) NULL,
            ElementName NVARCHAR(250) NULL,
            DataTestId NVARCHAR(250) NULL,
            DataCy NVARCHAR(250) NULL,
            DataTest NVARCHAR(250) NULL,
            AriaLabel NVARCHAR(250) NULL,
            RoleName NVARCHAR(120) NULL,
            Classes NVARCHAR(1000) NULL,
            InputValue NVARCHAR(MAX) NULL,
            ValueMode NVARCHAR(40) NULL,
            HtmlSnippet NVARCHAR(2000) NULL,
            ExpectedResult NVARCHAR(MAX) NULL,
            Notes NVARCHAR(MAX) NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SmartRecorderSteps_CreatedAt DEFAULT (SYSDATETIME()),
            UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SmartRecorderSteps_UpdatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_SmartRecorderSteps_Sessions FOREIGN KEY (SessionId) REFERENCES dbo.SmartRecorderSessions (Id) ON DELETE CASCADE
          );
          CREATE INDEX IX_SmartRecorderSteps_SessionId ON dbo.SmartRecorderSteps (SessionId, Ordem);
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }
  return schemaReadyPromise
}

async function loadSession(sessionId, auth) {
  const pool = await getPool()
  if (!pool) throw new Error('Smart Recorder requer banco configurado.')

  const request = createRequest(pool)
  request.input('sessionId', sql.NVarChar(120), sessionId)
  const result = await request.query(`
    SELECT s.*, p.Nome AS ProjectName
    FROM dbo.SmartRecorderSessions s
    INNER JOIN dbo.Projetos p ON p.Id = s.ProjetoId
    WHERE s.Id = @sessionId;

    SELECT *
    FROM dbo.SmartRecorderSteps
    WHERE SessionId = @sessionId
    ORDER BY Ordem;
  `)

  const sessionRow = result.recordsets[0]?.[0]
  if (!sessionRow) throw new Error('Sessao de gravacao nao encontrada.')
  if (!canAccessOwnedRecord(auth, sessionRow.CriadoPorUsuarioId)) throw new Error('Acesso restrito a esta gravacao.')

  const steps = (result.recordsets[1] ?? []).map(mapStep)
  return mapSession(sessionRow, steps)
}

async function loadSessionByCaptureToken(sessionId, captureToken) {
  const pool = await getPool()
  if (!pool) throw new Error('Smart Recorder requer banco configurado.')

  const request = createRequest(pool)
  request.input('sessionId', sql.NVarChar(120), sessionId)
  request.input('captureToken', sql.NVarChar(120), normalizeString(captureToken, 120))
  const result = await request.query(`
    SELECT TOP 1 s.*, p.Nome AS ProjectName
    FROM dbo.SmartRecorderSessions s
    INNER JOIN dbo.Projetos p ON p.Id = s.ProjetoId
    WHERE s.Id = @sessionId
      AND s.CaptureToken = @captureToken
      AND s.Status = 'recording'
      AND s.CaptureTokenExpiresAt > SYSDATETIME()
  `)

  const sessionRow = result.recordset[0]
  if (!sessionRow) throw new Error('Sessao de captura invalida ou finalizada.')
  return mapSession(sessionRow, [])
}

async function nextOrder(pool, sessionId) {
  const request = createRequest(pool)
  request.input('sessionId', sql.NVarChar(120), sessionId)
  const result = await request.query('SELECT ISNULL(MAX(Ordem), 0) + 1 AS NextOrder FROM dbo.SmartRecorderSteps WHERE SessionId = @sessionId')
  return Number(result.recordset[0]?.NextOrder || 1)
}

router.post('/sessions', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')

    const projectId = toNullableInt(req.body?.projectId)
    const name = normalizeString(req.body?.name, 250)
    const startUrl = normalizeString(req.body?.startUrl, 1000)
    if (!projectId || !name || !startUrl) {
      return res.status(400).json({ message: 'Projeto, nome do fluxo e URL inicial sao obrigatorios.' })
    }

    const sessionId = newId('smart-session')
    const captureToken = crypto.randomBytes(24).toString('hex')
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), sessionId)
    request.input('projectId', sql.Int, projectId)
    request.input('name', sql.NVarChar(250), name)
    request.input('startUrl', sql.NVarChar(1000), startUrl)
    request.input('environment', sql.NVarChar(120), normalizeString(req.body?.environment, 120))
    request.input('notes', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.notes))
    request.input('captureToken', sql.NVarChar(120), captureToken)
    request.input('userId', sql.NVarChar(120), req.auth?.userId || null)
    await request.query(`
      INSERT INTO dbo.SmartRecorderSessions (Id, ProjetoId, NomeFluxo, UrlInicial, Ambiente, Status, Observacoes, CaptureToken, CaptureTokenExpiresAt, CriadoPorUsuarioId)
      VALUES (@id, @projectId, @name, @startUrl, @environment, 'recording', @notes, @captureToken, DATEADD(MINUTE, ${CAPTURE_TOKEN_TTL_MINUTES}, SYSDATETIME()), @userId)
    `)

    const session = await loadSession(sessionId, req.auth)
    return res.status(201).json({ ...session, captureToken })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel criar a sessao.' })
  }
})

router.get('/sessions/:id', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(404).json({ message: error instanceof Error ? error.message : 'Sessao nao encontrada.' })
  }
})

router.post('/sessions/:id/steps', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const action = normalizeAction(req.body?.action)
    const selectorChoice = chooseSelector(req.body || {})
    const fallbackSelector = normalizeString(req.body?.selectorFallback, SELECTOR_LIMIT) || buildFallbackSelector(req.body || {})
    const value = normalizeCapturedValue({ ...req.body, action })
    const order = Number(req.body?.order || 0) || (await nextOrder(pool, req.params.id))
    const stepId = normalizeString(req.body?.id, 120) || newId('smart-step')

    const title = normalizeString(req.body?.title, 250) || `${action} ${normalizeString(req.body?.elementText, 80) || selectorChoice.selector}`
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), stepId)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    request.input('order', sql.Int, order)
    request.input('action', sql.NVarChar(40), action)
    request.input('title', sql.NVarChar(250), title)
    request.input('currentUrl', sql.NVarChar(1000), normalizeString(req.body?.currentUrl, 1000))
    request.input('selectorRecommended', sql.NVarChar(1000), normalizeString(req.body?.selectorRecommended, SELECTOR_LIMIT) || selectorChoice.selector)
    request.input('selectorFallback', sql.NVarChar(1000), fallbackSelector)
    request.input('selectorReason', sql.NVarChar(500), normalizeString(req.body?.selectorReason, 500) || selectorChoice.reason)
    request.input('elementText', sql.NVarChar(500), normalizeString(req.body?.elementText, TEXT_LIMIT))
    request.input('tagName', sql.NVarChar(80), normalizeString(req.body?.tagName, 80).toLowerCase())
    request.input('elementType', sql.NVarChar(80), normalizeString(req.body?.elementType, 80))
    request.input('elementId', sql.NVarChar(250), normalizeString(req.body?.elementId, 250))
    request.input('elementName', sql.NVarChar(250), normalizeString(req.body?.elementName, 250))
    request.input('dataTestId', sql.NVarChar(250), normalizeString(req.body?.dataTestId, 250))
    request.input('dataCy', sql.NVarChar(250), normalizeString(req.body?.dataCy, 250))
    request.input('dataTest', sql.NVarChar(250), normalizeString(req.body?.dataTest, 250))
    request.input('ariaLabel', sql.NVarChar(250), normalizeString(req.body?.ariaLabel, 250))
    request.input('roleName', sql.NVarChar(120), normalizeString(req.body?.roleName, 120))
    request.input('classes', sql.NVarChar(1000), normalizeString(req.body?.classes, 1000))
    request.input('inputValue', sql.NVarChar(sql.MAX), value.value)
    request.input('valueMode', sql.NVarChar(40), value.valueMode)
    request.input('htmlSnippet', sql.NVarChar(2000), sanitizeHtmlSnippet(req.body || {}))
    request.input('expectedResult', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.expectedResult))
    request.input('notes', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.notes))

    await request.query(`
      INSERT INTO dbo.SmartRecorderSteps
      (Id, SessionId, Ordem, Action, Title, CurrentUrl, SelectorRecommended, SelectorFallback, SelectorReason, ElementText, TagName, ElementType, ElementId, ElementName, DataTestId, DataCy, DataTest, AriaLabel, RoleName, Classes, InputValue, ValueMode, HtmlSnippet, ExpectedResult, Notes)
      VALUES
      (@id, @sessionId, @order, @action, @title, @currentUrl, @selectorRecommended, @selectorFallback, @selectorReason, @elementText, @tagName, @elementType, @elementId, @elementName, @dataTestId, @dataCy, @dataTest, @ariaLabel, @roleName, @classes, @inputValue, @valueMode, @htmlSnippet, @expectedResult, @notes);

      WITH Ordered AS (
        SELECT Id, ROW_NUMBER() OVER (ORDER BY Ordem, CreatedAt, Id) AS NewOrder
        FROM dbo.SmartRecorderSteps
        WHERE SessionId = @sessionId
      )
      UPDATE s
      SET Ordem = o.NewOrder
      FROM dbo.SmartRecorderSteps s
      INNER JOIN Ordered o ON o.Id = s.Id;

      UPDATE dbo.SmartRecorderSessions
      SET AtualizadoEm = SYSDATETIME()
      WHERE Id = @sessionId;
    `)

    const session = await loadSession(req.params.id, req.auth)
    return res.status(201).json(session.steps.find((step) => step.id === stepId))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel gravar o passo.' })
  }
})

router.patch('/sessions/:id/steps/:stepId', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const selectorChoice = chooseSelector(req.body || {})
    const value = normalizeCapturedValue(req.body || {})
    const request = createRequest(pool)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    request.input('stepId', sql.NVarChar(120), req.params.stepId)
    request.input('order', sql.Int, Number(req.body?.order || 0) || null)
    request.input('action', sql.NVarChar(40), normalizeAction(req.body?.action))
    request.input('title', sql.NVarChar(250), normalizeString(req.body?.title, 250))
    request.input('currentUrl', sql.NVarChar(1000), normalizeString(req.body?.currentUrl, 1000))
    request.input('selectorRecommended', sql.NVarChar(1000), normalizeString(req.body?.selectorRecommended, SELECTOR_LIMIT) || selectorChoice.selector)
    request.input('selectorFallback', sql.NVarChar(1000), normalizeString(req.body?.selectorFallback, SELECTOR_LIMIT))
    request.input('selectorReason', sql.NVarChar(500), normalizeString(req.body?.selectorReason, 500) || selectorChoice.reason)
    request.input('elementText', sql.NVarChar(500), normalizeString(req.body?.elementText, TEXT_LIMIT))
    request.input('tagName', sql.NVarChar(80), normalizeString(req.body?.tagName, 80).toLowerCase())
    request.input('elementType', sql.NVarChar(80), normalizeString(req.body?.elementType, 80))
    request.input('elementId', sql.NVarChar(250), normalizeString(req.body?.elementId, 250))
    request.input('elementName', sql.NVarChar(250), normalizeString(req.body?.elementName, 250))
    request.input('dataTestId', sql.NVarChar(250), normalizeString(req.body?.dataTestId, 250))
    request.input('dataCy', sql.NVarChar(250), normalizeString(req.body?.dataCy, 250))
    request.input('dataTest', sql.NVarChar(250), normalizeString(req.body?.dataTest, 250))
    request.input('ariaLabel', sql.NVarChar(250), normalizeString(req.body?.ariaLabel, 250))
    request.input('roleName', sql.NVarChar(120), normalizeString(req.body?.roleName, 120))
    request.input('classes', sql.NVarChar(1000), normalizeString(req.body?.classes, 1000))
    request.input('inputValue', sql.NVarChar(sql.MAX), value.value)
    request.input('valueMode', sql.NVarChar(40), value.valueMode)
    request.input('htmlSnippet', sql.NVarChar(2000), sanitizeHtmlSnippet(req.body || {}))
    request.input('expectedResult', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.expectedResult))
    request.input('notes', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.notes))
    await request.query(`
      UPDATE dbo.SmartRecorderSteps
      SET Ordem = COALESCE(@order, Ordem),
          Action = @action,
          Title = @title,
          CurrentUrl = @currentUrl,
          SelectorRecommended = @selectorRecommended,
          SelectorFallback = @selectorFallback,
          SelectorReason = @selectorReason,
          ElementText = @elementText,
          TagName = @tagName,
          ElementType = @elementType,
          ElementId = @elementId,
          ElementName = @elementName,
          DataTestId = @dataTestId,
          DataCy = @dataCy,
          DataTest = @dataTest,
          AriaLabel = @ariaLabel,
          RoleName = @roleName,
          Classes = @classes,
          InputValue = @inputValue,
          ValueMode = @valueMode,
          HtmlSnippet = @htmlSnippet,
          ExpectedResult = @expectedResult,
          Notes = @notes,
          UpdatedAt = SYSDATETIME()
      WHERE SessionId = @sessionId AND Id = @stepId;

      UPDATE dbo.SmartRecorderSessions
      SET AtualizadoEm = SYSDATETIME()
      WHERE Id = @sessionId;
    `)

    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel atualizar o passo.' })
  }
})

router.delete('/sessions/:id/steps/:stepId', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const request = createRequest(pool)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    request.input('stepId', sql.NVarChar(120), req.params.stepId)
    await request.query(`
      DELETE FROM dbo.SmartRecorderSteps
      WHERE SessionId = @sessionId AND Id = @stepId;

      WITH Ordered AS (
        SELECT Id, ROW_NUMBER() OVER (ORDER BY Ordem, CreatedAt) AS NewOrder
        FROM dbo.SmartRecorderSteps
        WHERE SessionId = @sessionId
      )
      UPDATE s
      SET Ordem = o.NewOrder
      FROM dbo.SmartRecorderSteps s
      INNER JOIN Ordered o ON o.Id = s.Id;
    `)

    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel excluir o passo.' })
  }
})

router.post('/sessions/:id/finalize', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const request = createRequest(pool)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    await request.query(`
      UPDATE dbo.SmartRecorderSessions
      SET Status = 'finalized',
          AtualizadoEm = SYSDATETIME(),
          FinalizadoEm = SYSDATETIME()
      WHERE Id = @sessionId
    `)

    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel finalizar a gravacao.' })
  }
})

router.post('/sessions/:id/pause', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const request = createRequest(pool)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    await request.query(`
      UPDATE dbo.SmartRecorderSessions
      SET Status = 'paused',
          AtualizadoEm = SYSDATETIME()
      WHERE Id = @sessionId
        AND Status <> 'finalized'
    `)

    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel pausar a gravacao.' })
  }
})

router.post('/sessions/:id/resume', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')
    await loadSession(req.params.id, req.auth)

    const request = createRequest(pool)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    await request.query(`
      UPDATE dbo.SmartRecorderSessions
      SET Status = 'recording',
          AtualizadoEm = SYSDATETIME()
      WHERE Id = @sessionId
        AND Status <> 'finalized'
    `)

    return res.json(await loadSession(req.params.id, req.auth))
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel retomar a gravacao.' })
  }
})

router.get('/sessions/:id/export-json', async (req, res) => {
  try {
    await ensureSmartRecorderSchema()
    const session = await loadSession(req.params.id, req.auth)
    const blueprint = buildBlueprint(session, session.steps)
    return res.json({
      blueprint,
      pageObjectSuggestion: buildPageObjectSuggestion(session.steps),
      cypressStepsSuggestion: buildCypressStepsSuggestion(session.steps),
      prompt: buildPrompt(session, blueprint),
    })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel exportar o JSON.' })
  }
})

export async function handleSmartRecorderCapture(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-QA-Orbit-Recorder-Token')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    await ensureSmartRecorderSchema()
    const pool = await getPool()
    if (!pool) throw new Error('Smart Recorder requer banco configurado.')

    const captureToken = req.headers['x-qa-orbit-recorder-token'] || req.query?.token
    await loadSessionByCaptureToken(req.params.id, captureToken)

    req.body = {
      ...req.body,
      valueMode: req.body?.valueMode || (String(req.body?.elementType || '').toLowerCase() === 'password' ? 'variable' : 'literal'),
    }

    const action = normalizeAction(req.body?.action)
    const selectorChoice = chooseSelector(req.body || {})
    const fallbackSelector = normalizeString(req.body?.selectorFallback, SELECTOR_LIMIT) || buildFallbackSelector(req.body || {})
    const value = normalizeCapturedValue({ ...req.body, action })
    const order = await nextOrder(pool, req.params.id)
    const stepId = newId('smart-step')
    const title = normalizeString(req.body?.title, 250) || `${action} ${normalizeString(req.body?.elementText, 80) || selectorChoice.selector}`

    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), stepId)
    request.input('sessionId', sql.NVarChar(120), req.params.id)
    request.input('order', sql.Int, order)
    request.input('action', sql.NVarChar(40), action)
    request.input('title', sql.NVarChar(250), title)
    request.input('currentUrl', sql.NVarChar(1000), normalizeString(req.body?.currentUrl, 1000))
    request.input('selectorRecommended', sql.NVarChar(1000), normalizeString(req.body?.selectorRecommended, SELECTOR_LIMIT) || selectorChoice.selector)
    request.input('selectorFallback', sql.NVarChar(1000), fallbackSelector)
    request.input('selectorReason', sql.NVarChar(500), normalizeString(req.body?.selectorReason, 500) || selectorChoice.reason)
    request.input('elementText', sql.NVarChar(500), normalizeString(req.body?.elementText, TEXT_LIMIT))
    request.input('tagName', sql.NVarChar(80), normalizeString(req.body?.tagName, 80).toLowerCase())
    request.input('elementType', sql.NVarChar(80), normalizeString(req.body?.elementType, 80))
    request.input('elementId', sql.NVarChar(250), normalizeString(req.body?.elementId, 250))
    request.input('elementName', sql.NVarChar(250), normalizeString(req.body?.elementName, 250))
    request.input('dataTestId', sql.NVarChar(250), normalizeString(req.body?.dataTestId, 250))
    request.input('dataCy', sql.NVarChar(250), normalizeString(req.body?.dataCy, 250))
    request.input('dataTest', sql.NVarChar(250), normalizeString(req.body?.dataTest, 250))
    request.input('ariaLabel', sql.NVarChar(250), normalizeString(req.body?.ariaLabel, 250))
    request.input('roleName', sql.NVarChar(120), normalizeString(req.body?.roleName, 120))
    request.input('classes', sql.NVarChar(1000), normalizeString(req.body?.classes, 1000))
    request.input('inputValue', sql.NVarChar(sql.MAX), value.value)
    request.input('valueMode', sql.NVarChar(40), value.valueMode)
    request.input('htmlSnippet', sql.NVarChar(2000), sanitizeHtmlSnippet(req.body || {}))
    request.input('expectedResult', sql.NVarChar(sql.MAX), '')
    request.input('notes', sql.NVarChar(sql.MAX), normalizeMultiline(req.body?.notes))
    await request.query(`
      INSERT INTO dbo.SmartRecorderSteps
      (Id, SessionId, Ordem, Action, Title, CurrentUrl, SelectorRecommended, SelectorFallback, SelectorReason, ElementText, TagName, ElementType, ElementId, ElementName, DataTestId, DataCy, DataTest, AriaLabel, RoleName, Classes, InputValue, ValueMode, HtmlSnippet, ExpectedResult, Notes)
      VALUES
      (@id, @sessionId, @order, @action, @title, @currentUrl, @selectorRecommended, @selectorFallback, @selectorReason, @elementText, @tagName, @elementType, @elementId, @elementName, @dataTestId, @dataCy, @dataTest, @ariaLabel, @roleName, @classes, @inputValue, @valueMode, @htmlSnippet, @expectedResult, @notes);

      UPDATE dbo.SmartRecorderSessions
      SET AtualizadoEm = SYSDATETIME()
      WHERE Id = @sessionId;
    `)

    return res.status(201).json({ ok: true, stepId })
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Nao foi possivel capturar o passo.' })
  }
}

export default router
