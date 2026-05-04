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
      return `    await driver.get(${quote(step.value || '/')});`
    case 'click':
      return `    await driver.findElement(By.css(${quote(step.selector)})).click();`
    case 'fill':
      return `    await driver.findElement(By.css(${quote(step.selector)})).sendKeys(resolveValue(${quote(step.value)}));`
    case 'select':
      return `    await driver.findElement(By.css(${quote(step.selector)})).sendKeys(resolveValue(${quote(step.value)}));`
    case 'assertText':
      return `    assert.match(await driver.findElement(By.css(${quote(step.selector)})).getText(), new RegExp(${quote(step.expected)}));`
    case 'assertUrl':
      return `    assert.match(await driver.getCurrentUrl(), new RegExp(${quote(step.expected)}));`
    case 'wait':
      return `    await driver.sleep(${Number(step.value || 1000)});`
    default:
      return `    // Acao nao suportada ainda: ${step.action}`
  }
}

export function generateSelenium(blueprint, options = {}) {
  const slug = sanitizeSlug(options.suiteName || blueprint.name || 'qa-orbit-suite')
  const suiteName = sanitizeSuiteName(options.suiteName || blueprint.name)
  const specFileName = ensureExtension(options.specFileName || blueprint.specName || `${slug}.test.js`, '.test.js', slug)
  const modulePath = sanitizeSlug(options.moduleName || '', '')
  const submodulePath = sanitizeSlug(options.submoduleName || '', '')
  const specPath = buildNestedPath('tests', modulePath || 'qa-orbit', submodulePath, specFileName)
  const initialVisit = blueprint.baseUrl ? [`    await driver.get(${quote(blueprint.baseUrl)});`] : []
  const stepLines = blueprint.steps.filter((step) => step.action !== 'visit').map(lineForStep)
  const specCode = [
    "const assert = require('node:assert/strict');",
    "const { Builder, By } = require('selenium-webdriver');",
    '',
    'function resolveValue(value) {',
    "  return String(value || '').replace(/\\{\\{\\s*([^}]+?)\\s*\\}\\}/g, (_match, key) => process.env[key.trim()] || '');",
    '}',
    '',
    `describe('QA Orbit - ${suiteName}', function () {`,
    '  this.timeout(60000);',
    '  let driver;',
    '',
    '  before(async function () {',
    "    driver = await new Builder().forBrowser(process.env.SELENIUM_BROWSER || 'chrome').build();",
    '  });',
    '',
    '  after(async function () {',
    '    if (driver) await driver.quit();',
    '  });',
    '',
    "  it('executa fluxo gerado pelo QA Orbit', async function () {",
    ...initialVisit,
    ...stepLines,
    '  });',
    '});',
  ].join('\n')

  return {
    framework: 'selenium',
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
