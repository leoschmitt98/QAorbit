import { createRequest, getPool, sql } from '../../db.js'
import { buildAutomationFailureContext } from '../core/failure-context.js'

let schemaReadyPromise

function normalizeString(value) {
  return String(value ?? '').trim()
}

function toDateOrNow(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function mapRun(row) {
  return {
    id: row.Id,
    name: row.Name || '',
    type: row.Type || 'single',
    framework: row.Framework || '',
    baseUrl: row.BaseUrl || '',
    status: row.Status || '',
    startedAt: row.StartedAt ? new Date(row.StartedAt).toISOString() : null,
    finishedAt: row.FinishedAt ? new Date(row.FinishedAt).toISOString() : null,
    durationMs: Number(row.DurationMs || 0),
    total: Number(row.Total || 0),
    passed: Number(row.Passed || 0),
    failed: Number(row.Failed || 0),
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
  }
}

function mapRunItem(row, artifacts = []) {
  return {
    id: row.Id,
    runId: row.RunId,
    specName: row.SpecName || '',
    specPath: row.SpecPath || '',
    framework: row.Framework || '',
    status: row.Status || '',
    exitCode: Number(row.ExitCode || 0),
    durationMs: Number(row.DurationMs || 0),
    mainError: row.MainError || '',
    stdoutSanitized: row.StdoutSanitized || '',
    stderrSanitized: row.StderrSanitized || '',
    command: row.CommandText || '',
    baseUrl: row.BaseUrl || '',
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
    artifacts,
  }
}

function mapArtifact(row) {
  return {
    id: row.Id,
    runItemId: row.RunItemId,
    type: row.Type || '',
    path: row.Path || '',
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
  }
}

export async function ensureAutomationRunsSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool()
      if (!pool) return

      await createRequest(pool).query(`
        IF OBJECT_ID('dbo.AutomationRuns', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.AutomationRuns (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            Name NVARCHAR(250) NOT NULL,
            Type NVARCHAR(40) NOT NULL,
            Framework NVARCHAR(40) NOT NULL,
            BaseUrl NVARCHAR(1000) NULL,
            Status NVARCHAR(40) NOT NULL,
            StartedAt DATETIME2(0) NOT NULL,
            FinishedAt DATETIME2(0) NOT NULL,
            DurationMs INT NOT NULL CONSTRAINT DF_AutomationRuns_DurationMs DEFAULT (0),
            Total INT NOT NULL CONSTRAINT DF_AutomationRuns_Total DEFAULT (0),
            Passed INT NOT NULL CONSTRAINT DF_AutomationRuns_Passed DEFAULT (0),
            Failed INT NOT NULL CONSTRAINT DF_AutomationRuns_Failed DEFAULT (0),
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AutomationRuns_CreatedAt DEFAULT (SYSDATETIME())
          );

          CREATE INDEX IX_AutomationRuns_CreatedAt ON dbo.AutomationRuns (CreatedAt DESC);
          CREATE INDEX IX_AutomationRuns_Framework_Status ON dbo.AutomationRuns (Framework, Status);
        END;

        IF OBJECT_ID('dbo.AutomationRunItems', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.AutomationRunItems (
            Id NVARCHAR(120) NOT NULL PRIMARY KEY,
            RunId NVARCHAR(120) NOT NULL,
            SpecName NVARCHAR(250) NULL,
            SpecPath NVARCHAR(1000) NULL,
            Framework NVARCHAR(40) NOT NULL,
            Status NVARCHAR(40) NOT NULL,
            ExitCode INT NOT NULL CONSTRAINT DF_AutomationRunItems_ExitCode DEFAULT (0),
            DurationMs INT NOT NULL CONSTRAINT DF_AutomationRunItems_DurationMs DEFAULT (0),
            MainError NVARCHAR(MAX) NULL,
            StdoutSanitized NVARCHAR(MAX) NULL,
            StderrSanitized NVARCHAR(MAX) NULL,
            CommandText NVARCHAR(1000) NULL,
            BaseUrl NVARCHAR(1000) NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AutomationRunItems_CreatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_AutomationRunItems_Runs FOREIGN KEY (RunId) REFERENCES dbo.AutomationRuns (Id) ON DELETE CASCADE
          );

          CREATE INDEX IX_AutomationRunItems_RunId ON dbo.AutomationRunItems (RunId, CreatedAt);
          CREATE INDEX IX_AutomationRunItems_Status ON dbo.AutomationRunItems (Status);
        END;

        IF OBJECT_ID('dbo.AutomationArtifacts', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.AutomationArtifacts (
            Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            RunItemId NVARCHAR(120) NOT NULL,
            Type NVARCHAR(40) NOT NULL,
            Path NVARCHAR(1000) NOT NULL,
            CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AutomationArtifacts_CreatedAt DEFAULT (SYSDATETIME()),
            CONSTRAINT FK_AutomationArtifacts_RunItems FOREIGN KEY (RunItemId) REFERENCES dbo.AutomationRunItems (Id) ON DELETE CASCADE
          );

          CREATE INDEX IX_AutomationArtifacts_RunItemId ON dbo.AutomationArtifacts (RunItemId);
        END;
      `)
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

async function insertRun(pool, run) {
  const request = createRequest(pool)
  request.input('id', sql.NVarChar(120), run.id)
  request.input('name', sql.NVarChar(250), run.name)
  request.input('type', sql.NVarChar(40), run.type)
  request.input('framework', sql.NVarChar(40), run.framework)
  request.input('baseUrl', sql.NVarChar(1000), run.baseUrl || null)
  request.input('status', sql.NVarChar(40), run.status)
  request.input('startedAt', sql.DateTime2, run.startedAt)
  request.input('finishedAt', sql.DateTime2, run.finishedAt)
  request.input('durationMs', sql.Int, Math.max(0, Number(run.durationMs || 0)))
  request.input('total', sql.Int, Math.max(0, Number(run.total || 0)))
  request.input('passed', sql.Int, Math.max(0, Number(run.passed || 0)))
  request.input('failed', sql.Int, Math.max(0, Number(run.failed || 0)))
  await request.query(`
    INSERT INTO dbo.AutomationRuns
      (Id, Name, Type, Framework, BaseUrl, Status, StartedAt, FinishedAt, DurationMs, Total, Passed, Failed)
    VALUES
      (@id, @name, @type, @framework, @baseUrl, @status, @startedAt, @finishedAt, @durationMs, @total, @passed, @failed)
  `)
}

async function insertItem(pool, item) {
  const request = createRequest(pool)
  request.input('id', sql.NVarChar(120), item.id)
  request.input('runId', sql.NVarChar(120), item.runId)
  request.input('specName', sql.NVarChar(250), item.specName || null)
  request.input('specPath', sql.NVarChar(1000), item.specPath || null)
  request.input('framework', sql.NVarChar(40), item.framework)
  request.input('status', sql.NVarChar(40), item.status)
  request.input('exitCode', sql.Int, Number(item.exitCode || 0))
  request.input('durationMs', sql.Int, Math.max(0, Number(item.durationMs || 0)))
  request.input('mainError', sql.NVarChar(sql.MAX), item.mainError || null)
  request.input('stdoutSanitized', sql.NVarChar(sql.MAX), item.stdoutSanitized || null)
  request.input('stderrSanitized', sql.NVarChar(sql.MAX), item.stderrSanitized || null)
  request.input('commandText', sql.NVarChar(1000), item.command || null)
  request.input('baseUrl', sql.NVarChar(1000), item.baseUrl || null)
  await request.query(`
    INSERT INTO dbo.AutomationRunItems
      (Id, RunId, SpecName, SpecPath, Framework, Status, ExitCode, DurationMs, MainError, StdoutSanitized, StderrSanitized, CommandText, BaseUrl)
    VALUES
      (@id, @runId, @specName, @specPath, @framework, @status, @exitCode, @durationMs, @mainError, @stdoutSanitized, @stderrSanitized, @commandText, @baseUrl)
  `)
}

async function insertArtifacts(pool, runItemId, artifacts) {
  const entries = []
  for (const type of ['screenshots', 'videos', 'traces', 'reports']) {
    for (const artifactPath of artifacts?.[type] || []) {
      entries.push({ type: type.replace(/s$/, ''), path: artifactPath })
    }
  }

  for (const artifact of entries) {
    const request = createRequest(pool)
    request.input('runItemId', sql.NVarChar(120), runItemId)
    request.input('type', sql.NVarChar(40), artifact.type)
    request.input('path', sql.NVarChar(1000), artifact.path)
    await request.query(`
      INSERT INTO dbo.AutomationArtifacts (RunItemId, Type, Path)
      VALUES (@runItemId, @type, @path)
    `)
  }
}

function createRunId(prefix = 'auto-run') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function specNameFromPath(specPath) {
  const normalized = normalizeString(specPath).replace(/\\/g, '/')
  return normalized.split('/').pop() || normalized || 'Spec sem nome'
}

export async function saveSingleAutomationRun(input, result) {
  await ensureAutomationRunsSchema()
  const pool = await getPool()
  if (!pool) return null

  const now = new Date()
  const startedAt = new Date(now.getTime() - Number(result.durationMs || 0))
  const runId = createRunId('auto-run')
  const itemId = createRunId('auto-item')
  const run = {
    id: runId,
    name: normalizeString(input.name || input.suiteName || input.specPath || result.command || 'Execucao Automation Builder'),
    type: 'single',
    framework: result.framework || input.framework || '',
    baseUrl: input.baseUrl || '',
    status: result.status,
    startedAt,
    finishedAt: now,
    durationMs: result.durationMs,
    total: Number(result.summary?.total || 1),
    passed: result.status === 'passed' ? 1 : 0,
    failed: result.status === 'passed' ? 0 : 1,
  }
  const item = {
    id: itemId,
    runId,
    specName: specNameFromPath(input.specPath),
    specPath: input.specPath || '',
    framework: result.framework,
    status: result.status,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    mainError: result.mainError || '',
    stdoutSanitized: result.stdout || '',
    stderrSanitized: result.stderr || '',
    command: result.command || input.command || '',
    baseUrl: input.baseUrl || '',
  }

  await insertRun(pool, run)
  await insertItem(pool, item)
  await insertArtifacts(pool, itemId, result.artifacts || {})

  return runId
}

export async function saveBatteryAutomationRun(battery, result) {
  await ensureAutomationRunsSchema()
  const pool = await getPool()
  if (!pool) return null

  const runId = createRunId('auto-battery')
  const run = {
    id: runId,
    name: normalizeString(battery.name || 'Bateria Automation Builder'),
    type: 'battery',
    framework: battery.framework || result.results?.[0]?.framework || '',
    baseUrl: battery.baseUrl || '',
    status: result.status,
    startedAt: toDateOrNow(result.startedAt),
    finishedAt: toDateOrNow(result.finishedAt),
    durationMs: result.durationMs,
    total: result.total,
    passed: result.passed,
    failed: result.failed,
  }

  await insertRun(pool, run)

  for (const [index, itemResult] of (result.results || []).entries()) {
    const sourceItem = battery.items?.[index] || {}
    const itemId = createRunId('auto-item')
    await insertItem(pool, {
      id: itemId,
      runId,
      specName: sourceItem.name || specNameFromPath(sourceItem.specPath),
      specPath: sourceItem.specPath || '',
      framework: itemResult.framework,
      status: itemResult.status,
      exitCode: itemResult.exitCode,
      durationMs: itemResult.durationMs,
      mainError: itemResult.mainError || '',
      stdoutSanitized: itemResult.stdout || '',
      stderrSanitized: itemResult.stderr || '',
      command: itemResult.command || sourceItem.command || '',
      baseUrl: sourceItem.baseUrl || battery.baseUrl || '',
    })
    await insertArtifacts(pool, itemId, itemResult.artifacts || {})
  }

  return runId
}

export async function listAutomationRuns(limit = 50) {
  await ensureAutomationRunsSchema()
  const pool = await getPool()
  if (!pool) throw new Error('Historico de automacao requer banco configurado.')

  const request = createRequest(pool)
  request.input('limit', sql.Int, Math.min(Math.max(Number(limit || 50), 1), 200))
  const result = await request.query(`
    SELECT TOP (@limit) *
    FROM dbo.AutomationRuns
    ORDER BY CreatedAt DESC
  `)

  return result.recordset.map(mapRun)
}

export async function getAutomationRun(runId) {
  await ensureAutomationRunsSchema()
  const pool = await getPool()
  if (!pool) throw new Error('Historico de automacao requer banco configurado.')

  const request = createRequest(pool)
  request.input('runId', sql.NVarChar(120), runId)
  const result = await request.query('SELECT TOP 1 * FROM dbo.AutomationRuns WHERE Id = @runId')
  const row = result.recordset[0]
  return row ? mapRun(row) : null
}

export async function listAutomationRunItems(runId) {
  await ensureAutomationRunsSchema()
  const pool = await getPool()
  if (!pool) throw new Error('Historico de automacao requer banco configurado.')

  const request = createRequest(pool)
  request.input('runId', sql.NVarChar(120), runId)
  const result = await request.query(`
    SELECT * FROM dbo.AutomationRunItems WHERE RunId = @runId ORDER BY CreatedAt, Id;
    SELECT a.*
    FROM dbo.AutomationArtifacts a
    INNER JOIN dbo.AutomationRunItems i ON i.Id = a.RunItemId
    WHERE i.RunId = @runId
    ORDER BY a.CreatedAt, a.Id;
  `)

  const artifactsByItem = new Map()
  for (const artifact of result.recordsets[1] || []) {
    const current = artifactsByItem.get(artifact.RunItemId) || []
    current.push(mapArtifact(artifact))
    artifactsByItem.set(artifact.RunItemId, current)
  }

  return (result.recordsets[0] || []).map((row) => mapRunItem(row, artifactsByItem.get(row.Id) || []))
}

export async function buildFailureContextFromRun(runId) {
  const run = await getAutomationRun(runId)
  if (!run) return null

  const items = await listAutomationRunItems(runId)
  const failedItem = items.find((item) => item.status !== 'passed') || items[0]
  if (!failedItem) return null

  return buildAutomationFailureContext({
    framework: failedItem.framework || run.framework,
    command: failedItem.command,
    specPath: failedItem.specPath,
    baseUrl: failedItem.baseUrl || run.baseUrl,
    exitCode: failedItem.exitCode,
    durationMs: failedItem.durationMs,
    stdout: failedItem.stdoutSanitized,
    stderr: failedItem.stderrSanitized,
    blueprint: {
      name: run.name,
      framework: failedItem.framework || run.framework,
      type: 'web-e2e',
      language: failedItem.framework === 'playwright' ? 'typescript' : 'javascript',
      pattern: 'simple',
      baseUrl: failedItem.baseUrl || run.baseUrl,
      specName: failedItem.specName || failedItem.specPath,
      steps: [],
    },
  })
}

