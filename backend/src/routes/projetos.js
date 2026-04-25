import { Router } from 'express'
import { createRequest, executeTrustedJson, getPool, queryTrustedJson, sql } from '../db.js'

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

    DECLARE @ProjectId INT = ${projectIdExpression};
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
    WHERE Id = @ProjectId;

    IF @DeletedProjectName IS NULL
    BEGIN
      THROW 51000, 'Projeto nao encontrado.', 1;
    END;

    DECLARE @Modules TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Modules (Id)
    SELECT Id FROM dbo.Modulos WHERE ProjetoId = @ProjectId;

    DECLARE @Portals TABLE (Id INT PRIMARY KEY);
    INSERT INTO @Portals (Id)
    SELECT Id FROM dbo.ProjetoPortais WHERE ProjetoId = @ProjectId;

    DECLARE @Tickets TABLE (TicketId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Tickets (TicketId)
    SELECT TicketId
    FROM dbo.Chamados
    WHERE ProjetoId = @ProjectId
      OR ModuloId IN (SELECT Id FROM @Modules);

    DECLARE @Bugs TABLE (BugId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Bugs (BugId)
    SELECT BugId
    FROM dbo.Bugs
    WHERE ProjetoId = @ProjectId
      OR ModuloId IN (SELECT Id FROM @Modules)
      OR TicketId IN (SELECT TicketId FROM @Tickets);

    DECLARE @Histories TABLE (HistoricoId NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Histories (HistoricoId)
    SELECT HistoricoId
    FROM dbo.HistoricoTestes
    WHERE ProjetoId = @ProjectId
      OR ModuloPrincipalId IN (SELECT Id FROM @Modules)
      OR TicketId IN (SELECT TicketId FROM @Tickets)
      OR BugId IN (SELECT BugId FROM @Bugs);

    DECLARE @TestPlans TABLE (Id NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @TestPlans (Id)
    SELECT Id
    FROM dbo.TestPlans
    WHERE ProjetoId = @ProjectId
      OR ModuloId IN (SELECT Id FROM @Modules)
      OR ChamadoIdOrigem IN (SELECT TicketId FROM @Tickets)
      OR BugIdOrigem IN (SELECT BugId FROM @Bugs);

    DECLARE @Demandas TABLE (Id NVARCHAR(120) PRIMARY KEY);
    INSERT INTO @Demandas (Id)
    SELECT Id
    FROM dbo.Demandas
    WHERE ProjetoId = @ProjectId;

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
      OR DocumentoId IN (SELECT DocumentoId FROM dbo.DocumentosFuncionais WHERE ProjetoId = @ProjectId OR ModuloId IN (SELECT Id FROM @Modules));
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
    WHERE ProjetoId = @ProjectId
      OR ModuloId IN (SELECT Id FROM @Modules);
    SET @DeletedDocuments = @@ROWCOUNT;

    DELETE FROM dbo.Modulos WHERE Id IN (SELECT Id FROM @Modules);
    SET @DeletedModules = @@ROWCOUNT;

    DELETE FROM dbo.ProjetoPortais WHERE Id IN (SELECT Id FROM @Portals);
    SET @DeletedPortals = @@ROWCOUNT;

    DELETE FROM dbo.Projetos WHERE Id = @ProjectId;

    SELECT
      CAST(@ProjectId AS VARCHAR(20)) AS deletedProjectId,
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

    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = transaction.request()
      request.input('projectId', sql.Int, projectId)
      const result = await request.query(buildProjectDeleteBatch('@projectId'))
      await transaction.commit()

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
