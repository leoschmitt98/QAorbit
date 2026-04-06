import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { createRequest, getPool, queryTrustedJson, sql } from '../db.js'
import { loadWorkflowProgress } from '../lib/chamados-store.js'
import { sanitizeSegment, storageRoot, ticketDirectory, readLegacyWorkflow } from '../lib/legacy-storage.js'
import { canAccessOwnedRecord, resolveWorkspaceScope } from '../lib/auth.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function bugPaths(ticketId, bugId) {
  const safeTicketId = sanitizeSegment(ticketId)
  const safeBugId = sanitizeSegment(bugId)
  const baseDirectory = path.join(storageRoot, 'chamados', safeTicketId, 'bugs')

  return {
    safeTicketId,
    safeBugId,
    baseDirectory,
    bugPath: path.join(baseDirectory, `${safeBugId}.json`),
    docxPath: path.join(baseDirectory, `${safeBugId}.docx`),
  }
}

function bugFramesPaths(ticketId, bugId) {
  const { safeTicketId, safeBugId } = bugPaths(ticketId, bugId)
  const framesDirectory = path.join(storageRoot, 'chamados', safeTicketId, 'bugs', safeBugId, 'quadros')
  return {
    safeTicketId,
    safeBugId,
    framesDirectory,
    metadataPath: path.join(framesDirectory, 'metadata.json'),
  }
}

function ensurePngDataUrl(imageDataUrl) {
  const match = imageDataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!match) throw new Error('Formato de quadro invalido. Envie uma imagem PNG em base64.')
  return match[1]
}

async function nextFrameFileName(framesDirectory) {
  const files = await fs.readdir(framesDirectory).catch(() => [])
  const indexes = files
    .map((file) => {
      const match = file.match(/^quadro-(\d+)\.png$/)
      return match ? Number(match[1]) : 0
    })
    .filter(Boolean)

  const nextIndex = (indexes.length > 0 ? Math.max(...indexes) : 0) + 1
  return `quadro-${String(nextIndex).padStart(3, '0')}.png`
}

