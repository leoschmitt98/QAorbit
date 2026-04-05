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
import { createRequest, getPool, queryTrustedJson } from '../db.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')

function sanitizeSegment(value) {
  return (value || 'sem-valor').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function ticketDirectory(ticketId) {
  return path.join(storageRoot, 'chamados', sanitizeSegment(ticketId))
}

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

async function loadWorkflow(ticketId) {
  const workflowPath = path.join(ticketDirectory(ticketId), 'workflow.json')
  const raw = await fs.readFile(workflowPath, 'utf-8')
  return JSON.parse(raw)
}

async function loadBug(ticketId, bugId) {
  const { bugPath } = bugPaths(ticketId, bugId)
  const raw = await fs.readFile(bugPath, 'utf-8')
  return JSON.parse(raw)
}

async function loadBugById(bugId) {
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

    const workflow = await loadWorkflow(found.ticketId)
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

    const workflow = await loadWorkflow(ticketId)
    const reproductionSteps = normalizeSteps(req.body?.reproductionSteps)
    if (reproductionSteps.length === 0) {
      return res.status(400).json({ message: 'Cadastre pelo menos um passo de reproducao para salvar o bug.' })
    }

    const catalogNames = await resolveCatalogNames(workflow.ticket?.projectId, workflow.ticket?.moduleId)
    const { baseDirectory, bugPath } = bugPaths(ticketId, bugId)
    const existingBug = await loadBug(ticketId, bugId).catch(() => null)
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

    const workflow = await loadWorkflow(found.ticketId)
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
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel atualizar o quadro do bug.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
