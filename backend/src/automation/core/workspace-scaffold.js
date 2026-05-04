import fs from 'node:fs/promises'
import path from 'node:path'
import { sanitizeSlug } from './automation-types.js'
import { assertSafeWorkspaceRoot } from '../runner/safe-workspace.js'

const RUN_BLUEPRINT_HELPER = `function resolveValue(value) {
  if (!value) return ''
  const match = String(value).match(/^\\{\\{(.+)}}$/)
  if (match) return Cypress.env(match[1]) || ''
  return value
}

function getTarget(step) {
  const target = step.target || {}

  if (target.recommendedCommand === 'contains') {
    return cy.contains(target.selector || 'body', target.text || '')
  }

  return cy.get(target.selector)
}

function runStep(step) {
  cy.log(\`\${step.order} - \${step.action}\`)

  const el = getTarget(step)

  if (step.action === 'click') {
    el.should('be.visible').click()
    return
  }

  if (step.action === 'type') {
    el.should('be.visible').clear().type(resolveValue(step.value), { log: false })
    return
  }

  if (step.action === 'select') {
    el.should('be.visible').select(resolveValue(step.value))
    return
  }

  if (step.action === 'check') {
    el.should('be.visible').check()
    return
  }

  if (step.action === 'uncheck') {
    el.should('be.visible').uncheck()
    return
  }

  if (step.action === 'submit') {
    el.should('be.visible').submit()
    return
  }

  if (step.action === 'assertText') {
    el.should('contain.text', resolveValue(step.value))
    return
  }

  if (step.action === 'assertVisible') {
    el.should('be.visible')
  }
}

export function runQaOrbitBlueprint(blueprint) {
  if (!blueprint?.startUrl) {
    throw new Error('Blueprint sem startUrl.')
  }

  const configuredBaseUrl = Cypress.config('baseUrl')
  cy.visit(configuredBaseUrl ? '/' : blueprint.startUrl)

  ;[...(blueprint.steps || [])]
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach(runStep)
}
`

function buildPosixPath(...segments) {
  return segments.filter(Boolean).join('/').replace(/\\/g, '/')
}

function createPackageJson(projectSlug, framework) {
  const scripts = {
    cypress: {
      'cy:open': 'cypress open',
      'cy:run': 'cypress run',
    },
    playwright: {
      'pw:open': 'playwright test --ui',
      'pw:run': 'playwright test',
    },
    selenium: {
      test: 'node tests/index.js',
    },
  }[framework] || {}

  return JSON.stringify({
    name: `${projectSlug}-automation`,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts,
  }, null, 2)
}

function createManifest(projectSlug, projectName) {
  return JSON.stringify({
    projectKey: projectSlug,
    projectName,
    suites: [],
  }, null, 2)
}

function createReadme({ projectName, framework, moduleSlug, submoduleSlug }) {
  return `# Workspace de automacao ${projectName}

Framework principal: ${framework}

Estrutura criada pelo QA Orbit:

\`\`\`text
${projectName}
  ${framework === 'cypress' ? 'cypress' : 'tests'}/
    ${moduleSlug}/
      ${submoduleSlug}/
\`\`\`

Proximos passos:

1. Abra a pasta no VS Code ou Cursor.
2. Rode \`npm install\`.
3. Instale o framework escolhido.
4. Gere ou copie as specs e fixtures pelo QA Orbit.
`
}

function createCypressConfig() {
  return `import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
  },
})
`
}

function createPlaywrightConfig() {
  return `import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    trace: 'on-first-retry',
  },
})
`
}

function createSeleniumIndex() {
  return `console.log('Workspace Selenium estruturado pelo QA Orbit. Adicione aqui o bootstrap dos seus testes.');`
}

async function writeIfMissing(filePath, content) {
  const existing = await fs.stat(filePath).catch(() => null)
  if (existing) return false
  await fs.writeFile(filePath, content, 'utf8')
  return true
}

function frameworkInstallCommand(framework) {
  if (framework === 'playwright') return 'npm install -D @playwright/test && npx playwright install'
  if (framework === 'selenium') return 'npm install selenium-webdriver'
  return 'npm install -D cypress'
}

function frameworkStartCommand(framework) {
  if (framework === 'playwright') return 'npm run pw:open'
  if (framework === 'selenium') return 'npm test'
  return 'npm run cy:open'
}

