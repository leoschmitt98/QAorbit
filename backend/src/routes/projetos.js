import { Router } from 'express'
import fs from 'node:fs/promises'
import { createRequest, executeTrustedJson, getPool, queryTrustedJson, sql } from '../db.js'
import { ticketDirectory } from '../lib/legacy-storage.js'

const router = Router()

function normalizeDeleteSummary(record = {}) {
  return {
    deletedProjectId: String(record.deletedProjectId || record.DeletedProjectId || ''),
    deletedProjectName: String(record.deletedProjectName || record.DeletedProjectName || ''),
    deletedPortals: Number(record.deletedPortals || record.DeletedPortals || 0),
    deletedModules: Number(record.deletedModules || record.DeletedModules || 0),
    deletedDocuments: Number(record.deletedDocuments || record.DeletedDocuments || 0),
    deletedTickets: Number(record.deletedTickets || record.DeletedTickets || 0),
    deletedBugs: Number(record.deletedBugs || record.DeletedBugs || 0),
    deletedHistoricalTests: Number(record.deletedHistoricalTests || record.DeletedHistoricalTests || 0),
    deletedTestPlans: Number(record.deletedTestPlans || record.DeletedTestPlans || 0),
    deletedDemandas: Number(record.deletedDemandas || record.DeletedDemandas || 0),
  }
}

