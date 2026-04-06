import { Router } from 'express'
import { attachSession, authenticateUser, clearSession, createUserAccount, currentSession, listUsers } from '../lib/auth.js'

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

router.get('/users', async (req, res) => {
  const session = currentSession(req)
  if (!session || !session.canViewAll) {
    return res.status(403).json({ message: 'Acesso restrito a administradores.' })
  }

  try {
    const users = await listUsers()
    return res.json(users)
  } catch (error) {
    return res.status(500).json({
      message: 'Nao foi possivel listar os usuarios.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    })
  }
})

router.post('/users', async (req, res) => {
  const session = currentSession(req)
  if (!session || !session.canViewAll) {
    return res.status(403).json({ message: 'Acesso restrito a administradores.' })
  }

  try {
    const user = await createUserAccount(req.body ?? {})
    return res.status(201).json(user)
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel criar o usuario.',
    })
  }
})

export default router