async function readMetadata(metadataPath) {
  try {
    const content = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function resolveCatalogNames(projectId, moduleId) {
  if (!projectId && !moduleId) return { projectName: '-', moduleName: '-' }

  const query = `
    SELECT
      CAST(p.Id AS VARCHAR(20)) AS projectId,
      p.Nome AS projectName,
      CAST(m.Id AS VARCHAR(20)) AS moduleId,
      m.Nome AS moduleName
    FROM Projetos p
    LEFT JOIN Modulos m ON m.Id = ${moduleId ? Number(moduleId) || 0 : 0}
    WHERE p.Id = ${projectId ? Number(projectId) || 0 : 0}
  `

  try {
    const pool = await getPool()
    if (!pool) {
      const rows = await queryTrustedJson(query)
      const first = rows[0] ?? {}
      return {
        projectName: first.projectName || projectId || '-',
        moduleName: first.moduleName || moduleId || '-',
      }
    }

    const request = createRequest(pool)
    const result = await request.query(query)
    const first = result.recordset[0] ?? {}
    return {
      projectName: first.projectName || projectId || '-',
      moduleName: first.moduleName || moduleId || '-',
    }
  } catch {
    return {
      projectName: projectId || '-',
      moduleName: moduleId || '-',
    }
  }
}

async function loadWorkflow(ticketId, auth) {
  try {
    return await loadWorkflowProgress(ticketId, auth)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Acesso restrito')) {
      throw error
    }
    return readLegacyWorkflow(ticketId)
  }
}

async function loadBug(ticketId, bugId) {
  const { bugPath } = bugPaths(ticketId, bugId)
  const raw = await fs.readFile(bugPath, 'utf-8')
  return JSON.parse(raw)
}

async function loadBugById(bugId) {
  const pool = await getPool()
  if (pool) {
    const request = createRequest(pool)
    request.input('bugId', sql.NVarChar(120), bugId)
    const result = await request.query(`
      SELECT b.*, ownerUser.Nome AS OwnerName
      FROM dbo.Bugs b
      LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = b.CreatedByUserId
      WHERE b.BugId = @bugId;
      SELECT * FROM dbo.BugPassosReproducao WHERE BugId = @bugId ORDER BY Ordem;
      SELECT * FROM dbo.BugQuadros WHERE BugId = @bugId ORDER BY OrdemExibicao;
    `)

    const bugRow = result.recordsets[0]?.[0]
    if (bugRow) {
      return {
        ticketId: bugRow.TicketId,
        bug: {
          id: bugRow.BugId,
          ticketId: bugRow.TicketId,
          title: bugRow.Titulo,
          expectedBehavior: bugRow.ComportamentoEsperado || '',
          obtainedBehavior: bugRow.ComportamentoObtido || '',
          severity: bugRow.Severidade,
          priority: bugRow.Prioridade,
          status: bugRow.StatusBug,
          createdAt: bugRow.DataCriacao ? new Date(bugRow.DataCriacao).toISOString() : new Date().toISOString(),
          updatedAt: bugRow.DataAtualizacao ? new Date(bugRow.DataAtualizacao).toISOString() : new Date().toISOString(),
          reproductionSteps: (result.recordsets[1] ?? []).map((step) => ({
            id: step.PassoId,
            order: step.Ordem,
            description: step.DescricaoPasso,
            observedResult: step.ResultadoObservado || '',
          })),
          evidence: {
            gifName: '',
            gifPreviewUrl: '',
            frames: (result.recordsets[2] ?? []).map((frame) => ({
              id: frame.QuadroId,
              name: frame.Nome,
              imageUrl: frame.DownloadUrl || '',
              downloadUrl: frame.DownloadUrl || '',
              fileName: frame.FileName || undefined,
              persistedAt: frame.PersistedAt ? new Date(frame.PersistedAt).toISOString() : undefined,
              timestampLabel: frame.TimestampLabel || '00:00',
              description: frame.Descricao || '',
              annotations: frame.AnnotationsJson ? JSON.parse(frame.AnnotationsJson) : [],
              editHistory: frame.EditHistoryJson ? JSON.parse(frame.EditHistoryJson) : [],
            })),
          },
          ticketSnapshot: {
            ticketId: bugRow.TicketId,
            ticketTitle: '',
            projectId: bugRow.ProjetoId ? String(bugRow.ProjetoId) : '',
            moduleId: bugRow.ModuloId ? String(bugRow.ModuloId) : '',
            portalArea: '',
            environment: bugRow.Ambiente || '',
            version: bugRow.Versao || '',
            origin: bugRow.Origem || '',
            baseReference: bugRow.BaseReferencia || '',
            accessUrl: bugRow.AccessUrl || '',
            username: bugRow.UsuarioAcesso || '',
            password: bugRow.SenhaAcesso || '',
            companyCode: bugRow.EmpresaCodigo || '',
            unitCode: bugRow.UnidadeCodigo || '',
            branchName: bugRow.BranchName || '',
            developerChangelog: bugRow.ChangelogDev || '',
            customerProblemDescription: bugRow.DescricaoProblemaChamado || '',
            initialAnalysis: bugRow.AnaliseInicial || '',
            documentoBaseName: bugRow.DocumentoBaseNome || '',
          },
          createdByUserId: bugRow.CreatedByUserId || '',
          ownerName: bugRow.OwnerName || '',
        },
      }
    }
  }

  const chamadosDirectory = path.join(storageRoot, 'chamados')
  const entries = await fs.readdir(chamadosDirectory, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const currentPath = path.join(chamadosDirectory, entry.name, 'bugs', `${sanitizeSegment(bugId)}.json`)
    try {
      const raw = await fs.readFile(currentPath, 'utf-8')
      return { ticketId: entry.name, bug: JSON.parse(raw) }
    } catch {
      continue
    }
  }

  return null
}

async function loadBugFrameEvidence(ticketId, bugId) {
  const { safeTicketId, safeBugId, metadataPath, framesDirectory } = bugFramesPaths(ticketId, bugId)
  try {
    const raw = await fs.readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(raw)
    return metadata.map((entry) => ({
      ...entry,
      imageUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/bugs/${encodeURIComponent(safeBugId)}/quadros/${encodeURIComponent(entry.fileName)}`,
      downloadUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/bugs/${encodeURIComponent(safeBugId)}/quadros/${encodeURIComponent(entry.fileName)}`,
      filePath: path.join(framesDirectory, entry.fileName),
    }))
  } catch {
    return []
  }
}

function normalizeSteps(steps) {
  return (Array.isArray(steps) ? steps : [])
    .map((step, index) => ({
      id: step.id || `bug-step-${Date.now()}-${index + 1}`,
      order: Number(step.order || index + 1),
      description: String(step.description || '').trim(),
      observedResult: String(step.observedResult || '').trim(),
    }))
    .filter((step) => step.description)
    .sort((left, right) => left.order - right.order)
}

function normalizeEvidence(evidence, fallbackEvidence) {
  const frames = Array.isArray(evidence?.frames)
    ? evidence.frames.map((frame, index) => ({
        id: String(frame.id || `bug-frame-${index + 1}`),
        name: String(frame.name || `Quadro ${index + 1}`),
        imageUrl: String(frame.downloadUrl || frame.imageUrl || ''),
        downloadUrl: String(frame.downloadUrl || frame.imageUrl || ''),
        fileName: typeof frame.fileName === 'string' ? frame.fileName : undefined,
        persistedAt: typeof frame.persistedAt === 'string' ? frame.persistedAt : undefined,
        timestampLabel: String(frame.timestampLabel || '00:00'),
        description: typeof frame.description === 'string' ? frame.description : '',
        annotations: Array.isArray(frame.annotations) ? frame.annotations : [],
        editHistory: Array.isArray(frame.editHistory) ? frame.editHistory : [],
      }))
    : fallbackEvidence?.frames || []

  return {
    gifName: String(evidence?.gifName || fallbackEvidence?.gifName || ''),
    gifPreviewUrl: '',
    frames,
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').trim()
}

function isMeaningfulValue(value) {
  return normalizeText(value) !== '' && normalizeText(value) !== '-'
}

function buildMultilineParagraphs(value, options = {}) {
  const normalized = normalizeText(value)
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  const finalLines = lines.length > 0 ? lines : ['-']
  return finalLines.map((line) => new Paragraph({ text: line, ...options }))
}

function buildDocumentTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '111827', size: 34 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
  })
}

