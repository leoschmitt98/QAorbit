import { createRequest, getPool, sql } from '../db.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readLegacyWorkflow, sanitizeSegment, storageRoot, ticketDirectory, writeLegacyWorkflow } from './legacy-storage.js'
import { canAccessOwnedRecord, resolveWorkspaceScope } from './auth.js'

function toNullableInt(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function normalizeString(value) {
  const normalized = String(value ?? '').trim()
  return normalized || ''
}

function resolveStoredAssetUrl(ticketId, frame) {
  const directUrl = normalizeString(frame?.DownloadUrl || frame?.downloadUrl || frame?.imageUrl)
  if (directUrl) return directUrl

  const fileName = normalizeString(frame?.FileName || frame?.fileName)
  if (!fileName) return ''

  return `/storage/chamados/${encodeURIComponent(sanitizeSegment(ticketId))}/quadros/${encodeURIComponent(fileName)}`
}

function resolveScenarioStoredAssetUrl(ticketId, scenarioId, frame) {
  const directUrl = normalizeString(frame?.DownloadUrl || frame?.downloadUrl || frame?.imageUrl)
  if (directUrl) return directUrl

  const fileName = normalizeString(frame?.FileName || frame?.fileName)
  if (!fileName || !scenarioId) return ''

  return `/storage/chamados/${encodeURIComponent(sanitizeSegment(ticketId))}/cenarios/${encodeURIComponent(sanitizeSegment(scenarioId))}/quadros/${encodeURIComponent(fileName)}`
}

async function mergeScenarioEvidenceFromLegacy(ticketId, draft) {
  try {
    const legacyDraft = await readLegacyWorkflow(ticketId)
    const legacyScenarios = Array.isArray(legacyDraft?.scenarios) ? legacyDraft.scenarios : []

    if (!Array.isArray(draft?.scenarios) || legacyScenarios.length === 0) {
      return draft
    }

    return {
      ...draft,
      scenarios: draft.scenarios.map((scenario) => {
        const legacyScenario = legacyScenarios.find((item) => item.id === scenario.id)
        return legacyScenario
          ? {
              ...scenario,
              gifName: legacyScenario.gifName || '',
              gifPreviewUrl: legacyScenario.gifPreviewUrl || '',
              frames: Array.isArray(legacyScenario.frames)
                ? legacyScenario.frames.map((frame) => {
                    const resolvedUrl = resolveScenarioStoredAssetUrl(ticketId, scenario.id, frame)
                    return {
                      ...frame,
                      imageUrl: resolvedUrl || frame.imageUrl || '',
                      downloadUrl: resolvedUrl || frame.downloadUrl || frame.imageUrl || '',
                    }
                  })
                : [],
            }
          : scenario
      }),
    }
  } catch {
    return draft
  }
}

async function resolveAreaIdByName(transaction, portalArea) {
  const areaName = normalizeString(portalArea)
  if (!areaName) return null

  const request = transaction.request()
  request.input('nome', sql.NVarChar(120), areaName)
  const result = await request.query(`
    SELECT TOP 1 Id
    FROM dbo.Areas
    WHERE Nome = @nome
  `)
  return result.recordset[0]?.Id ?? null
}

async function saveAttachments(transaction, ticketId, attachments) {
  const deleteRequest = transaction.request()
  deleteRequest.input('ticketId', sql.NVarChar(120), ticketId)
  await deleteRequest.query('DELETE FROM dbo.ChamadoAnexosSuporte WHERE TicketId = @ticketId')

  for (const attachment of Array.isArray(attachments) ? attachments : []) {
    const fileName = normalizeString(attachment)
    if (!fileName) continue
    const insertRequest = transaction.request()
    insertRequest.input('ticketId', sql.NVarChar(120), ticketId)
    insertRequest.input('nomeArquivo', sql.NVarChar(255), fileName)
    await insertRequest.query(`
      INSERT INTO dbo.ChamadoAnexosSuporte (TicketId, NomeArquivo)
      VALUES (@ticketId, @nomeArquivo)
    `)
  }
}

async function saveProblem(transaction, ticketId, problem) {
  const request = transaction.request()
  request.input('ticketId', sql.NVarChar(120), ticketId)
  request.input('descricao', sql.NVarChar(sql.MAX), normalizeString(problem?.problemDescription))
  request.input('analise', sql.NVarChar(sql.MAX), normalizeString(problem?.initialAnalysis))
  request.input('esperado', sql.NVarChar(sql.MAX), normalizeString(problem?.expectedBehavior))
  request.input('relatado', sql.NVarChar(sql.MAX), normalizeString(problem?.reportedBehavior))
  request.input('documentacao', sql.NVarChar(sql.MAX), normalizeString(problem?.relatedDocumentation))
  request.input('dadosTeste', sql.NVarChar(sql.MAX), normalizeString(problem?.testData))
  await request.query(`
    MERGE dbo.ChamadoProblemas AS target
    USING (SELECT @ticketId AS TicketId) AS src
    ON target.TicketId = src.TicketId
    WHEN MATCHED THEN
      UPDATE SET
        DescricaoEstruturada = @descricao,
        AnaliseInicial = @analise,
        ComportamentoEsperado = @esperado,
        ComportamentoRelatado = @relatado,
        DocumentacaoRelacionada = @documentacao,
        DadosTeste = @dadosTeste,
        DataAtualizacao = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (TicketId, DescricaoEstruturada, AnaliseInicial, ComportamentoEsperado, ComportamentoRelatado, DocumentacaoRelacionada, DadosTeste)
      VALUES (@ticketId, @descricao, @analise, @esperado, @relatado, @documentacao, @dadosTeste);
  `)
}

async function saveRetest(transaction, ticketId, retest) {
  const retestRequest = transaction.request()
  retestRequest.input('ticketId', sql.NVarChar(120), ticketId)
  retestRequest.input('preCondicoes', sql.NVarChar(sql.MAX), normalizeString(retest?.preconditions))
  retestRequest.input('gifName', sql.NVarChar(255), normalizeString(retest?.gifName))
  retestRequest.input('gifPreviewUrl', sql.NVarChar(500), normalizeString(retest?.gifPreviewUrl))
  retestRequest.input('comportamentoObtido', sql.NVarChar(sql.MAX), normalizeString(retest?.obtainedBehavior))
  retestRequest.input('statusReteste', sql.NVarChar(40), normalizeString(retest?.status) || 'Parcial')
  await retestRequest.query(`
    MERGE dbo.ChamadoRetestes AS target
    USING (SELECT @ticketId AS TicketId) AS src
    ON target.TicketId = src.TicketId
    WHEN MATCHED THEN
      UPDATE SET
        PreCondicoes = @preCondicoes,
        GifName = @gifName,
        GifPreviewUrl = @gifPreviewUrl,
        ComportamentoObtido = @comportamentoObtido,
        StatusReteste = @statusReteste,
        DataAtualizacao = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (TicketId, PreCondicoes, GifName, GifPreviewUrl, ComportamentoObtido, StatusReteste)
      VALUES (@ticketId, @preCondicoes, @gifName, @gifPreviewUrl, @comportamentoObtido, @statusReteste);
  `)

  const deleteFramesRequest = transaction.request()
  deleteFramesRequest.input('ticketId', sql.NVarChar(120), ticketId)
  await deleteFramesRequest.query('DELETE FROM dbo.ChamadoRetestePassoQuadros WHERE PassoId IN (SELECT PassoId FROM dbo.ChamadoRetestePassos WHERE TicketId = @ticketId)')
  await deleteFramesRequest.query('DELETE FROM dbo.ChamadoRetestePassos WHERE TicketId = @ticketId')
  await deleteFramesRequest.query('DELETE FROM dbo.ChamadoRetesteQuadros WHERE TicketId = @ticketId')

  for (let index = 0; index < (Array.isArray(retest?.frames) ? retest.frames.length : 0); index += 1) {
    const frame = retest.frames[index]
    const frameRequest = transaction.request()
    frameRequest.input('quadroId', sql.NVarChar(120), normalizeString(frame.id) || `frame-${index + 1}`)
    frameRequest.input('ticketId', sql.NVarChar(120), ticketId)
    frameRequest.input('nome', sql.NVarChar(255), normalizeString(frame.name) || `Quadro ${index + 1}`)
    frameRequest.input('timestampLabel', sql.NVarChar(50), normalizeString(frame.timestampLabel))
    frameRequest.input('descricao', sql.NVarChar(sql.MAX), normalizeString(frame.description))
    frameRequest.input('fileName', sql.NVarChar(255), normalizeString(frame.fileName))
    frameRequest.input('downloadUrl', sql.NVarChar(500), normalizeString(frame.downloadUrl || frame.imageUrl))
    frameRequest.input('caminhoStorage', sql.NVarChar(500), normalizeString(frame.downloadUrl || frame.imageUrl))
    frameRequest.input('persistedAt', sql.DateTime2, frame.persistedAt ? new Date(frame.persistedAt) : null)
    frameRequest.input('ordem', sql.Int, index + 1)
    frameRequest.input('annotationsJson', sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(frame.annotations) ? frame.annotations : []))
    frameRequest.input('editHistoryJson', sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(frame.editHistory) ? frame.editHistory : []))
    await frameRequest.query(`
      INSERT INTO dbo.ChamadoRetesteQuadros
      (QuadroId, TicketId, Nome, TimestampLabel, Descricao, FileName, DownloadUrl, CaminhoStorage, PersistedAt, OrdemExibicao, AnnotationsJson, EditHistoryJson)
      VALUES
      (@quadroId, @ticketId, @nome, @timestampLabel, @descricao, @fileName, @downloadUrl, @caminhoStorage, @persistedAt, @ordem, @annotationsJson, @editHistoryJson)
    `)
  }

  for (let index = 0; index < (Array.isArray(retest?.steps) ? retest.steps.length : 0); index += 1) {
    const step = retest.steps[index]
    const stepId = normalizeString(step.id) || `step-${index + 1}`
    const stepRequest = transaction.request()
    stepRequest.input('passoId', sql.NVarChar(120), stepId)
    stepRequest.input('ticketId', sql.NVarChar(120), ticketId)
    stepRequest.input('ordem', sql.Int, index + 1)
    stepRequest.input('statusPasso', sql.NVarChar(40), normalizeString(step.status) || 'Parcial')
    await stepRequest.query(`
      INSERT INTO dbo.ChamadoRetestePassos (PassoId, TicketId, Ordem, StatusPasso)
      VALUES (@passoId, @ticketId, @ordem, @statusPasso)
    `)

    for (let frameIndex = 0; frameIndex < (Array.isArray(step.frameIds) ? step.frameIds.length : 0); frameIndex += 1) {
      const linkRequest = transaction.request()
      linkRequest.input('passoId', sql.NVarChar(120), stepId)
      linkRequest.input('quadroId', sql.NVarChar(120), normalizeString(step.frameIds[frameIndex]))
      linkRequest.input('ordem', sql.Int, frameIndex + 1)
      await linkRequest.query(`
        INSERT INTO dbo.ChamadoRetestePassoQuadros (PassoId, QuadroId, Ordem)
        VALUES (@passoId, @quadroId, @ordem)
      `)
    }
  }
}

