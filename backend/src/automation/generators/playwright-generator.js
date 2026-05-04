import { ensureExtension, sanitizeSlug, sanitizeSuiteName } from '../core/automation-types.js'

function buildNestedPath(...segments) {
  return segments.filter(Boolean).join('/').replace(/\\/g, '/')
}

function quote(value) {
  return JSON.stringify(String(value || ''))
}

function lineForStep(step) {
  switch (step.action) {
    case 'visit':
      return `  await page.goto(${quote(step.value || '/')});`
    case 'click':
      return `  await page.locator(${quote(step.selector)}).click();`
    case 'fill':
      return `  await page.locator(${quote(step.selector)}).fill(${quote(step.value)});`
    case 'select':
      return `  await page.locator(${quote(step.selector)}).selectOption(${quote(step.value)});`
    case 'assertText':
      return `  await expect(page.locator(${quote(step.selector)})).toContainText(${quote(step.expected)});`
    case 'assertUrl':
      return `  await expect(page).toHaveURL(new RegExp(${quote(step.expected)}));`
    case 'wait':
      return `  await page.waitForTimeout(${Number(step.value || 1000)});`
    default:
      return `  // Acao nao suportada ainda: ${step.action}`
  }
}

export function generatePlaywright(blueprint, options = {}) {
  const slug = sanitizeSlug(options.suiteName || blueprint.name || 'qa-orbit-suite')
  const suiteName = sanitizeSuiteName(options.suiteName || blueprint.name)
  const extension = blueprint.language === 'javascript' ? '.spec.js' : '.spec.ts'
  const specFileName = ensureExtension(options.specFileName || blueprint.specName || `${slug}${extension}`, extension, slug)
  const modulePath = sanitizeSlug(options.moduleName || '', '')
  const submodulePath = sanitizeSlug(options.submoduleName || '', '')
  const specPath = buildNestedPath('tests', modulePath || 'qa-orbit', submodulePath, specFileName)
  const initialVisit = blueprint.baseUrl ? [`  await page.goto(${quote(blueprint.baseUrl)});`] : []
  const stepLines = blueprint.steps.filter((step) => step.action !== 'visit').map(lineForStep)
  const specCode = [
    "import { test, expect } from '@playwright/test';",
    '',
    `test.describe('QA Orbit - ${suiteName}', () => {`,
    " test('executa fluxo gerado pelo QA Orbit', async ({ page }) => {",
    ...initialVisit,
    ...stepLines,
    ' });',
    '});',
  ].join('\n')

  return {
    framework: 'playwright',
    blueprint,
    fixtureJson: JSON.stringify(blueprint, null, 2),
    specCode,
    files: [{ path: specPath, kind: 'spec', content: specCode }],
    suggestedPaths: {
      fixturePath: '',
      specPath,
    },
  }
}
