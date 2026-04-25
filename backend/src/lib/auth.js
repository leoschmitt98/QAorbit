import crypto from 'node:crypto'
import { createRequest, getPool, sql } from '../db.js'

const SESSION_COOKIE_NAME = 'qa_orbit_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 12

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || 'qa-orbit-dev-secret-change-me'
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf-8')
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url')
}

function parseCookies(cookieHeader) {
  const cookies = {}
  for (const item of String(cookieHeader || '').split(';')) {
    const [key, ...rest] = item.trim().split('=')
    if (!key) continue
    cookies[key] = decodeURIComponent(rest.join('='))
  }
  return cookies
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 120000
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex')
  return { salt, hash, iterations }
}

function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt)
  const expected = Buffer.from(storedHash, 'hex')
  const current = Buffer.from(hash, 'hex')
  return expected.length === current.length && crypto.timingSafeEqual(expected, current)
}

function buildSessionToken(user) {
  const payload = JSON.stringify({
    userId: user.userId,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + SESSION_TTL_MS,
  })
  const encoded = base64UrlEncode(payload)
  const signature = signPayload(encoded)
  return `${encoded}.${signature}`
}

function readSessionToken(token) {
  if (!token || !token.includes('.')) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  const expected = signPayload(encoded)
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null
  }
  const payload = JSON.parse(base64UrlDecode(encoded))
  if (!payload?.exp || Number(payload.exp) < Date.now()) return null
  return payload
}

