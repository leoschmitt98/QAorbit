import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const storageRoot = path.resolve(__dirname, '../../../storage')

export function sanitizeSegment(value) {
  return String(value || 'sem-valor')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

export function ticketDirectory(ticketId) {
  return path.join(storageRoot, 'chamados', sanitizeSegment(ticketId))
}

export function workflowPathForTicket(ticketId) {
  const safeTicketId = sanitizeSegment(ticketId)
  return {
    safeTicketId,
    directory: ticketDirectory(ticketId),
    workflowPath: path.join(ticketDirectory(ticketId), 'workflow.json'),
  }
}

export async function readLegacyWorkflow(ticketId) {
  const { workflowPath } = workflowPathForTicket(ticketId)
  const raw = await fs.readFile(workflowPath, 'utf-8')
  return JSON.parse(raw)
}

export async function writeLegacyWorkflow(ticketId, draft) {
  const { directory, workflowPath } = workflowPathForTicket(ticketId)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(workflowPath, JSON.stringify(draft, null, 2), 'utf-8')
}
