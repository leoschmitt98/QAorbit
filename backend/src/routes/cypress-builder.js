import { Router } from 'express'
import { buildAutomationFailureContext } from '../automation/core/failure-context.js'
import { buildAutomationPreview } from '../automation/routes/automation-builder-routes.js'

const router = Router()

router.post('/preview', async (req, res) => {
  try {
    const options = {
      ...(req.body?.options || {}),
      framework: 'cypress',
      type: 'web-e2e',
      language: 'javascript',
      pattern: 'simple',
    }

    return res.json(buildAutomationPreview(req.body?.blueprint, options))
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel gerar o preview Cypress.',
    })
  }
})

router.post('/failure-context', async (req, res) => {
  try {
    return res.json(
      buildAutomationFailureContext({
        framework: 'cypress',
        blueprint: req.body?.blueprint,
        runResult: {
          framework: 'cypress',
          ...(req.body?.runResult || {}),
        },
      }),
    )
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel gerar o contexto de falha.',
    })
  }
})

export default router
