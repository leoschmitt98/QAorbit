import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import areasRouter from './routes/areas.js'
import authRouter from './routes/auth.js'
import bugsRouter from './routes/bugs.js'
import chamadosRouter from './routes/chamados.js'
import automationBuilderRouter from './automation/routes/automation-builder-routes.js'
import cypressBuilderRouter from './routes/cypress-builder.js'
import demandasRouter from './routes/demandas.js'
import documentosFuncionaisRouter from './routes/documentos-funcionais.js'
import evidenciasRouter from './routes/evidencias.js'
import historicoTestesRouter from './routes/historico-testes.js'
import modulosRouter from './routes/modulos.js'
import projetoPortaisRouter from './routes/projeto-portais.js'
import projetosRouter from './routes/projetos.js'
import qaRunnerRouter from './routes/qa-runner.js'
import quadrosRouter from './routes/quadros.js'
import smartRecorderRouter, { handleSmartRecorderCapture } from './routes/smart-recorder.js'
import testPlansRouter from './routes/test-plans.js'
import { closePool } from './db.js'
import { ensureAuthSchemaAndBootstrap, requireAuth } from './lib/auth.js'
import { ensureAutomationRunsSchema } from './automation/runner/automation-runs-store.js'

const app = express()
const port = Number(process.env.API_PORT || 3001)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../storage')

app.set('trust proxy', 1)
app.use(express.json({ limit: '50mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.options('/api/smart-recorder/capture/:id/steps', handleSmartRecorderCapture)
app.post('/api/smart-recorder/capture/:id/steps', handleSmartRecorderCapture)
app.use('/api/auth', authRouter)
app.use('/storage', requireAuth, express.static(storageRoot))
app.use('/api', requireAuth)

app.use('/api/projetos', projetosRouter)
app.use('/api/automation', automationBuilderRouter)
app.use('/api/cypress-builder', cypressBuilderRouter)
app.use('/api/qa-runner', qaRunnerRouter)
app.use('/api/smart-recorder', smartRecorderRouter)
app.use('/api/projeto-portais', projetoPortaisRouter)
app.use('/api/modulos', modulosRouter)
app.use('/api/areas', areasRouter)
app.use('/api/chamados', chamadosRouter)
app.use('/api/demandas', demandasRouter)
app.use('/api/documentos-funcionais', documentosFuncionaisRouter)
app.use('/api/test-plans', testPlansRouter)
app.use('/api/bugs', bugsRouter)
app.use('/api/evidencias', evidenciasRouter)
app.use('/api/historico-testes', historicoTestesRouter)
app.use('/api/quadros', quadrosRouter)

ensureAuthSchemaAndBootstrap()
  .then(() => ensureAutomationRunsSchema())
  .then(() => {
    app.listen(port, () => {
      console.log(`QA Orbit backend online at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Falha ao iniciar autenticacao do QA Orbit:', error)
    process.exit(1)
  })

async function shutdown() {
  await closePool()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
