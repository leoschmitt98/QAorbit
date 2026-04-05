param(
  [string[]]$TicketIds,
  [string]$ApiBase = "http://localhost:3001",
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$storageChamados = Join-Path $repoRoot "storage\chamados"

if (-not (Test-Path $storageChamados)) {
  throw "Pasta de chamados nao encontrada em $storageChamados"
}

function Get-HistoryIndex {
  param([string]$BaseUrl)

  try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/historico-testes" -Method Get
    if ($null -eq $response) { return @() }
    return @($response)
  } catch {
    throw "Nao foi possivel consultar a API de historico. Confirme se o backend esta rodando em $BaseUrl."
  }
}

function New-HistoryPayload {
  param(
    [string]$WorkflowPath
  )

  $workflow = Get-Content -Path $WorkflowPath -Raw | ConvertFrom-Json
  $ticket = $workflow.ticket
  $problem = $workflow.problem
  $retest = $workflow.retest
  $classification = $workflow.classification

  if ([string]::IsNullOrWhiteSpace($ticket.ticketId)) {
    return $null
  }

  $mainModuleId = if (-not [string]::IsNullOrWhiteSpace($classification.mainModuleId)) {
    [string]$classification.mainModuleId
  } else {
    [string]$ticket.moduleId
  }

  if ([string]::IsNullOrWhiteSpace($ticket.projectId) -or [string]::IsNullOrWhiteSpace($mainModuleId)) {
    return [pscustomobject]@{
      TicketId = [string]$ticket.ticketId
      Reason = "Workflow sem projeto ou modulo principal preenchido."
      Payload = $null
    }
  }

  $flowScenario = if (-not [string]::IsNullOrWhiteSpace($ticket.title)) {
    [string]$ticket.title
  } elseif (-not [string]::IsNullOrWhiteSpace($problem.problemDescription)) {
    [string]$problem.problemDescription
  } else {
    "Fluxo do chamado $($ticket.ticketId)"
  }

  $payload = [ordered]@{
    ticketId = [string]$ticket.ticketId
    projectId = [string]$ticket.projectId
    modulePrincipalId = $mainModuleId
    portalArea = [string]$ticket.portalArea
    fluxoCenario = $flowScenario
    resumoProblema = if (-not [string]::IsNullOrWhiteSpace($problem.problemDescription)) { [string]$problem.problemDescription } else { [string]$ticket.customerProblemDescription }
    comportamentoEsperado = [string]$problem.expectedBehavior
    comportamentoObtido = if (-not [string]::IsNullOrWhiteSpace($retest.obtainedBehavior)) { [string]$retest.obtainedBehavior } else { [string]$problem.reportedBehavior }
    resultadoFinal = if (-not [string]::IsNullOrWhiteSpace($retest.status)) { [string]$retest.status } else { "Parcial" }
    criticidade = if (-not [string]::IsNullOrWhiteSpace($classification.criticality)) { [string]$classification.criticality } else { "Media" }
    modulosImpactados = @($classification.impactedModuleIds)
    tags = @()
    temAutomacao = $false
    frameworkAutomacao = ""
    caminhoSpec = ""
    chamadoTitulo = [string]$ticket.title
  }

  return [pscustomobject]@{
    TicketId = [string]$ticket.ticketId
    Reason = ""
    Payload = $payload
  }
}

$historyIndex = Get-HistoryIndex -BaseUrl $ApiBase
$existingTickets = @{}
foreach ($item in $historyIndex) {
  if (-not [string]::IsNullOrWhiteSpace($item.ticketId)) {
    $existingTickets[[string]$item.ticketId] = $true
  }
}

$workflowFiles =
  if ($TicketIds -and $TicketIds.Count -gt 0) {
    foreach ($ticketId in $TicketIds) {
      Join-Path $storageChamados "$ticketId\workflow.json"
    }
  } else {
    Get-ChildItem -Path $storageChamados -Filter "workflow.json" -Recurse -File | Select-Object -ExpandProperty FullName
  }

if (-not $workflowFiles -or $workflowFiles.Count -eq 0) {
  throw "Nenhum workflow encontrado para processar."
}

$created = @()
$skipped = @()

foreach ($workflowFile in $workflowFiles) {
  if (-not (Test-Path $workflowFile)) {
    $skipped += "Arquivo nao encontrado: $workflowFile"
    continue
  }

  $entry = New-HistoryPayload -WorkflowPath $workflowFile
  if ($null -eq $entry -or $null -eq $entry.Payload) {
    $skipped += "$($entry.TicketId): $($entry.Reason)"
    continue
  }

  if (-not $Force.IsPresent -and $existingTickets.ContainsKey($entry.TicketId)) {
    $skipped += "$($entry.TicketId): historico ja existe."
    continue
  }

  if ($DryRun.IsPresent) {
    $created += "$($entry.TicketId): pronto para envio"
    continue
  }

  $json = $entry.Payload | ConvertTo-Json -Depth 20
  try {
    $response = Invoke-RestMethod `
      -Uri "$ApiBase/api/historico-testes" `
      -Method Post `
      -ContentType "application/json" `
      -Body $json

    $created += "$($entry.TicketId): criado como $($response.id)"
  } catch {
    $message = $_.Exception.Message
    $skipped += "$($entry.TicketId): falha ao criar historico. $message"
  }
}

Write-Host ""
Write-Host "Historicos criados:" -ForegroundColor Green
if ($created.Count -gt 0) {
  $created | ForEach-Object { Write-Host " - $_" }
} else {
  Write-Host " - nenhum"
}

Write-Host ""
Write-Host "Itens ignorados:" -ForegroundColor Yellow
if ($skipped.Count -gt 0) {
  $skipped | ForEach-Object { Write-Host " - $_" }
} else {
  Write-Host " - nenhum"
}
