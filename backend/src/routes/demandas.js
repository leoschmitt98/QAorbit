import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canAccessOwnedRecord, resolveWorkspaceScope } from '../lib/auth.js'
import { createRequest, getPool, sql } from '../db.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const storageRoot = path.resolve(__dirname, '../../../storage')

let schemaReadyPromise

function normalizeString(value) {
  const normalized = String(value ?? '').trim()
  return normalized || ''
}

function toNullableInt(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key)
}

function sanitizeStorageSegment(value, fallback) {
  return normalizeString(value || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function sanitizeUploadedFileName(fileName) {
  const baseName = path.basename(normalizeString(fileName || 'evidencia.bin')) || 'evidencia.bin'
  return baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
}

function parseUploadedFile(fileDataUrl) {
  const match = String(fileDataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Arquivo de evidencia invalido. Envie o arquivo em base64.')
  }

  return {
    mimeType: match[1],
    base64Content: match[2],
  }
}

async function ensureEvidenceFolder(demandaId, tarefaId, cenarioId) {
  const folder = path.join(
    storageRoot,
    'demandas',
    sanitizeStorageSegment(demandaId, 'sem-demanda'),
    'tarefas',
    sanitizeStorageSegment(tarefaId, 'sem-tarefa'),
    'cenarios',
    sanitizeStorageSegment(cenarioId, 'sem-cenario'),
    'evidencias',
  )

  await fs.mkdir(folder, { recursive: true })
  return folder
}

function normalizeDemandaStatus(value) {
  const normalized = normalizeString(value)
  if (['Rascunho', 'Em andamento', 'Concluida'].includes(normalized)) return normalized
  return 'Rascunho'
}

function normalizePrioridade(value) {
  const normalized = normalizeString(value)
  if (['Baixa', 'Media', 'Alta'].includes(normalized)) return normalized
  return 'Media'
}

function normalizeTarefaStatus(value) {
  const normalized = normalizeString(value)
  if (['Pendente', 'Em validacao', 'Concluida'].includes(normalized)) return normalized
  return 'Pendente'
}

function normalizeCenarioTipo(value) {
  const normalized = normalizeString(value).toLowerCase()
  if (normalized === 'principal') return 'principal'
  return 'auxiliar'
}

function normalizeCenarioStatus(value) {
  const normalized = normalizeString(value).toLowerCase()
  if (['passou', 'falhou', 'parcial'].includes(normalized)) return normalized
  return 'parcial'
}

async function ensureDemandasSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool()
      if (!pool) return

      await createRequest(pool).query(`
        IF OBJECT_ID('dbo.Demandas', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Demandas (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            Titulo NVARCHAR(250) NOT NULL,
            Descricao NVARCHAR(MAX) NULL,
            ProjetoId INT NOT NULL,
            Status NVARCHAR(40) NOT NULL CONSTRAINT DF_Demandas_Status DEFAULT ('Rascunho'),
            Prioridade NVARCHAR(30) NOT NULL CONSTRAINT DF_Demandas_Prioridade DEFAULT ('Media'),
            ResponsavelId NVARCHAR(120) NULL,
            CriadoPorUsuarioId NVARCHAR(120) NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_Demandas_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_Demandas_AtualizadoEm DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_Demandas_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id)
          );

          CREATE INDEX IX_Demandas_ProjetoId ON dbo.Demandas (ProjetoId);
          CREATE INDEX IX_Demandas_Status ON dbo.Demandas (Status);
          CREATE INDEX IX_Demandas_CriadoPorUsuarioId ON dbo.Demandas (CriadoPorUsuarioId);
        END;

        IF OBJECT_ID('dbo.DemandaTarefas', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.DemandaTarefas (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            DemandaId NVARCHAR(120) NOT NULL,
            Titulo NVARCHAR(250) NOT NULL,
            Descricao NVARCHAR(MAX) NULL,
            PortalId INT NULL,
            AreaId INT NULL,
            ModuloId INT NULL,
            Status NVARCHAR(40) NOT NULL CONSTRAINT DF_DemandaTarefas_Status DEFAULT ('Pendente'),
            Ordem INT NOT NULL CONSTRAINT DF_DemandaTarefas_Ordem DEFAULT (1),
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaTarefas_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaTarefas_AtualizadoEm DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_DemandaTarefas_Demandas FOREIGN KEY (DemandaId) REFERENCES dbo.Demandas (Id) ON DELETE CASCADE,
            CONSTRAINT FK_DemandaTarefas_ProjetoPortais FOREIGN KEY (PortalId) REFERENCES dbo.ProjetoPortais (Id),
            CONSTRAINT FK_DemandaTarefas_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id),
            CONSTRAINT FK_DemandaTarefas_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
          );

          CREATE INDEX IX_DemandaTarefas_DemandaId ON dbo.DemandaTarefas (DemandaId, Ordem);
        END;

        IF COL_LENGTH('dbo.DemandaTarefas', 'PortalId') IS NULL
        BEGIN
          ALTER TABLE dbo.DemandaTarefas ADD PortalId INT NULL;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_DemandaTarefas_ProjetoPortais')
        BEGIN
          ALTER TABLE dbo.DemandaTarefas
          ADD CONSTRAINT FK_DemandaTarefas_ProjetoPortais FOREIGN KEY (PortalId) REFERENCES dbo.ProjetoPortais (Id);
        END;

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE name = 'IX_DemandaTarefas_PortalId'
            AND object_id = OBJECT_ID('dbo.DemandaTarefas')
        )
        BEGIN
          CREATE INDEX IX_DemandaTarefas_PortalId ON dbo.DemandaTarefas (PortalId);
        END;

        IF OBJECT_ID('dbo.DemandaCenarios', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.DemandaCenarios (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            DemandaId NVARCHAR(120) NOT NULL,
            DemandaTarefaId NVARCHAR(120) NOT NULL,
            Titulo NVARCHAR(250) NOT NULL,
            Descricao NVARCHAR(MAX) NULL,
            Tipo NVARCHAR(20) NOT NULL CONSTRAINT DF_DemandaCenarios_Tipo DEFAULT ('auxiliar'),
            Status NVARCHAR(20) NOT NULL CONSTRAINT DF_DemandaCenarios_Status DEFAULT ('parcial'),
            Observacoes NVARCHAR(MAX) NULL,
            CriadoPorUsuarioId NVARCHAR(120) NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaCenarios_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaCenarios_AtualizadoEm DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_DemandaCenarios_Demandas FOREIGN KEY (DemandaId) REFERENCES dbo.Demandas (Id),
            CONSTRAINT FK_DemandaCenarios_Tarefas FOREIGN KEY (DemandaTarefaId) REFERENCES dbo.DemandaTarefas (Id) ON DELETE CASCADE
          );

          CREATE INDEX IX_DemandaCenarios_TarefaId ON dbo.DemandaCenarios (DemandaTarefaId, Tipo, CriadoEm);
          CREATE INDEX IX_DemandaCenarios_DemandaId ON dbo.DemandaCenarios (DemandaId);
        END;

        IF OBJECT_ID('dbo.DemandaCenarioEvidencias', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.DemandaCenarioEvidencias (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            DemandaId NVARCHAR(120) NOT NULL,
            DemandaTarefaId NVARCHAR(120) NOT NULL,
            DemandaCenarioId NVARCHAR(120) NOT NULL,
            NomeArquivo NVARCHAR(260) NOT NULL,
            CaminhoArquivo NVARCHAR(500) NOT NULL,
            TipoArquivo NVARCHAR(120) NULL,
            Legenda NVARCHAR(MAX) NULL,
            Ordem INT NOT NULL CONSTRAINT DF_DemandaCenarioEvidencias_Ordem DEFAULT (1),
            CriadoPorUsuarioId NVARCHAR(120) NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaCenarioEvidencias_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_DemandaCenarioEvidencias_AtualizadoEm DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_DemandaCenarioEvidencias_Demandas FOREIGN KEY (DemandaId) REFERENCES dbo.Demandas (Id),
            CONSTRAINT FK_DemandaCenarioEvidencias_Tarefas FOREIGN KEY (DemandaTarefaId) REFERENCES dbo.DemandaTarefas (Id),
            CONSTRAINT FK_DemandaCenarioEvidencias_Cenarios FOREIGN KEY (DemandaCenarioId) REFERENCES dbo.DemandaCenarios (Id) ON DELETE CASCADE
          );

          CREATE INDEX IX_DemandaCenarioEvidencias_CenarioId ON dbo.DemandaCenarioEvidencias (DemandaCenarioId, Ordem, CriadoEm);
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

function mapDemanda(row) {
  return {
    id: row.Id,
    titulo: row.Titulo || '',
    descricao: row.Descricao || '',
    projectId: row.ProjetoId ? String(row.ProjetoId) : '',
    projectName: row.ProjectName || '',
    status: row.Status || 'Rascunho',
    prioridade: row.Prioridade || 'Media',
    responsavelId: row.ResponsavelId || '',
    createdByUserId: row.CriadoPorUsuarioId || '',
    ownerName: row.OwnerName || '',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
    tarefasCount: Number(row.TarefasCount || 0),
  }
}

function mapTarefa(row) {
  return {
    id: row.Id,
    demandaId: row.DemandaId,
    titulo: row.Titulo || '',
    descricao: row.Descricao || '',
    portalId: row.PortalId ? String(row.PortalId) : '',
    portalName: row.PortalName || row.AreaName || '',
    areaId: row.AreaId ? String(row.AreaId) : '',
    areaName: row.AreaName || '',
    moduleId: row.ModuloId ? String(row.ModuloId) : '',
    moduleName: row.ModuleName || '',
    status: row.Status || 'Pendente',
    ordem: Number(row.Ordem || 0),
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
  }
}

function mapCenario(row) {
  return {
    id: row.Id,
    demandaId: row.DemandaId,
    demandaTarefaId: row.DemandaTarefaId,
    titulo: row.Titulo || '',
    descricao: row.Descricao || '',
    tipo: row.Tipo || 'auxiliar',
    status: row.Status || 'parcial',
    observacoes: row.Observacoes || '',
    createdByUserId: row.CriadoPorUsuarioId || '',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
  }
}

function mapEvidencia(row) {
  return {
    id: row.Id,
    demandaId: row.DemandaId,
    demandaTarefaId: row.DemandaTarefaId,
    demandaCenarioId: row.DemandaCenarioId,
    nomeArquivo: row.NomeArquivo || '',
    caminhoArquivo: row.CaminhoArquivo || '',
    urlArquivo: row.CaminhoArquivo ? `/storage/${String(row.CaminhoArquivo).replace(/\\/g, '/')}` : '',
    tipoArquivo: row.TipoArquivo || '',
    legenda: row.Legenda || '',
    ordem: Number(row.Ordem || 0),
    createdByUserId: row.CriadoPorUsuarioId || '',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
  }
}

async function loadOwnedDemanda(demandaId, auth) {
  const pool = await getPool()
  if (!pool) throw new Error('Demandas requerem banco configurado.')

  const request = createRequest(pool)
  request.input('demandaId', sql.NVarChar(120), demandaId)
  const result = await request.query(`
    SELECT TOP 1
      d.*,
      p.Nome AS ProjectName,
      ownerUser.Nome AS OwnerName,
      (SELECT COUNT(1) FROM dbo.DemandaTarefas t WHERE t.DemandaId = d.Id) AS TarefasCount
    FROM dbo.Demandas d
    INNER JOIN dbo.Projetos p ON p.Id = d.ProjetoId
    LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = d.CriadoPorUsuarioId
    WHERE d.Id = @demandaId
  `)

  const found = result.recordset[0]
  if (!found) throw new Error('Demanda nao encontrada.')
  if (!canAccessOwnedRecord(auth, found.CriadoPorUsuarioId)) {
    throw new Error('Acesso restrito ao workspace deste QA.')
  }
  return found
}

async function loadOwnedTarefa(demandaId, tarefaId, auth) {
  await loadOwnedDemanda(demandaId, auth)
  const pool = await getPool()
  const request = createRequest(pool)
  request.input('demandaId', sql.NVarChar(120), demandaId)
  request.input('tarefaId', sql.NVarChar(120), tarefaId)
  const result = await request.query(`
    SELECT TOP 1
      t.*,
      pp.Nome AS PortalName,
      a.Nome AS AreaName,
      m.Nome AS ModuleName
    FROM dbo.DemandaTarefas t
    LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = t.PortalId
    LEFT JOIN dbo.Areas a ON a.Id = t.AreaId
    LEFT JOIN dbo.Modulos m ON m.Id = t.ModuloId
    WHERE t.Id = @tarefaId
      AND t.DemandaId = @demandaId
  `)

  const found = result.recordset[0]
  if (!found) throw new Error('Tarefa da demanda nao encontrada.')
  return found
}

async function loadOwnedCenario(demandaId, tarefaId, cenarioId, auth) {
  await loadOwnedTarefa(demandaId, tarefaId, auth)
  const pool = await getPool()
  const request = createRequest(pool)
  request.input('demandaId', sql.NVarChar(120), demandaId)
  request.input('tarefaId', sql.NVarChar(120), tarefaId)
  request.input('cenarioId', sql.NVarChar(120), cenarioId)
  const result = await request.query(`
    SELECT TOP 1 *
    FROM dbo.DemandaCenarios
    WHERE Id = @cenarioId
      AND DemandaId = @demandaId
      AND DemandaTarefaId = @tarefaId
  `)

  const found = result.recordset[0]
  if (!found) throw new Error('Cenario da tarefa nao encontrado.')
  return found
}

async function ensurePrincipalScenarioAvailable(pool, demandaId, tarefaId, tipo, ignoreCenarioId) {
  if (tipo !== 'principal') return

  const request = createRequest(pool)
  request.input('demandaId', sql.NVarChar(120), demandaId)
  request.input('tarefaId', sql.NVarChar(120), tarefaId)
  request.input('ignoreCenarioId', sql.NVarChar(120), ignoreCenarioId || '')
  const result = await request.query(`
    SELECT TOP 1 Id
    FROM dbo.DemandaCenarios
    WHERE DemandaId = @demandaId
      AND DemandaTarefaId = @tarefaId
      AND Tipo = 'principal'
      AND (@ignoreCenarioId = '' OR Id <> @ignoreCenarioId)
  `)

  if (result.recordset[0]) {
    throw new Error('Esta tarefa ja possui um cenario principal.')
  }
}

router.get('/', async (req, res) => {
  try {
    await ensureDemandasSchema()
    const pool = await getPool()
    if (!pool) {
      return res.json([])
    }

    const scope = resolveWorkspaceScope(req.auth, req.query.scope)
    const request = createRequest(pool)
    request.input('scope', sql.NVarChar(10), scope)
    request.input('userId', sql.NVarChar(120), req.auth?.userId || '')
    const result = await request.query(`
      SELECT
        d.*,
        p.Nome AS ProjectName,
        ownerUser.Nome AS OwnerName,
        (SELECT COUNT(1) FROM dbo.DemandaTarefas t WHERE t.DemandaId = d.Id) AS TarefasCount
      FROM dbo.Demandas d
      INNER JOIN dbo.Projetos p ON p.Id = d.ProjetoId
      LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = d.CriadoPorUsuarioId
      WHERE @scope = 'all' OR d.CriadoPorUsuarioId = @userId
      ORDER BY d.AtualizadoEm DESC, d.Titulo
    `)

    return res.json(result.recordset.map(mapDemanda))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar as demandas.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    await ensureDemandasSchema()
    const demanda = await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const tarefasRequest = createRequest(pool)
    tarefasRequest.input('demandaId', sql.NVarChar(120), req.params.id)
    const tarefasResult = await tarefasRequest.query(`
      SELECT
        t.*,
        pp.Nome AS PortalName,
        a.Nome AS AreaName,
        m.Nome AS ModuleName
      FROM dbo.DemandaTarefas t
      LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = t.PortalId
      LEFT JOIN dbo.Areas a ON a.Id = t.AreaId
      LEFT JOIN dbo.Modulos m ON m.Id = t.ModuloId
      WHERE t.DemandaId = @demandaId
      ORDER BY t.Ordem, t.CriadoEm
    `)

    const cenariosRequest = createRequest(pool)
    cenariosRequest.input('demandaId', sql.NVarChar(120), req.params.id)
    const cenariosResult = await cenariosRequest.query(`
      SELECT
        c.*
      FROM dbo.DemandaCenarios c
      WHERE c.DemandaId = @demandaId
      ORDER BY CASE WHEN c.Tipo = 'principal' THEN 0 ELSE 1 END, c.CriadoEm
    `)

    const cenariosByTarefa = new Map()
    for (const row of cenariosResult.recordset) {
      const current = cenariosByTarefa.get(row.DemandaTarefaId) ?? []
      current.push(mapCenario(row))
      cenariosByTarefa.set(row.DemandaTarefaId, current)
    }

    const evidenciasRequest = createRequest(pool)
    evidenciasRequest.input('demandaId', sql.NVarChar(120), req.params.id)
    const evidenciasResult = await evidenciasRequest.query(`
      SELECT
        e.*
      FROM dbo.DemandaCenarioEvidencias e
      WHERE e.DemandaId = @demandaId
      ORDER BY e.DemandaCenarioId, e.Ordem, e.CriadoEm
    `)

    const evidenciasByCenario = new Map()
    for (const row of evidenciasResult.recordset) {
      const current = evidenciasByCenario.get(row.DemandaCenarioId) ?? []
      current.push(mapEvidencia(row))
      evidenciasByCenario.set(row.DemandaCenarioId, current)
    }

    return res.json({
      ...mapDemanda(demanda),
      tarefas: tarefasResult.recordset.map((row) => ({
        ...mapTarefa(row),
        cenarios: (cenariosByTarefa.get(row.Id) ?? []).map((cenario) => ({
          ...cenario,
          evidencias: evidenciasByCenario.get(cenario.id) ?? [],
        })),
      })),
    })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    const notFound = error instanceof Error && error.message.includes('nao encontrada')
    return res.status(forbidden ? 403 : notFound ? 404 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel carregar a demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:id/cenarios', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    const result = await request.query(`
      SELECT
        c.*
      FROM dbo.DemandaCenarios c
      WHERE c.DemandaId = @demandaId
      ORDER BY c.DemandaTarefaId, CASE WHEN c.Tipo = 'principal' THEN 0 ELSE 1 END, c.CriadoEm
    `)

    return res.json(result.recordset.map(mapCenario))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel listar os cenarios da demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  try {
    await ensureDemandasSchema()
    const pool = await getPool()
    if (!pool) {
      throw new Error('Demandas requerem banco configurado.')
    }

    const titulo = normalizeString(req.body?.titulo)
    const descricao = normalizeString(req.body?.descricao)
    const projetoId = toNullableInt(req.body?.projectId)
    const status = normalizeDemandaStatus(req.body?.status)
    const prioridade = normalizePrioridade(req.body?.prioridade)
    const responsavelId = normalizeString(req.body?.responsavelId)

    if (!titulo || !projetoId) {
      return res.status(400).json({ message: 'Titulo e projeto sao obrigatorios para criar a demanda.' })
    }

    const id = `dem-${Date.now()}`
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), id)
    request.input('titulo', sql.NVarChar(250), titulo)
    request.input('descricao', sql.NVarChar(sql.MAX), descricao)
    request.input('projetoId', sql.Int, projetoId)
    request.input('status', sql.NVarChar(40), status)
    request.input('prioridade', sql.NVarChar(30), prioridade)
    request.input('responsavelId', sql.NVarChar(120), responsavelId || null)
    request.input('criadoPorUsuarioId', sql.NVarChar(120), req.auth?.userId || null)
    await request.query(`
      INSERT INTO dbo.Demandas
      (Id, Titulo, Descricao, ProjetoId, Status, Prioridade, ResponsavelId, CriadoPorUsuarioId)
      VALUES
      (@id, @titulo, @descricao, @projetoId, @status, @prioridade, @responsavelId, @criadoPorUsuarioId)
    `)

    const created = await loadOwnedDemanda(id, req.auth)
    return res.status(201).json(mapDemanda(created))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel criar a demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), req.params.id)
    request.input('titulo', sql.NVarChar(250), normalizeString(req.body?.titulo) || null)
    request.input('descricao', sql.NVarChar(sql.MAX), hasOwn(req.body, 'descricao') ? normalizeString(req.body?.descricao) : null)
    request.input('projetoId', sql.Int, toNullableInt(req.body?.projectId))
    request.input('status', sql.NVarChar(40), hasOwn(req.body, 'status') ? normalizeDemandaStatus(req.body?.status) : null)
    request.input(
      'prioridade',
      sql.NVarChar(30),
      hasOwn(req.body, 'prioridade') ? normalizePrioridade(req.body?.prioridade) : null,
    )
    request.input(
      'responsavelId',
      sql.NVarChar(120),
      hasOwn(req.body, 'responsavelId') ? normalizeString(req.body?.responsavelId) || null : null,
    )
    request.input('hasDescricao', sql.Bit, hasOwn(req.body, 'descricao'))
    request.input('hasResponsavelId', sql.Bit, hasOwn(req.body, 'responsavelId'))
    await request.query(`
      UPDATE dbo.Demandas
      SET
        Titulo = COALESCE(@titulo, Titulo),
        Descricao = CASE WHEN @hasDescricao = 1 THEN @descricao ELSE Descricao END,
        ProjetoId = COALESCE(@projetoId, ProjetoId),
        Status = COALESCE(@status, Status),
        Prioridade = COALESCE(@prioridade, Prioridade),
        ResponsavelId = CASE WHEN @hasResponsavelId = 1 THEN @responsavelId ELSE ResponsavelId END,
        AtualizadoEm = SYSDATETIME()
      WHERE Id = @id
    `)

    const updated = await loadOwnedDemanda(req.params.id, req.auth)
    return res.json(mapDemanda(updated))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel atualizar a demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), req.params.id)
    await request.query(`
      DELETE FROM dbo.Demandas
      WHERE Id = @id
    `)

    const demandFolder = path.join(storageRoot, 'demandas', sanitizeStorageSegment(req.params.id, 'sem-demanda'))
    await fs.rm(demandFolder, { recursive: true, force: true }).catch(() => null)

    return res.json({ ok: true })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel excluir a demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/:id/tarefas', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const titulo = normalizeString(req.body?.titulo)
    if (!titulo) {
      return res.status(400).json({ message: 'Titulo da tarefa e obrigatorio.' })
    }

    const pool = await getPool()
    const nextOrderRequest = createRequest(pool)
    nextOrderRequest.input('demandaId', sql.NVarChar(120), req.params.id)
    const nextOrderResult = await nextOrderRequest.query(`
      SELECT ISNULL(MAX(Ordem), 0) + 1 AS NextOrder
      FROM dbo.DemandaTarefas
      WHERE DemandaId = @demandaId
    `)
    const nextOrder = Number(req.body?.ordem) > 0 ? Number(req.body.ordem) : Number(nextOrderResult.recordset[0]?.NextOrder || 1)
    const tarefaId = `dt-${Date.now()}`
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), tarefaId)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('titulo', sql.NVarChar(250), titulo)
    request.input('descricao', sql.NVarChar(sql.MAX), normalizeString(req.body?.descricao))
    request.input('portalId', sql.Int, toNullableInt(req.body?.portalId))
    request.input('areaId', sql.Int, toNullableInt(req.body?.areaId))
    request.input('moduloId', sql.Int, toNullableInt(req.body?.moduleId))
    request.input('status', sql.NVarChar(40), normalizeTarefaStatus(req.body?.status))
    request.input('ordem', sql.Int, nextOrder)
    await request.query(`
      INSERT INTO dbo.DemandaTarefas (Id, DemandaId, Titulo, Descricao, PortalId, AreaId, ModuloId, Status, Ordem)
      VALUES (@id, @demandaId, @titulo, @descricao, @portalId, @areaId, @moduloId, @status, @ordem)
    `)

    const result = await createRequest(pool)
      .input('id', sql.NVarChar(120), tarefaId)
      .query(`
        SELECT
          t.*,
          pp.Nome AS PortalName,
          a.Nome AS AreaName,
          m.Nome AS ModuleName
        FROM dbo.DemandaTarefas t
        LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = t.PortalId
        LEFT JOIN dbo.Areas a ON a.Id = t.AreaId
        LEFT JOIN dbo.Modulos m ON m.Id = t.ModuloId
        WHERE t.Id = @id
      `)

    return res.status(201).json(mapTarefa(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel criar a tarefa da demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id/tarefas/:tarefaId', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
    request.input('titulo', sql.NVarChar(250), hasOwn(req.body, 'titulo') ? normalizeString(req.body?.titulo) : null)
    request.input('descricao', sql.NVarChar(sql.MAX), hasOwn(req.body, 'descricao') ? normalizeString(req.body?.descricao) : null)
    request.input('portalId', sql.Int, hasOwn(req.body, 'portalId') ? toNullableInt(req.body?.portalId) : null)
    request.input('areaId', sql.Int, hasOwn(req.body, 'areaId') ? toNullableInt(req.body?.areaId) : null)
    request.input('moduloId', sql.Int, hasOwn(req.body, 'moduleId') ? toNullableInt(req.body?.moduleId) : null)
    request.input('status', sql.NVarChar(40), hasOwn(req.body, 'status') ? normalizeTarefaStatus(req.body?.status) : null)
    request.input('ordem', sql.Int, hasOwn(req.body, 'ordem') && Number.isFinite(Number(req.body?.ordem)) ? Number(req.body.ordem) : null)
    request.input('hasTitulo', sql.Bit, hasOwn(req.body, 'titulo'))
    request.input('hasDescricao', sql.Bit, hasOwn(req.body, 'descricao'))
    request.input('hasPortalId', sql.Bit, hasOwn(req.body, 'portalId'))
    request.input('hasAreaId', sql.Bit, hasOwn(req.body, 'areaId'))
    request.input('hasModuloId', sql.Bit, hasOwn(req.body, 'moduleId'))

    if (hasOwn(req.body, 'titulo') && !normalizeString(req.body?.titulo)) {
      return res.status(400).json({ message: 'Titulo da tarefa e obrigatorio.' })
    }

    await request.query(`
      UPDATE dbo.DemandaTarefas
      SET
        Titulo = CASE WHEN @hasTitulo = 1 THEN @titulo ELSE Titulo END,
        Descricao = CASE WHEN @hasDescricao = 1 THEN @descricao ELSE Descricao END,
        PortalId = CASE WHEN @hasPortalId = 1 THEN @portalId ELSE PortalId END,
        AreaId = CASE WHEN @hasAreaId = 1 THEN @areaId ELSE AreaId END,
        ModuloId = CASE WHEN @hasModuloId = 1 THEN @moduloId ELSE ModuloId END,
        Status = COALESCE(@status, Status),
        Ordem = COALESCE(@ordem, Ordem),
        AtualizadoEm = SYSDATETIME()
      WHERE Id = @tarefaId
        AND DemandaId = @demandaId
    `)

    const result = await createRequest(pool)
      .input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
      .query(`
        SELECT
          t.*,
          pp.Nome AS PortalName,
          a.Nome AS AreaName,
          m.Nome AS ModuleName
        FROM dbo.DemandaTarefas t
        LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = t.PortalId
        LEFT JOIN dbo.Areas a ON a.Id = t.AreaId
        LEFT JOIN dbo.Modulos m ON m.Id = t.ModuloId
        WHERE t.Id = @tarefaId
      `)

    return res.json(mapTarefa(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel atualizar a tarefa da demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:id/tarefas/:tarefaId', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedDemanda(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
    await request.query(`
      DELETE FROM dbo.DemandaTarefas
      WHERE Id = @tarefaId
        AND DemandaId = @demandaId
    `)

    return res.json({ ok: true })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel remover a tarefa da demanda.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/:id/tarefas/:tarefaId/cenarios', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedTarefa(req.params.id, req.params.tarefaId, req.auth)
    const pool = await getPool()
    const titulo = normalizeString(req.body?.titulo)
    if (!titulo) {
      return res.status(400).json({ message: 'Titulo do cenario e obrigatorio.' })
    }

    const tipo = normalizeCenarioTipo(req.body?.tipo)
    await ensurePrincipalScenarioAvailable(pool, req.params.id, req.params.tarefaId, tipo)

    const cenarioId = `dc-${Date.now()}`
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), cenarioId)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('demandaTarefaId', sql.NVarChar(120), req.params.tarefaId)
    request.input('titulo', sql.NVarChar(250), titulo)
    request.input('descricao', sql.NVarChar(sql.MAX), normalizeString(req.body?.descricao))
    request.input('tipo', sql.NVarChar(20), tipo)
    request.input('status', sql.NVarChar(20), normalizeCenarioStatus(req.body?.status))
    request.input('observacoes', sql.NVarChar(sql.MAX), normalizeString(req.body?.observacoes))
    request.input('criadoPorUsuarioId', sql.NVarChar(120), req.auth?.userId || null)
    await request.query(`
      INSERT INTO dbo.DemandaCenarios
      (Id, DemandaId, DemandaTarefaId, Titulo, Descricao, Tipo, Status, Observacoes, CriadoPorUsuarioId)
      VALUES
      (@id, @demandaId, @demandaTarefaId, @titulo, @descricao, @tipo, @status, @observacoes, @criadoPorUsuarioId)
    `)

    const result = await createRequest(pool)
      .input('id', sql.NVarChar(120), cenarioId)
      .query(`
        SELECT *
        FROM dbo.DemandaCenarios
        WHERE Id = @id
      `)

    return res.status(201).json(mapCenario(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    const duplicatePrincipal = error instanceof Error && error.message.includes('cenario principal')
    return res.status(forbidden ? 403 : duplicatePrincipal ? 400 : 500).json({
      message: forbidden
        ? 'Esta demanda pertence ao workspace de outro QA.'
        : duplicatePrincipal
          ? 'Esta tarefa ja possui um cenario principal.'
          : 'Nao foi possivel criar o cenario da tarefa.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id/tarefas/:tarefaId/cenarios/:cenarioId', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedTarefa(req.params.id, req.params.tarefaId, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    const tipo = hasOwn(req.body, 'tipo') ? normalizeCenarioTipo(req.body?.tipo) : null

    if (hasOwn(req.body, 'titulo') && !normalizeString(req.body?.titulo)) {
      return res.status(400).json({ message: 'Titulo do cenario e obrigatorio.' })
    }

    await ensurePrincipalScenarioAvailable(pool, req.params.id, req.params.tarefaId, tipo, req.params.cenarioId)

    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
    request.input('cenarioId', sql.NVarChar(120), req.params.cenarioId)
    request.input('titulo', sql.NVarChar(250), hasOwn(req.body, 'titulo') ? normalizeString(req.body?.titulo) : null)
    request.input('descricao', sql.NVarChar(sql.MAX), hasOwn(req.body, 'descricao') ? normalizeString(req.body?.descricao) : null)
    request.input('tipo', sql.NVarChar(20), tipo)
    request.input('status', sql.NVarChar(20), hasOwn(req.body, 'status') ? normalizeCenarioStatus(req.body?.status) : null)
    request.input(
      'observacoes',
      sql.NVarChar(sql.MAX),
      hasOwn(req.body, 'observacoes') ? normalizeString(req.body?.observacoes) : null,
    )
    request.input('hasTitulo', sql.Bit, hasOwn(req.body, 'titulo'))
    request.input('hasDescricao', sql.Bit, hasOwn(req.body, 'descricao'))
    request.input('hasTipo', sql.Bit, hasOwn(req.body, 'tipo'))
    request.input('hasObservacoes', sql.Bit, hasOwn(req.body, 'observacoes'))

    await request.query(`
      UPDATE dbo.DemandaCenarios
      SET
        Titulo = CASE WHEN @hasTitulo = 1 THEN @titulo ELSE Titulo END,
        Descricao = CASE WHEN @hasDescricao = 1 THEN @descricao ELSE Descricao END,
        Tipo = CASE WHEN @hasTipo = 1 THEN @tipo ELSE Tipo END,
        Status = COALESCE(@status, Status),
        Observacoes = CASE WHEN @hasObservacoes = 1 THEN @observacoes ELSE Observacoes END,
        AtualizadoEm = SYSDATETIME()
      WHERE Id = @cenarioId
        AND DemandaId = @demandaId
        AND DemandaTarefaId = @tarefaId
    `)

    const result = await createRequest(pool)
      .input('cenarioId', sql.NVarChar(120), req.params.cenarioId)
      .query(`
        SELECT *
        FROM dbo.DemandaCenarios
        WHERE Id = @cenarioId
      `)

    return res.json(mapCenario(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    const duplicatePrincipal = error instanceof Error && error.message.includes('cenario principal')
    return res.status(forbidden ? 403 : duplicatePrincipal ? 400 : 500).json({
      message: forbidden
        ? 'Esta demanda pertence ao workspace de outro QA.'
        : duplicatePrincipal
          ? 'Esta tarefa ja possui um cenario principal.'
          : 'Nao foi possivel atualizar o cenario da tarefa.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:id/tarefas/:tarefaId/cenarios/:cenarioId', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedTarefa(req.params.id, req.params.tarefaId, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
    request.input('cenarioId', sql.NVarChar(120), req.params.cenarioId)
    await request.query(`
      DELETE FROM dbo.DemandaCenarios
      WHERE Id = @cenarioId
        AND DemandaId = @demandaId
        AND DemandaTarefaId = @tarefaId
    `)

    return res.json({ ok: true })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel remover o cenario da tarefa.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/:id/tarefas/:tarefaId/cenarios/:cenarioId/evidencias', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedCenario(req.params.id, req.params.tarefaId, req.params.cenarioId, req.auth)
    const fileName = sanitizeUploadedFileName(req.body?.nomeArquivo)
    const legenda = normalizeString(req.body?.legenda)
    const requestedOrder = Number(req.body?.ordem)
    const { mimeType, base64Content } = parseUploadedFile(req.body?.arquivoDataUrl)
    const pool = await getPool()
    const folder = await ensureEvidenceFolder(req.params.id, req.params.tarefaId, req.params.cenarioId)
    const evidenceId = `de-${Date.now()}`
    const persistedFileName = `${sanitizeStorageSegment(evidenceId, 'evidencia')}-${fileName}`
    const filePath = path.join(folder, persistedFileName)
    const relativeStoragePath = path
      .relative(storageRoot, filePath)
      .split(path.sep)
      .join('/')

    await fs.writeFile(filePath, Buffer.from(base64Content, 'base64'))

    const orderRequest = createRequest(pool)
    orderRequest.input('cenarioId', sql.NVarChar(120), req.params.cenarioId)
    const orderResult = await orderRequest.query(`
      SELECT ISNULL(MAX(Ordem), 0) + 1 AS NextOrder
      FROM dbo.DemandaCenarioEvidencias
      WHERE DemandaCenarioId = @cenarioId
    `)
    const ordem = Number.isFinite(requestedOrder) && requestedOrder > 0 ? requestedOrder : Number(orderResult.recordset[0]?.NextOrder || 1)

    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), evidenceId)
    request.input('demandaId', sql.NVarChar(120), req.params.id)
    request.input('demandaTarefaId', sql.NVarChar(120), req.params.tarefaId)
    request.input('demandaCenarioId', sql.NVarChar(120), req.params.cenarioId)
    request.input('nomeArquivo', sql.NVarChar(260), fileName)
    request.input('caminhoArquivo', sql.NVarChar(500), relativeStoragePath)
    request.input('tipoArquivo', sql.NVarChar(120), mimeType)
    request.input('legenda', sql.NVarChar(sql.MAX), legenda)
    request.input('ordem', sql.Int, ordem)
    request.input('criadoPorUsuarioId', sql.NVarChar(120), req.auth?.userId || null)
    await request.query(`
      INSERT INTO dbo.DemandaCenarioEvidencias
      (Id, DemandaId, DemandaTarefaId, DemandaCenarioId, NomeArquivo, CaminhoArquivo, TipoArquivo, Legenda, Ordem, CriadoPorUsuarioId)
      VALUES
      (@id, @demandaId, @demandaTarefaId, @demandaCenarioId, @nomeArquivo, @caminhoArquivo, @tipoArquivo, @legenda, @ordem, @criadoPorUsuarioId)
    `)

    const result = await createRequest(pool)
      .input('id', sql.NVarChar(120), evidenceId)
      .query(`
        SELECT *
        FROM dbo.DemandaCenarioEvidencias
        WHERE Id = @id
      `)

    return res.status(201).json(mapEvidencia(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    const notFound = error instanceof Error && error.message.includes('nao encontrado')
    return res.status(forbidden ? 403 : notFound ? 404 : 500).json({
      message: forbidden
        ? 'Esta demanda pertence ao workspace de outro QA.'
        : notFound
          ? 'Nao foi possivel localizar o cenario para anexar a evidencia.'
          : 'Nao foi possivel anexar a evidencia do cenario.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:id/tarefas/:tarefaId/cenarios/:cenarioId/evidencias/:evidenciaId', async (req, res) => {
  try {
    await ensureDemandasSchema()
    await loadOwnedCenario(req.params.id, req.params.tarefaId, req.params.cenarioId, req.auth)
    const pool = await getPool()
    const selectRequest = createRequest(pool)
    selectRequest.input('demandaId', sql.NVarChar(120), req.params.id)
    selectRequest.input('tarefaId', sql.NVarChar(120), req.params.tarefaId)
    selectRequest.input('cenarioId', sql.NVarChar(120), req.params.cenarioId)
    selectRequest.input('evidenciaId', sql.NVarChar(120), req.params.evidenciaId)
    const result = await selectRequest.query(`
      SELECT TOP 1 *
      FROM dbo.DemandaCenarioEvidencias
      WHERE Id = @evidenciaId
        AND DemandaId = @demandaId
        AND DemandaTarefaId = @tarefaId
        AND DemandaCenarioId = @cenarioId
    `)

    const found = result.recordset[0]
    if (!found) {
      return res.status(404).json({ message: 'Evidencia nao encontrada para este cenario.' })
    }

    if (found.CaminhoArquivo) {
      const absolutePath = path.join(storageRoot, String(found.CaminhoArquivo))
      await fs.rm(absolutePath, { force: true }).catch(() => null)
    }

    const deleteRequest = createRequest(pool)
    deleteRequest.input('evidenciaId', sql.NVarChar(120), req.params.evidenciaId)
    await deleteRequest.query(`
      DELETE FROM dbo.DemandaCenarioEvidencias
      WHERE Id = @evidenciaId
    `)

    return res.json({ ok: true })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Esta demanda pertence ao workspace de outro QA.' : 'Nao foi possivel remover a evidencia do cenario.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
