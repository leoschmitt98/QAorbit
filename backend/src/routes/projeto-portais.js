import { Router } from 'express'
import { createRequest, executeTrustedJson, getPool, queryTrustedJson, sql } from '../db.js'

const router = Router()

let schemaReadyPromise

function ensureProjectPortalsSchema() {
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
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

function normalizePortal(item) {
  return {
    id: String(item.id || item.Id || ''),
    nome: String(item.nome || item.Nome || '').trim(),
    projetoId: String(item.projetoId || item.ProjetoId || ''),
  }
}

router.get('/', async (req, res) => {
  const projetoId = Number(req.query.projetoId)

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  try {
    await ensureProjectPortalsSchema()
    const pool = await getPool()

    if (!pool) {
      const rows = await queryTrustedJson(`
        SELECT
          CAST(Id AS VARCHAR(20)) AS id,
          Nome AS nome,
          CAST(ProjetoId AS VARCHAR(20)) AS projetoId
        FROM ProjetoPortais
        WHERE Ativo = 1
          AND ProjetoId = ${projetoId}
        ORDER BY Nome
      `)

      return res.json(rows.map(normalizePortal))
    }

    const request = createRequest(pool)
    request.input('projetoId', sql.Int, projetoId)
    const result = await request.query(`
      SELECT
        CAST(Id AS VARCHAR(20)) AS id,
        Nome AS nome,
        CAST(ProjetoId AS VARCHAR(20)) AS projetoId
      FROM dbo.ProjetoPortais
      WHERE Ativo = 1
        AND ProjetoId = @projetoId
      ORDER BY Nome
    `)

    return res.json(result.recordset.map(normalizePortal))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar os portais do projeto.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/', async (req, res) => {
  const projetoId = Number(req.body?.projetoId)
  const nome = String(req.body?.nome || '').trim()

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  if (!nome) {
    return res.status(400).json({ message: 'Nome do portal e obrigatorio.' })
  }

  try {
    await ensureProjectPortalsSchema()
    const pool = await getPool()

    if (!pool) {
      const safeNome = nome.replace(/'/g, "''")
      const rows = await executeTrustedJson(`
        DECLARE @Inserted TABLE (
          id VARCHAR(20),
          nome NVARCHAR(200),
          projetoId VARCHAR(20)
        );

        IF NOT EXISTS (
          SELECT 1
          FROM ProjetoPortais
          WHERE ProjetoId = ${projetoId}
            AND Ativo = 1
            AND LOWER(Nome) = LOWER(N'${safeNome}')
        )
        BEGIN
          INSERT INTO ProjetoPortais (ProjetoId, Nome, Ativo, DataCriacao)
          OUTPUT CAST(INSERTED.Id AS VARCHAR(20)), INSERTED.Nome, CAST(INSERTED.ProjetoId AS VARCHAR(20))
          INTO @Inserted
          VALUES (${projetoId}, N'${safeNome}', 1, GETDATE());
        END

        SELECT * FROM @Inserted FOR JSON PATH;
      `)

      const created = rows[0]
      if (!created) {
        return res.status(409).json({ message: 'Ja existe um portal com esse nome neste projeto.' })
      }

      return res.status(201).json(normalizePortal(created))
    }

    const duplicateRequest = createRequest(pool)
    duplicateRequest.input('projetoId', sql.Int, projetoId)
    duplicateRequest.input('nome', sql.NVarChar(200), nome)
    const duplicateResult = await duplicateRequest.query(`
      SELECT TOP 1 Id
      FROM dbo.ProjetoPortais
      WHERE ProjetoId = @projetoId
        AND Ativo = 1
        AND LOWER(Nome) = LOWER(@nome)
    `)

    if (duplicateResult.recordset[0]) {
      return res.status(409).json({ message: 'Ja existe um portal com esse nome neste projeto.' })
    }

    const request = createRequest(pool)
    request.input('projetoId', sql.Int, projetoId)
    request.input('nome', sql.NVarChar(200), nome)
    const result = await request.query(`
      INSERT INTO dbo.ProjetoPortais (ProjetoId, Nome, Ativo, DataCriacao)
      OUTPUT
        CAST(INSERTED.Id AS VARCHAR(20)) AS id,
        INSERTED.Nome AS nome,
        CAST(INSERTED.ProjetoId AS VARCHAR(20)) AS projetoId
      VALUES (@projetoId, @nome, 1, GETDATE())
    `)

    return res.status(201).json(normalizePortal(result.recordset[0]))
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel cadastrar o portal do projeto.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