function buildProjectDeleteBatch(projectIdExpression, outputJson = false) {
  return `
    SET XACT_ABORT ON;

    DECLARE @DeleteProjectId INT = ${projectIdExpression};
    DECLARE @DeletedProjectName NVARCHAR(200);
    DECLARE @DeletedPortals INT = 0;
    DECLARE @DeletedModules INT = 0;
    DECLARE @DeletedDocuments INT = 0;
    DECLARE @DeletedTickets INT = 0;
    DECLARE @DeletedBugs INT = 0;
    DECLARE @DeletedHistoricalTests INT = 0;
    DECLARE @DeletedTestPlans INT = 0;
    DECLARE @DeletedDemandas INT = 0;

    SELECT @DeletedProjectName = Nome
    FROM dbo.Projetos
    WHERE Id = @DeleteProjectId;

    IF @DeletedProjectName IS NULL
    BEGIN
      THROW 51000, 'Projeto nao encontrado.', 1;
    END;

    DECLARE @Modules TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Modules (Id)
    SELECT Id FROM dbo.Modulos WHERE ProjetoId = @DeleteProjectId;

    DECLARE @Portals TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Portals (Id)
    SELECT Id FROM dbo.ProjetoPortais WHERE ProjetoId = @DeleteProjectId;

    INSERT INTO @Modules (Id)
    SELECT Id
    FROM dbo.Modulos
    WHERE PortalId IN (SELECT Id FROM @Portals)
      AND Id NOT IN (SELECT Id FROM @Modules);

    DECLARE @Tickets TABLE (TicketId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Tickets (TicketId)
    SELECT TicketId
    FROM dbo.Chamados
    WHERE ProjetoId = @DeleteProjectId
      OR ModuloId IN (SELECT Id FROM @Modules);

    DECLARE @Bugs TABLE (BugId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Bugs (BugId)
    SELECT BugId
    FROM dbo.Bugs
    WHERE ProjetoId = @DeleteProjectId
      OR ModuloId IN (SELECT Id FROM @Modules)
      OR TicketId IN (SELECT TicketId FROM @Tickets);

    DECLARE @Histories TABLE (HistoricoId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Histories (HistoricoId)
    SELECT HistoricoId
    FROM dbo.HistoricoTestes
    WHERE ProjetoId = @DeleteProjectId
      OR ModuloPrincipalId IN (SELECT Id FROM @Modules)
      OR TicketId IN (SELECT TicketId FROM @Tickets)
      OR BugId IN (SELECT BugId FROM @Bugs);

    DECLARE @TestPlans TABLE (Id NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @TestPlans (Id)
    SELECT Id
    FROM dbo.TestPlans
    WHERE ProjetoId = @DeleteProjectId
      OR ModuloId IN (SELECT Id FROM @Modules)
      OR ChamadoIdOrigem IN (SELECT TicketId FROM @Tickets)
      OR BugIdOrigem IN (SELECT BugId FROM @Bugs);

    DECLARE @Demandas TABLE (Id NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Demandas (Id)
    SELECT Id
    FROM dbo.Demandas
    WHERE ProjetoId = @DeleteProjectId;

    DELETE FROM dbo.DemandaCenarioEvidencias
    WHERE DemandaId IN (SELECT Id FROM @Demandas)
      OR DemandaTarefaId IN (SELECT Id FROM dbo.DemandaTarefas WHERE DemandaId IN (SELECT Id FROM @Demandas))
      OR DemandaCenarioId IN (SELECT Id FROM dbo.DemandaCenarios WHERE DemandaId IN (SELECT Id FROM @Demandas));

    DELETE FROM dbo.DemandaCenarios
    WHERE DemandaId IN (SELECT Id FROM @Demandas)
      OR DemandaTarefaId IN (SELECT Id FROM dbo.DemandaTarefas WHERE DemandaId IN (SELECT Id FROM @Demandas));

    DELETE FROM dbo.DemandaTarefas
    WHERE DemandaId IN (SELECT Id FROM @Demandas)
      OR PortalId IN (SELECT Id FROM @Portals)
      OR ModuloId IN (SELECT Id FROM @Modules);

    DELETE FROM dbo.Demandas WHERE Id IN (SELECT Id FROM @Demandas);
    SET @DeletedDemandas = @@ROWCOUNT;

    DELETE FROM dbo.TestPlanSteps WHERE TestPlanId IN (SELECT Id FROM @TestPlans);
    DELETE FROM dbo.TestPlans WHERE Id IN (SELECT Id FROM @TestPlans);
    SET @DeletedTestPlans = @@ROWCOUNT;

    DELETE FROM dbo.HistoricoRelacionamentos
    WHERE HistoricoOrigemId IN (SELECT HistoricoId FROM @Histories)
      OR HistoricoRelacionadoId IN (SELECT HistoricoId FROM @Histories);

    DELETE FROM dbo.HistoricoTesteQuadros WHERE HistoricoId IN (SELECT HistoricoId FROM @Histories);
    DELETE FROM dbo.HistoricoTesteTags WHERE HistoricoId IN (SELECT HistoricoId FROM @Histories);
    DELETE FROM dbo.HistoricoTesteModulosImpactados
    WHERE HistoricoId IN (SELECT HistoricoId FROM @Histories)
      OR ModuloId IN (SELECT Id FROM @Modules);

    DELETE FROM dbo.HistoricoTestes WHERE HistoricoId IN (SELECT HistoricoId FROM @Histories);
    SET @DeletedHistoricalTests = @@ROWCOUNT;

    DELETE FROM dbo.BugPromptsIA WHERE BugId IN (SELECT BugId FROM @Bugs);
    DELETE FROM dbo.BugQuadros WHERE BugId IN (SELECT BugId FROM @Bugs);
    DELETE FROM dbo.BugPassosReproducao WHERE BugId IN (SELECT BugId FROM @Bugs);
    DELETE FROM dbo.Bugs WHERE BugId IN (SELECT BugId FROM @Bugs);
    SET @DeletedBugs = @@ROWCOUNT;

    DELETE FROM dbo.ChamadoPromptsIA WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.ChamadoDocumentosSelecionadosPrompt
    WHERE TicketId IN (SELECT TicketId FROM @Tickets)
      OR DocumentoId IN (SELECT DocumentoId FROM dbo.DocumentosFuncionais WHERE ProjetoId = @DeleteProjectId OR ModuloId IN (SELECT Id FROM @Modules));
    DELETE FROM dbo.ChamadoClassificacaoModulosImpactados
    WHERE TicketId IN (SELECT TicketId FROM @Tickets)
      OR ModuloId IN (SELECT Id FROM @Modules);
    DELETE FROM dbo.ChamadoClassificacoes
    WHERE TicketId IN (SELECT TicketId FROM @Tickets)
      OR ModuloPrincipalId IN (SELECT Id FROM @Modules);
    DELETE FROM dbo.ChamadoCenariosComplementares
    WHERE TicketId IN (SELECT TicketId FROM @Tickets)
      OR ModuloId IN (SELECT Id FROM @Modules);
    DELETE FROM dbo.ChamadoRetestePassoQuadros
    WHERE PassoId IN (SELECT PassoId FROM dbo.ChamadoRetestePassos WHERE TicketId IN (SELECT TicketId FROM @Tickets))
      OR QuadroId IN (SELECT QuadroId FROM dbo.ChamadoRetesteQuadros WHERE TicketId IN (SELECT TicketId FROM @Tickets));
    DELETE FROM dbo.ChamadoRetestePassos WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.ChamadoRetesteQuadros WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.ChamadoRetestes WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.ChamadoProblemas WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.ChamadoAnexosSuporte WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    DELETE FROM dbo.Chamados WHERE TicketId IN (SELECT TicketId FROM @Tickets);
    SET @DeletedTickets = @@ROWCOUNT;

    DELETE FROM dbo.DocumentosFuncionais
    WHERE ProjetoId = @DeleteProjectId
      OR ModuloId IN (SELECT Id FROM @Modules);
    SET @DeletedDocuments = @@ROWCOUNT;

    DELETE FROM dbo.Modulos WHERE Id IN (SELECT Id FROM @Modules);
    SET @DeletedModules = @@ROWCOUNT;

    DELETE FROM dbo.ProjetoPortais WHERE Id IN (SELECT Id FROM @Portals);
    SET @DeletedPortals = @@ROWCOUNT;

    DELETE FROM dbo.Projetos WHERE Id = @DeleteProjectId;

    SELECT
      CAST(@DeleteProjectId AS VARCHAR(20)) AS deletedProjectId,
      @DeletedProjectName AS deletedProjectName,
      @DeletedPortals AS deletedPortals,
      @DeletedModules AS deletedModules,
      @DeletedDocuments AS deletedDocuments,
      @DeletedTickets AS deletedTickets,
      @DeletedBugs AS deletedBugs,
      @DeletedHistoricalTests AS deletedHistoricalTests,
      @DeletedTestPlans AS deletedTestPlans,
      @DeletedDemandas AS deletedDemandas
    ${outputJson ? 'FOR JSON PATH' : ''}
  `
}

