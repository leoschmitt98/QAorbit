import fs from 'node:fs/promises'
import path from 'node:path'

export function getSafeRoots() {
  return [
    process.cwd(),
    path.resolve(process.cwd(), 'storage'),
    process.env.QA_ORBIT_AUTOMATION_WORKSPACE_ROOT,
    process.env.QA_ORBIT_RUNNER_WORKSPACE_ROOT,
  ].filter(Boolean).map((root) => path.resolve(root))
}

export function isInsideDirectory(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath)
  return !relativePath || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

export async function assertSafeWorkingDir(workingDir) {
  const resolved = path.resolve(String(workingDir || '').trim())
  const stat = await fs.stat(resolved).catch(() => null)

  if (!stat?.isDirectory()) {
    const error = new Error('workingDir nao encontrado ou nao e uma pasta.')
    error.statusCode = 400
    throw error
  }

  const safeRoots = getSafeRoots()
  if (!safeRoots.some((root) => isInsideDirectory(root, resolved))) {
    const error = new Error('workingDir fora das pastas seguras de automacao. Configure QA_ORBIT_AUTOMATION_WORKSPACE_ROOT para liberar workspaces externos.')
    error.statusCode = 400
    throw error
  }

  return resolved
}

export async function assertSafeWorkspaceRoot(workspaceRoot) {
  const resolved = path.resolve(String(workspaceRoot || '').trim())
  if (!resolved) {
    const error = new Error('Informe a raiz do workspace de automacao.')
    error.statusCode = 400
    throw error
  }

  const safeRoots = getSafeRoots()
  if (!safeRoots.some((root) => isInsideDirectory(root, resolved))) {
    const error = new Error('Raiz do workspace fora das pastas seguras de automacao. Configure QA_ORBIT_AUTOMATION_WORKSPACE_ROOT para liberar workspaces externos.')
    error.statusCode = 400
    throw error
  }

  await fs.mkdir(resolved, { recursive: true })
  return resolved
}