function sessionCookie(token, clear = false) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  parts.push(clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`)
  return parts.join('; ')
}

export async function ensureAuthSchemaAndBootstrap() {
  const pool = await getPool()
  if (!pool) return

  await createRequest(pool).query(`
    IF OBJECT_ID('dbo.UsuariosQaOrbit', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.UsuariosQaOrbit (
        UserId NVARCHAR(120) NOT NULL PRIMARY KEY,
        Nome NVARCHAR(180) NOT NULL,
        Email NVARCHAR(180) NOT NULL UNIQUE,
        RoleName NVARCHAR(40) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        PasswordSalt NVARCHAR(120) NOT NULL,
        Ativo BIT NOT NULL CONSTRAINT DF_UsuariosQaOrbit_Ativo DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UsuariosQaOrbit_CreatedAt DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_UsuariosQaOrbit_UpdatedAt DEFAULT SYSDATETIME()
      );
    END

    IF COL_LENGTH('dbo.Chamados', 'CreatedByUserId') IS NULL
      ALTER TABLE dbo.Chamados ADD CreatedByUserId NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.Chamados', 'UpdatedByUserId') IS NULL
      ALTER TABLE dbo.Chamados ADD UpdatedByUserId NVARCHAR(120) NULL;

    IF COL_LENGTH('dbo.Bugs', 'CreatedByUserId') IS NULL
      ALTER TABLE dbo.Bugs ADD CreatedByUserId NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.Bugs', 'UpdatedByUserId') IS NULL
      ALTER TABLE dbo.Bugs ADD UpdatedByUserId NVARCHAR(120) NULL;

    IF COL_LENGTH('dbo.HistoricoTestes', 'CreatedByUserId') IS NULL
      ALTER TABLE dbo.HistoricoTestes ADD CreatedByUserId NVARCHAR(120) NULL;
  `)

  const bootstrapEmail = process.env.AUTH_BOOTSTRAP_EMAIL?.trim()
  const bootstrapPassword = process.env.AUTH_BOOTSTRAP_PASSWORD?.trim()
  const bootstrapName = process.env.AUTH_BOOTSTRAP_NAME?.trim() || 'Administrador QA Orbit'
  const bootstrapRole = process.env.AUTH_BOOTSTRAP_ROLE?.trim() || 'admin'

  if (!bootstrapEmail || !bootstrapPassword) return

  const countResult = await createRequest(pool).query('SELECT COUNT(1) AS total FROM dbo.UsuariosQaOrbit')
  const totalUsers = Number(countResult.recordset[0]?.total || 0)
  if (totalUsers > 0) return

  const password = hashPassword(bootstrapPassword)
  const request = createRequest(pool)
  request.input('userId', sql.NVarChar(120), `user-${Date.now()}`)
  request.input('nome', sql.NVarChar(180), bootstrapName)
  request.input('email', sql.NVarChar(180), bootstrapEmail.toLowerCase())
  request.input('roleName', sql.NVarChar(40), bootstrapRole)
  request.input('passwordHash', sql.NVarChar(255), password.hash)
  request.input('passwordSalt', sql.NVarChar(120), password.salt)
  await request.query(`
    INSERT INTO dbo.UsuariosQaOrbit (UserId, Nome, Email, RoleName, PasswordHash, PasswordSalt)
    VALUES (@userId, @nome, @email, @roleName, @passwordHash, @passwordSalt)
  `)
}

export async function authenticateUser(email, password) {
  const pool = await getPool()
  if (!pool) throw new Error('Autenticacao requer banco configurado.')

  const request = createRequest(pool)
  request.input('email', sql.NVarChar(180), String(email || '').trim().toLowerCase())
  const result = await request.query(`
    SELECT TOP 1 UserId, Nome, Email, RoleName, PasswordHash, PasswordSalt, Ativo
    FROM dbo.UsuariosQaOrbit
    WHERE Email = @email
  `)
  const user = result.recordset[0]
  if (!user || !user.Ativo) return null
  if (!verifyPassword(String(password || ''), user.PasswordSalt, user.PasswordHash)) return null

  return {
    userId: user.UserId,
    name: user.Nome,
    email: user.Email,
    role: user.RoleName,
    canViewAll: ['admin', 'lead', 'manager'].includes(String(user.RoleName || '').toLowerCase()),
  }
}

export async function listUsers() {
  const pool = await getPool()
  if (!pool) throw new Error('Gestao de usuarios requer banco configurado.')

  const result = await createRequest(pool).query(`
    SELECT UserId, Nome, Email, RoleName, Ativo, CreatedAt, UpdatedAt
    FROM dbo.UsuariosQaOrbit
    WHERE Ativo = 1
    ORDER BY Nome
  `)

  return result.recordset.map((user) => ({
    userId: user.UserId,
    name: user.Nome,
    email: user.Email,
    role: user.RoleName,
    active: Boolean(user.Ativo),
    createdAt: user.CreatedAt ? new Date(user.CreatedAt).toISOString() : null,
    updatedAt: user.UpdatedAt ? new Date(user.UpdatedAt).toISOString() : null,
  }))
}

export async function createUserAccount(payload) {
  const pool = await getPool()
  if (!pool) throw new Error('Gestao de usuarios requer banco configurado.')

  const name = String(payload?.name || '').trim()
  const email = String(payload?.email || '').trim().toLowerCase()
  const role = String(payload?.role || 'qa').trim().toLowerCase()
  const password = String(payload?.password || '')

  if (!name || !email || !password) {
    throw new Error('Nome, email e senha sao obrigatorios.')
  }

  if (password.length < 8) {
    throw new Error('A senha precisa ter pelo menos 8 caracteres.')
  }

  if (!['qa', 'lead', 'manager', 'admin'].includes(role)) {
    throw new Error('Perfil invalido.')
  }

  const duplicateCheck = createRequest(pool)
  duplicateCheck.input('email', sql.NVarChar(180), email)
  const duplicateResult = await duplicateCheck.query(`
    SELECT TOP 1 UserId
    FROM dbo.UsuariosQaOrbit
    WHERE Email = @email
  `)
  if (duplicateResult.recordset[0]) {
    throw new Error('Ja existe um usuario com este email.')
  }

  const passwordData = hashPassword(password)
  const request = createRequest(pool)
  request.input('userId', sql.NVarChar(120), `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
  request.input('nome', sql.NVarChar(180), name)
  request.input('email', sql.NVarChar(180), email)
  request.input('roleName', sql.NVarChar(40), role)
  request.input('passwordHash', sql.NVarChar(255), passwordData.hash)
  request.input('passwordSalt', sql.NVarChar(120), passwordData.salt)
  await request.query(`
    INSERT INTO dbo.UsuariosQaOrbit (UserId, Nome, Email, RoleName, PasswordHash, PasswordSalt)
    VALUES (@userId, @nome, @email, @roleName, @passwordHash, @passwordSalt)
  `)

  return {
    name,
    email,
    role,
  }
}

export async function deleteUserAccount(userId, currentUser) {
  const pool = await getPool()
  if (!pool) throw new Error('Gestao de usuarios requer banco configurado.')

  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) {
    throw new Error('Usuario invalido.')
  }

  if (normalizedUserId === currentUser?.userId) {
    throw new Error('Voce nao pode excluir o proprio acesso logado.')
  }

  const lookupRequest = createRequest(pool)
  lookupRequest.input('userId', sql.NVarChar(120), normalizedUserId)
  const lookupResult = await lookupRequest.query(`
    SELECT TOP 1 UserId, Nome, Email, RoleName, Ativo
    FROM dbo.UsuariosQaOrbit
    WHERE UserId = @userId
  `)

  const user = lookupResult.recordset[0]
  if (!user) {
    throw new Error('Usuario nao encontrado.')
  }

  if (!user.Ativo) {
    return {
      userId: user.UserId,
      name: user.Nome,
      email: user.Email,
      active: false,
    }
  }

  if (String(user.RoleName || '').toLowerCase() === 'admin') {
    const adminCountResult = await createRequest(pool).query(`
      SELECT COUNT(1) AS total
      FROM dbo.UsuariosQaOrbit
      WHERE Ativo = 1
        AND LOWER(RoleName) = 'admin'
    `)

    if (Number(adminCountResult.recordset[0]?.total || 0) <= 1) {
      throw new Error('Nao e possivel excluir o ultimo administrador ativo.')
    }
  }

  const updateRequest = createRequest(pool)
  updateRequest.input('userId', sql.NVarChar(120), normalizedUserId)
  await updateRequest.query(`
    UPDATE dbo.UsuariosQaOrbit
    SET Ativo = 0,
        UpdatedAt = SYSDATETIME()
    WHERE UserId = @userId
  `)

  return {
    userId: user.UserId,
    name: user.Nome,
    email: user.Email,
    active: false,
  }
}

export function attachSession(res, user) {
  const token = buildSessionToken(user)
  res.setHeader('Set-Cookie', sessionCookie(token))
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', sessionCookie('', true))
}

export function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[SESSION_COOKIE_NAME]
  const payload = readSessionToken(token)
  if (!payload) {
    return res.status(401).json({ message: 'Sessao invalida ou expirada.' })
  }

  req.auth = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    canViewAll: ['admin', 'lead', 'manager'].includes(String(payload.role || '').toLowerCase()),
  }

  return next()
}

export function currentSession(req) {
  const cookies = parseCookies(req.headers.cookie)
  const payload = readSessionToken(cookies[SESSION_COOKIE_NAME])
  if (!payload) return null
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    canViewAll: ['admin', 'lead', 'manager'].includes(String(payload.role || '').toLowerCase()),
  }
}

export function resolveWorkspaceScope(session, requestedScope) {
  const normalized = String(requestedScope || '').trim().toLowerCase()
  if (session?.canViewAll && normalized === 'all') return 'all'
  return 'mine'
}

export function canAccessOwnedRecord(session, ownerUserId) {
  if (!session) return false
  if (session.canViewAll) return true
  return Boolean(ownerUserId && session.userId === ownerUserId)
}