export async function scaffoldAutomationWorkspace(input = {}) {
  const framework = String(input.framework || 'cypress').toLowerCase()
  const workspaceRoot = await assertSafeWorkspaceRoot(
    input.workspaceRoot || process.env.QA_ORBIT_AUTOMATION_WORKSPACE_ROOT || path.join(process.cwd(), 'automation-workspaces'),
  )

  const projectSlug = sanitizeSlug(input.projectName || 'projeto-automacao', 'projeto-automacao')
  const moduleSlug = sanitizeSlug(input.moduleName || 'modulo', 'modulo')
  const submoduleSlug = sanitizeSlug(input.submoduleName || 'submodulo', 'submodulo')
  const suiteSlug = sanitizeSlug(input.suiteName || 'suite', 'suite')
  const projectName = String(input.projectName || 'Projeto automacao').trim() || 'Projeto automacao'

  const workingDir = path.join(workspaceRoot, projectSlug)
  await fs.mkdir(workingDir, { recursive: true })

  const relativeSpecPath = framework === 'cypress'
    ? buildPosixPath('cypress', 'e2e', moduleSlug, submoduleSlug, `${suiteSlug}.cy.js`)
    : buildPosixPath('tests', moduleSlug, submoduleSlug, framework === 'playwright' ? `${suiteSlug}.spec.ts` : `${suiteSlug}.test.js`)
  const relativeFixturePath = framework === 'cypress'
    ? buildPosixPath('cypress', 'fixtures', 'qa-orbit', moduleSlug, submoduleSlug, `${suiteSlug}.json`)
    : ''

  const dirs = framework === 'cypress'
    ? [
        path.join(workingDir, 'cypress', 'e2e', moduleSlug, submoduleSlug),
        path.join(workingDir, 'cypress', 'fixtures', 'qa-orbit', moduleSlug, submoduleSlug),
        path.join(workingDir, 'cypress', 'support', 'qa-orbit'),
      ]
    : [
        path.join(workingDir, 'tests', moduleSlug, submoduleSlug),
      ]

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }

  const createdFiles = []
  const packageJsonPath = path.join(workingDir, 'package.json')
  if (await writeIfMissing(packageJsonPath, createPackageJson(projectSlug, framework))) createdFiles.push(path.relative(workingDir, packageJsonPath).replace(/\\/g, '/'))

  const manifestPath = path.join(workingDir, 'qa-orbit.suites.json')
  if (await writeIfMissing(manifestPath, createManifest(projectSlug, projectName))) createdFiles.push(path.relative(workingDir, manifestPath).replace(/\\/g, '/'))

  const readmePath = path.join(workingDir, 'README.md')
  if (await writeIfMissing(readmePath, createReadme({ projectName, framework, moduleSlug, submoduleSlug }))) createdFiles.push(path.relative(workingDir, readmePath).replace(/\\/g, '/'))

  let helperPath = ''
  if (framework === 'cypress') {
    const configPath = path.join(workingDir, 'cypress.config.js')
    if (await writeIfMissing(configPath, createCypressConfig())) createdFiles.push(path.relative(workingDir, configPath).replace(/\\/g, '/'))

    const helperFilePath = path.join(workingDir, 'cypress', 'support', 'qa-orbit', 'run-blueprint.js')
    if (await writeIfMissing(helperFilePath, RUN_BLUEPRINT_HELPER)) createdFiles.push(path.relative(workingDir, helperFilePath).replace(/\\/g, '/'))
    helperPath = 'cypress/support/qa-orbit/run-blueprint.js'
  }

  if (framework === 'playwright') {
    const configPath = path.join(workingDir, 'playwright.config.ts')
    if (await writeIfMissing(configPath, createPlaywrightConfig())) createdFiles.push(path.relative(workingDir, configPath).replace(/\\/g, '/'))
  }

  if (framework === 'selenium') {
    const indexPath = path.join(workingDir, 'tests', 'index.js')
    if (await writeIfMissing(indexPath, createSeleniumIndex())) createdFiles.push(path.relative(workingDir, indexPath).replace(/\\/g, '/'))
  }

  return {
    framework,
    workspaceRoot,
    workingDir,
    createdPaths: {
      projectRoot: workingDir,
      specDir: path.dirname(relativeSpecPath).replace(/\\/g, '/'),
      fixtureDir: relativeFixturePath ? path.dirname(relativeFixturePath).replace(/\\/g, '/') : '',
      helperPath,
      manifestPath: 'qa-orbit.suites.json',
      readmePath: 'README.md',
    },
    suggestedPaths: {
      specPath: relativeSpecPath,
      fixturePath: relativeFixturePath,
    },
    commands: {
      openInVscode: `code "${workingDir}"`,
      openInCursor: `cursor "${workingDir}"`,
      enterDir: `cd "${workingDir}"`,
      npmInstall: 'npm install',
      frameworkInstall: frameworkInstallCommand(framework),
      openFramework: frameworkStartCommand(framework),
    },
    createdFiles,
    warnings: [
      'A estrutura foi criada, mas as dependencias ainda precisam ser instaladas manualmente.',
      'Revise se a pasta escolhida e a raiz oficial do workspace antes de gerar suites reais.',
    ],
  }
}
