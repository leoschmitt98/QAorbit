import path from 'node:path'
import { ensureExtension, sanitizeSlug, sanitizeSuiteName } from '../core/automation-types.js'

function buildNestedPath(...segments) {
  return segments.filter(Boolean).join('/').replace(/\\/g, '/')
}

function buildRelativeImport(specPath, fixturePath) {
  const relativePath = path.posix.relative(path.posix.dirname(specPath), fixturePath)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function toLegacyRunnerBlueprint(blueprint) {
  return {
    id: blueprint.id || '',
    name: blueprint.name,
    project: blueprint.project || { id: '', name: '' },
    startUrl: blueprint.baseUrl,
    environment: blueprint.environment || '',
    steps: blueprint.steps.map((step, index) => ({
      order: Number(step.order || index + 1),
      action: step.legacyAction || (step.action === 'fill' ? 'type' : step.action),
      target: step.legacyTarget || {
        strategy: step.targetName && !step.selector.includes('[') && !step.selector.includes('.') ? 'text' : 'css',
        selector: step.selector || 'body',
        text: step.targetName || null,
        recommendedCommand: step.targetName && step.action === 'click' ? 'contains' : 'get',
        fallbackSelector: step.selector || '',
      },
      value: step.value || null,
      variableName: /^\{\{[^{}]+\}\}$/.test(step.value || '') ? String(step.value).slice(2, -2) : null,
      expectedResult: step.expected || '',
      selectorQuality: 'medium',
      warning: step.notes || '',
      improvementSuggestion: '',
    })),
  }
}

export function generateCypress(blueprint, options = {}) {
  const slug = sanitizeSlug(options.suiteName || blueprint.name || 'qa-orbit-suite')
  const suiteName = sanitizeSuiteName(options.suiteName || blueprint.name)
  const fixtureFileName = ensureExtension(options.fixtureFileName || `${slug}.json`, '.json', slug)
  const specFileName = ensureExtension(options.specFileName || blueprint.specName || `${slug}.cy.js`, '.cy.js', slug)
  const modulePath = sanitizeSlug(options.moduleName || '', '')
  const submodulePath = sanitizeSlug(options.submoduleName || '', '')
  const fixturePath = buildNestedPath('cypress', 'fixtures', 'qa-orbit', modulePath, submodulePath, fixtureFileName)
  const specPath = buildNestedPath('cypress', 'e2e', modulePath || 'qa-orbit', submodulePath, specFileName)
  const runnerBlueprint = toLegacyRunnerBlueprint(blueprint)
  const blueprintImportPath = buildRelativeImport(specPath, fixturePath)
  const runnerImportPath = buildRelativeImport(specPath, 'cypress/support/qa-orbit/run-blueprint')
  const specCode = [
    `import blueprint from '${blueprintImportPath}'`,
    `import { runQaOrbitBlueprint } from '${runnerImportPath}'`,
    '',
    `describe('QA Orbit - ${suiteName}', () => {`,
    "  it('executa o fluxo exportado pelo QA Orbit', () => {",
    '    runQaOrbitBlueprint(blueprint)',
    '  })',
    '})',
  ].join('\n')

  return {
    framework: 'cypress',
    blueprint: runnerBlueprint,
    fixtureJson: JSON.stringify(runnerBlueprint, null, 2),
    specCode,
    files: [
      { path: fixturePath, kind: 'fixture', content: JSON.stringify(runnerBlueprint, null, 2) },
      { path: specPath, kind: 'spec', content: specCode },
    ],
    suggestedPaths: {
      fixturePath,
      specPath,
    },
  }
}
