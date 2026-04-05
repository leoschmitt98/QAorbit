import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import areasRouter from './routes/areas.js'
import bugsRouter from './routes/bugs.js'
import chamadosRouter from './routes/chamados.js'
import documentosFuncionaisRouter from './routes/documentos-funcionais.js'
import evidenciasRouter from './routes/evidencias.js'
import historicoTestesRouter from './routes/historico-testes.js'
import modulosRouter from './routes/modulos.js'
import projetosRouter from './routes/projetos.js'
import quadrosRouter from './routes/quadros.js'
import { closePool } from './db.js'

const app = express()
const port = Number(process.env.API_PORT || 3001)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../storage')

app.use(express.json({ limit: '50mb' }))
app.use('/storage', express.static(storageRoot))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/projetos', projetosRouter)
app.use('/api/modulos', modulosRouter)
app.use('/api/areas', areasRouter)
app.use('/api/chamados', chamadosRouter)
app.use('/api/documentos-funcionais', documentosFuncionaisRouter)
app.use('/api/bugs', bugsRouter)
app.use('/api/evidencias', evidenciasRouter)
app.use('/api/historico-testes', historicoTestesRouter)
app.use('/api/quadros', quadrosRouter)

app.listen(port, () => {
  console.log(`QA Orbit backend online at http://localhost:${port}`)
})

async function shutdown() {
  await closePool()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
