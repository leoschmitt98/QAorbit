import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequest, getPool, sql } from '../db.js'
import { loadWorkflowProgress } from '../lib/chamados-store.js'
import { sanitizeSegment, storageRoot } from '../lib/legacy-storage.js'
import { canAccessOwnedRecord, resolveWorkspaceScope } from '../lib/auth.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const historyRoot = path.join(storageRoot, 'historico-testes')
const RELATED_WEIGHTS = {
  sameProject: 18,
  sameMainModule: 34,
  samePortalArea: 16,
  flowKeyword: 8,
  problemKeyword: 5,
  sharedTag: 10,
  sharedImpactedModule: 12,
  approvedOrPartialResult: 6,
  linkedBug: 7,
}
const REGRESSION_THRESHOLD = 60

function buildHistoryId(ticketId) {
  return `hist-${sanitizeSegment(ticketId)}-${Date.now()}`
}

function historyFilePath(recordId) {
  return path.join(historyRoot, `${sanitizeSegment(recordId)}.json`)
}

function workflowPath(ticketId) {
  const safeTicketId = sanitizeSegment(ticketId)
  return path.join(storageRoot, 'chamados', safeTicketId, 'workflow.json')
}

function evidenceWordPath(ticketId) {
  const safeTicketId = sanitizeSegment(ticketId)
  return path.join(storageRoot, 'chamados', safeTicketId, `evidencia-${safeTicketId}.docx`)
}

function evidenceWordUrl(ticketId) {
  const safeTicketId = sanitizeSegment(ticketId)
  return `/storage/chamados/${encodeURIComponent(safeTicketId)}/evidencia-${encodeURIComponent(safeTicketId)}.docx`
}

function bugWordPath(ticketId, bugId) {
  return path.join(storageRoot, 'chamados', sanitizeSegment(ticketId), 'bugs', `${sanitizeSegment(bugId)}.docx`)
}

function bugWordUrl(ticketId, bugId) {
  return `/storage/chamados/${encodeURIComponent(sanitizeSegment(ticketId))}/bugs/${encodeURIComponent(sanitizeSegment(bugId))}.docx`
}

async function readWorkflow(ticketId) {
  const raw = await fs.readFile(workflowPath(ticketId), 'utf-8')
  return JSON.parse(raw)
}

async function readHistoryRecord(recordId) {
  const raw = await fs.readFile(historyFilePath(recordId), 'utf-8')
  return JSON.parse(raw)
}

async function readAllHistoryRecords() {
  await fs.mkdir(historyRoot, { recursive: true })
  const entries = await fs.readdir(historyRoot, { withFileTypes: true })
  const records = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(historyRoot, entry.name), 'utf-8')
      records.push(JSON.parse(raw))
    } catch {
      continue
    }
  }

  return records
}

async function listHistoryRecordsFromDb() {
  const pool = await getPool()
  if (!pool) return null

  const result = await createRequest(pool).query(`
    SELECT h.*, ownerUser.Nome AS OwnerName
    FROM dbo.HistoricoTestes h
    LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = h.CreatedByUserId
    ORDER BY h.DataCriacao DESC;
    SELECT * FROM dbo.HistoricoTesteModulosImpactados;
    SELECT * FROM dbo.HistoricoTesteTags;
    SELECT * FROM dbo.HistoricoTesteQuadros;
  `)

  return mapHistoryRecords(
    result.recordsets[0] ?? [],
    result.recordsets[1] ?? [],
    result.recordsets[2] ?? [],
    result.recordsets[3] ?? [],
  )
}