function buildSectionSeparator() {
  return new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: 'CBD2D9',
        size: 6,
        space: 1,
      },
    },
    spacing: { before: 260, after: 110 },
  })
}

function buildSectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text: `▶ ${text.toUpperCase()}`, bold: true, color: '1F2933', size: 26 })],
    spacing: { before: 100, after: 140 },
  })
}

function buildStepTitle(text, spacing = { before: 240, after: 140 }) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '1F2933', size: 24 })],
    spacing,
  })
}

function buildStatusBadge(status) {
  const normalized = normalizeText(status) || '-'
  const lower = normalized.toLowerCase()
  let color = '2F855A'

  if (lower.includes('reprov') || lower.includes('nok') || lower.includes('erro') || lower.includes('novo')) color = 'C53030'
  else if (lower.includes('parcial') || lower.includes('bloque')) color = 'B7791F'

  return new Paragraph({
    children: [
      new TextRun({ text: 'Status final: ', bold: true, color: '1F2933' }),
      new TextRun({ text: normalized, bold: true, color }),
    ],
    spacing: { after: 120 },
  })
}

function buildLabeledBlock(label, value) {
  const normalized = normalizeText(value)
  if (!normalized) return []

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length <= 1) {
    return [
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, color: '1F2933' }),
          new TextRun(lines[0] || '-'),
        ],
        spacing: { after: 90 },
      }),
    ]
  }

  return [
    new Paragraph({
      children: [new TextRun({ text: `${label}:`, bold: true, color: '1F2933' })],
      spacing: { after: 40 },
    }),
    ...lines.map((line, index) =>
      new Paragraph({
        text: line,
        indent: { left: 320 },
        spacing: { after: index === lines.length - 1 ? 90 : 40 },
      }),
    ),
  ]
}

function parseBaseReference(baseReference) {
  const normalized = normalizeText(baseReference)
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean)
  const databaseLine = lines.find((line) => /^DataBase\s*=/i.test(line))
  const connectionLine = lines.find((line) => /^ConnectionName\s*=/i.test(line))
  const bracketLine = lines.find((line) => /^\[.*\]$/.test(line))
  const genericLines = lines.filter(
    (line) =>
      !/^(DriverName|LibraryName|VendorLib|BlobSize|GetDriverFunc|PasswordRequired|EnableBCD)\s*=/i.test(line),
  )

  const databaseValue = databaseLine ? databaseLine.replace(/^DataBase\s*=\s*/i, '').trim() : ''
  const connectionValue = connectionLine
    ? connectionLine.replace(/^ConnectionName\s*=\s*/i, '').trim()
    : bracketLine
      ? bracketLine.replace(/^\[|\]$/g, '').trim()
      : ''
  const compactBase = genericLines
    .filter((line) => !/^ConnectionName\s*=/i.test(line) && !/^\[.*\]$/.test(line))
    .filter((line) => !/^User_Name\s*=/i.test(line) && !/^Password\s*=/i.test(line))
    .join('\n')

  return {
    databaseValue: databaseValue || compactBase || '',
    connectionValue,
  }
}

function buildEnvironmentBlock(snapshot) {
  const moduleLabel = snapshot.portalArea
    ? `${snapshot.portalArea}${snapshot.moduleName && snapshot.moduleName !== '-' ? ` · ${snapshot.moduleName}` : ''}`
    : snapshot.moduleName || snapshot.portalArea || ''
  const { databaseValue, connectionValue } = parseBaseReference(snapshot.baseReference)
  const rows = [
    ['Ambiente', snapshot.environment],
    ['Base de dados', databaseValue],
    ['Conexao', connectionValue],
    ['Usuario', snapshot.username ? `${snapshot.username}${snapshot.password ? ` / ${snapshot.password}` : ''}` : ''],
    ['Modulo', moduleLabel],
    ['URL', snapshot.accessUrl],
    ['Branch', snapshot.branchName],
  ].filter(([, value]) => isMeaningfulValue(value))

  if (rows.length === 0) return [new Paragraph('Nenhuma informacao de ambiente foi registrada para este bug.')]
  return rows.flatMap(([label, value]) => buildLabeledBlock(label, value))
}

function buildCalledContextBlock(snapshot) {
  const rows = [
    ['Chamado', snapshot.ticketId || '-'],
    ['Titulo do chamado', snapshot.ticketTitle || '-'],
    ['Projeto', snapshot.projectName || snapshot.projectId || '-'],
    ['Modulo', snapshot.moduleName || snapshot.moduleId || '-'],
    ['Portal / Area', snapshot.portalArea || '-'],
    ['Ambiente', snapshot.environment || '-'],
    ['Versao / Hotfix', snapshot.version || '-'],
    ['Origem', snapshot.origin || '-'],
    ['Descricao original', snapshot.customerProblemDescription || '-'],
    ['Analise inicial', snapshot.initialAnalysis || '-'],
    ['Documento base', snapshot.documentoBaseName || '-'],
  ].filter(([, value]) => isMeaningfulValue(value))

  return rows.flatMap(([label, value]) => buildLabeledBlock(label, value))
}

