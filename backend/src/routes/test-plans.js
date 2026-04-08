import { Router } from 'express'
import { canAccessOwnedRecord, resolveWorkspaceScope } from '../lib/auth.js'
import { createRequest, getPool, sql } from '../db.js'

const router = Router()

let schemaReadyPromise

function normalizeString(value) {
  const normalized = String(value ?? '').trim()
  return normalized || ''
}

function toNullableInt(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function normalizeCriticality(value) {
  const normalized = normalizeString(value)
  if (!normalized) return ''
  if (['Baixa', 'Media', 'Alta'].includes(normalized)) return normalized
  return 'Media'
}

async function ensureTestPlansSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool()
      if (!pool) return

      await createRequest(pool).query(`
        IF OBJECT_ID('dbo.TestPlans', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TestPlans (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            Titulo NVARCHAR(250) NOT NULL,
            Objetivo NVARCHAR(MAX) NULL,
            ProjetoId INT NOT NULL,
            ModuloId INT NOT NULL,
            AreaId INT NULL,
            ChamadoIdOrigem NVARCHAR(120) NULL,
            BugIdOrigem NVARCHAR(120) NULL,
            Tipo NVARCHAR(80) NULL,
            Criticidade NVARCHAR(30) NULL,
            IncluirEmRegressao BIT NOT NULL CONSTRAINT DF_TestPlans_IncluirEmRegressao DEFAULT (0),
            Status NVARCHAR(30) NOT NULL CONSTRAINT DF_TestPlans_Status DEFAULT ('rascunho'),
            CriadoPorUsuarioId NVARCHAR(120) NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlans_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlans_AtualizadoEm DEFAULT (SYSDATETIME()),
            FinalizadoEm DATETIME2(0) NULL,
            CONSTRAINT FK_TestPlans_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
            CONSTRAINT FK_TestPlans_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id),
            CONSTRAINT FK_TestPlans_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id),
            CONSTRAINT FK_TestPlans_Chamados FOREIGN KEY (ChamadoIdOrigem) REFERENCES dbo.Chamados (TicketId)
          );

          CREATE INDEX IX_TestPlans_ProjetoModulo ON dbo.TestPlans (ProjetoId, ModuloId);
          CREATE INDEX IX_TestPlans_Status ON dbo.TestPlans (Status);
          CREATE INDEX IX_TestPlans_CriadoPorUsuarioId ON dbo.TestPlans (CriadoPorUsuarioId);
        END;

        IF OBJECT_ID('dbo.TestPlanSteps', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TestPlanSteps (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            TestPlanId NVARCHAR(120) NOT NULL,
            Ordem INT NOT NULL,
            Acao NVARCHAR(MAX) NOT NULL,
            ResultadoEsperado NVARCHAR(MAX) NOT NULL,
            CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlanSteps_CriadoEm DEFAULT (SYSDATETIME()),
            AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlanSteps_AtualizadoEm DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_TestPlanSteps_TestPlans FOREIGN KEY (TestPlanId) REFERENCES dbo.TestPlans (Id) ON DELETE CASCADE
          );

          CREATE INDEX IX_TestPlanSteps_TestPlanId ON dbo.TestPlanSteps (TestPlanId, Ordem);
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

function mapTestPlan(row) {
  return {
    id: row.Id,
    titulo: row.Titulo || '',
    objetivo: row.Objetivo || '',
    projectId: row.ProjetoId ? String(row.ProjetoId) : '',
    projectName: row.ProjectName || '',
    moduleId: row.ModuloId ? String(row.ModuloId) : '',
    moduleName: row.ModuleName || '',
    areaId: row.AreaId ? String(row.AreaId) : '',
    areaName: row.AreaName || '',
    chamadoIdOrigem: row.ChamadoIdOrigem || '',
    bugIdOrigem: row.BugIdOrigem || '',
    tipo: row.Tipo || '',
    criticidade: row.Criticidade || '',
    incluirEmRegressao: Boolean(row.IncluirEmRegressao),
    status: row.Status || 'rascunho',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
    finalizedAt: row.FinalizadoEm ? new Date(row.FinalizadoEm).toISOString() : null,
    createdByUserId: row.CriadoPorUsuarioId || '',
    ownerName: row.OwnerName || '',
    stepsCount: Number(row.StepsCount || 0),
  }
}

function mapStep(row) {
  return {
    id: row.Id,
    testPlanId: row.TestPlanId,
    ordem: Number(row.Ordem || 0),
    acao: row.Acao || '',
    resultadoEsperado: row.ResultadoEsperado || '',
    createdAt: row.CriadoEm ? new Date(row.CriadoEm).toISOString() : new Date().toISOString(),
    updatedAt: row.AtualizadoEm ? new Date(row.AtualizadoEm).toISOString() : new Date().toISOString(),
  }
}

async function loadOwnedTestPlan(testPlanId, auth) {
  const pool = await getPool()
  if (!pool) throw new Error('Test Plans requerem banco configurado.')

  const request = createRequest(pool)
  request.input('testPlanId', sql.NVarChar(120), testPlanId)
  const result = await request.query(`
    SELECT TOP 1
      tp.*,
      p.Nome AS ProjectName,
      m.Nome AS ModuleName,
      a.Nome AS AreaName,
      ownerUser.Nome AS OwnerName,
      (SELECT COUNT(1) FROM dbo.TestPlanSteps s WHERE s.TestPlanId = tp.Id) AS StepsCount
    FROM dbo.TestPlans tp
    INNER JOIN dbo.Projetos p ON p.Id = tp.ProjetoId
    INNER JOIN dbo.Modulos m ON m.Id = tp.ModuloId
    LEFT JOIN dbo.Areas a ON a.Id = tp.AreaId
    LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = tp.CriadoPorUsuarioId
    WHERE tp.Id = @testPlanId
  `)

  const found = result.recordset[0]
  if (!found) {
    throw new Error('Test Plan nao encontrado.')
  }
  if (!canAccessOwnedRecord(auth, found.CriadoPorUsuarioId)) {
    throw new Error('Acesso restrito ao workspace deste QA.')
  }
  return found
}

router.get('/', async (req, res) => {
  try {
    await ensureTestPlansSchema()
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
        tp.*,
        p.Nome AS ProjectName,
        m.Nome AS ModuleName,
        a.Nome AS AreaName,
        ownerUser.Nome AS OwnerName,
        (SELECT COUNT(1) FROM dbo.TestPlanSteps s WHERE s.TestPlanId = tp.Id) AS StepsCount
      FROM dbo.TestPlans tp
      INNER JOIN dbo.Projetos p ON p.Id = tp.ProjetoId
      INNER JOIN dbo.Modulos m ON m.Id = tp.ModuloId
      LEFT JOIN dbo.Areas a ON a.Id = tp.AreaId
      LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = tp.CriadoPorUsuarioId
      WHERE @scope = 'all' OR tp.CriadoPorUsuarioId = @userId
      ORDER BY p.Nome, m.Nome, tp.Titulo
    `)

    return res.json(result.recordset.map(mapTestPlan))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar os Test Plans.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    const testPlan = await loadOwnedTestPlan(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('testPlanId', sql.NVarChar(120), req.params.id)
    const stepsResult = await request.query(`
      SELECT *
      FROM dbo.TestPlanSteps
      WHERE TestPlanId = @testPlanId
      ORDER BY Ordem, CriadoEm
    `)

    return res.json({
      ...mapTestPlan(testPlan),
      steps: stepsResult.recordset.map(mapStep),
    })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    const notFound = error instanceof Error && error.message.includes('nao encontrado')
    return res.status(forbidden ? 403 : notFound ? 404 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel carregar o Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    const pool = await getPool()
    if (!pool) {
      throw new Error('Test Plans requerem banco configurado.')
    }

    const titulo = normalizeString(req.body?.titulo)
    const objetivo = normalizeString(req.body?.objetivo)
    const projetoId = toNullableInt(req.body?.projectId)
    const moduloId = toNullableInt(req.body?.moduleId)
    const areaId = toNullableInt(req.body?.areaId)
    const chamadoIdOrigem = normalizeString(req.body?.chamadoIdOrigem)
    const bugIdOrigem = normalizeString(req.body?.bugIdOrigem)
    const tipo = normalizeString(req.body?.tipo) || 'manual'
    const criticidade = normalizeCriticality(req.body?.criticidade)
    const incluirEmRegressao = Boolean(req.body?.incluirEmRegressao)

    if (!titulo || !projetoId || !moduloId) {
      return res.status(400).json({ message: 'Titulo, projeto e modulo sao obrigatorios para criar o Test Plan.' })
    }

    const id = `tp-${Date.now()}`
    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), id)
    request.input('titulo', sql.NVarChar(250), titulo)
    request.input('objetivo', sql.NVarChar(sql.MAX), objetivo)
    request.input('projetoId', sql.Int, projetoId)
    request.input('moduloId', sql.Int, moduloId)
    request.input('areaId', sql.Int, areaId)
    request.input('chamadoIdOrigem', sql.NVarChar(120), chamadoIdOrigem || null)
    request.input('bugIdOrigem', sql.NVarChar(120), bugIdOrigem || null)
    request.input('tipo', sql.NVarChar(80), tipo || null)
    request.input('criticidade', sql.NVarChar(30), criticidade || null)
    request.input('incluirEmRegressao', sql.Bit, incluirEmRegressao)
    request.input('criadoPorUsuarioId', sql.NVarChar(120), req.auth?.userId || null)
    await request.query(`
      INSERT INTO dbo.TestPlans
      (Id, Titulo, Objetivo, ProjetoId, ModuloId, AreaId, ChamadoIdOrigem, BugIdOrigem, Tipo, Criticidade, IncluirEmRegressao, Status, CriadoPorUsuarioId)
      VALUES
      (@id, @titulo, @objetivo, @projetoId, @moduloId, @areaId, @chamadoIdOrigem, @bugIdOrigem, @tipo, @criticidade, @incluirEmRegressao, 'rascunho', @criadoPorUsuarioId)
    `)

    const created = await loadOwnedTestPlan(id, req.auth)
    return res.status(201).json(mapTestPlan(created))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel criar o escopo do Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    await loadOwnedTestPlan(req.params.id, req.auth)
    const pool = await getPool()

    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), req.params.id)
    request.input('titulo', sql.NVarChar(250), normalizeString(req.body?.titulo) || null)
    request.input('objetivo', sql.NVarChar(sql.MAX), normalizeString(req.body?.objetivo) || null)
    request.input('projetoId', sql.Int, toNullableInt(req.body?.projectId))
    request.input('moduloId', sql.Int, toNullableInt(req.body?.moduleId))
    request.input('areaId', sql.Int, toNullableInt(req.body?.areaId))
    request.input('tipo', sql.NVarChar(80), normalizeString(req.body?.tipo) || null)
    request.input('criticidade', sql.NVarChar(30), normalizeCriticality(req.body?.criticidade) || null)
    request.input('incluirEmRegressao', sql.Bit, typeof req.body?.incluirEmRegressao === 'boolean' ? req.body.incluirEmRegressao : null)
    await request.query(`
      UPDATE dbo.TestPlans
      SET
        Titulo = COALESCE(@titulo, Titulo),
        Objetivo = COALESCE(@objetivo, Objetivo),
        ProjetoId = COALESCE(@projetoId, ProjetoId),
        ModuloId = COALESCE(@moduloId, ModuloId),
        AreaId = COALESCE(@areaId, AreaId),
        Tipo = COALESCE(@tipo, Tipo),
        Criticidade = COALESCE(@criticidade, Criticidade),
        IncluirEmRegressao = COALESCE(@incluirEmRegressao, IncluirEmRegressao),
        AtualizadoEm = SYSDATETIME()
      WHERE Id = @id
    `)

    const updated = await loadOwnedTestPlan(req.params.id, req.auth)
    return res.json(mapTestPlan(updated))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel atualizar o Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/:id/steps', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    await loadOwnedTestPlan(req.params.id, req.auth)
    const acao = normalizeString(req.body?.acao)
    const resultadoEsperado = normalizeString(req.body?.resultadoEsperado)
    if (!acao || !resultadoEsperado) {
      return res.status(400).json({ message: 'Acao e resultado esperado sao obrigatorios.' })
    }

    const pool = await getPool()
    const nextOrderRequest = createRequest(pool)
    nextOrderRequest.input('testPlanId', sql.NVarChar(120), req.params.id)
    const nextOrderResult = await nextOrderRequest.query(`
      SELECT ISNULL(MAX(Ordem), 0) + 1 AS NextOrder
      FROM dbo.TestPlanSteps
      WHERE TestPlanId = @testPlanId
    `)
    const nextOrder = Number(nextOrderResult.recordset[0]?.NextOrder || 1)
    const stepId = `tps-${Date.now()}`

    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), stepId)
    request.input('testPlanId', sql.NVarChar(120), req.params.id)
    request.input('ordem', sql.Int, nextOrder)
    request.input('acao', sql.NVarChar(sql.MAX), acao)
    request.input('resultadoEsperado', sql.NVarChar(sql.MAX), resultadoEsperado)
    await request.query(`
      INSERT INTO dbo.TestPlanSteps (Id, TestPlanId, Ordem, Acao, ResultadoEsperado)
      VALUES (@id, @testPlanId, @ordem, @acao, @resultadoEsperado)
    `)

    const stepResult = await createRequest(pool)
      .input('id', sql.NVarChar(120), stepId)
      .query('SELECT * FROM dbo.TestPlanSteps WHERE Id = @id')

    return res.status(201).json(mapStep(stepResult.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel criar o step do Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id/steps/:stepId', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    await loadOwnedTestPlan(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('testPlanId', sql.NVarChar(120), req.params.id)
    request.input('stepId', sql.NVarChar(120), req.params.stepId)
    request.input('acao', sql.NVarChar(sql.MAX), normalizeString(req.body?.acao) || null)
    request.input('resultadoEsperado', sql.NVarChar(sql.MAX), normalizeString(req.body?.resultadoEsperado) || null)
    request.input('ordem', sql.Int, Number.isFinite(Number(req.body?.ordem)) ? Number(req.body.ordem) : null)
    await request.query(`
      UPDATE dbo.TestPlanSteps
      SET
        Acao = COALESCE(@acao, Acao),
        ResultadoEsperado = COALESCE(@resultadoEsperado, ResultadoEsperado),
        Ordem = COALESCE(@ordem, Ordem),
        AtualizadoEm = SYSDATETIME()
      WHERE Id = @stepId
        AND TestPlanId = @testPlanId
    `)

    const result = await createRequest(pool)
      .input('stepId', sql.NVarChar(120), req.params.stepId)
      .query('SELECT * FROM dbo.TestPlanSteps WHERE Id = @stepId')

    return res.json(mapStep(result.recordset[0]))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel atualizar o step do Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    await loadOwnedTestPlan(req.params.id, req.auth)
    const pool = await getPool()
    const request = createRequest(pool)
    request.input('testPlanId', sql.NVarChar(120), req.params.id)
    request.input('stepId', sql.NVarChar(120), req.params.stepId)
    await request.query(`
      DELETE FROM dbo.TestPlanSteps
      WHERE Id = @stepId
        AND TestPlanId = @testPlanId
    `)
    return res.json({ ok: true })
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel remover o step do Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.patch('/:id/finalizar', async (req, res) => {
  try {
    await ensureTestPlansSchema()
    const testPlan = await loadOwnedTestPlan(req.params.id, req.auth)
    const pool = await getPool()
    const stepsRequest = createRequest(pool)
    stepsRequest.input('testPlanId', sql.NVarChar(120), req.params.id)
    const stepsCountResult = await stepsRequest.query(`
      SELECT COUNT(1) AS total
      FROM dbo.TestPlanSteps
      WHERE TestPlanId = @testPlanId
    `)
    const stepsCount = Number(stepsCountResult.recordset[0]?.total || 0)

    if (!normalizeString(testPlan.Titulo) || !testPlan.ProjetoId || !testPlan.ModuloId || stepsCount < 1) {
      return res.status(400).json({
        message: 'Para finalizar o Test Plan, informe titulo, projeto, modulo e cadastre pelo menos 1 step.',
      })
    }

    const request = createRequest(pool)
    request.input('id', sql.NVarChar(120), req.params.id)
    await request.query(`
      UPDATE dbo.TestPlans
      SET Status = 'finalizado',
          FinalizadoEm = SYSDATETIME(),
          AtualizadoEm = SYSDATETIME()
      WHERE Id = @id
    `)

    const finalized = await loadOwnedTestPlan(req.params.id, req.auth)
    return res.json(mapTestPlan({ ...finalized, StepsCount: stepsCount }))
  } catch (error) {
    const forbidden = error instanceof Error && error.message.includes('Acesso restrito')
    return res.status(forbidden ? 403 : 500).json({
      message: forbidden ? 'Este Test Plan pertence ao workspace de outro QA.' : 'Nao foi possivel finalizar o Test Plan.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