function mapHistoryRecords(records, impactedModules, tags, frames) {
  const impactedByHistory = new Map()
  impactedModules.forEach((row) => {
    const current = impactedByHistory.get(row.HistoricoId) ?? []
    current.push(String(row.ModuloId))
    impactedByHistory.set(row.HistoricoId, current)
  })

  const tagsByHistory = new Map()
  tags.forEach((row) => {
    const current = tagsByHistory.get(row.HistoricoId) ?? []
    current.push(String(row.Tag))
    tagsByHistory.set(row.HistoricoId, current)
  })

  const framesByHistory = new Map()
  frames.forEach((row) => {
    const current = framesByHistory.get(row.HistoricoId) ?? []
    current.push({
      id: row.QuadroId,
      name: row.FileName || row.QuadroId,
      imageUrl: row.DownloadUrl || '',
      description: row.Descricao || '',
      fileName: row.FileName || '',
    })
    framesByHistory.set(row.HistoricoId, current)
  })

  return records.map((row) => ({
    id: row.HistoricoId,
    ticketId: row.TicketId,
    bugId: row.BugId || '',
    projectId: row.ProjetoId ? String(row.ProjetoId) : '',
    modulePrincipalId: row.ModuloPrincipalId ? String(row.ModuloPrincipalId) : '',
    portalArea: row.PortalAreaNome || '',
    fluxoCenario: row.FluxoCenario || '',
    resumoProblema: row.ResumoProblema || '',
    comportamentoEsperado: row.ComportamentoEsperado || '',
    comportamentoObtido: row.ComportamentoObtido || '',
    resultadoFinal: row.ResultadoFinal || 'Parcial',
    criticidade: row.Criticidade || 'Media',
    modulosImpactados: impactedByHistory.get(row.HistoricoId) ?? [],
    tags: tagsByHistory.get(row.HistoricoId) ?? [],
    temAutomacao: Boolean(row.TemAutomacao),
    frameworkAutomacao: row.FrameworkAutomacao || '',
    caminhoSpec: row.CaminhoSpec || '',
    dataCriacao: row.DataCriacao ? new Date(row.DataCriacao).toISOString() : new Date().toISOString(),
    chamadoTitulo: '',
    documentoWordUrl: '',
    bugWordUrl: '',
    evidencias: framesByHistory.get(row.HistoricoId) ?? [],
    relatedHistoryIds: [],
    impactAnalysisReady: true,
    createdByUserId: row.CreatedByUserId || '',
    ownerName: row.OwnerName || '',
  }))
}

async function collectEvidenceFrames(ticketId, workflow) {
  const safeTicketId = sanitizeSegment(ticketId)
  const frames = Array.isArray(workflow?.retest?.frames) ? workflow.retest.frames : []

  return frames.map((frame, index) => ({
    id: frame.id || `frame-${index + 1}`,
    name: frame.name || `Quadro ${index + 1}`,
    imageUrl:
      frame.downloadUrl ||
      `/storage/chamados/${encodeURIComponent(safeTicketId)}/quadros/${encodeURIComponent(frame.fileName || '')}`,
    description: frame.description || '',
    fileName: frame.fileName || '',
  }))
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
}

function overlapScore(sourceA, sourceB, weightPerMatch) {
  const tokensA = new Set(tokenize(sourceA))
  const tokensB = new Set(tokenize(sourceB))
  let matches = 0

  for (const token of tokensA) {
    if (tokensB.has(token)) matches += 1
  }

  return matches * weightPerMatch
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : []
}

