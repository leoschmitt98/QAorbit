import { Router } from 'express'
import { createRequest, executeTrustedJson, getPool, queryTrustedJson, sql } from '../db.js'

const router = Router()

function normalizeModule(module) {
  return {
    id: String(module.id || module.Id || ''),
    nome: String(module.nome || module.Nome || '').trim(),
    projetoId: String(module.projetoId || module.ProjetoId || ''),
  }
}

router.get('/', async (req, res) => {
  const projetoId = Number(req.query.projetoId)

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  try {
    const pool = await getPool()

    if (!pool) {
      const rows = await queryTrustedJson(`
        SELECT
          CAST(Id AS VARCHAR(20)) AS id,
          Nome AS nome,
          CAST(ProjetoId AS VARCHAR(20)) AS projetoId
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
        CAST(Id AS VARCHAR(20)) AS id,
        Nome AS nome,
        CAST(ProjetoId AS VARCHAR(20)) AS projetoId
      FROM Modulos
      WHERE Ativo = 1
        AND ProjetoId = @projetoId
      ORDER BY Nome
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

  if (!Number.isInteger(projetoId)) {
    return res.status(400).json({ message: 'projetoId e obrigatorio.' })
  }

  if (!nome) {
    return res.status(400).json({ message: 'Nome do modulo e obrigatorio.' })
  }

  try {
    const pool = await getPool()

    if (!pool) {
      const safeNome = nome.replace(/'/g, "''")
      const rows = await executeTrustedJson(`
        DECLARE @Inserted TABLE (
          id VARCHAR(20),
          nome NVARCHAR(255),
          projetoId VARCHAR(20)
        );

        IF NOT EXISTS (
          SELECT 1
          FROM Modulos
          WHERE ProjetoId = ${projetoId}
            AND Ativo = 1
            AND LOWER(Nome) = LOWER(N'${safeNome}')
        )
        BEGIN
          INSERT INTO Modulos (Nome, ProjetoId, Ativo, DataCriacao)
          OUTPUT CAST(INSERTED.Id AS VARCHAR(20)), INSERTED.Nome, CAST(INSERTED.ProjetoId AS VARCHAR(20))
          INTO @Inserted
          VALUES (N'${safeNome}', ${projetoId}, 1, GETDATE());
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
      FROM Modulos
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
    const result = await request.query(`
      INSERT INTO Modulos (Nome, ProjetoId, Ativo, DataCriacao)
      OUTPUT
        CAST(INSERTED.Id AS VARCHAR(20)) AS id,
        INSERTED.Nome AS nome,
        CAST(INSERTED.ProjetoId AS VARCHAR(20)) AS projetoId
      VALUES (@nome, @projetoId, 1, GETDATE())
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
