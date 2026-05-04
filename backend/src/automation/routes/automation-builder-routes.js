import { Router } from 'express'
import { normalizeAutomationBlueprint } from '../core/step-normalizer.js'
import { generateAutomation } from '../generators/index.js'
import { executeAutomation, runAutomationBattery } from '../runner/execution-engine.js'
import { buildAutomationFailureContext } from '../core/failure-context.js'
import { scaffoldAutomationWorkspace } from '../core/workspace-scaffold.js'
import {
  buildFailureContextFromRun,
  getAutomationRun,
  listAutomationRunItems,
  listAutomationRuns,
  saveBatteryAutomationRun,
  saveSingleAutomationRun,
} from '../runner/automation-runs-store.js'

const router = Router()

export function buildAutomationPreview(blueprintInput, options = {}) {
  if (!blueprintInput || typeof blueprintInput !== 'object') {
    const error = new Error('Blueprint invalido.')
    error.statusCode = 400
    throw error
  }

  const { blueprint, warnings } = normalizeAutomationBlueprint(blueprintInput, options)
  const generated = generateAutomation(blueprint, options)

  return {
    ...generated,
    neutralBlueprint: blueprint,
    warnings: [...warnings],
  }
}

router.post('/generate', async (req, res) => {
  try {
    return res.json(buildAutomationPreview(req.body?.blueprint, req.body?.options || {}))
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel gerar automacao.',
    })
  }
})

router.post('/workspace-structure', async (req, res) => {
  try {
    return res.json(await scaffoldAutomationWorkspace(req.body || {}))
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel estruturar o workspace de automacao.',
    })
  }
})

router.post('/run', async (req, res) => {
  try {
    const input = {
      framework: req.body?.framework,
      command: req.body?.command,
      workingDir: req.body?.workingDir,
      specPath: req.body?.specPath,
      baseUrl: req.body?.baseUrl,
      env: req.body?.env || {},
      name: req.body?.name || req.body?.suiteName,
    }
    const result = await executeAutomation(input)
    const runId = await saveSingleAutomationRun(input, result)

    return res.json({
      ...result,
      runId,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel executar automacao.',
    })
  }
})

router.post('/failure-context', async (req, res) => {
  try {
    return res.json(buildAutomationFailureContext(req.body || {}))
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel gerar contexto de correcao.',
    })
  }
})

router.post('/batteries/run', async (req, res) => {
  try {
    const battery = req.body?.battery || req.body || {}
    const result = await runAutomationBattery(battery)
    const runId = await saveBatteryAutomationRun(battery, result)

    return res.json({
      ...result,
      runId,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel executar bateria.',
    })
  }
})

router.get('/runs', async (req, res) => {
  try {
    return res.json({
      runs: await listAutomationRuns(req.query?.limit),
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel listar historico de automacao.',
    })
  }
})

router.get('/runs/:id', async (req, res) => {
  try {
    const run = await getAutomationRun(req.params.id)
    if (!run) return res.status(404).json({ message: 'Execucao nao encontrada.' })

    return res.json({ run })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel carregar execucao.',
    })
  }
})

router.get('/runs/:id/items', async (req, res) => {
  try {
    const run = await getAutomationRun(req.params.id)
    if (!run) return res.status(404).json({ message: 'Execucao nao encontrada.' })

    return res.json({
      run,
      items: await listAutomationRunItems(req.params.id),
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel carregar itens da execucao.',
    })
  }
})

router.get('/runs/:id/failure-context', async (req, res) => {
  try {
    const context = await buildFailureContextFromRun(req.params.id)
    if (!context) return res.status(404).json({ message: 'Execucao sem dados suficientes para correcao assistida.' })

    return res.json(context)
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel gerar contexto da execucao salva.',
    })
  }
})

export default router