function buildRelatedRecommendation(record, params) {
  const matchReasons = []
  let impactScore = 0

  if (params.projeto && record.projectId === params.projeto) {
    impactScore += RELATED_WEIGHTS.sameProject
    matchReasons.push('Mesmo projeto')
  }

  if (params.moduloPrincipal && record.modulePrincipalId === params.moduloPrincipal) {
    impactScore += RELATED_WEIGHTS.sameMainModule
    matchReasons.push('Mesmo modulo principal')
  }

  if (params.portalArea && record.portalArea === params.portalArea) {
    impactScore += RELATED_WEIGHTS.samePortalArea
    matchReasons.push('Mesma area/portal')
  }

  const flowOverlap = overlapScore(record.fluxoCenario, params.fluxoCenario, RELATED_WEIGHTS.flowKeyword)
  if (flowOverlap > 0) {
    impactScore += flowOverlap
    matchReasons.push('Palavras em comum no fluxo')
  }

  const problemOverlap = overlapScore(
    record.resumoProblema,
    params.resumoProblema,
    RELATED_WEIGHTS.problemKeyword,
  )
  if (problemOverlap > 0) {
    impactScore += problemOverlap
    matchReasons.push('Palavras em comum no resumo do problema')
  }

  const requestedTags = normalizeStringArray(params.tags)
  const existingTags = normalizeStringArray(record.tags)
  const sharedTags = requestedTags.filter((tag) => existingTags.includes(tag))
  if (sharedTags.length > 0) {
    impactScore += sharedTags.length * RELATED_WEIGHTS.sharedTag
    matchReasons.push('Tags em comum')
  }

  const requestedImpactedModules = normalizeStringArray(params.modulosImpactados)
  const existingImpactedModules = normalizeStringArray(record.modulosImpactados)
  const sharedImpactedModules = requestedImpactedModules.filter((moduleId) =>
    existingImpactedModules.includes(moduleId),
  )
  if (sharedImpactedModules.length > 0) {
    impactScore += sharedImpactedModules.length * RELATED_WEIGHTS.sharedImpactedModule
    matchReasons.push('Modulos impactados coincidem')
  }

  const normalizedResult = String(record.resultadoFinal || '').toLowerCase()
  if (normalizedResult.includes('aprov') || normalizedResult.includes('parcial')) {
    impactScore += RELATED_WEIGHTS.approvedOrPartialResult
    matchReasons.push('Historico anterior validado ou parcialmente validado')
  }

  if (record.bugId) {
    impactScore += RELATED_WEIGHTS.linkedBug
    matchReasons.push('Possui bug/correcao associada')
  }

  const strongSignals =
    Number(params.projeto && record.projectId === params.projeto) +
    Number(params.moduloPrincipal && record.modulePrincipalId === params.moduloPrincipal) +
    Number(params.portalArea && record.portalArea === params.portalArea) +
    Number(flowOverlap > 0) +
    Number(problemOverlap > 0) +
    Number(sharedTags.length > 0) +
    Number(sharedImpactedModules.length > 0) +
    Number(Boolean(record.bugId))

  const type =
    params.moduloPrincipal &&
    record.modulePrincipalId === params.moduloPrincipal &&
    strongSignals >= 3 &&
    impactScore >= REGRESSION_THRESHOLD
      ? 'regressao_sugerida'
      : 'historico_relacionado'

  return {
    ...record,
    type,
    impactScore,
    relevanceScore: impactScore,
    matchReasons,
    chamado: record.ticketId,
    projeto: record.projectId,
    modulo: record.modulePrincipalId,
    portalAreaLabel: record.portalArea,
    automacao: record.temAutomacao ? 'sim' : 'nao',
    spec: record.caminhoSpec || '',
  }
}

