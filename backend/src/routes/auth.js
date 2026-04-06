import { Router } from 'express'
import { attachSession, authenticateUser, clearSession, currentSession } from '../lib/auth.js'

const router = Router()

router.get('/me', (req, res) => {
  const session = currentSession(req)
  if (!session) {
    return res.status(401).json({ message: 'Nao autenticado.' })
  }

  return res.json(session)
})

router.post('/login', async (req, res) => {
  try {
    const user = await authenticateUser(req.body?.email, req.body?.password)
    if (!user) {
      return res.status(401).json({ message: 'Email ou senha invalidos.' })
    }

    attachSession(res, user)
    return res.json(user)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel realizar login.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/logout', (_req, res) => {
  clearSession(res)
  return res.json({ ok: true })
})

export default router
