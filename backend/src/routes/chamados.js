import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')

function sanitizeTicketId(ticketId) {
  return (ticketId || 'sem-ticket').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function workflowPathForTicket(ticketId) {
  const safeTicketId = sanitizeTicketId(ticketId)
  return {
    safeTicketId,
    directory: path.join(storageRoot, 'chamados', safeTicketId),
    workflowPath: path.join(storageRoot, 'chamados', safeTicketId, 'workflow.json'),
  }
}

async function readWorkflowForTicket(ticketId) {
  const { workflowPath } = workflowPathForTicket(ticketId)
  const raw = await fs.readFile(workflowPath, 'utf-8')
  return JSON.parse(raw)
}

router.get('/progressos', async (_req, res) => {
  try {
    const chamadosDirectory = path.join(storageRoot, 'chamados')
    const entries = await fs.readdir(chamadosDirectory, { withFileTypes: true }).catch(() => [])
    const saved = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const workflowPath = path.join(chamadosDirectory, entry.name, 'workflow.json')
      try {
        const draft = await readWorkflowForTicket(entry.name)
        saved.push({
          ticketId: draft.ticket?.ticketId || entry.name,
          title: draft.ticket?.title || 'Chamado salvo',
          updatedAt: draft.updatedAt || new Date().toISOString(),
          projectId: draft.ticket?.projectId || '',
          moduleId: draft.ticket?.moduleId || '',
          status: draft.retest?.status || 'Parcial',
          lifecycleStatus: draft.lifecycleStatus || 'Em andamento',
          finalizedAt: draft.finalizedAt || null,
          environment: draft.ticket?.environment || '',
          version: draft.ticket?.version || '',
          currentStep: Number(draft.currentStep || 0),
          framesCount: Array.isArray(draft.retest?.frames) ? draft.retest.frames.length : 0,
          scenariosCount: Array.isArray(draft.scenarios) ? draft.scenarios.length : 0,
          historyRecordsCount: Array.isArray(draft.historyRecordIds) ? draft.historyRecordIds.length : 0,
        })
      } catch {
        continue
      }
    }

    saved.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    return res.json(saved)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar os chamados com progresso salvo.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:ticketId/progresso', async (req, res) => {
  try {
    const draft = await readWorkflowForTicket(req.params.ticketId)
    return res.json(draft)
  } catch (error) {
    return res.status(404).json({
      message: 'Nao foi encontrado progresso salvo para este chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.put('/:ticketId/progresso', async (req, res) => {
  try {
    const { directory, workflowPath } = workflowPathForTicket(req.params.ticketId)
    const updatedAt = new Date().toISOString()
    const existingDraft = await readWorkflowForTicket(req.params.ticketId).catch(() => null)
    const lifecycleStatus = req.body.lifecycleStatus || existingDraft?.lifecycleStatus || 'Em andamento'
    const finalizedAt =
      lifecycleStatus === 'Finalizado'
        ? req.body.finalizedAt || existingDraft?.finalizedAt || updatedAt
        : null

    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(
      workflowPath,
      JSON.stringify(
        {
          ...req.body,
          lifecycleStatus,
          finalizedAt,
          updatedAt,
        },
        null,
        2,
      ),
      'utf-8',
    )

    return res.json({ ok: true, updatedAt })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel salvar o progresso do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:ticketId/status', async (req, res) => {
  try {
    const { workflowPath } = workflowPathForTicket(req.params.ticketId)
    const draft = await readWorkflowForTicket(req.params.ticketId)
    const nextLifecycleStatus = req.body?.lifecycleStatus === 'Finalizado' ? 'Finalizado' : 'Em andamento'
    const updatedAt = new Date().toISOString()

    await fs.writeFile(
      workflowPath,
      JSON.stringify(
        {
          ...draft,
          lifecycleStatus: nextLifecycleStatus,
          finalizedAt: nextLifecycleStatus === 'Finalizado' ? draft.finalizedAt || updatedAt : null,
          updatedAt,
        },
        null,
        2,
      ),
      'utf-8',
    )

    return res.json({
      ok: true,
      lifecycleStatus: nextLifecycleStatus,
      finalizedAt: nextLifecycleStatus === 'Finalizado' ? draft.finalizedAt || updatedAt : null,
      updatedAt,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel atualizar o status operacional do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
