import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')

function sanitizeTicketId(ticketId) {
  return (ticketId || 'sem-ticket').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function ensurePngDataUrl(imageDataUrl) {
  const match = imageDataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!match) {
    throw new Error('Formato de quadro invalido. Envie uma imagem PNG em base64.')
  }

  return match[1]
}

async function ensureTicketFolder(ticketId) {
  const safeTicketId = sanitizeTicketId(ticketId)
  const framesDirectory = path.join(storageRoot, 'chamados', safeTicketId, 'quadros')
  await fs.mkdir(framesDirectory, { recursive: true })
  return { safeTicketId, framesDirectory }
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

router.post('/', async (req, res) => {
  try {
    const { ticketId, imageDataUrl, timestampLabel, description } = req.body ?? {}

    if (!ticketId || !imageDataUrl || !timestampLabel) {
      return res.status(400).json({ message: 'ticketId, imageDataUrl e timestampLabel sao obrigatorios.' })
    }

    const pngBase64 = ensurePngDataUrl(imageDataUrl)
    const { safeTicketId, framesDirectory } = await ensureTicketFolder(ticketId)
    const fileName = await nextFrameFileName(framesDirectory)
    const filePath = path.join(framesDirectory, fileName)
    const persistedAt = new Date().toISOString()
    const metadataPath = path.join(framesDirectory, 'metadata.json')

    await fs.writeFile(filePath, Buffer.from(pngBase64, 'base64'))

    const metadata = await readMetadata(metadataPath)
    metadata.push({
      id: `${safeTicketId}-${fileName}`,
      originalTicketId: ticketId,
      fileName,
      timestampLabel,
      description: description || '',
      persistedAt,
    })
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

    return res.status(201).json({
      id: `${safeTicketId}-${fileName}`,
      fileName,
      imageUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/quadros/${encodeURIComponent(fileName)}`,
      downloadUrl: `/storage/chamados/${encodeURIComponent(safeTicketId)}/quadros/${encodeURIComponent(fileName)}`,
      persistedAt,
    })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel persistir o quadro capturado.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:ticketId/:fileName', async (req, res) => {
  try {
    const safeTicketId = sanitizeTicketId(req.params.ticketId)
    const fileName = path.basename(req.params.fileName)
    const framesDirectory = path.join(storageRoot, 'chamados', safeTicketId, 'quadros')
    const filePath = path.join(framesDirectory, fileName)
    const metadataPath = path.join(framesDirectory, 'metadata.json')

    await fs.rm(filePath, { force: true })

    const metadata = await readMetadata(metadataPath)
    const nextMetadata = metadata.filter((entry) => entry.fileName !== fileName)
    await fs.writeFile(metadataPath, JSON.stringify(nextMetadata, null, 2), 'utf-8')

    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel remover o quadro persistido.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:ticketId/:fileName', async (req, res) => {
  try {
    const safeTicketId = sanitizeTicketId(req.params.ticketId)
    const fileName = path.basename(req.params.fileName)
    const framesDirectory = path.join(storageRoot, 'chamados', safeTicketId, 'quadros')
    const metadataPath = path.join(framesDirectory, 'metadata.json')
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
      message: 'Nao foi possivel atualizar os metadados do quadro.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
