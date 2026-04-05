import { Router } from 'express'
import {
  listWorkflowProgress,
  loadWorkflowProgress,
  saveWorkflowProgress,
  updateWorkflowLifecycleStatus,
} from '../lib/chamados-store.js'

const router = Router()

router.get('/progressos', async (_req, res) => {
  try {
    const saved = await listWorkflowProgress()
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
    const draft = await loadWorkflowProgress(req.params.ticketId)
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
    const result = await saveWorkflowProgress(req.params.ticketId, req.body ?? {})
    return res.json(result)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel salvar o progresso do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:ticketId/status', async (req, res) => {
  try {
    const nextLifecycleStatus = req.body?.lifecycleStatus === 'Finalizado' ? 'Finalizado' : 'Em andamento'
    const result = await updateWorkflowLifecycleStatus(req.params.ticketId, nextLifecycleStatus)
    return res.json(result)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel atualizar o status operacional do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
