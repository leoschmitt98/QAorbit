import { Router } from 'express'
import {
  deleteWorkflowProgress,
  listWorkflowProgress,
  loadWorkflowProgress,
  saveWorkflowProgress,
  updateWorkflowLifecycleStatus,
} from '../lib/chamados-store.js'

const router = Router()

router.get('/progressos', async (req, res) => {
  try {
    const saved = await listWorkflowProgress(req.auth, req.query.scope)
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
    const draft = await loadWorkflowProgress(req.params.ticketId, req.auth)
    return res.json(draft)
  } catch (error) {
    return res.status(error instanceof Error && error.message.includes('Acesso restrito') ? 403 : 404).json({
      message: error instanceof Error && error.message.includes('Acesso restrito')
        ? 'Este chamado pertence ao workspace de outro QA.'
        : 'Nao foi encontrado progresso salvo para este chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.put('/:ticketId/progresso', async (req, res) => {
  try {
    const result = await saveWorkflowProgress(req.params.ticketId, req.body ?? {}, req.auth)
    return res.json(result)
  } catch (error) {
    return res.status(error instanceof Error && error.message.includes('Acesso restrito') ? 403 : 500).json({
      message: error instanceof Error && error.message.includes('Acesso restrito')
        ? 'Este chamado pertence ao workspace de outro QA.'
        : 'Nao foi possivel salvar o progresso do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:ticketId/status', async (req, res) => {
  try {
    const nextLifecycleStatus = req.body?.lifecycleStatus === 'Finalizado' ? 'Finalizado' : 'Em andamento'
    const result = await updateWorkflowLifecycleStatus(req.params.ticketId, nextLifecycleStatus, req.auth)
    return res.json(result)
  } catch (error) {
    return res.status(error instanceof Error && error.message.includes('Acesso restrito') ? 403 : 500).json({
      message: error instanceof Error && error.message.includes('Acesso restrito')
        ? 'Este chamado pertence ao workspace de outro QA.'
        : 'Nao foi possivel atualizar o status operacional do chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:ticketId', async (req, res) => {
  try {
    const result = await deleteWorkflowProgress(req.params.ticketId, req.auth)
    return res.json(result)
  } catch (error) {
    return res.status(error instanceof Error && error.message.includes('Acesso restrito') ? 403 : 500).json({
      message: error instanceof Error && error.message.includes('Acesso restrito')
        ? 'Este chamado pertence ao workspace de outro QA.'
        : 'Nao foi possivel excluir o chamado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
