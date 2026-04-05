import { Router } from 'express'
import { createRequest, getPool, queryTrustedJson } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const pool = await getPool()

    if (!pool) {
      const rows = await queryTrustedJson(`
        SELECT
          CAST(Id AS VARCHAR(20)) AS id,
          Nome AS nome
        FROM Areas
        WHERE Ativo = 1
      `)
      return res.json(rows)
    }

    const request = createRequest(pool)
    const result = await request.query(`
      SELECT
        CAST(Id AS VARCHAR(20)) AS id,
        Nome AS nome
      FROM Areas
      WHERE Ativo = 1
      ORDER BY Nome
    `)

    return res.json(result.recordset)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel carregar as areas.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

export default router
