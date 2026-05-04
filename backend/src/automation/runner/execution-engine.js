import { spawn } from 'node:child_process'
import { sanitizeEnv } from '../core/log-sanitizer.js'
import { buildCypressCommand, collectCypressArtifacts } from './framework-adapters/cypress-adapter.js'
import { buildPlaywrightCommand, collectPlaywrightArtifacts } from './framework-adapters/playwright-adapter.js'
import { buildSeleniumCommand, collectSeleniumArtifacts } from './framework-adapters/selenium-adapter.js'
import { normalizeExecutionResult } from './result-normalizer.js'
import { assertSafeWorkingDir } from './safe-workspace.js'

const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/s/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /powershell/i,
  /curl\s+[^|]*\|\s*sh/i,
  /wget\s+[^|]*\|\s*sh/i,
  /&&/,
  /;/,
  /\|/,
]

const ALLOWED_CUSTOM_COMMANDS = {
  selenium: [/^npm\s+test$/i, /^npm\s+run\s+[a-z0-9:_-]+$/i, /^node\s+[a-z0-9_./\\-]+$/i],
}

function assertSafeCommand(framework, command) {
  const commandText = String(command || '').trim()
  if (!commandText) return

  if (DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(commandText))) {
    const error = new Error('Comando bloqueado por conter padrao perigoso.')
    error.statusCode = 400
    throw error
  }

  const allowed = ALLOWED_CUSTOM_COMMANDS[framework] || []
  if (allowed.length && !allowed.some((pattern) => pattern.test(commandText))) {
    const error = new Error(`Comando customizado nao permitido para ${framework}.`)
    error.statusCode = 400
    throw error
  }
}

function buildSpawnEnv(extraEnv) {
  const blockedKeys = new Set(['ELECTRON_RUN_AS_NODE'])
  const safeEnv = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (!key || key.includes('=') || value == null) continue
    if (blockedKeys.has(key.toUpperCase())) continue
    safeEnv[key] = String(value)
  }

  return {
    ...safeEnv,
    ...sanitizeEnv(extraEnv),
  }
}

function splitCommand(commandText) {
  const matches = String(commandText || '').match(/"[^"]+"|'[^']+'|\S+/g) || []
  return matches.map((part) => part.replace(/^['"]|['"]$/g, ''))
}

async function buildFrameworkCommand(input) {
  switch (input.framework) {
    case 'playwright':
      return buildPlaywrightCommand(input)
    case 'selenium':
      return buildSeleniumCommand(input)
    case 'cypress':
    default:
      return buildCypressCommand(input)
  }
}

async function collectArtifacts(framework, workingDir) {
  switch (framework) {
    case 'playwright':
      return collectPlaywrightArtifacts(workingDir)
    case 'selenium':
      return collectSeleniumArtifacts(workingDir)
    case 'cypress':
    default:
      return collectCypressArtifacts(workingDir)
  }
}

export async function executeAutomation(input) {
  const framework = String(input.framework || 'cypress').toLowerCase()
  const workingDir = await assertSafeWorkingDir(input.workingDir)
  assertSafeCommand(framework, input.command)

  const commandInput = {
    ...input,
    framework,
    workingDir,
  }
  const frameworkCommand = await buildFrameworkCommand(commandInput)
  let command = frameworkCommand.command
  let args = frameworkCommand.args || []

  if (frameworkCommand.custom) {
    const parts = splitCommand(frameworkCommand.command)
    command = parts.shift()
    args = parts
  }

  const startedAt = Date.now()
  const child = spawn(command, args, {
    cwd: workingDir,
    shell: process.platform === 'win32',
    windowsHide: true,
    env: buildSpawnEnv(input.env || {}),
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const result = await new Promise((resolve) => {
    child.on('close', (code) => resolve({ exitCode: code ?? 1 }))
    child.on('error', (error) => resolve({ exitCode: 1, error }))
  })
  const durationMs = Date.now() - startedAt
  const artifacts = await collectArtifacts(framework, workingDir)

  return normalizeExecutionResult({
    framework,
    command,
    displayCommand: frameworkCommand.displayCommand,
    workingDir,
    exitCode: result.exitCode,
    durationMs,
    stdout,
    stderr,
    artifacts,
    error: result.error,
    warnings: result.error ? [result.error.message] : [],
  })
}

export async function runAutomationBattery(battery) {
  const startedAt = new Date()
  const items = Array.isArray(battery.items) ? battery.items : []
  const results = []

  for (const item of items) {
    const result = await executeAutomation({
      framework: item.framework || battery.framework,
      workingDir: battery.workingDir,
      command: item.command,
      specPath: item.specPath,
      baseUrl: item.baseUrl || battery.baseUrl,
      env: battery.env || {},
    })
    results.push({
      name: item.name || item.specPath || item.command || 'Item sem nome',
      ...result,
    })
  }

  const finishedAt = new Date()
  const passed = results.filter((result) => result.status === 'passed').length
  const failed = results.filter((result) => result.status === 'failed' || result.status === 'error').length
  const status = failed === 0 ? 'passed' : passed > 0 ? 'partial' : 'failed'

  return {
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    total: results.length,
    passed,
    failed,
    results,
  }
}
