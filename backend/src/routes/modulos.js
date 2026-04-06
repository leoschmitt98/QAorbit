import { Router } from 'express'
import { createRequest, executeTrustedJson, getPool, queryTrustedJson, sql } from '../db.js'

const router = Router()

let schemaReadyPromise

function ensureModulesSchema() {
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

          CREATE UNIQUE INDEX UX_ProjetoPortais_Projeto_Nome ON dbo.ProjetoPortais (ProjetoId, Nome);
          CREATE INDEX IX_ProjetoPortais_ProjetoId ON dbo.ProjetoPortais (ProjetoId);
        END;

        IF COL_LENGTH('dbo.Modulos', 'PortalId') IS NULL
        BEGIN
          ALTER TABLE dbo.Modulos ADD PortalId INT NULL;
        END;

        IF NOT EXISTS (
          SELECT 1
          FROM sys.foreign_keys
          WHERE name = 'FK_Modulos_ProjetoPortais'
        )
        BEGIN
          ALTER TABLE dbo.Modulos
          ADD CONSTRAINT FK_Modulos_ProjetoPortais
          FOREIGN KEY (PortalId) REFERENCES dbo.ProjetoPortais (Id);
        END;

        IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE name = 'IX_Modulos_PortalId'
            AND object_id = OBJECT_ID('dbo.Modulos')
        )
        BEGIN
          CREATE INDEX IX_Modulos_PortalId ON dbo.Modulos (PortalId);
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

function normalizeModule(module) {
  return {
    id: String(module.id || module.Id || ''),
    nome: String(module.nome || module.Nome || '').trim(),
    projetoId: String(module.projetoId || module.ProjetoId || ''),
    portalId: module.portalId || module.PortalId ? String(module.portalId || module.PortalId) : '',
    portalNome: String(module.portalNome || module.PortalNome || '').trim(),
  }
}

router.get('/', async (req, res) => {
  const projetoId = Number(req.query.projetoId)

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  try {
    await ensureModulesSchema()
    const pool = await getPool()

    if (!pool) {
      const rows = await queryTrustedJson(`
        SELECT
          CAST(Id AS VARCHAR(20)) AS id,
          Nome AS nome,
          CAST(ProjetoId AS VARCHAR(20)) AS projetoId,
          CAST(PortalId AS VARCHAR(20)) AS portalId,
          '' AS portalNome
        FROM Modulos
        WHERE Ativo = 1
          AND ProjetoId = ${projetoId}
      `)
      return res.json(rows.map(normalizeModule))
    }

    const request = createRequest(pool)
    request.input('projetoId', sql.Int, projetoId)
    const result = await request.query(`
      SELECT
        CAST(m.Id AS VARCHAR(20)) AS id,
        m.Nome AS nome,
        CAST(m.ProjetoId AS VARCHAR(20)) AS projetoId,
        CAST(m.PortalId AS VARCHAR(20)) AS portalId,
        COALESCE(pp.Nome, '') AS portalNome
      FROM dbo.Modulos m
      LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = m.PortalId
      WHERE m.Ativo = 1
        AND m.ProjetoId = @projetoId
      ORDER BY COALESCE(pp.Nome, 'Sem portal'), m.Nome
    `)

    return res.json(result.recordset.map(normalizeModule))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar os modulos.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  const projetoId = Number(req.body?.projetoId)
  const nome = String(req.body?.nome || '').trim()
  const portalIdRaw = String(req.body?.portalId || '').trim()
  const portalId = portalIdRaw ? Number(portalIdRaw) : null

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  if (!nome) {
    return res.status(400).json({ message: 'Nome do modulo e obrigatorio.' })
  }

  try {
    await ensureModulesSchema()
    const pool = await getPool()

    if (!pool) {
      const safeNome = nome.replace(/'/g, "''")
      const rows = await executeTrustedJson(`
        DECLARE @Inserted TABLE (
          id VARCHAR(20),
          nome NVARCHAR(255),
          projetoId VARCHAR(20),
          portalId VARCHAR(20),
          portalNome NVARCHAR(200)
        );

        IF NOT EXISTS (
          SELECT 1
          FROM Modulos
          WHERE ProjetoId = ${projetoId}
            AND Ativo = 1
            AND LOWER(Nome) = LOWER(N'${safeNome}')
        )
        BEGIN
          INSERT INTO Modulos (Nome, ProjetoId, PortalId, Ativo, DataCriacao)
          OUTPUT CAST(INSERTED.Id AS VARCHAR(20)), INSERTED.Nome, CAST(INSERTED.ProjetoId AS VARCHAR(20)), CAST(INSERTED.PortalId AS VARCHAR(20)), N''
          INTO @Inserted
          VALUES (N'${safeNome}', ${projetoId}, ${portalId ?? 'NULL'}, 1, GETDATE());
        END

        SELECT * FROM @Inserted FOR JSON PATH;
      `)

      const created = rows[0]
      if (!created) {
        return res.status(409).json({ message: 'Ja existe um modulo ativo com esse nome neste projeto.' })
      }

      return res.status(201).json(normalizeModule(created))
    }

    const duplicateRequest = createRequest(pool)
    duplicateRequest.input('projetoId', sql.Int, projetoId)
    duplicateRequest.input('nome', sql.NVarChar(255), nome)
    const duplicateResult = await duplicateRequest.query(`
      SELECT TOP 1 Id
      FROM dbo.Modulos
      WHERE ProjetoId = @projetoId
        AND Ativo = 1
        AND LOWER(Nome) = LOWER(@nome)
    `)

    if (duplicateResult.recordset[0]) {
      return res.status(409).json({ message: 'Ja existe um modulo ativo com esse nome neste projeto.' })
    }

    const request = createRequest(pool)
    request.input('nome', sql.NVarChar(255), nome)
    request.input('projetoId', sql.Int, projetoId)
    request.input('portalId', sql.Int, portalId)
    const result = await request.query(`
      DECLARE @Inserted TABLE (
        id INT,
        nome NVARCHAR(255),
        projetoId INT,
        portalId INT
      );

      INSERT INTO dbo.Modulos (Nome, ProjetoId, PortalId, Ativo, DataCriacao)
      OUTPUT INSERTED.Id, INSERTED.Nome, INSERTED.ProjetoId, INSERTED.PortalId
      INTO @Inserted
      VALUES (@nome, @projetoId, @portalId, 1, GETDATE());

      SELECT
        CAST(i.id AS VARCHAR(20)) AS id,
        i.nome AS nome,
        CAST(i.projetoId AS VARCHAR(20)) AS projetoId,
        CAST(i.portalId AS VARCHAR(20)) AS portalId,
        COALESCE(pp.Nome, '') AS portalNome
      FROM @Inserted i
      LEFT JOIN dbo.ProjetoPortais pp ON pp.Id = i.portalId
    `)

    return res.status(201).json(normalizeModule(result.recordset[0]))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel cadastrar o modulo agora.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
