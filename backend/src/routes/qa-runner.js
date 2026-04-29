import { Router } from 'express'
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const router = Router()

const CYPRESS_SPEC_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const WINDOWS_DRIVE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function normalizePath(value) {
  return path.resolve(String(value || '').trim())
}

async function assertWorkspacePath(workspacePath) {
  const resolvedPath = normalizePath(workspacePath)
  const stat = await fs.stat(resolvedPath).catch(() => null)

  if (!stat?.isDirectory()) {
    const error = new Error('Caminho do workspace Cypress nao encontrado.')
    error.statusCode = 400
    throw error
  }

  return resolvedPath
}

async function listWindowsRoots() {
  const roots = await Promise.all(
    WINDOWS_DRIVE_LETTERS.map(async (letter) => {
      const drivePath = `${letter}:\\`
      const stat = await fs.stat(drivePath).catch(() => null)
      return stat?.isDirectory()
        ? {
            name: drivePath,
            path: drivePath,
          }
        : null
    }),
  )

  return roots.filter(Boolean)
}

async function listDirectoryEntries(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(directoryPath, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return directories
}

function chooseWindowsDirectory(initialPath) {
  const selectedPath = String(initialPath || '').trim()
  const safeInitialPath = JSON.stringify(selectedPath)
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Selecione o workspace Cypress'
$dialog.ShowNewFolderButton = $true
$initialPath = ${safeInitialPath}
if ($initialPath -and (Test-Path -LiteralPath $initialPath)) {
  $dialog.SelectedPath = $initialPath
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
`

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-Command', script],
      { windowsHide: false, timeout: 120000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
          return
        }

        resolve(stdout.trim())
      },
    )
  })
}

function normalizeSuite(suite, workspacePath) {
  const spec = String(suite?.spec || '').replace(/\\/g, '/')
  const name = String(suite?.name || spec || 'Suite sem nome').trim()

  return {
    id: String(suite?.id || spec || name).trim(),
    name,
    spec,
    description: String(suite?.description || '').trim(),
    requiredParams: Array.isArray(suite?.requiredParams) ? suite.requiredParams.map(String) : [],
    tags: Array.isArray(suite?.tags) ? suite.tags.map(String) : [],
    absoluteSpecPath: spec ? path.resolve(workspacePath, spec) : '',
  }
}

function isInsideDirectory(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath)
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function buildSpawnEnv(extraEnv) {
  const safeEnv = {}
  const blockedKeys = new Set(['ELECTRON_RUN_AS_NODE'])

  for (const [key, value] of Object.entries(process.env)) {
    if (!key || key.includes('=') || value == null) continue
    if (blockedKeys.has(key.toUpperCase())) continue
    safeEnv[key] = String(value)
  }

  for (const [key, value] of Object.entries(extraEnv)) {
    if (!key || key.includes('=')) continue
    safeEnv[key] = String(value ?? '')
  }

  return safeEnv
}

async function resolveCypressCommand(workspacePath) {
  const localBinary = process.platform === 'win32'
    ? path.join(workspacePath, 'node_modules', '.bin', 'cypress.cmd')
    : path.join(workspacePath, 'node_modules', '.bin', 'cypress')
  const localStat = await fs.stat(localBinary).catch(() => null)

  if (localStat?.isFile()) {
    return {
      command: localBinary,
      argsPrefix: [],
    }
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    argsPrefix: ['cypress'],
  }
}

async function readSuitesManifest(workspacePath) {
  const manifestPath = path.join(workspacePath, 'qa-orbit.suites.json')
  const raw = await fs.readFile(manifestPath, 'utf-8').catch(() => '')
  if (!raw) return null

  const parsed = JSON.parse(raw)
  const suites = Array.isArray(parsed?.suites) ? parsed.suites : []

  return {
    source: 'manifest',
    projectKey: String(parsed?.projectKey || '').trim(),
    projectName: String(parsed?.projectName || '').trim(),
    suites: suites.map((suite) => normalizeSuite(suite, workspacePath)).filter((suite) => suite.spec),
  }
}

async function walkSpecs(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const specs = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      specs.push(...(await walkSpecs(fullPath)))
      continue
    }

    const extension = path.extname(entry.name)
    if (!CYPRESS_SPEC_EXTENSIONS.has(extension)) continue
    if (!entry.name.includes('.cy.') && !entry.name.includes('.spec.')) continue

    specs.push(fullPath)
  }

  return specs
}

function titleFromSpec(relativeSpec) {
  return relativeSpec
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/\.(cy|spec)\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || relativeSpec
}

async function scanSuites(workspacePath) {
  const manifest = await readSuitesManifest(workspacePath)
  if (manifest) return manifest

  const e2ePath = path.join(workspacePath, 'cypress', 'e2e')
  const specs = await walkSpecs(e2ePath)

  return {
    source: 'scan',
    projectKey: '',
    projectName: '',
    suites: specs.map((specPath) => {
      const spec = path.relative(workspacePath, specPath).replace(/\\/g, '/')
      return normalizeSuite(
        {
          id: spec,
          name: titleFromSpec(spec),
          spec,
          requiredParams: ['baseUrl'],
        },
        workspacePath,
      )
    }),
  }
}

router.post('/suites', async (req, res) => {
  try {
    const workspacePath = await assertWorkspacePath(req.body?.workspacePath)
    const result = await scanSuites(workspacePath)

    return res.json({
      workspacePath,
      ...result,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel buscar suites Cypress.',
    })
  }
})

router.get('/directories', async (req, res) => {
  try {
    const requestedPath = String(req.query?.path || '').trim()

    if (!requestedPath && process.platform === 'win32') {
      return res.json({
        currentPath: '',
        parentPath: '',
        entries: await listWindowsRoots(),
      })
    }

    const currentPath = requestedPath ? normalizePath(requestedPath) : path.parse(process.cwd()).root
    const stat = await fs.stat(currentPath).catch(() => null)

    if (!stat?.isDirectory()) {
      return res.status(400).json({ message: 'Pasta nao encontrada.' })
    }

    const rootPath = path.parse(currentPath).root
    const parentPath = currentPath === rootPath ? '' : path.dirname(currentPath)

    return res.json({
      currentPath,
      parentPath,
      entries: await listDirectoryEntries(currentPath),
    })
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel listar as pastas.',
    })
  }
})

router.post('/choose-directory', async (req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ message: 'Seletor nativo disponivel apenas no Windows.' })
  }

  try {
    const selectedPath = await chooseWindowsDirectory(req.body?.initialPath)

    return res.json({
      canceled: !selectedPath,
      selectedPath,
    })
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel abrir o seletor de pastas.',
    })
  }
})

router.post('/run', async (req, res) => {
  try {
    const workspacePath = await assertWorkspacePath(req.body?.workspacePath)
    const spec = String(req.body?.spec || '').trim()
    const absoluteSpecPath = path.resolve(workspacePath, spec)

    if (!spec || !isInsideDirectory(workspacePath, absoluteSpecPath)) {
      return res.status(400).json({ message: 'Spec Cypress invalida.' })
    }

    const specStat = await fs.stat(absoluteSpecPath).catch(() => null)
    if (!specStat?.isFile()) {
      return res.status(400).json({ message: 'Arquivo de spec nao encontrado no workspace informado.' })
    }

    const envValues = {
      QA_ORBIT_PROJECT_ID: String(req.body?.projectId || ''),
      QA_ORBIT_PROJECT_NAME: String(req.body?.projectName || ''),
      CYPRESS_username: String(req.body?.username || ''),
      CYPRESS_password: String(req.body?.password || ''),
      ...Object.fromEntries(
        Object.entries(req.body?.extraEnv || {}).map(([key, value]) => [`CYPRESS_${key}`, String(value ?? '')]),
      ),
    }

    const cypressCommand = await resolveCypressCommand(workspacePath)
    const args = [...cypressCommand.argsPrefix, 'run', '--spec', spec]
    if (req.body?.baseUrl) {
      args.push('--config', `baseUrl=${String(req.body.baseUrl)}`)
    }

    const command = cypressCommand.command
    const startedAt = new Date()
    const child = spawn(command, args, {
      cwd: workspacePath,
      shell: process.platform === 'win32',
      windowsHide: true,
      env: buildSpawnEnv(envValues),
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
      child.on('close', (code) => resolve({ code: code ?? 1 }))
      child.on('error', (error) => resolve({ code: 1, error }))
    })

    const finishedAt = new Date()

    return res.json({
      ok: result.code === 0,
      status: result.code === 0 ? 'passed' : 'failed',
      exitCode: result.code,
      command: `${command} ${args.join(' ')}`,
      workspacePath,
      spec,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      stdout,
      stderr,
      error: result.error instanceof Error ? result.error.message : '',
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel executar a suite Cypress.',
    })
  }
})

export default router
