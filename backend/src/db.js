import 'dotenv/config'
import sql from 'mssql'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function getInstanceParts() {
  const rawServer = process.env.DB_SERVER?.trim() || 'localhost'
  if (rawServer.includes('\\')) {
    const [server, instanceName] = rawServer.split('\\')
    return { server, instanceName }
  }

  return {
    server: rawServer,
    instanceName: process.env.DB_INSTANCE?.trim() || undefined,
  }
}

function baseConfig() {
  const { server, instanceName } = getInstanceParts()
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined

  const config = {
    server,
    database: process.env.DB_DATABASE || 'QA Orbit',
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    options: {
      encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
      trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
      instanceName,
    },
    pool: {
      min: 0,
      max: 5,
      idleTimeoutMillis: 30000,
    },
  }

  if (port && !instanceName) {
    config.port = port
  }

  return config
}

let poolPromise

function shouldUseTrustedConnection() {
  return (process.env.DB_TRUSTED_CONNECTION || '').toLowerCase() === 'true'
}

export async function getPool() {
  if (shouldUseTrustedConnection() && !process.env.DB_USER) {
    return null
  }

  if (!poolPromise) {
    poolPromise = sql.connect(baseConfig())
  }

  return poolPromise
}

export function createRequest(pool) {
  return pool.request()
}

export async function queryTrustedJson(query) {
  const { server, instanceName } = getInstanceParts()
  const sqlcmdServer = instanceName ? `${server}\\${instanceName}` : server
  const database = process.env.DB_DATABASE || 'QA Orbit'
  const wrappedQuery = `SET NOCOUNT ON; SELECT * FROM (${query}) AS src FOR JSON PATH;`

  const { stdout } = await execFileAsync(
    'sqlcmd',
    ['-S', sqlcmdServer, '-d', database, '-E', '-C', '-Q', wrappedQuery, '-h', '-1', '-W', '-w', '65535'],
    { windowsHide: true },
  )

  const text = stdout.trim()
  return text ? JSON.parse(text) : []
}

export async function executeTrustedJson(statement) {
  const { server, instanceName } = getInstanceParts()
  const sqlcmdServer = instanceName ? `${server}\\${instanceName}` : server
  const database = process.env.DB_DATABASE || 'QA Orbit'

  const { stdout } = await execFileAsync(
    'sqlcmd',
    ['-S', sqlcmdServer, '-d', database, '-E', '-C', '-Q', `SET NOCOUNT ON; ${statement}`, '-h', '-1', '-W', '-w', '65535'],
    { windowsHide: true },
  )

  const text = stdout.trim()
  return text ? JSON.parse(text) : []
}

export async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise
    await pool.close()
    poolPromise = undefined
  }
}

export { sql }
