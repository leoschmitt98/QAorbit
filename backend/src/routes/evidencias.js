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

function sanitizeTicketId(ticketId) {
  return (ticketId || 'sem-ticket').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function workflowPaths(ticketId) {
  const safeTicketId = sanitizeTicketId(ticketId)
  const ticketDirectory = path.join(storageRoot, 'chamados', safeTicketId)
  return {
    safeTicketId,
    ticketDirectory,
    workflowPath: path.join(ticketDirectory, 'workflow.json'),
    metadataPath: path.join(ticketDirectory, 'quadros', 'metadata.json'),
    framesDirectory: path.join(ticketDirectory, 'quadros'),
  }
}

async function loadWorkflow(ticketId) {
  const { workflowPath } = workflowPaths(ticketId)
  const content = await fs.readFile(workflowPath, 'utf-8')
  return JSON.parse(content)
}

async function loadMetadata(ticketId) {
  const { metadataPath } = workflowPaths(ticketId)
  try {
    const content = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function resolveCatalogNames(projectId, moduleId) {
  if (!projectId && !moduleId) {
    return { projectName: '-', moduleName: '-' }
  }

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

  return finalLines.map(
    (line) =>
      new Paragraph({
        text: line,
        ...options,
      }),
  )
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

  if (lower.includes('reprov') || lower.includes('nok') || lower.includes('erro')) color = 'C53030'
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
    ...lines.map(
      (line, index) =>
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

function buildEnvironmentBlock(ticket, catalogNames) {
  const moduleLabel = ticket.portalArea
    ? `${ticket.portalArea}${catalogNames.moduleName && catalogNames.moduleName !== '-' ? ` · ${catalogNames.moduleName}` : ''}`
    : catalogNames.moduleName || ticket.portalArea || ''

  const { databaseValue, connectionValue } = parseBaseReference(ticket.baseReference)
  const rows = [
    ['Ambiente', ticket.environment],
    ['Base de dados', databaseValue],
    ['Conexao', connectionValue],
    ['Usuario', ticket.username ? `${ticket.username}${ticket.password ? ` / ${ticket.password}` : ''}` : ''],
    ['Modulo', moduleLabel],
    ['URL', ticket.accessUrl],
    ['Branch', ticket.branchName],
  ].filter(([, value]) => isMeaningfulValue(value))

  if (rows.length === 0) {
    return [new Paragraph('Nenhuma informacao de ambiente foi registrada para este chamado.')]
  }

  return rows.flatMap(([label, value]) => buildLabeledBlock(label, value))
}

function buildInfoBlock(ticket, catalogNames) {
  const rows = [
    ['Chamado', ticket.ticketId || '-'],
    ['Projeto', catalogNames.projectName],
    ['Modulo', catalogNames.moduleName],
    ['Ambiente', ticket.environment || '-'],
    ['Versao', ticket.version || '-'],
  ].filter(([, value]) => isMeaningfulValue(value))

  return rows.flatMap(([label, value]) => buildLabeledBlock(label, value))
}

function buildConclusionParagraphs(workflow) {
  const conclusionText = normalizeText(workflow.retest?.obtainedBehavior)
  if (conclusionText) return buildMultilineParagraphs(conclusionText)

  if ((workflow.retest?.status || '').toLowerCase().includes('aprov')) {
    return [new Paragraph('O reteste foi concluido com sucesso e nao apresentou novas divergencias visiveis.')]
  }
  if ((workflow.retest?.status || '').toLowerCase().includes('parcial')) {
    return [new Paragraph('O reteste apresentou resultado parcial e requer acompanhamento complementar do fluxo validado.')]
  }
  return [new Paragraph('O problema persiste apos o reteste e requer nova analise do time responsavel.')]
}

router.get('/:ticketId/export-docx', async (req, res) => {
  try {
    const workflow = await loadWorkflow(req.params.ticketId)
    const metadata = await loadMetadata(req.params.ticketId)
    const { framesDirectory, safeTicketId, ticketDirectory } = workflowPaths(req.params.ticketId)
    const catalogNames = await resolveCatalogNames(workflow.ticket?.projectId, workflow.ticket?.moduleId)
    const orderedFrames = metadata.map((entry) => {
      const frame = workflow.retest?.frames?.find((item) => item.id === entry.id || item.fileName === entry.fileName)
      const stepIndex = workflow.retest?.steps?.findIndex((step) => step.frameIds.includes(entry.id)) ?? -1
      return {
        ...entry,
        frame,
        stepIndex,
        filePath: path.join(framesDirectory, entry.fileName),
      }
    })

    const docChildren = [
      buildDocumentTitle('Evidencia de Validacao'),
      buildSectionSeparator(),
      buildSectionTitle('Ambiente de Execucao'),
      ...buildEnvironmentBlock(workflow.ticket ?? {}, catalogNames),
      buildSectionSeparator(),
      buildSectionTitle('Dados do Chamado'),
      ...buildInfoBlock(workflow.ticket ?? {}, catalogNames),
      buildSectionSeparator(),
      buildSectionTitle('Descricao do Teste'),
      ...buildMultilineParagraphs(workflow.problem?.problemDescription || 'Sem descricao informada.'),
      buildSectionSeparator(),
      buildSectionTitle('Execucao do Teste'),
    ]

    if (orderedFrames.length === 0) {
      docChildren.push(new Paragraph('Nenhuma evidência visual foi registrada para este chamado.'))
    }

    for (let index = 0; index < orderedFrames.length; index += 1) {
      const item = orderedFrames[index]
      const imageBuffer = await fs.readFile(item.filePath)
      const title = item.stepIndex >= 0 ? `PASSO ${item.stepIndex + 1}` : `PASSO ${index + 1}`

      docChildren.push(buildStepTitle(title, { before: index === 0 ? 180 : 360, after: 140 }))
      docChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width: 520, height: 293 },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: item.description || item.frame?.description ? 100 : 220 },
        }),
      )

      if (item.description || item.frame?.description) {
        docChildren.push(
          ...buildMultilineParagraphs(item.description || item.frame?.description || '', {
            alignment: AlignmentType.CENTER,
            spacing: { after: 220 },
          }),
        )
      }
    }

    docChildren.push(buildSectionSeparator())
    docChildren.push(buildSectionTitle('Conclusao'))
    docChildren.push(buildStatusBadge(workflow.retest?.status || '-'))
    docChildren.push(...buildConclusionParagraphs(workflow))

    const doc = new Document({
      sections: [{ children: docChildren }],
    })

    const buffer = await Packer.toBuffer(doc)
    const fileName = `evidencia-${safeTicketId}.docx`
    const filePath = path.join(ticketDirectory, fileName)

    await fs.mkdir(ticketDirectory, { recursive: true })
    await fs.writeFile(filePath, buffer)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', String(buffer.length))
    return res.send(buffer)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel gerar a evidencia em Word.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