async function saveScenarios(transaction, ticketId, scenarios) {
  const deleteRequest = transaction.request()
  deleteRequest.input('ticketId', sql.NVarChar(120), ticketId)
  await deleteRequest.query('DELETE FROM dbo.ChamadoCenariosComplementares WHERE TicketId = @ticketId')

  for (const scenario of Array.isArray(scenarios) ? scenarios : []) {
    const request = transaction.request()
    request.input('cenarioId', sql.NVarChar(120), normalizeString(scenario.id))
    request.input('ticketId', sql.NVarChar(120), ticketId)
    request.input('descricao', sql.NVarChar(sql.MAX), normalizeString(scenario.description))
    request.input('moduloId', sql.Int, toNullableInt(scenario.moduleId))
    request.input('resultadoEsperado', sql.NVarChar(sql.MAX), normalizeString(scenario.expectedResult))
    request.input('resultadoObtido', sql.NVarChar(sql.MAX), normalizeString(scenario.obtainedResult))
    request.input('statusCenario', sql.NVarChar(40), normalizeString(scenario.status) || 'Parcial')
    await request.query(`
      INSERT INTO dbo.ChamadoCenariosComplementares
      (CenarioId, TicketId, Descricao, ModuloId, ResultadoEsperado, ResultadoObtido, StatusCenario)
      VALUES
      (@cenarioId, @ticketId, @descricao, @moduloId, @resultadoEsperado, @resultadoObtido, @statusCenario)
    `)
  }
}

