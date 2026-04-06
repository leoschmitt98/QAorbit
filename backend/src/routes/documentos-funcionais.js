import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequest, getPool, sql } from '../db.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')
const baseDirectory = path.join(storageRoot, 'documentos-funcionais')
const metadataPath = path.join(baseDirectory, 'records.json')
let schemaReadyPromise

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

function ensureDocumentScopesSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool()
      if (!pool) return

      await pool.request().query(`
        IF OBJECT_ID('dbo.ProjetoPortais', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.ProjetoPortais (
            Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            ProjetoId INT NOT NULL,
            Nome NVARCHAR(200) NOT NULL,
            Ativo BIT NOT NULL CONSTRAINT DF_ProjetoPortais_Ativo DEFAULT (1),
            DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ProjetoPortais_DataCriacao DEFAULT (SYSDATETIME()),
            DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ProjetoPortais_DataAtualizacao DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_ProjetoPortais_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id)
          );
        END;

        IF COL_LENGTH('dbo.Modulos', 'PortalId') IS NULL
        BEGIN
          ALTER TABLE dbo.Modulos ADD PortalId INT NULL;
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

router.get('/', async (req, res) => {
  try {
    await ensureDocumentScopesSchema()
    const projectId = String(req.query.projectId || '').trim()
    const moduleId = String(req.query.moduleId || '').trim()
    const search = String(req.query.search || '').trim().toLowerCase()

    const pool = await getPool()
    const dbRecords =
      pool
        ? (
            await (() => {
              const request = createRequest(pool)
              return request.query(`
                SELECT
                  df.*,
                  m.PortalId AS PortalId,
                  pp.Nome AS PortalNome
                FROM dbo.DocumentosFuncionais df
                LEFT JOIN dbo.Modulos m ON m.Id = df.ModuloId
                LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = m.PortalId
                WHERE df.Ativo = 1
                ORDER BY df.DataAtualizacao DESC
              `)
            })()
          ).recordset.map((row) =>
            normalizeRecord({
              id: row.DocumentoId,
              projectId: row.ProjetoId ? String(row.ProjetoId) : '',
              projectName: '',
              moduleId: row.ModuloId ? String(row.ModuloId) : '',
              portalId: row.PortalId ? String(row.PortalId) : '',
              portalName: row.PortalNome || '',
              moduleName: '',
              title: row.Titulo,
              type: row.TipoDocumento,
              version: row.Versao,
              summary: row.Resumo,
              author: row.Autor,
              fileName: row.NomeArquivo,
              storedFileName: row.CaminhoStorage ? path.basename(row.CaminhoStorage) : row.NomeArquivo,
              downloadUrl: row.DownloadUrl,
              mimeType: row.MimeType,
              sizeBytes: row.TamanhoBytes,
              tags: row.TagsJson ? JSON.parse(row.TagsJson) : [],
              updatedAt: row.DataAtualizacao ? new Date(row.DataAtualizacao).toISOString() : new Date().toISOString(),
            }),
          )
        : null

    const records = (dbRecords ?? (await readRecords()).map(normalizeRecord)).filter((record) => {
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
    await ensureDocumentScopesSchema()
    const pool = await getPool()
    const records = pool
      ? (
          await (() => {
            const request = createRequest(pool)
            request.input('documentoId', sql.NVarChar(80), req.params.documentId)
            return request.query(`
              SELECT
                df.*,
                m.PortalId AS PortalId,
                pp.Nome AS PortalNome
              FROM dbo.DocumentosFuncionais df
              LEFT JOIN dbo.Modulos m ON m.Id = df.ModuloId
              LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = m.PortalId
              WHERE df.DocumentoId = @documentoId
            `)
          })()
        ).recordset.map((row) =>
          normalizeRecord({
            id: row.DocumentoId,
            projectId: row.ProjetoId ? String(row.ProjetoId) : '',
            portalId: row.PortalId ? String(row.PortalId) : '',
            portalName: row.PortalNome || '',
            moduleId: row.ModuloId ? String(row.ModuloId) : '',
            title: row.Titulo,
            type: row.TipoDocumento,
            version: row.Versao,
            summary: row.Resumo,
            author: row.Autor,
            fileName: row.NomeArquivo,
            storedFileName: row.CaminhoStorage ? path.basename(row.CaminhoStorage) : row.NomeArquivo,
            tags: row.TagsJson ? JSON.parse(row.TagsJson) : [],
            updatedAt: row.DataAtualizacao ? new Date(row.DataAtualizacao).toISOString() : new Date().toISOString(),
          }),
        )
      : (await readRecords()).map(normalizeRecord)
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
    await ensureDocumentScopesSchema()
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

    const pool = await getPool()
    if (pool) {
      const request = createRequest(pool)
      request.input('documentoId', sql.NVarChar(80), record.id)
      request.input('projetoId', sql.Int, Number(projectId))
      request.input('moduloId', sql.Int, Number(moduleId))
      request.input('titulo', sql.NVarChar(250), title)
      request.input('tipoDocumento', sql.NVarChar(80), type)
      request.input('versao', sql.NVarChar(50), version)
      request.input('resumo', sql.NVarChar(sql.MAX), summary)
      request.input('autor', sql.NVarChar(150), author)
      request.input('tagsJson', sql.NVarChar(sql.MAX), JSON.stringify(tags))
      request.input('nomeArquivo', sql.NVarChar(255), fileName)
      request.input('caminhoStorage', sql.NVarChar(500), `${safeProjectId}/${safeModuleId}/${safeFileName}`)
      request.input('downloadUrl', sql.NVarChar(500), buildDownloadUrl(record))
      request.input('mimeType', sql.NVarChar(120), mimeType)
      request.input('tamanhoBytes', sql.BigInt, buffer.byteLength)
      request.input('dataAtualizacao', sql.DateTime2, new Date(record.updatedAt))
      await request.query(`
        INSERT INTO dbo.DocumentosFuncionais
        (DocumentoId, ProjetoId, ModuloId, Titulo, TipoDocumento, Versao, Resumo, Autor, TagsJson, NomeArquivo, CaminhoStorage, DownloadUrl, MimeType, TamanhoBytes, DataAtualizacao)
        VALUES
        (@documentoId, @projetoId, @moduloId, @titulo, @tipoDocumento, @versao, @resumo, @autor, @tagsJson, @nomeArquivo, @caminhoStorage, @downloadUrl, @mimeType, @tamanhoBytes, @dataAtualizacao)
      `)
    }

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