async function listTicketIdsForProject(pool, projectId) {
  const request = createRequest(pool)
  request.input('projectId', sql.Int, projectId)
  const result = await request.query(`
    DECLARE @Modules TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Modules (Id)
    SELECT Id
    FROM dbo.Modulos
    WHERE ProjetoId = @projectId;

    DECLARE @Portals TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Portals (Id)
    SELECT Id
    FROM dbo.ProjetoPortais
    WHERE ProjetoId = @projectId;

    INSERT INTO @Modules (Id)
    SELECT Id
    FROM dbo.Modulos
    WHERE PortalId IN (SELECT Id FROM @Portals)
      AND Id NOT IN (SELECT Id FROM @Modules);

    SELECT TicketId
    FROM dbo.Chamados
    WHERE ProjetoId = @projectId
      OR ModuloId IN (SELECT Id FROM @Modules);
  `)

  return result.recordset.map((row) => String(row.TicketId || '').trim()).filter(Boolean)
}

async function removeLegacyTicketDirectories(ticketIds) {
  await Promise.all(
    ticketIds.map((ticketId) => fs.rm(ticketDirectory(ticketId), { recursive: true, force: true }).catch(() => undefined)),
  )
}

async function queryInTransaction(transaction, query, inputs = []) {
  const request = transaction.request()
  inputs.forEach(({ name, type, value }) => request.input(name, type, value))
  return request.query(query)
}

