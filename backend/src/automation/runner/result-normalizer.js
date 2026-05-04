import { sanitizeFreeText } from '../core/log-sanitizer.js'

function parsePlaywrightSummary(stdout) {
  const jsonStart = String(stdout || '').indexOf('{')
  if (jsonStart < 0) return {}

  try {
    const parsed = JSON.parse(String(stdout).slice(jsonStart))
    const stats = parsed.stats || {}
    return {
      total: Number(stats.expected || 0) + Number(stats.unexpected || 0) + Number(stats.skipped || 0),
      passed: Number(stats.expected || 0),
      failed: Number(stats.unexpected || 0),
      skipped: Number(stats.skipped || 0),
    }
  } catch {
    return {}
  }
}

function parseCypressSummary(stdout) {
  const text = String(stdout || '')
  const match = text.match(/(\d+)\s+passing/i)
  const failedMatch = text.match(/(\d+)\s+failing/i)

  if (!match && !failedMatch) return {}

  const passed = Number(match?.[1] || 0)
  const failed = Number(failedMatch?.[1] || 0)
  return {
    total: passed + failed,
    passed,
    failed,
  }
}

export function extractMainError(stdout, stderr, framework) {
  const lines = `${stderr || ''}\n${stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const matchers = framework === 'playwright'
    ? [/Error:/i, /Timeout/i, /expect\(/i, /locator/i, /failed/i]
    : framework === 'selenium'
      ? [/NoSuchElement/i, /TimeoutError/i, /SessionNotCreated/i, /AssertionError/i, /Error:/i]
      : [/CypressError/i, /Timed out retrying/i, /AssertionError/i, /Expected to find element/i, /failed because/i]

  for (const matcher of matchers) {
    const line = lines.find((candidate) => matcher.test(candidate))
    if (line) return sanitizeFreeText(line, 1000)
  }

  return sanitizeFreeText(lines[0] || '', 1000)
}

export function normalizeExecutionResult(input) {
  const stdout = sanitizeFreeText(input.stdout || '')
  const stderr = sanitizeFreeText(input.stderr || '')
  const summary = input.framework === 'playwright'
    ? parsePlaywrightSummary(input.stdout)
    : input.framework === 'cypress'
      ? parseCypressSummary(input.stdout)
      : {}

  return {
    status: input.error ? 'error' : input.exitCode === 0 ? 'passed' : 'failed',
    framework: input.framework,
    command: input.displayCommand || input.command,
    workingDir: input.workingDir,
    exitCode: input.exitCode,
    durationMs: input.durationMs,
    stdout,
    stderr,
    artifacts: input.artifacts || {
      screenshots: [],
      videos: [],
      traces: [],
      reports: [],
    },
    summary,
    mainError: input.exitCode === 0 ? '' : extractMainError(stdout, stderr, input.framework),
    warnings: input.warnings || [],
  }
}