router.get('/', async (req, res) => {
  try {
    const scope = resolveWorkspaceScope(req.auth, req.query.scope)
    const records = ((await listHistoryRecordsFromDb()) ?? (await readAllHistoryRecords())).filter((record) =>
      scope === 'all' ? true : canAccessOwnedRecord(req.auth, record.createdByUserId),
    )
    records.sort((left, right) => new Date(right.dataCriacao).getTime() - new Date(left.dataCriacao).getTime())
    return res.json(records)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar o historico de testes.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/relacionados', async (req, res) => {
  try {
    const params = {
      projeto: String(req.query.projeto || '').trim(),
      moduloPrincipal: String(req.query.moduloPrincipal || '').trim(),
      portalArea: String(req.query.portalArea || '').trim(),
      fluxoCenario: String(req.query.fluxoCenario || '').trim(),
      resumoProblema: String(req.query.resumoProblema || '').trim(),
      modulosImpactados: String(req.query.modulosImpactados || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      tags: String(req.query.tags || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }

    const hasContext =
      Boolean(params.projeto && params.moduloPrincipal && params.portalArea) &&
      Boolean(params.fluxoCenario || params.resumoProblema || params.tags.length > 0)

    if (!hasContext) {
      return res.json([])
    }

    const records = (await listHistoryRecordsFromDb()) ?? (await readAllHistoryRecords())
    const scored = records
      .map((record) => buildRelatedRecommendation(record, params))
      .filter((record) => record.impactScore > 0)
      .sort(
        (left, right) =>
          Number(right.type === 'regressao_sugerida') - Number(left.type === 'regressao_sugerida') ||
          right.impactScore - left.impactScore ||
          new Date(right.dataCriacao).getTime() - new Date(left.dataCriacao).getTime(),
      )
      .slice(0, 5)

    return res.json(scored)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel consultar os historicos relacionados.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:recordId', async (req, res) => {
  try {
    const dbRecords = await listHistoryRecordsFromDb()
    const record = dbRecords?.find((item) => item.id === req.params.recordId) || (await readHistoryRecord(req.params.recordId))
    if (!record || !canAccessOwnedRecord(req.auth, record.createdByUserId)) {
      return res.status(403).json({ message: 'Este historico pertence ao workspace de outro QA.' })
    }
    return res.json(record)
  } catch (error) {
    return res.status(404).json({
      message: 'Registro historico nao encontrado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  try {
    const payload = req.body ?? {}
    const ticketId = sanitizeSegment(payload.ticketId)

    if (!ticketId || ticketId === 'sem-valor') {
      return res.status(400).json({ message: 'Informe um ticketId valido para salvar no historico.' })
    }

    if (!String(payload.fluxoCenario || '').trim()) {
      return res.status(400).json({ message: 'Informe o fluxo/cenario testado antes de salvar no historico.' })
    }

    const workflow = await loadWorkflowProgress(ticketId, req.auth)
    const recordId = buildHistoryId(ticketId)
    const createdAt = new Date().toISOString()
    const evidenceFrames = await collectEvidenceFrames(ticketId, workflow)

    const record = {
      id: recordId,
      ticketId,
      bugId: payload.bugId ? sanitizeSegment(payload.bugId) : '',
      projectId: String(payload.projectId || workflow.ticket?.projectId || ''),
      modulePrincipalId: String(payload.modulePrincipalId || workflow.ticket?.moduleId || ''),
      portalArea: String(payload.portalArea || workflow.ticket?.portalArea || ''),
      fluxoCenario: String(payload.fluxoCenario || '').trim(),
      resumoProblema: String(payload.resumoProblema || workflow.problem?.problemDescription || '').trim(),
      comportamentoEsperado: String(payload.comportamentoEsperado || workflow.problem?.expectedBehavior || '').trim(),
      comportamentoObtido: String(
        payload.comportamentoObtido || workflow.retest?.obtainedBehavior || workflow.problem?.reportedBehavior || '',
      ).trim(),
      resultadoFinal: String(payload.resultadoFinal || workflow.retest?.status || 'Parcial'),
      criticidade: String(payload.criticidade || workflow.classification?.criticality || 'Media'),
      modulosImpactados: Array.isArray(payload.modulosImpactados)
        ? payload.modulosImpactados.map((item) => String(item))
        : Array.isArray(workflow.classification?.impactedModuleIds)
          ? workflow.classification.impactedModuleIds
          : [],
      tags: Array.isArray(payload.tags)
        ? payload.tags.map((item) => String(item).trim()).filter(Boolean)
        : [],
      temAutomacao: Boolean(payload.temAutomacao),
      frameworkAutomacao: payload.temAutomacao ? String(payload.frameworkAutomacao || '') : '',
      caminhoSpec: payload.temAutomacao ? String(payload.caminhoSpec || '').trim() : '',
      dataCriacao: createdAt,
      chamadoTitulo: String(payload.chamadoTitulo || workflow.ticket?.title || '').trim(),
      documentoWordUrl: '',
      bugWordUrl: '',
      evidencias: evidenceFrames,
      relatedHistoryIds: Array.isArray(payload.relatedHistoryIds)
        ? payload.relatedHistoryIds.map((item) => String(item))
        : [],
      impactAnalysisReady: true,
      createdByUserId: req.auth?.userId || '',
      ownerName: req.auth?.name || '',
    }

    try {
      await fs.access(evidenceWordPath(ticketId))
      record.documentoWordUrl = evidenceWordUrl(ticketId)
    } catch {
      record.documentoWordUrl = ''
    }

    if (record.bugId) {
      try {
        await fs.access(bugWordPath(ticketId, record.bugId))
        record.bugWordUrl = bugWordUrl(ticketId, record.bugId)
      } catch {
        record.bugWordUrl = ''
      }
    }

    const pool = await getPool()
    if (pool) {
      const transaction = new sql.Transaction(pool)
      await transaction.begin()
      try {
        const insertHistory = transaction.request()
        insertHistory.input('historicoId', sql.NVarChar(120), record.id)
        insertHistory.input('ticketId', sql.NVarChar(120), record.ticketId)
        insertHistory.input('bugId', sql.NVarChar(120), record.bugId || null)
        insertHistory.input('projetoId', sql.Int, Number(record.projectId || 0) || null)
        insertHistory.input('moduloPrincipalId', sql.Int, Number(record.modulePrincipalId || 0) || null)
        insertHistory.input('portalAreaNome', sql.NVarChar(120), record.portalArea || '')
        insertHistory.input('fluxoCenario', sql.NVarChar(300), record.fluxoCenario)
        insertHistory.input('resumoProblema', sql.NVarChar(sql.MAX), record.resumoProblema)
        insertHistory.input('comportamentoEsperado', sql.NVarChar(sql.MAX), record.comportamentoEsperado)
        insertHistory.input('comportamentoObtido', sql.NVarChar(sql.MAX), record.comportamentoObtido)
        insertHistory.input('resultadoFinal', sql.NVarChar(40), record.resultadoFinal)
        insertHistory.input('criticidade', sql.NVarChar(30), record.criticidade)
        insertHistory.input('temAutomacao', sql.Bit, Boolean(record.temAutomacao))
        insertHistory.input('frameworkAutomacao', sql.NVarChar(50), record.frameworkAutomacao || '')
        insertHistory.input('caminhoSpec', sql.NVarChar(500), record.caminhoSpec || '')
        insertHistory.input('dataCriacao', sql.DateTime2, new Date(record.dataCriacao))
        insertHistory.input('createdByUserId', sql.NVarChar(120), req.auth?.userId || null)
        await insertHistory.query(`
          INSERT INTO dbo.HistoricoTestes
          (HistoricoId, TicketId, BugId, ProjetoId, ModuloPrincipalId, PortalAreaNome, FluxoCenario, ResumoProblema, ComportamentoEsperado, ComportamentoObtido, ResultadoFinal, Criticidade, TemAutomacao, FrameworkAutomacao, CaminhoSpec, DataCriacao, CreatedByUserId)
          VALUES
          (@historicoId, @ticketId, @bugId, @projetoId, @moduloPrincipalId, @portalAreaNome, @fluxoCenario, @resumoProblema, @comportamentoEsperado, @comportamentoObtido, @resultadoFinal, @criticidade, @temAutomacao, @frameworkAutomacao, @caminhoSpec, @dataCriacao, @createdByUserId)
        `)

        for (const moduleId of record.modulosImpactados) {
          const request = transaction.request()
          request.input('historicoId', sql.NVarChar(120), record.id)
          request.input('moduloId', sql.Int, Number(moduleId || 0) || null)
          await request.query(`
            INSERT INTO dbo.HistoricoTesteModulosImpactados (HistoricoId, ModuloId)
            VALUES (@historicoId, @moduloId)
          `)
        }

        for (const tag of record.tags) {
          const request = transaction.request()
          request.input('historicoId', sql.NVarChar(120), record.id)
          request.input('tag', sql.NVarChar(120), tag)
          await request.query(`
            INSERT INTO dbo.HistoricoTesteTags (HistoricoId, Tag)
            VALUES (@historicoId, @tag)
          `)
        }

        for (const frame of record.evidencias) {
          const request = transaction.request()
          request.input('historicoId', sql.NVarChar(120), record.id)
          request.input('quadroId', sql.NVarChar(120), frame.id)
          request.input('origemQuadro', sql.NVarChar(20), 'chamado')
          request.input('fileName', sql.NVarChar(255), frame.fileName || '')
          request.input('downloadUrl', sql.NVarChar(500), frame.imageUrl || '')
          request.input('caminhoStorage', sql.NVarChar(500), frame.imageUrl || '')
          request.input('descricao', sql.NVarChar(sql.MAX), frame.description || '')
          await request.query(`
            INSERT INTO dbo.HistoricoTesteQuadros (HistoricoId, QuadroId, OrigemQuadro, FileName, DownloadUrl, CaminhoStorage, Descricao)
            VALUES (@historicoId, @quadroId, @origemQuadro, @fileName, @downloadUrl, @caminhoStorage, @descricao)
          `)
        }

        await transaction.commit()
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    }

    await fs.mkdir(historyRoot, { recursive: true })
    await fs.writeFile(historyFilePath(recordId), JSON.stringify(record, null, 2), 'utf-8')

    return res.status(201).json(record)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel salvar o registro no historico de testes.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