async function tableExists(transaction, tableName) {
  const result = await queryInTransaction(
    transaction,
    `
      SELECT 1 AS found
      FROM sys.tables t
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name = 'dbo'
        AND t.name = @tableName
    `,
    [{ name: 'tableName', type: sql.NVarChar(128), value: tableName }],
  )

  return Boolean(result.recordset[0])
}

async function columnExists(transaction, tableName, columnName) {
  const result = await queryInTransaction(
    transaction,
    `
      SELECT 1 AS found
      FROM sys.columns c
      INNER JOIN sys.tables t ON t.object_id = c.object_id
      INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE s.name = 'dbo'
        AND t.name = @tableName
        AND c.name = @columnName
    `,
    [
      { name: 'tableName', type: sql.NVarChar(128), value: tableName },
      { name: 'columnName', type: sql.NVarChar(128), value: columnName },
    ],
  )

  return Boolean(result.recordset[0])
}

async function insertTempIdsByConditions(transaction, tempTable, sourceTable, idColumn, conditions, inputs = []) {
  if (!(await tableExists(transaction, sourceTable)) || !(await columnExists(transaction, sourceTable, idColumn))) {
    return
  }

  const validConditions = []
  for (const condition of conditions) {
    if (!condition.column || (await columnExists(transaction, sourceTable, condition.column))) {
      validConditions.push(condition.sql)
    }
  }

  if (!validConditions.length) return

  await queryInTransaction(
    transaction,
    `
      INSERT INTO ${tempTable} (Id)
      SELECT DISTINCT ${idColumn}
      FROM dbo.${sourceTable}
      WHERE (${validConditions.join('\n        OR ')})
        AND NOT EXISTS (SELECT 1 FROM ${tempTable} existing WHERE existing.Id = dbo.${sourceTable}.${idColumn})
    `,
    inputs,
  )
}

async function deleteIfTableExists(transaction, tableName, whereClause, inputs = []) {
  if (!(await tableExists(transaction, tableName))) {
    return 0
  }

  const result = await queryInTransaction(transaction, `DELETE FROM dbo.${tableName} WHERE ${whereClause}`, inputs)
  return result.rowsAffected[0] ?? 0
}

