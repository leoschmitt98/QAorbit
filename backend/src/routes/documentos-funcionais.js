import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')
const baseDirectory = path.join(storageRoot, 'documentos-funcionais')
const metadataPath = path.join(baseDirectory, 'records.json')

function sanitizeSegment(value) {
  return String(value || 'sem-valor').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

async function ensureBaseDirectory() {
  await fs.mkdir(baseDirectory, { recursive: true })
}

async function readRecords() {
  try {
    const raw = await fs.readFile(metadataPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeRecords(records) {
  await ensureBaseDirectory()
  await fs.writeFile(metadataPath, JSON.stringify(records, null, 2), 'utf-8')
}

function normalizeRecord(record) {
  return {
    ...record,
    id: String(record.id || ''),
    projectId: String(record.projectId || ''),
    moduleId: String(record.moduleId || ''),
    title: String(record.title || '').trim(),
    summary: String(record.summary || '').trim(),
    version: String(record.version || '').trim(),
    author: String(record.author || '').trim(),
    fileName: String(record.fileName || '').trim(),
    tags: Array.isArray(record.tags) ? record.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  }
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+);base64,(.+)$/)
  if (!match) {
    throw new Error('Arquivo invalido. Envie o conteudo em base64.')
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function buildDownloadUrl(record) {
  return `/storage/documentos-funcionais/${encodeURIComponent(record.projectId)}/${encodeURIComponent(record.moduleId)}/${encodeURIComponent(record.storedFileName)}`
}

router.get('/', async (req, res) => {
  try {
    const projectId = String(req.query.projectId || '').trim()
    const moduleId = String(req.query.moduleId || '').trim()
    const search = String(req.query.search || '').trim().toLowerCase()

    const records = (await readRecords()).map(normalizeRecord).filter((record) => {
      if (projectId && record.projectId !== projectId) return false
      if (moduleId && record.moduleId !== moduleId) return false
      if (!search) return true

      return [record.title, record.summary, record.version, record.tags.join(' '), record.projectName, record.moduleName]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })

    return res.json(
      records
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map((record) => ({
          ...record,
          downloadUrl: buildDownloadUrl(record),
        })),
    )
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar os documentos funcionais.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:documentId', async (req, res) => {
  try {
    const records = (await readRecords()).map(normalizeRecord)
    const found = records.find((record) => record.id === req.params.documentId)
    if (!found) {
      return res.status(404).json({ message: 'Documento funcional nao encontrado.' })
    }

    return res.json({
      ...found,
      downloadUrl: buildDownloadUrl(found),
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar o documento funcional.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  const title = String(req.body?.title || '').trim()
  const type = String(req.body?.type || '').trim()
  const projectId = String(req.body?.projectId || '').trim()
  const projectName = String(req.body?.projectName || '').trim()
  const moduleId = String(req.body?.moduleId || '').trim()
  const moduleName = String(req.body?.moduleName || '').trim()
  const version = String(req.body?.version || '').trim() || 'v1'
  const summary = String(req.body?.summary || '').trim()
  const author = String(req.body?.author || '').trim() || 'QA Orbit'
  const fileName = String(req.body?.fileName || '').trim()
  const dataUrl = String(req.body?.fileDataUrl || '')
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean) : []

  if (!title || !type || !projectId || !moduleId || !fileName || !dataUrl) {
    return res.status(400).json({ message: 'Titulo, tipo, projeto, modulo e arquivo sao obrigatorios.' })
  }

  try {
    const id = `doc-${Date.now()}`
    const safeProjectId = sanitizeSegment(projectId)
    const safeModuleId = sanitizeSegment(moduleId)
    const safeFileName = `${id}-${sanitizeSegment(fileName)}`
    const targetDirectory = path.join(baseDirectory, safeProjectId, safeModuleId)
    const { mimeType, buffer } = parseDataUrl(dataUrl)

    await fs.mkdir(targetDirectory, { recursive: true })
    await fs.writeFile(path.join(targetDirectory, safeFileName), buffer)

    const record = normalizeRecord({
      id,
      title,
      type,
      projectId,
      projectName,
      moduleId,
      moduleName,
      version,
      summary,
      author,
      fileName,
      storedFileName: safeFileName,
      tags,
      mimeType,
      sizeBytes: buffer.byteLength,
      updatedAt: new Date().toISOString(),
    })

    const records = await readRecords()
    records.push(record)
    await writeRecords(records)

    return res.status(201).json({
      ...record,
      downloadUrl: buildDownloadUrl(record),
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel salvar o documento funcional.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