async function saveClassification(transaction, ticketId, classification) {
  const request = transaction.request()
  request.input('ticketId', sql.NVarChar(120), ticketId)
  request.input('reutilizavel', sql.Bit, Boolean(classification?.reusable))
  request.input('moduloPrincipalId', sql.Int, toNullableInt(classification?.mainModuleId))
  request.input('criticidade', sql.NVarChar(30), normalizeString(classification?.criticality) || 'Media')
  request.input('candidatoAutomacao', sql.Bit, Boolean(classification?.automationCandidate))
  request.input('nomeAutomacao', sql.NVarChar(255), normalizeString(classification?.automationName))
  await request.query(`
    MERGE dbo.ChamadoClassificacoes AS target
    USING (SELECT @ticketId AS TicketId) AS src
    ON target.TicketId = src.TicketId
    WHEN MATCHED THEN
      UPDATE SET
        Reutilizavel = @reutilizavel,
        ModuloPrincipalId = @moduloPrincipalId,
        Criticidade = @criticidade,
        CandidatoAutomacao = @candidatoAutomacao,
        NomeAutomacao = @nomeAutomacao,
        DataAtualizacao = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (TicketId, Reutilizavel, ModuloPrincipalId, Criticidade, CandidatoAutomacao, NomeAutomacao)
      VALUES (@ticketId, @reutilizavel, @moduloPrincipalId, @criticidade, @candidatoAutomacao, @nomeAutomacao);
  `)

  const deleteRequest = transaction.request()
  deleteRequest.input('ticketId', sql.NVarChar(120), ticketId)
  await deleteRequest.query('DELETE FROM dbo.ChamadoClassificacaoModulosImpactados WHERE TicketId = @ticketId')

  for (const moduleId of Array.isArray(classification?.impactedModuleIds) ? classification.impactedModuleIds : []) {
    const insertRequest = transaction.request()
    insertRequest.input('ticketId', sql.NVarChar(120), ticketId)
    insertRequest.input('moduloId', sql.Int, toNullableInt(moduleId))
    await insertRequest.query(`
      INSERT INTO dbo.ChamadoClassificacaoModulosImpactados (TicketId, ModuloId)
      VALUES (@ticketId, @moduloId)
    `)
  }
}

async function savePromptSelections(transaction, ticketId, selectedFunctionalDocumentIds) {
  const deleteRequest = transaction.request()
  deleteRequest.input('ticketId', sql.NVarChar(120), ticketId)
  await deleteRequest.query('DELETE FROM dbo.ChamadoDocumentosSelecionadosPrompt WHERE TicketId = @ticketId')

  for (const documentId of Array.isArray(selectedFunctionalDocumentIds) ? selectedFunctionalDocumentIds : []) {
    const insertRequest = transaction.request()
    insertRequest.input('ticketId', sql.NVarChar(120), ticketId)
    insertRequest.input('documentoId', sql.NVarChar(80), normalizeString(documentId))
    await insertRequest.query(`
      INSERT INTO dbo.ChamadoDocumentosSelecionadosPrompt (TicketId, DocumentoId)
      VALUES (@ticketId, @documentoId)
    `)
  }
}