async function runProjectCascadeDelete(transaction, projectId) {
  const projectResult = await queryInTransaction(
    transaction,
    `
      SELECT TOP 1 Nome
      FROM dbo.Projetos
      WHERE Id = @projectId
    `,
    [{ name: 'projectId', type: sql.Int, value: projectId }],
  )

  const projectName = projectResult.recordset[0]?.Nome
  if (!projectName) {
    const error = new Error('Projeto nao encontrado.')
    error.statusCode = 404
    throw error
  }

  await queryInTransaction(transaction, `
    CREATE TABLE #Modules (Id INT PRIMARY KEY);
    CREATE TABLE #Portals (Id INT PRIMARY KEY);
    CREATE TABLE #Tickets (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #Bugs (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #Histories (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #TestPlans (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #Demandas (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #DemandaTarefas (Id NVARCHAR(120) PRIMARY KEY);
    CREATE TABLE #DemandaCenarios (Id NVARCHAR(120) PRIMARY KEY);
  `)

  await insertTempIdsByConditions(transaction, '#Modules', 'Modulos', 'Id', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#Portals', 'ProjetoPortais', 'Id', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#Modules', 'Modulos', 'Id', [
    { column: 'PortalId', sql: 'PortalId IN (SELECT Id FROM #Portals)' },
  ])
  await insertTempIdsByConditions(transaction, '#Tickets', 'Chamados', 'TicketId', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
    { column: 'ModuloId', sql: 'ModuloId IN (SELECT Id FROM #Modules)' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#Bugs', 'Bugs', 'BugId', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
    { column: 'ModuloId', sql: 'ModuloId IN (SELECT Id FROM #Modules)' },
    { column: 'TicketId', sql: 'TicketId IN (SELECT Id FROM #Tickets)' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#Histories', 'HistoricoTestes', 'HistoricoId', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
    { column: 'ModuloPrincipalId', sql: 'ModuloPrincipalId IN (SELECT Id FROM #Modules)' },
    { column: 'TicketId', sql: 'TicketId IN (SELECT Id FROM #Tickets)' },
    { column: 'BugId', sql: 'BugId IN (SELECT Id FROM #Bugs)' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#TestPlans', 'TestPlans', 'Id', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
    { column: 'ModuloId', sql: 'ModuloId IN (SELECT Id FROM #Modules)' },
    { column: 'ChamadoIdOrigem', sql: 'ChamadoIdOrigem IN (SELECT Id FROM #Tickets)' },
    { column: 'BugIdOrigem', sql: 'BugIdOrigem IN (SELECT Id FROM #Bugs)' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#Demandas', 'Demandas', 'Id', [
    { column: 'ProjetoId', sql: 'ProjetoId = @projectId' },
  ], [{ name: 'projectId', type: sql.Int, value: projectId }])
  await insertTempIdsByConditions(transaction, '#DemandaTarefas', 'DemandaTarefas', 'Id', [
    { column: 'DemandaId', sql: 'DemandaId IN (SELECT Id FROM #Demandas)' },
    { column: 'PortalId', sql: 'PortalId IN (SELECT Id FROM #Portals)' },
    { column: 'ModuloId', sql: 'ModuloId IN (SELECT Id FROM #Modules)' },
  ])
  await insertTempIdsByConditions(transaction, '#DemandaCenarios', 'DemandaCenarios', 'Id', [
    { column: 'DemandaId', sql: 'DemandaId IN (SELECT Id FROM #Demandas)' },
    { column: 'DemandaTarefaId', sql: 'DemandaTarefaId IN (SELECT Id FROM #DemandaTarefas)' },
  ])

  await deleteIfTableExists(
    transaction,
    'DemandaCenarioEvidencias',
    'DemandaId IN (SELECT Id FROM #Demandas) OR DemandaTarefaId IN (SELECT Id FROM #DemandaTarefas) OR DemandaCenarioId IN (SELECT Id FROM #DemandaCenarios)',
  )
  await deleteIfTableExists(transaction, 'DemandaCenarios', 'Id IN (SELECT Id FROM #DemandaCenarios)')
  await deleteIfTableExists(transaction, 'DemandaTarefas', 'Id IN (SELECT Id FROM #DemandaTarefas)')
  const deletedDemandas = await deleteIfTableExists(transaction, 'Demandas', 'Id IN (SELECT Id FROM #Demandas)')

  await deleteIfTableExists(transaction, 'TestPlanSteps', 'TestPlanId IN (SELECT Id FROM #TestPlans)')
  const deletedTestPlans = await deleteIfTableExists(transaction, 'TestPlans', 'Id IN (SELECT Id FROM #TestPlans)')

  await deleteIfTableExists(
    transaction,
    'HistoricoRelacionamentos',
    'HistoricoOrigemId IN (SELECT Id FROM #Histories) OR HistoricoRelacionadoId IN (SELECT Id FROM #Histories)',
  )
  await deleteIfTableExists(transaction, 'HistoricoTesteQuadros', 'HistoricoId IN (SELECT Id FROM #Histories)')
  await deleteIfTableExists(transaction, 'HistoricoTesteTags', 'HistoricoId IN (SELECT Id FROM #Histories)')
  await deleteIfTableExists(
    transaction,
    'HistoricoTesteModulosImpactados',
    'HistoricoId IN (SELECT Id FROM #Histories) OR ModuloId IN (SELECT Id FROM #Modules)',
  )
  const deletedHistoricalTests = await deleteIfTableExists(transaction, 'HistoricoTestes', 'HistoricoId IN (SELECT Id FROM #Histories)')

  await deleteIfTableExists(transaction, 'BugPromptsIA', 'BugId IN (SELECT Id FROM #Bugs)')
  await deleteIfTableExists(transaction, 'BugQuadros', 'BugId IN (SELECT Id FROM #Bugs)')
  await deleteIfTableExists(transaction, 'BugPassosReproducao', 'BugId IN (SELECT Id FROM #Bugs)')
  const deletedBugs = await deleteIfTableExists(transaction, 'Bugs', 'BugId IN (SELECT Id FROM #Bugs)')

  await deleteIfTableExists(transaction, 'ChamadoPromptsIA', 'TicketId IN (SELECT Id FROM #Tickets)')
  await deleteIfTableExists(
    transaction,
    'ChamadoDocumentosSelecionadosPrompt',
    'TicketId IN (SELECT Id FROM #Tickets) OR DocumentoId IN (SELECT DocumentoId FROM dbo.DocumentosFuncionais WHERE ProjetoId = @projectId OR ModuloId IN (SELECT Id FROM #Modules))',
    [{ name: 'projectId', type: sql.Int, value: projectId }],
  )
  await deleteIfTableExists(
    transaction,
    'ChamadoClassificacaoModulosImpactados',
    'TicketId IN (SELECT Id FROM #Tickets) OR ModuloId IN (SELECT Id FROM #Modules)',
  )
  await deleteIfTableExists(
    transaction,
    'ChamadoClassificacoes',
    'TicketId IN (SELECT Id FROM #Tickets) OR ModuloPrincipalId IN (SELECT Id FROM #Modules)',
  )
  await deleteIfTableExists(
    transaction,
    'ChamadoCenariosComplementares',
    'TicketId IN (SELECT Id FROM #Tickets) OR ModuloId IN (SELECT Id FROM #Modules)',
  )
  await deleteIfTableExists(
    transaction,
    'ChamadoRetestePassoQuadros',
    'PassoId IN (SELECT PassoId FROM dbo.ChamadoRetestePassos WHERE TicketId IN (SELECT Id FROM #Tickets)) OR QuadroId IN (SELECT QuadroId FROM dbo.ChamadoRetesteQuadros WHERE TicketId IN (SELECT Id FROM #Tickets))',
  )
  await deleteIfTableExists(transaction, 'ChamadoRetestePassos', 'TicketId IN (SELECT Id FROM #Tickets)')
  await deleteIfTableExists(transaction, 'ChamadoRetesteQuadros', 'TicketId IN (SELECT Id FROM #Tickets)')
  await deleteIfTableExists(transaction, 'ChamadoRetestes', 'TicketId IN (SELECT Id FROM #Tickets)')
  await deleteIfTableExists(transaction, 'ChamadoProblemas', 'TicketId IN (SELECT Id FROM #Tickets)')
  await deleteIfTableExists(transaction, 'ChamadoAnexosSuporte', 'TicketId IN (SELECT Id FROM #Tickets)')
  const deletedTickets = await deleteIfTableExists(transaction, 'Chamados', 'TicketId IN (SELECT Id FROM #Tickets)')

  const deletedDocuments = await deleteIfTableExists(
    transaction,
    'DocumentosFuncionais',
    'ProjetoId = @projectId OR ModuloId IN (SELECT Id FROM #Modules)',
    [{ name: 'projectId', type: sql.Int, value: projectId }],
  )
  const deletedModules = await deleteIfTableExists(transaction, 'Modulos', 'Id IN (SELECT Id FROM #Modules)')
  const deletedPortals = await deleteIfTableExists(transaction, 'ProjetoPortais', 'Id IN (SELECT Id FROM #Portals)')

  await queryInTransaction(
    transaction,
    'DELETE FROM dbo.Projetos WHERE Id = @projectId',
    [{ name: 'projectId', type: sql.Int, value: projectId }],
  )

  return normalizeDeleteSummary({
    deletedProjectId: projectId,
    deletedProjectName: projectName,
    deletedPortals,
    deletedModules,
    deletedDocuments,
    deletedTickets,
    deletedBugs,
    deletedHistoricalTests,
    deletedTestPlans,
    deletedDemandas,
  })
}

router.get('/', async (_req, res) => {
  try {
    const pool = await getPool()

    if (!pool) {
      const rows = await queryTrustedJson(`
        SELECT
          CAST(Id AS VARCHAR(20)) AS id,
          Nome AS nome
        FROM Projetos
        WHERE Ativo = 1
      `)
      return res.json(rows)
    }

    const request = createRequest(pool)
    const result = await request.query(`
      SELECT
        CAST(Id AS VARCHAR(20)) AS id,
        Nome AS nome
      FROM Projetos
      WHERE Ativo = 1
      ORDER BY Nome
    `)

    return res.json(result.recordset)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar os projetos.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  const nome = String(req.body?.nome || '').trim()

  if (!nome) {
    return res.status(400).json({ message: 'Informe o nome do projeto.' })
  }

  if (nome.length > 200) {
    return res.status(400).json({ message: 'O nome do projeto deve ter no maximo 200 caracteres.' })
  }

  try {
    const pool = await getPool()

    if (!pool) {
      const rows = await executeTrustedJson(`
        DECLARE @Inserted TABLE (id VARCHAR(20), nome NVARCHAR(200));

        IF EXISTS (SELECT 1 FROM dbo.Projetos WHERE Nome = N'${nome.replace(/'/g, "''")}' AND Ativo = 1)
          THROW 51001, 'Ja existe um projeto ativo com este nome.', 1;

        INSERT INTO dbo.Projetos (Nome, Ativo, DataCriacao, DataAtualizacao)
        OUTPUT CAST(inserted.Id AS VARCHAR(20)), inserted.Nome INTO @Inserted
        VALUES (N'${nome.replace(/'/g, "''")}', 1, SYSDATETIME(), SYSDATETIME());

        SELECT id, nome FROM @Inserted FOR JSON PATH;
      `)
      return res.status(201).json(rows[0])
    }

    const request = createRequest(pool)
    request.input('nome', sql.NVarChar(200), nome)
    const result = await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.Projetos WHERE Nome = @nome AND Ativo = 1)
        THROW 51001, 'Ja existe um projeto ativo com este nome.', 1;

      DECLARE @Inserted TABLE (id VARCHAR(20), nome NVARCHAR(200));

      INSERT INTO dbo.Projetos (Nome, Ativo, DataCriacao, DataAtualizacao)
      OUTPUT CAST(inserted.Id AS VARCHAR(20)), inserted.Nome INTO @Inserted
      VALUES (@nome, 1, SYSDATETIME(), SYSDATETIME());

      SELECT id, nome FROM @Inserted;
    `)

    return res.status(201).json(result.recordset[0])
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Erro desconhecido'
    return res.status(detail.includes('Ja existe') ? 409 : 500).json({
      message: detail.includes('Ja existe') ? 'Ja existe um projeto ativo com este nome.' : 'Nao foi possivel cadastrar o projeto.',
      detail,
    })
  }
})

router.delete('/:projectId', async (req, res) => {
  const projectId = Number(req.params.projectId)

  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ message: 'projectId invalido.' })
  }

  try {
    const pool = await getPool()

    if (!pool) {
      const rows = await executeTrustedJson(`
        BEGIN TRANSACTION;
        ${buildProjectDeleteBatch(projectId, true)}
        COMMIT TRANSACTION;
      `)
      return res.json(normalizeDeleteSummary(rows[0]))
    }

    const legacyTicketIds = await listTicketIdsForProject(pool, projectId)
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = transaction.request()
      request.input('projectId', sql.Int, projectId)
      const result = await request.query(buildProjectDeleteBatch('@projectId'))
      await transaction.commit()
      await removeLegacyTicketDirectories(legacyTicketIds)

      return res.json(normalizeDeleteSummary(result.recordset[0]))
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Erro desconhecido'
    const status = detail.includes('Projeto nao encontrado') ? 404 : 500

    return res.status(status).json({
      message: status === 404 ? 'Projeto nao encontrado.' : 'Nao foi possivel excluir o projeto.',
      detail,
    })
  }
})

export default router
