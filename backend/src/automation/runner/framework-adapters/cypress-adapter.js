import fs from 'node:fs/promises'
import path from 'node:path'

export async function buildCypressCommand(input) {
  const localBinary = process.platform === 'win32'
    ? path.join(input.workingDir, 'node_modules', '.bin', 'cypress.cmd')
    : path.join(input.workingDir, 'node_modules', '.bin', 'cypress')
  const localStat = await fs.stat(localBinary).catch(() => null)
  const command = localStat?.isFile() ? localBinary : process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const args = localStat?.isFile() ? ['run'] : ['cypress', 'run']

  if (input.specPath) {
    args.push('--spec', input.specPath)
  }

  if (input.baseUrl) {
    args.push('--config', `baseUrl=${input.baseUrl}`)
  }

  return {
    command,
    args,
    displayCommand: `${localStat?.isFile() ? 'cypress' : 'npx cypress'} ${args.filter((arg) => arg !== 'cypress').join(' ')}`.trim(),
  }
}

export async function collectCypressArtifacts(workingDir) {
  return {
    screenshots: await listFiles(path.join(workingDir, 'cypress', 'screenshots'), ['.png']),
    videos: await listFiles(path.join(workingDir, 'cypress', 'videos'), ['.mp4']),
    traces: [],
    reports: await listFiles(path.join(workingDir, 'cypress', 'reports'), ['.json', '.html', '.xml']),
  }
}

async function listFiles(directory, extensions) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const result = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await listFiles(fullPath, extensions)))
      continue
    }

    if (extensions.includes(path.extname(entry.name).toLowerCase())) {
      result.push(fullPath)
    }
  }

  return result
}

