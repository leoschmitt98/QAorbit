import fs from 'node:fs/promises'
import path from 'node:path'

export async function buildPlaywrightCommand(input) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const args = ['playwright', 'test']

  if (input.specPath) {
    args.push(input.specPath)
  }

  args.push('--reporter=json')

  return {
    command,
    args,
    displayCommand: `npx playwright test${input.specPath ? ` "${input.specPath}"` : ''} --reporter=json`,
  }
}

export async function collectPlaywrightArtifacts(workingDir) {
  return {
    screenshots: await listFiles(path.join(workingDir, 'test-results'), ['.png']),
    videos: await listFiles(path.join(workingDir, 'test-results'), ['.webm', '.mp4']),
    traces: await listFiles(path.join(workingDir, 'test-results'), ['.zip']),
    reports: await listFiles(path.join(workingDir, 'playwright-report'), ['.html', '.json']),
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