function buildBugDataBlock(bug) {
  const rows = [
    ['Titulo do bug', bug.title || '-'],
    ['Severidade', bug.severity || '-'],
    ['Prioridade', bug.priority || '-'],
    ['Status', bug.status || '-'],
    ['Comportamento esperado', bug.expectedBehavior || '-'],
    ['Comportamento obtido', bug.obtainedBehavior || '-'],
  ].filter(([, value]) => isMeaningfulValue(value))

  return rows.flatMap(([label, value]) => buildLabeledBlock(label, value))
}

function buildConclusionParagraphs(bug, workflow) {
  const bugText = normalizeText(bug.obtainedBehavior)
  if (bugText) return buildMultilineParagraphs(bugText)

  const problemText = normalizeText(workflow.problem?.problemDescription)
  if (problemText) return buildMultilineParagraphs(problemText)

  return [new Paragraph('Bug documentado para apoio ao time de desenvolvimento.')]
}

router.get('/', async (_req, res) => {
  try {
    const scope = resolveWorkspaceScope(_req.auth, _req.query.scope)
    const pool = await getPool()
    if (pool) {
      const request = createRequest(pool)
      request.input('scope', sql.NVarChar(10), scope)
      request.input('userId', sql.NVarChar(120), _req.auth?.userId || '')
      const result = await request.query(`
        SELECT
          BugId AS id,
          TicketId AS ticketId,
          Titulo AS title,
          StatusBug AS status,
          Severidade AS severity,
          Prioridade AS priority,
          DataCriacao AS createdAt,
          DataAtualizacao AS updatedAt,
          CAST(ProjetoId AS VARCHAR(20)) AS projectId,
          CAST(ModuloId AS VARCHAR(20)) AS moduleId,
          CreatedByUserId AS createdByUserId,
          ownerUser.Nome AS ownerName
        FROM dbo.Bugs
        LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = dbo.Bugs.CreatedByUserId
        WHERE @scope = 'all' OR dbo.Bugs.CreatedByUserId = @userId
        ORDER BY DataAtualizacao DESC
      `)

      return res.json(
        result.recordset.map((row) => ({
          ...row,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
            projectName: row.projectId || '-',
            moduleName: row.moduleId || '-',
            createdByUserId: row.createdByUserId || '',
            ownerName: row.ownerName || '',
          })),
      )
    }

    const chamadosDirectory = path.join(storageRoot, 'chamados')
    const entries = await fs.readdir(chamadosDirectory, { withFileTypes: true }).catch(() => [])
    const bugs = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const bugsDirectory = path.join(chamadosDirectory, entry.name, 'bugs')
      const bugFiles = await fs.readdir(bugsDirectory, { withFileTypes: true }).catch(() => [])

      for (const bugFile of bugFiles) {
        if (!bugFile.isFile() || !bugFile.name.endsWith('.json')) continue
        try {
          const raw = await fs.readFile(path.join(bugsDirectory, bugFile.name), 'utf-8')
          const bug = JSON.parse(raw)
          if (scope !== 'all' && !canAccessOwnedRecord(_req.auth, bug.createdByUserId || _req.auth?.userId)) continue
          bugs.push({
            id: bug.id,
            ticketId: bug.ticketId,
            title: bug.title,
            status: bug.status,
            severity: bug.severity,
            priority: bug.priority,
            createdAt: bug.createdAt,
            updatedAt: bug.updatedAt,
            projectId: bug.ticketSnapshot?.projectId || '',
            projectName: bug.ticketSnapshot?.projectName || bug.ticketSnapshot?.projectId || '-',
            moduleId: bug.ticketSnapshot?.moduleId || '',
            moduleName: bug.ticketSnapshot?.moduleName || bug.ticketSnapshot?.moduleId || '-',
            createdByUserId: bug.createdByUserId || '',
            ownerName: bug.ownerName || '',
          })
        } catch {
          continue
        }
      }
    }

    bugs.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    return res.json(bugs)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar os bugs vinculados.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:bugId', async (req, res) => {
  try {
    const found = await loadBugById(req.params.bugId)
    if (!found) return res.status(404).json({ message: 'Bug nao encontrado.' })
    if (!canAccessOwnedRecord(req.auth, found.bug.createdByUserId || req.auth?.userId)) {
      return res.status(403).json({ message: 'Este bug pertence ao workspace de outro QA.' })
    }

    const workflow = await loadWorkflow(found.ticketId, req.auth)
    const evidenceFrames = await loadBugFrameEvidence(found.ticketId, found.bug.id)
    return res.json({ bug: found.bug, workflow, evidenceFrames })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar o bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.put('/:bugId', async (req, res) => {
  try {
    const bugId = sanitizeSegment(req.params.bugId)
    const ticketId = sanitizeSegment(req.body?.ticketId)

    if (!ticketId || ticketId === 'sem-valor') {
      return res.status(400).json({ message: 'Informe um chamado valido para vincular o bug.' })
    }

    const currentBug = await loadBugById(bugId)
    if (currentBug && !canAccessOwnedRecord(req.auth, currentBug.bug.createdByUserId || req.auth?.userId)) {
      return res.status(403).json({ message: 'Este bug pertence ao workspace de outro QA.' })
    }

    const workflow = await loadWorkflow(ticketId, req.auth)
    const reproductionSteps = normalizeSteps(req.body?.reproductionSteps)
    if (reproductionSteps.length === 0) {
      return res.status(400).json({ message: 'Cadastre pelo menos um passo de reproducao para salvar o bug.' })
    }

    const catalogNames = await resolveCatalogNames(workflow.ticket?.projectId, workflow.ticket?.moduleId)
    const { baseDirectory, bugPath } = bugPaths(ticketId, bugId)
    const existingBug = currentBug?.bug ?? (await loadBug(ticketId, bugId).catch(() => null))
    const createdAt = existingBug?.createdAt || new Date().toISOString()
    const updatedAt = new Date().toISOString()

    const bugRecord = {
      id: bugId,
      ticketId,
      title: String(req.body?.title || '').trim(),
      expectedBehavior: String(req.body?.expectedBehavior || '').trim(),
      obtainedBehavior: String(req.body?.obtainedBehavior || '').trim(),
      severity: req.body?.severity || 'Moderada',
      priority: req.body?.priority || 'Media',
      status: req.body?.status || 'Novo',
      createdAt,
      updatedAt,
      reproductionSteps,
      evidence: normalizeEvidence(req.body?.evidence, existingBug?.evidence),
      createdByUserId: existingBug?.createdByUserId || req.auth?.userId || '',
      ownerName: existingBug?.ownerName || req.auth?.name || '',
      ticketSnapshot: {
        ticketId: workflow.ticket?.ticketId || ticketId,
        ticketTitle: workflow.ticket?.title || '',
        projectId: workflow.ticket?.projectId || '',
        projectName: catalogNames.projectName,
        moduleId: workflow.ticket?.moduleId || '',
        moduleName: catalogNames.moduleName,
        portalArea: workflow.ticket?.portalArea || '',
        environment: workflow.ticket?.environment || '',
        version: workflow.ticket?.version || '',
        origin: workflow.ticket?.origin || '',
        baseReference: workflow.ticket?.baseReference || '',
        accessUrl: workflow.ticket?.accessUrl || '',
        username: workflow.ticket?.username || '',
        password: workflow.ticket?.password || '',
        companyCode: workflow.ticket?.companyCode || '',
        unitCode: workflow.ticket?.unitCode || '',
        branchName: workflow.ticket?.branchName || '',
        developerChangelog: workflow.ticket?.developerChangelog || '',
        customerProblemDescription: workflow.ticket?.customerProblemDescription || '',
        initialAnalysis: workflow.problem?.initialAnalysis || '',
        documentoBaseName: workflow.ticket?.documentoBaseName || '',
      },
    }

    const pool = await getPool()
    if (pool) {
      const transaction = new sql.Transaction(pool)
      await transaction.begin()
      try {
        const bugRequest = transaction.request()
        bugRequest.input('bugId', sql.NVarChar(120), bugId)
        bugRequest.input('ticketId', sql.NVarChar(120), ticketId)
        bugRequest.input('titulo', sql.NVarChar(300), bugRecord.title)
        bugRequest.input('comportamentoEsperado', sql.NVarChar(sql.MAX), bugRecord.expectedBehavior)
        bugRequest.input('comportamentoObtido', sql.NVarChar(sql.MAX), bugRecord.obtainedBehavior)
        bugRequest.input('severidade', sql.NVarChar(30), bugRecord.severity)
        bugRequest.input('prioridade', sql.NVarChar(30), bugRecord.priority)
        bugRequest.input('statusBug', sql.NVarChar(40), bugRecord.status)
        bugRequest.input('projetoId', sql.Int, Number(bugRecord.ticketSnapshot.projectId || 0) || null)
        bugRequest.input('moduloId', sql.Int, Number(bugRecord.ticketSnapshot.moduleId || 0) || null)
        bugRequest.input('ambiente', sql.NVarChar(120), bugRecord.ticketSnapshot.environment || '')
        bugRequest.input('versao', sql.NVarChar(120), bugRecord.ticketSnapshot.version || '')
        bugRequest.input('origem', sql.NVarChar(80), bugRecord.ticketSnapshot.origin || '')
        bugRequest.input('baseReferencia', sql.NVarChar(sql.MAX), bugRecord.ticketSnapshot.baseReference || '')
        bugRequest.input('accessUrl', sql.NVarChar(500), bugRecord.ticketSnapshot.accessUrl || '')
        bugRequest.input('usuarioAcesso', sql.NVarChar(150), bugRecord.ticketSnapshot.username || '')
        bugRequest.input('senhaAcesso', sql.NVarChar(150), bugRecord.ticketSnapshot.password || '')
        bugRequest.input('empresaCodigo', sql.NVarChar(80), bugRecord.ticketSnapshot.companyCode || '')
        bugRequest.input('unidadeCodigo', sql.NVarChar(80), bugRecord.ticketSnapshot.unitCode || '')
        bugRequest.input('branchName', sql.NVarChar(255), bugRecord.ticketSnapshot.branchName || '')
        bugRequest.input('changelogDev', sql.NVarChar(sql.MAX), bugRecord.ticketSnapshot.developerChangelog || '')
        bugRequest.input('descricaoProblemaChamado', sql.NVarChar(sql.MAX), bugRecord.ticketSnapshot.customerProblemDescription || '')
        bugRequest.input('analiseInicial', sql.NVarChar(sql.MAX), bugRecord.ticketSnapshot.initialAnalysis || '')
        bugRequest.input('documentoBaseNome', sql.NVarChar(255), bugRecord.ticketSnapshot.documentoBaseName || '')
        bugRequest.input('dataCriacao', sql.DateTime2, new Date(createdAt))
        bugRequest.input('createdByUserId', sql.NVarChar(120), bugRecord.createdByUserId || null)
        bugRequest.input('updatedByUserId', sql.NVarChar(120), req.auth?.userId || null)
        await bugRequest.query(`
          MERGE dbo.Bugs AS target
          USING (SELECT @bugId AS BugId) AS src
          ON target.BugId = src.BugId
          WHEN MATCHED THEN
            UPDATE SET
              TicketId = @ticketId,
              Titulo = @titulo,
              ComportamentoEsperado = @comportamentoEsperado,
              ComportamentoObtido = @comportamentoObtido,
              Severidade = @severidade,
              Prioridade = @prioridade,
              StatusBug = @statusBug,
              ProjetoId = @projetoId,
              ModuloId = @moduloId,
              Ambiente = @ambiente,
              Versao = @versao,
              Origem = @origem,
              BaseReferencia = @baseReferencia,
              AccessUrl = @accessUrl,
              UsuarioAcesso = @usuarioAcesso,
              SenhaAcesso = @senhaAcesso,
              EmpresaCodigo = @empresaCodigo,
              UnidadeCodigo = @unidadeCodigo,
              BranchName = @branchName,
              ChangelogDev = @changelogDev,
              DescricaoProblemaChamado = @descricaoProblemaChamado,
              AnaliseInicial = @analiseInicial,
              DocumentoBaseNome = @documentoBaseNome,
              UpdatedByUserId = @updatedByUserId,
              DataAtualizacao = SYSDATETIME()
          WHEN NOT MATCHED THEN
            INSERT
            (BugId, TicketId, Titulo, ComportamentoEsperado, ComportamentoObtido, Severidade, Prioridade, StatusBug, ProjetoId, ModuloId, Ambiente, Versao, Origem, BaseReferencia, AccessUrl, UsuarioAcesso, SenhaAcesso, EmpresaCodigo, UnidadeCodigo, BranchName, ChangelogDev, DescricaoProblemaChamado, AnaliseInicial, DocumentoBaseNome, DataCriacao, DataAtualizacao, CreatedByUserId, UpdatedByUserId)
            VALUES
            (@bugId, @ticketId, @titulo, @comportamentoEsperado, @comportamentoObtido, @severidade, @prioridade, @statusBug, @projetoId, @moduloId, @ambiente, @versao, @origem, @baseReferencia, @accessUrl, @usuarioAcesso, @senhaAcesso, @empresaCodigo, @unidadeCodigo, @branchName, @changelogDev, @descricaoProblemaChamado, @analiseInicial, @documentoBaseNome, @dataCriacao, SYSDATETIME(), @createdByUserId, @updatedByUserId);
        `)

        const cleanup = transaction.request()
        cleanup.input('bugId', sql.NVarChar(120), bugId)
        await cleanup.query('DELETE FROM dbo.BugPassosReproducao WHERE BugId = @bugId')

        for (const step of bugRecord.reproductionSteps) {
          const stepRequest = transaction.request()
          stepRequest.input('passoId', sql.NVarChar(120), step.id)
          stepRequest.input('bugId', sql.NVarChar(120), bugId)
          stepRequest.input('ordem', sql.Int, step.order)
          stepRequest.input('descricaoPasso', sql.NVarChar(sql.MAX), step.description)
          stepRequest.input('resultadoObservado', sql.NVarChar(sql.MAX), step.observedResult || '')
          await stepRequest.query(`
            INSERT INTO dbo.BugPassosReproducao (PassoId, BugId, Ordem, DescricaoPasso, ResultadoObservado)
            VALUES (@passoId, @bugId, @ordem, @descricaoPasso, @resultadoObservado)
          `)
        }

        await transaction.commit()
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    }

    await fs.mkdir(baseDirectory, { recursive: true })
    await fs.writeFile(bugPath, JSON.stringify(bugRecord, null, 2), 'utf-8')
    return res.json({ ok: true, bug: bugRecord })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel salvar o bug vinculado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:bugId/export-docx', async (req, res) => {
  try {
    const found = await loadBugById(req.params.bugId)
    if (!found) return res.status(404).json({ message: 'Bug nao encontrado.' })
    if (!canAccessOwnedRecord(req.auth, found.bug.createdByUserId || req.auth?.userId)) {
      return res.status(403).json({ message: 'Este bug pertence ao workspace de outro QA.' })
    }

    const workflow = await loadWorkflow(found.ticketId, req.auth)
    const evidenceFrames = await loadBugFrameEvidence(found.ticketId, found.bug.id)
    const { docxPath, safeBugId } = bugPaths(found.ticketId, found.bug.id)

    const children = [
      buildDocumentTitle('Relato de Bug'),
      buildSectionSeparator(),
      buildSectionTitle('Ambiente de Execucao'),
      ...buildEnvironmentBlock(found.bug.ticketSnapshot || {}),
      buildSectionSeparator(),
      buildSectionTitle('Dados do Chamado'),
      ...buildCalledContextBlock(found.bug.ticketSnapshot || {}),
      buildSectionSeparator(),
      buildSectionTitle('Dados do Bug'),
      ...buildBugDataBlock(found.bug),
      buildSectionSeparator(),
      buildSectionTitle('Passo a Passo para Reproducao'),
    ]

    if (found.bug.reproductionSteps.length > 0) {
      for (const step of found.bug.reproductionSteps) {
        children.push(...buildMultilineParagraphs(`PASSO ${step.order}`, { spacing: { before: 180, after: 70 } }))
        children.push(...buildMultilineParagraphs(step.description, { spacing: { after: step.observedResult ? 80 : 120 } }))

        if (step.observedResult) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Resultado observado: ', bold: true, color: '1F2933' }),
                new TextRun(step.observedResult),
              ],
              spacing: { after: 120 },
            }),
          )
        }
      }
    } else {
      children.push(new Paragraph('Nenhum passo de reproducao cadastrado.'))
    }

    children.push(buildSectionSeparator())
    children.push(buildSectionTitle('Evidencias'))

    if (evidenceFrames.length > 0) {
      for (let index = 0; index < evidenceFrames.length; index += 1) {
        const frame = evidenceFrames[index]
        const imageBuffer = await fs.readFile(frame.filePath)
        children.push(buildStepTitle(`PASSO ${index + 1}`, { before: index === 0 ? 180 : 360, after: 140 }))
        children.push(
          new Paragraph({
            children: [new ImageRun({ data: imageBuffer, transformation: { width: 520, height: 293 } })],
            alignment: AlignmentType.CENTER,
            spacing: { after: frame.description ? 100 : 180 },
          }),
        )

        if (frame.description) {
          children.push(...buildMultilineParagraphs(frame.description, { alignment: AlignmentType.CENTER, spacing: { after: 180 } }))
        }
      }
    } else if (workflow.ticket?.supportAttachments?.length || workflow.retest?.uploads?.length) {
      const attachments = [...(workflow.ticket?.supportAttachments || []), ...(workflow.retest?.uploads || [])]
      attachments.forEach((attachment) => children.push(...buildMultilineParagraphs(attachment)))
    } else {
      children.push(new Paragraph('Nenhuma evidência visual foi registrada para este chamado.'))
    }

    children.push(buildSectionSeparator())
    children.push(buildSectionTitle('Conclusao'))
    children.push(buildStatusBadge(found.bug.status || '-'))
    children.push(...buildConclusionParagraphs(found.bug, workflow))

    const doc = new Document({
      sections: [{ children }],
    })

    const buffer = await Packer.toBuffer(doc)
    await fs.mkdir(path.dirname(docxPath), { recursive: true })
    await fs.writeFile(docxPath, buffer)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="relato-bug-${safeBugId}.docx"`)
    res.setHeader('Content-Length', String(buffer.length))
    return res.send(buffer)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel gerar o Word do bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/:bugId/quadros', async (req, res) => {
  try {
    const { ticketId, imageDataUrl, timestampLabel, description } = req.body ?? {}
    const bugId = sanitizeSegment(req.params.bugId)

    if (!ticketId || !imageDataUrl || !timestampLabel) {
      return res.status(400).json({ message: 'ticketId, imageDataUrl e timestampLabel sao obrigatorios.' })
    }

    const pngBase64 = ensurePngDataUrl(imageDataUrl)
    const { safeTicketId, safeBugId, framesDirectory, metadataPath } = bugFramesPaths(ticketId, bugId)
    await fs.mkdir(framesDirectory, { recursive: true })
    const fileName = await nextFrameFileName(framesDirectory)
    const filePath = path.join(framesDirectory, fileName)
    const persistedAt = new Date().toISOString()

    await fs.writeFile(filePath, Buffer.from(pngBase64, 'base64'))

    const metadata = await readMetadata(metadataPath)
    metadata.push({
      id: `${safeBugId}-${fileName}`,
      originalTicketId: ticketId,
      fileName,
      timestampLabel,
      description: description || '',
      persistedAt,
    })
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    const pool = await getPool()
    if (pool) {
      const request = createRequest(pool)
      request.input('quadroId', sql.NVarChar(120), `${safeBugId}-${fileName}`)
      request.input('bugId', sql.NVarChar(120), bugId)
      request.input('nome', sql.NVarChar(255), fileName)
      request.input('timestampLabel', sql.NVarChar(50), timestampLabel)
      request.input('descricao', sql.NVarChar(sql.MAX), description || '')
      request.input('fileName', sql.NVarChar(255), fileName)
      request.input(
        'downloadUrl',
        sql.NVarChar(500),
        `/storage/chamados/${encodeURIComponent(safeTicketId)}/bugs/${encodeURIComponent(safeBugId)}/quadros/${encodeURIComponent(fileName)}`,
      )
      request.input(
        'caminhoStorage',
        sql.NVarChar(500),
        `chamados/${safeTicketId}/bugs/${safeBugId}/quadros/${fileName}`,
      )
      request.input('persistedAt', sql.DateTime2, new Date(persistedAt))
      request.input('ordemExibicao', sql.Int, metadata.length)
      request.input('annotationsJson', sql.NVarChar(sql.MAX), '[]')
      request.input('editHistoryJson', sql.NVarChar(sql.MAX), '[]')
      await request.query(`
        MERGE dbo.BugQuadros AS target
        USING (SELECT @quadroId AS QuadroId) AS src
        ON target.QuadroId = src.QuadroId
        WHEN MATCHED THEN
          UPDATE SET
            BugId = @bugId,
            Nome = @nome,
            TimestampLabel = @timestampLabel,
            Descricao = @descricao,
            FileName = @fileName,
            DownloadUrl = @downloadUrl,
            CaminhoStorage = @caminhoStorage,
            PersistedAt = @persistedAt,
            OrdemExibicao = @ordemExibicao,
            AnnotationsJson = @annotationsJson,
            EditHistoryJson = @editHistoryJson
        WHEN NOT MATCHED THEN
          INSERT (QuadroId, BugId, Nome, TimestampLabel, Descricao, FileName, DownloadUrl, CaminhoStorage, PersistedAt, OrdemExibicao, AnnotationsJson, EditHistoryJson)
          VALUES (@quadroId, @bugId, @nome, @timestampLabel, @descricao, @fileName, @downloadUrl, @caminhoStorage, @persistedAt, @ordemExibicao, @annotationsJson, @editHistoryJson);
      `)
    }

    return res.status(201).json({
      id: `${safeBugId}-${fileName}`,
      fileName,
      imageUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/bugs/${encodeURIComponent(safeBugId)}/quadros/${encodeURIComponent(fileName)}`,
      downloadUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/bugs/${encodeURIComponent(safeBugId)}/quadros/${encodeURIComponent(fileName)}`,
      persistedAt,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel persistir o quadro do bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:bugId/quadros/:ticketId/:fileName', async (req, res) => {
  try {
    const { framesDirectory, metadataPath } = bugFramesPaths(req.params.ticketId, req.params.bugId)
    const fileName = path.basename(req.params.fileName)
    const filePath = path.join(framesDirectory, fileName)

    await fs.rm(filePath, { force: true })
    const metadata = await readMetadata(metadataPath)
    const nextMetadata = metadata.filter((entry) => entry.fileName !== fileName)
    await fs.writeFile(metadataPath, JSON.stringify(nextMetadata, null, 2), 'utf-8')

    const pool = await getPool()
    if (pool) {
      const request = createRequest(pool)
      request.input('bugId', sql.NVarChar(120), req.params.bugId)
      request.input('fileName', sql.NVarChar(255), fileName)
      await request.query('DELETE FROM dbo.BugQuadros WHERE BugId = @bugId AND FileName = @fileName')
    }
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel remover o quadro do bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:bugId/quadros/:ticketId/:fileName', async (req, res) => {
  try {
    const { metadataPath } = bugFramesPaths(req.params.ticketId, req.params.bugId)
    const fileName = path.basename(req.params.fileName)
    const metadata = await readMetadata(metadataPath)
    const nextMetadata = metadata.map((entry) =>
      entry.fileName === fileName
        ? {
            ...entry,
            description: typeof req.body?.description === 'string' ? req.body.description : entry.description,
            timestampLabel: typeof req.body?.timestampLabel === 'string' ? req.body.timestampLabel : entry.timestampLabel,
          }
        : entry,
    )

    await fs.writeFile(metadataPath, JSON.stringify(nextMetadata, null, 2), 'utf-8')

    const pool = await getPool()
    if (pool) {
      const request = createRequest(pool)
      request.input('bugId', sql.NVarChar(120), req.params.bugId)
      request.input('fileName', sql.NVarChar(255), fileName)
      request.input('descricao', sql.NVarChar(sql.MAX), typeof req.body?.description === 'string' ? req.body.description : '')
      request.input('timestampLabel', sql.NVarChar(50), typeof req.body?.timestampLabel === 'string' ? req.body.timestampLabel : '')
      await request.query(`
        UPDATE dbo.BugQuadros
        SET Descricao = CASE WHEN @descricao = '' THEN Descricao ELSE @descricao END,
            TimestampLabel = CASE WHEN @timestampLabel = '' THEN TimestampLabel ELSE @timestampLabel END
        WHERE BugId = @bugId AND FileName = @fileName
      `)
    }
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel atualizar o quadro do bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