export async function saveWorkflowProgress(ticketId, payload, auth) {
  const pool = await getPool()
  const updatedAt = new Date().toISOString()
  const lifecycleStatus = payload.lifecycleStatus || 'Em andamento'
  const finalizedAt = lifecycleStatus === 'Finalizado' ? payload.finalizedAt || updatedAt : null
  const ownerUserId = auth?.userId || ''
  const ownerName = auth?.name || ''

  if (!pool) {
    const draft = { ...payload, lifecycleStatus, finalizedAt, updatedAt, createdByUserId: ownerUserId, ownerName }
    await writeLegacyWorkflow(ticketId, draft)
    return { ok: true, updatedAt }
  }

  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const ownershipRequest = transaction.request()
    ownershipRequest.input('ticketId', sql.NVarChar(120), ticketId)
    const ownershipResult = await ownershipRequest.query(`
      SELECT TOP 1 CreatedByUserId
      FROM dbo.Chamados
      WHERE TicketId = @ticketId
    `)
    const existingOwnerUserId = ownershipResult.recordset[0]?.CreatedByUserId || ''
    if (existingOwnerUserId && !canAccessOwnedRecord(auth, existingOwnerUserId)) {
      throw new Error('Acesso restrito ao workspace deste QA.')
    }

    const areaId = await resolveAreaIdByName(transaction, payload.ticket?.portalArea)
    const request = transaction.request()
    request.input('ticketId', sql.NVarChar(120), ticketId)
    request.input('titulo', sql.NVarChar(300), normalizeString(payload.ticket?.title) || 'Chamado salvo')
    request.input('descricaoProblemaCliente', sql.NVarChar(sql.MAX), normalizeString(payload.ticket?.customerProblemDescription))
    request.input('projetoId', sql.Int, toNullableInt(payload.ticket?.projectId))
    request.input('tipoProduto', sql.NVarChar(50), normalizeString(payload.ticket?.productType))
    request.input('areaId', sql.Int, areaId)
    request.input('portalAreaNome', sql.NVarChar(120), normalizeString(payload.ticket?.portalArea))
    request.input('moduloId', sql.Int, toNullableInt(payload.ticket?.moduleId))
    request.input('ambiente', sql.NVarChar(120), normalizeString(payload.ticket?.environment))
    request.input('versao', sql.NVarChar(120), normalizeString(payload.ticket?.version))
    request.input('origem', sql.NVarChar(80), normalizeString(payload.ticket?.origin))
    request.input('baseReferencia', sql.NVarChar(sql.MAX), normalizeString(payload.ticket?.baseReference))
    request.input('accessUrl', sql.NVarChar(500), normalizeString(payload.ticket?.accessUrl))
    request.input('usuarioAcesso', sql.NVarChar(150), normalizeString(payload.ticket?.username))
    request.input('senhaAcesso', sql.NVarChar(150), normalizeString(payload.ticket?.password))
    request.input('empresaCodigo', sql.NVarChar(80), normalizeString(payload.ticket?.companyCode))
    request.input('unidadeCodigo', sql.NVarChar(80), normalizeString(payload.ticket?.unitCode))
    request.input('branchName', sql.NVarChar(255), normalizeString(payload.ticket?.branchName))
    request.input('changelogDev', sql.NVarChar(sql.MAX), normalizeString(payload.ticket?.developerChangelog))
    request.input('documentoBaseNome', sql.NVarChar(255), normalizeString(payload.ticket?.documentoBaseName))
    request.input('currentStep', sql.Int, Number(payload.currentStep || 0))
    request.input('lifecycleStatus', sql.NVarChar(40), lifecycleStatus)
    request.input('aiResponse', sql.NVarChar(sql.MAX), normalizeString(payload.aiResponse))
    request.input('dataFinalizacao', sql.DateTime2, finalizedAt ? new Date(finalizedAt) : null)
    request.input('createdByUserId', sql.NVarChar(120), ownerUserId || null)
    request.input('updatedByUserId', sql.NVarChar(120), ownerUserId || null)
    await request.query(`
      MERGE dbo.Chamados AS target
      USING (SELECT @ticketId AS TicketId) AS src
      ON target.TicketId = src.TicketId
      WHEN MATCHED THEN
        UPDATE SET
          Titulo = @titulo,
          DescricaoProblemaCliente = @descricaoProblemaCliente,
          ProjetoId = @projetoId,
          TipoProduto = @tipoProduto,
          AreaId = @areaId,
          PortalAreaNome = @portalAreaNome,
          ModuloId = @moduloId,
          Ambiente = @ambiente,
          Versao = @versao,
          Origem = @origem,
          BaseReferencia = @baseReferencia,
          AccessUrl = @accessUrl,
          UsuarioAcesso = @usuarioAcesso,
          SenhaAcesso = @senhaAcesso,
          EmpresaCodigo = @empresaCodigo,
          UnidadeCodigo = @unidadeCodigo,
          BranchName = @branchName,
          ChangelogDev = @changelogDev,
          DocumentoBaseNome = @documentoBaseNome,
          CurrentStep = @currentStep,
          LifecycleStatus = @lifecycleStatus,
          AiResponse = @aiResponse,
          CreatedByUserId = ISNULL(target.CreatedByUserId, @createdByUserId),
          UpdatedByUserId = @updatedByUserId,
          DataAtualizacao = SYSDATETIME(),
          DataFinalizacao = @dataFinalizacao
      WHEN NOT MATCHED THEN
        INSERT
        (TicketId, Titulo, DescricaoProblemaCliente, ProjetoId, TipoProduto, AreaId, PortalAreaNome, ModuloId, Ambiente, Versao, Origem, BaseReferencia, AccessUrl, UsuarioAcesso, SenhaAcesso, EmpresaCodigo, UnidadeCodigo, BranchName, ChangelogDev, DocumentoBaseNome, CurrentStep, LifecycleStatus, AiResponse, DataFinalizacao, CreatedByUserId, UpdatedByUserId)
        VALUES
        (@ticketId, @titulo, @descricaoProblemaCliente, @projetoId, @tipoProduto, @areaId, @portalAreaNome, @moduloId, @ambiente, @versao, @origem, @baseReferencia, @accessUrl, @usuarioAcesso, @senhaAcesso, @empresaCodigo, @unidadeCodigo, @branchName, @changelogDev, @documentoBaseNome, @currentStep, @lifecycleStatus, @aiResponse, @dataFinalizacao, @createdByUserId, @updatedByUserId);
    `)

    await saveAttachments(transaction, ticketId, payload.ticket?.supportAttachments)
    await saveProblem(transaction, ticketId, payload.problem)
    await saveRetest(transaction, ticketId, payload.retest)
    await saveScenarios(transaction, ticketId, payload.scenarios)
    await saveClassification(transaction, ticketId, payload.classification)
    await savePromptSelections(transaction, ticketId, payload.selectedFunctionalDocumentIds)

    await transaction.commit()

    await writeLegacyWorkflow(ticketId, {
      ...payload,
      lifecycleStatus,
      finalizedAt,
      updatedAt,
      createdByUserId: ownerUserId,
      ownerName,
    })

    return { ok: true, updatedAt }
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

function mapWorkflowFromRecordsets(recordsets, ticketId) {
  const ticket = recordsets.ticket?.[0]
  if (!ticket) return null

  const frames = (recordsets.frames ?? []).map((frame) => ({
    id: frame.QuadroId,
    name: frame.Nome,
    imageUrl: resolveStoredAssetUrl(ticketId, frame),
    timestampLabel: frame.TimestampLabel || '00:00',
    description: frame.Descricao || '',
    fileName: frame.FileName || undefined,
    downloadUrl: resolveStoredAssetUrl(ticketId, frame) || undefined,
    persistedAt: frame.PersistedAt ? new Date(frame.PersistedAt).toISOString() : undefined,
    annotations: frame.AnnotationsJson ? JSON.parse(frame.AnnotationsJson) : [],
    editHistory: frame.EditHistoryJson ? JSON.parse(frame.EditHistoryJson) : [],
  }))

  const stepFramesMap = new Map()
  for (const link of recordsets.stepFrames ?? []) {
    const existing = stepFramesMap.get(link.PassoId) ?? []
    existing.push({ quadroId: link.QuadroId, ordem: link.Ordem })
    stepFramesMap.set(link.PassoId, existing)
  }

  const steps = (recordsets.steps ?? []).map((step) => ({
    id: step.PassoId,
    status: step.StatusPasso,
    frameIds: (stepFramesMap.get(step.PassoId) ?? [])
      .sort((left, right) => left.ordem - right.ordem)
      .map((item) => item.quadroId),
  }))

  return {
    currentStep: Number(ticket.CurrentStep || 0),
    ticket: {
      ticketId: ticket.TicketId || ticketId,
      title: ticket.Titulo || '',
      customerProblemDescription: ticket.DescricaoProblemaCliente || '',
      projectId: ticket.ProjetoId ? String(ticket.ProjetoId) : '',
      productType: ticket.TipoProduto || 'Portal',
      portalArea: ticket.PortalAreaNome || '',
      moduleId: ticket.ModuloId ? String(ticket.ModuloId) : '',
      environment: ticket.Ambiente || '',
      version: ticket.Versao || '',
      origin: ticket.Origem || 'Suporte',
      baseReference: ticket.BaseReferencia || '',
      accessUrl: ticket.AccessUrl || '',
      username: ticket.UsuarioAcesso || '',
      password: ticket.SenhaAcesso || '',
      companyCode: ticket.EmpresaCodigo || '',
      unitCode: ticket.UnidadeCodigo || '',
      branchName: ticket.BranchName || '',
      developerChangelog: ticket.ChangelogDev || '',
      documentoBaseName: ticket.DocumentoBaseNome || '',
      supportAttachments: (recordsets.attachments ?? []).map((item) => item.NomeArquivo),
    },
    problem: {
      problemDescription: recordsets.problem?.[0]?.DescricaoEstruturada || '',
      initialAnalysis: recordsets.problem?.[0]?.AnaliseInicial || '',
      expectedBehavior: recordsets.problem?.[0]?.ComportamentoEsperado || '',
      reportedBehavior: recordsets.problem?.[0]?.ComportamentoRelatado || '',
      relatedDocumentation: recordsets.problem?.[0]?.DocumentacaoRelacionada || '',
      testData: recordsets.problem?.[0]?.DadosTeste || '',
    },
    retest: {
      preconditions: recordsets.retest?.[0]?.PreCondicoes || '',
      gifName: recordsets.retest?.[0]?.GifName || '',
      gifPreviewUrl: recordsets.retest?.[0]?.GifPreviewUrl || '',
      frames,
      steps,
      obtainedBehavior: recordsets.retest?.[0]?.ComportamentoObtido || '',
      status: recordsets.retest?.[0]?.StatusReteste || 'Parcial',
      uploads: [],
    },
    scenarios: (recordsets.scenarios ?? []).map((scenario) => ({
      id: scenario.CenarioId,
      description: scenario.Descricao,
      moduleId: scenario.ModuloId ? String(scenario.ModuloId) : '',
      expectedResult: scenario.ResultadoEsperado || '',
      obtainedResult: scenario.ResultadoObtido || '',
      status: scenario.StatusCenario || 'Parcial',
    })),
    classification: {
      reusable: Boolean(recordsets.classification?.[0]?.Reutilizavel),
      mainModuleId: recordsets.classification?.[0]?.ModuloPrincipalId
        ? String(recordsets.classification[0].ModuloPrincipalId)
        : '',
      impactedModuleIds: (recordsets.impactedModules ?? []).map((row) => String(row.ModuloId)),
      criticality: recordsets.classification?.[0]?.Criticidade || 'Media',
      automationCandidate: Boolean(recordsets.classification?.[0]?.CandidatoAutomacao),
      automationName: recordsets.classification?.[0]?.NomeAutomacao || '',
    },
    aiResponse: ticket.AiResponse || '',
    lifecycleStatus: ticket.LifecycleStatus || 'Em andamento',
    finalizedAt: ticket.DataFinalizacao ? new Date(ticket.DataFinalizacao).toISOString() : null,
    selectedFunctionalDocumentIds: (recordsets.selectedDocs ?? []).map((row) => row.DocumentoId),
    historyRecordIds: [],
    updatedAt: ticket.DataAtualizacao ? new Date(ticket.DataAtualizacao).toISOString() : new Date().toISOString(),
    createdByUserId: ticket.CreatedByUserId || '',
    ownerName: ticket.OwnerName || '',
  }
}

export async function loadWorkflowProgress(ticketId, auth) {
  const pool = await getPool()

  if (!pool) {
    const legacyDraft = await readLegacyWorkflow(ticketId)
    if (!auth || canAccessOwnedRecord(auth, legacyDraft?.createdByUserId)) {
      return legacyDraft
    }
    throw new Error('Acesso restrito ao workspace deste QA.')
  }

  const request = createRequest(pool)
  request.input('ticketId', sql.NVarChar(120), ticketId)
  const result = await request.query(`
    SELECT c.*, ownerUser.Nome AS OwnerName
    FROM dbo.Chamados c
    LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = c.CreatedByUserId
    WHERE c.TicketId = @ticketId;
    SELECT * FROM dbo.ChamadoAnexosSuporte WHERE TicketId = @ticketId ORDER BY Id;
    SELECT * FROM dbo.ChamadoProblemas WHERE TicketId = @ticketId;
    SELECT * FROM dbo.ChamadoRetestes WHERE TicketId = @ticketId;
    SELECT * FROM dbo.ChamadoRetesteQuadros WHERE TicketId = @ticketId ORDER BY OrdemExibicao;
    SELECT * FROM dbo.ChamadoRetestePassos WHERE TicketId = @ticketId ORDER BY Ordem;
    SELECT * FROM dbo.ChamadoRetestePassoQuadros WHERE PassoId IN (SELECT PassoId FROM dbo.ChamadoRetestePassos WHERE TicketId = @ticketId);
    SELECT * FROM dbo.ChamadoCenariosComplementares WHERE TicketId = @ticketId ORDER BY DataCriacao;
    SELECT * FROM dbo.ChamadoClassificacoes WHERE TicketId = @ticketId;
    SELECT * FROM dbo.ChamadoClassificacaoModulosImpactados WHERE TicketId = @ticketId;
    SELECT * FROM dbo.ChamadoDocumentosSelecionadosPrompt WHERE TicketId = @ticketId;
  `)

  const draft = mapWorkflowFromRecordsets(
    {
      ticket: result.recordsets[0],
      attachments: result.recordsets[1],
      problem: result.recordsets[2],
      retest: result.recordsets[3],
      frames: result.recordsets[4],
      steps: result.recordsets[5],
      stepFrames: result.recordsets[6],
      scenarios: result.recordsets[7],
      classification: result.recordsets[8],
      impactedModules: result.recordsets[9],
      selectedDocs: result.recordsets[10],
    },
    ticketId,
  )

  if (draft) {
    if (!canAccessOwnedRecord(auth, draft.createdByUserId)) {
      throw new Error('Acesso restrito ao workspace deste QA.')
    }
    return mergeScenarioEvidenceFromLegacy(ticketId, draft)
  }

  const legacyDraft = await readLegacyWorkflow(ticketId)
  if (!auth || canAccessOwnedRecord(auth, legacyDraft?.createdByUserId)) {
    return legacyDraft
  }
  throw new Error('Acesso restrito ao workspace deste QA.')
}

export async function listWorkflowProgress(auth, requestedScope) {
  const pool = await getPool()
  const legacySummaries = await listLegacyWorkflowProgress(auth)
  if (!pool) return legacySummaries
  const scope = resolveWorkspaceScope(auth, requestedScope)

  const request = createRequest(pool)
  request.input('scope', sql.NVarChar(10), scope)
  request.input('userId', sql.NVarChar(120), auth?.userId || '')
  const result = await request.query(`
    SELECT CAST(Id AS VARCHAR(20)) AS projectId
    FROM dbo.Projetos
    WHERE Ativo = 1;

    SELECT CAST(Id AS VARCHAR(20)) AS moduleId
    FROM dbo.Modulos
    WHERE Ativo = 1;

    SELECT
      c.TicketId AS ticketId,
      c.Titulo AS title,
      c.DataAtualizacao AS updatedAt,
      CAST(c.ProjetoId AS VARCHAR(20)) AS projectId,
      CAST(c.ModuloId AS VARCHAR(20)) AS moduleId,
      ISNULL(r.StatusReteste, 'Parcial') AS status,
      c.LifecycleStatus AS lifecycleStatus,
      c.DataFinalizacao AS finalizedAt,
      c.Ambiente AS environment,
      c.Versao AS version,
      c.CurrentStep AS currentStep,
      c.CreatedByUserId AS createdByUserId,
      ownerUser.Nome AS ownerName,
      (SELECT COUNT(1) FROM dbo.ChamadoRetesteQuadros q WHERE q.TicketId = c.TicketId) AS framesCount,
      (SELECT COUNT(1) FROM dbo.ChamadoCenariosComplementares cc WHERE cc.TicketId = c.TicketId) AS scenariosCount,
      (SELECT COUNT(1) FROM dbo.HistoricoTestes h WHERE h.TicketId = c.TicketId) AS historyRecordsCount
    FROM dbo.Chamados c
    LEFT JOIN dbo.ChamadoRetestes r ON r.TicketId = c.TicketId
    LEFT JOIN dbo.UsuariosQaOrbit ownerUser ON ownerUser.UserId = c.CreatedByUserId
    WHERE @scope = 'all' OR c.CreatedByUserId = @userId
    ORDER BY c.DataAtualizacao DESC
  `)

  const activeProjectIds = new Set((result.recordsets[0] ?? []).map((row) => String(row.projectId || '')))
  const activeModuleIds = new Set((result.recordsets[1] ?? []).map((row) => String(row.moduleId || '')))

  const dbSummaries = (result.recordsets[2] ?? []).map((row) => ({
    ...row,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    finalizedAt: row.finalizedAt ? new Date(row.finalizedAt).toISOString() : null,
    currentStep: Number(row.currentStep || 0),
    framesCount: Number(row.framesCount || 0),
    scenariosCount: Number(row.scenariosCount || 0),
    historyRecordsCount: Number(row.historyRecordsCount || 0),
  }))

  const merged = new Map(dbSummaries.map((item) => [item.ticketId, item]))
  for (const legacy of legacySummaries) {
    if (legacy.projectId && !activeProjectIds.has(String(legacy.projectId))) continue
    if (legacy.moduleId && !activeModuleIds.has(String(legacy.moduleId))) continue

    if (!merged.has(legacy.ticketId)) {
      merged.set(legacy.ticketId, legacy)
    }
  }

  return [...merged.values()].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export async function updateWorkflowLifecycleStatus(ticketId, lifecycleStatus, auth) {
  const pool = await getPool()
  const updatedAt = new Date().toISOString()
  const finalizedAt = lifecycleStatus === 'Finalizado' ? updatedAt : null

  if (!pool) {
    const legacy = await readLegacyWorkflow(ticketId)
    if (auth && !canAccessOwnedRecord(auth, legacy?.createdByUserId)) {
      throw new Error('Acesso restrito ao workspace deste QA.')
    }
    await writeLegacyWorkflow(ticketId, {
      ...legacy,
      lifecycleStatus,
      finalizedAt,
      updatedAt,
      createdByUserId: legacy?.createdByUserId || auth?.userId || '',
      ownerName: legacy?.ownerName || auth?.name || '',
    })
    return { ok: true, lifecycleStatus, finalizedAt, updatedAt }
  }

  const request = createRequest(pool)
  const ownershipCheck = createRequest(pool)
  ownershipCheck.input('ticketId', sql.NVarChar(120), ticketId)
  const ownershipResult = await ownershipCheck.query(`
    SELECT TOP 1 CreatedByUserId
    FROM dbo.Chamados
    WHERE TicketId = @ticketId
  `)
  const existingOwnerUserId = ownershipResult.recordset[0]?.CreatedByUserId || ''
  if (existingOwnerUserId && !canAccessOwnedRecord(auth, existingOwnerUserId)) {
    throw new Error('Acesso restrito ao workspace deste QA.')
  }

  request.input('ticketId', sql.NVarChar(120), ticketId)
  request.input('lifecycleStatus', sql.NVarChar(40), lifecycleStatus)
  request.input('finalizedAt', sql.DateTime2, finalizedAt ? new Date(finalizedAt) : null)
  request.input('updatedByUserId', sql.NVarChar(120), auth?.userId || null)
  request.input('userId', sql.NVarChar(120), auth?.userId || '')
  request.input('scope', sql.NVarChar(10), resolveWorkspaceScope(auth, 'mine'))
  await request.query(`
    UPDATE dbo.Chamados
    SET LifecycleStatus = @lifecycleStatus,
        DataFinalizacao = @finalizedAt,
        UpdatedByUserId = @updatedByUserId,
        DataAtualizacao = SYSDATETIME()
    WHERE TicketId = @ticketId
      AND (@scope = 'all' OR CreatedByUserId = @userId)
  `)

  try {
    const legacy = await readLegacyWorkflow(ticketId)
    await writeLegacyWorkflow(ticketId, {
      ...legacy,
      lifecycleStatus,
      finalizedAt,
      updatedAt,
    })
  } catch {
    // compatibilidade opcional
  }

  return { ok: true, lifecycleStatus, finalizedAt, updatedAt }
}

export async function deleteWorkflowProgress(ticketId, auth) {
  const pool = await getPool()

  if (!pool) {
    const legacy = await readLegacyWorkflow(ticketId)
    if (auth && !canAccessOwnedRecord(auth, legacy?.createdByUserId)) {
      throw new Error('Acesso restrito ao workspace deste QA.')
    }
    await fs.rm(ticketDirectory(ticketId), { recursive: true, force: true })
    return { ok: true }
  }

  const ownershipCheck = createRequest(pool)
  ownershipCheck.input('ticketId', sql.NVarChar(120), ticketId)
  const ownershipResult = await ownershipCheck.query(`
    SELECT TOP 1 CreatedByUserId
    FROM dbo.Chamados
    WHERE TicketId = @ticketId
  `)
  const existingOwnerUserId = ownershipResult.recordset[0]?.CreatedByUserId || ''
  if (existingOwnerUserId && !canAccessOwnedRecord(auth, existingOwnerUserId)) {
    throw new Error('Acesso restrito ao workspace deste QA.')
  }

  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const cleanup = transaction.request()
    cleanup.input('ticketId', sql.NVarChar(120), ticketId)
    await cleanup.query(`
      DELETE FROM dbo.HistoricoRelacionamentos
      WHERE HistoricoOrigemId IN (SELECT HistoricoId FROM dbo.HistoricoTestes WHERE TicketId = @ticketId)
         OR HistoricoRelacionadoId IN (SELECT HistoricoId FROM dbo.HistoricoTestes WHERE TicketId = @ticketId);

      DELETE FROM dbo.HistoricoTesteModulosImpactados
      WHERE HistoricoId IN (SELECT HistoricoId FROM dbo.HistoricoTestes WHERE TicketId = @ticketId);

      DELETE FROM dbo.HistoricoTesteTags
      WHERE HistoricoId IN (SELECT HistoricoId FROM dbo.HistoricoTestes WHERE TicketId = @ticketId);

      DELETE FROM dbo.HistoricoTesteQuadros
      WHERE HistoricoId IN (SELECT HistoricoId FROM dbo.HistoricoTestes WHERE TicketId = @ticketId);

      DELETE FROM dbo.HistoricoTestes
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.BugPromptsIA
      WHERE BugId IN (SELECT BugId FROM dbo.Bugs WHERE TicketId = @ticketId);

      DELETE FROM dbo.BugPassosReproducao
      WHERE BugId IN (SELECT BugId FROM dbo.Bugs WHERE TicketId = @ticketId);

      DELETE FROM dbo.BugQuadros
      WHERE BugId IN (SELECT BugId FROM dbo.Bugs WHERE TicketId = @ticketId);

      DELETE FROM dbo.Bugs
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoPromptsIA
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoRetestePassoQuadros
      WHERE PassoId IN (SELECT PassoId FROM dbo.ChamadoRetestePassos WHERE TicketId = @ticketId);

      DELETE FROM dbo.ChamadoRetestePassos
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoRetesteQuadros
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoRetestes
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoCenariosComplementares
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoClassificacaoModulosImpactados
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoClassificacoes
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoDocumentosSelecionadosPrompt
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoProblemas
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.ChamadoAnexosSuporte
      WHERE TicketId = @ticketId;

      DELETE FROM dbo.Chamados
      WHERE TicketId = @ticketId;
    `)

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }

  await fs.rm(ticketDirectory(ticketId), { recursive: true, force: true }).catch(() => undefined)
  return { ok: true }
}

async function listLegacyWorkflowProgress(auth) {
  const chamadosDirectory = path.join(storageRoot, 'chamados')
  const entries = await fs.readdir(chamadosDirectory, { withFileTypes: true }).catch(() => [])
  const saved = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const draft = await readLegacyWorkflow(entry.name)
      if (auth && !canAccessOwnedRecord(auth, draft.createdByUserId)) continue
      saved.push({
        ticketId: draft.ticket?.ticketId || entry.name,
        title: draft.ticket?.title || 'Chamado salvo',
        updatedAt: draft.updatedAt || new Date().toISOString(),
        projectId: draft.ticket?.projectId || '',
        moduleId: draft.ticket?.moduleId || '',
        status: draft.retest?.status || 'Parcial',
        lifecycleStatus: draft.lifecycleStatus || 'Em andamento',
        finalizedAt: draft.finalizedAt || null,
        environment: draft.ticket?.environment || '',
        version: draft.ticket?.version || '',
        currentStep: Number(draft.currentStep || 0),
        framesCount: Array.isArray(draft.retest?.frames) ? draft.retest.frames.length : 0,
        scenariosCount: Array.isArray(draft.scenarios) ? draft.scenarios.length : 0,
        historyRecordsCount: Array.isArray(draft.historyRecordIds) ? draft.historyRecordIds.length : 0,
        createdByUserId: draft.createdByUserId || '',
        ownerName: draft.ownerName || '',
      })
    } catch {
      continue
    }
  }

  return saved
}
