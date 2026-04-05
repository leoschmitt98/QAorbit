import type { ProblemStructuring, TicketContext } from '@/types/domain'
import type { CatalogModulo, CatalogOption } from '@/services/catalog-api'

export interface ClipboardImportResult {
  ticketUpdates: Partial<TicketContext>
  problemUpdates: Partial<ProblemStructuring>
  rawText: string
  matchedHints: string[]
}

function cleanText(value: string) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function cleanMultilineText(value: string) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function normalize(value: string) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function findOptionIdByText(text: string, options: CatalogOption[]) {
  const normalizedText = normalize(text)
  return options.find((option) => normalizedText.includes(normalize(option.nome)))?.id || ''
}

function findModuleIdByText(text: string, modules: CatalogModulo[]) {
  const normalizedText = normalize(text)
  return modules.find((module) => normalizedText.includes(normalize(module.nome)))?.id || ''
}

function splitLines(text: string) {
  return cleanMultilineText(text)
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean)
}

function extractSingleLineValue(text: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`(?:^|\\n)${label}\\s*[:\\-]\\s*([^\\n]+)`, 'i')
    const match = text.match(regex)
    if (match?.[1]) {
      return cleanText(match[1])
    }
  }

  return ''
}

function extractLabeledValueFromLines(text: string, labels: string[]) {
  const lines = splitLines(text)
  const normalizedLabels = labels.map(normalize)

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index]
    const normalizedLine = normalize(currentLine)

    for (const label of normalizedLabels) {
      if (normalizedLine === label && lines[index + 1]) {
        return cleanText(lines[index + 1])
      }

      if (normalizedLine.startsWith(`${label}:`) || normalizedLine.startsWith(`${label} -`)) {
        return cleanText(currentLine.slice(currentLine.indexOf(':') >= 0 ? currentLine.indexOf(':') + 1 : label.length))
      }
    }
  }

  return ''
}

function extractSectionValue(text: string, labels: string[], stopLabels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(
      `(?:^|\\n)${label}\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n(?:${stopLabels.join('|')})\\s*[:\\-]|$)`,
      'i',
    )
    const match = text.match(regex)
    if (match?.[1]) {
      return cleanMultilineText(match[1])
    }
  }

  return ''
}

function extractSectionByHeading(text: string, labels: string[], stopLabels: string[]) {
  const lines = splitLines(text)
  const normalizedLabels = labels.map(normalize)
  const normalizedStops = stopLabels.map(normalize)

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index]
    const normalizedLine = normalize(currentLine)

    if (!normalizedLabels.some((label) => normalizedLine === label || normalizedLine.startsWith(`${label}:`))) {
      continue
    }

    const collected: string[] = []
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex]
      const normalizedNextLine = normalize(nextLine)

      if (normalizedStops.some((stop) => normalizedNextLine === stop || normalizedNextLine.startsWith(`${stop}:`))) {
        break
      }

      collected.push(nextLine)
    }

    return cleanMultilineText(collected.join('\n'))
  }

  return ''
}

function extractAzureTitle(text: string) {
  const lines = splitLines(text)

  for (const line of lines.slice(0, 6)) {
    const match = line.match(/^\d+\s+(.+)$/)
    if (match?.[1]) {
      return cleanText(match[1])
    }
  }

  return ''
}

function inferPortalArea(text: string, areas: CatalogOption[]) {
  const normalizedText = normalize(text)
  const directArea = areas.find((area) => normalizedText.includes(normalize(area.nome)))?.nome

  if (directArea) return directArea
  if (normalizedText.includes('professor')) return 'Professor'
  if (normalizedText.includes('aluno')) return 'Aluno'
  if (normalizedText.includes('secretaria')) return 'Secretaria'
  return ''
}

export async function importTicketClipboardContent(params: {
  text: string
  projects: CatalogOption[]
  modules: CatalogModulo[]
  areas: CatalogOption[]
}): Promise<ClipboardImportResult> {
  const rawText = cleanMultilineText(params.text)

  if (!rawText) {
    throw new Error('Cole o conteudo do chamado antes de tentar preencher automaticamente.')
  }

  const stopLabels = [
    'id',
    'ticket',
    'chamado',
    'numero do chamado',
    'titulo',
    'titulo do chamado',
    'assunto',
    'projeto',
    'produto',
    'modulo',
    'modulo principal',
    'portal',
    'area',
    'portal / area',
    'ambiente',
    'versao',
    'hotfix',
    'origem',
    'descricao',
    'descricao do problema',
    'problema',
    'relato',
    'esperado',
    'comportamento esperado',
    'obtido',
    'comportamento obtido',
    'relatado',
    'analise',
    'analise inicial',
    'changelog',
    'arquivos alterados',
    'artefatos alterados',
    'base',
    'dll/url',
    'dll',
    'url',
    'usuario',
    'senha',
    'empresa',
    'unidade',
    'branch',
  ]

  const ticketId =
    extractSingleLineValue(rawText, ['id', 'ticket', 'chamado', 'numero do chamado', 'work item']) ||
    extractLabeledValueFromLines(rawText, ['id', 'ticket', 'chamado', 'numero do chamado', 'work item']) ||
    cleanText(rawText.match(/\b\d{4,}-\d+\b/)?.[0] || '')

  const title =
    extractSingleLineValue(rawText, ['titulo', 'titulo do chamado', 'assunto', 'title']) ||
    extractLabeledValueFromLines(rawText, ['titulo', 'titulo do chamado', 'assunto', 'title']) ||
    extractAzureTitle(rawText)
  const projectId =
    findOptionIdByText(
      extractSingleLineValue(rawText, ['projeto', 'produto']) ||
        extractLabeledValueFromLines(rawText, ['projeto', 'produto', 'categoria']),
      params.projects,
    ) ||
    findOptionIdByText(rawText, params.projects)
  const portalArea =
    extractSingleLineValue(rawText, ['portal / area', 'portal', 'area']) ||
    extractLabeledValueFromLines(rawText, ['portal / area', 'portal', 'area']) ||
    inferPortalArea(rawText, params.areas) ||
    ''
  const moduleId =
    findModuleIdByText(
      extractSingleLineValue(rawText, ['modulo principal', 'modulo', 'categoria']) ||
        extractLabeledValueFromLines(rawText, ['modulo principal', 'modulo', 'categoria']),
      params.modules,
    ) ||
    findModuleIdByText(rawText, params.modules)

  const customerProblemDescription =
    extractSectionValue(
      rawText,
      ['descricao do problema', 'descricao', 'problema', 'relato', 'descricao original'],
      stopLabels,
    ) ||
    extractSectionByHeading(rawText, ['detalhes'], ['parecer do analista', 'passos para reproducao', 'changelog', 'solucao']) ||
    cleanText(
      rawText.match(/(?:^|\n)(?!parecer|passos|changelog|solucao)(.+(?:erro|mensagem|nao conseguimos|não conseguimos).+)/i)?.[1] ||
        '',
    )
  const expectedBehavior = extractSectionValue(
    rawText,
    ['comportamento esperado', 'resultado esperado', 'esperado'],
    stopLabels,
  )
  const reportedBehavior = extractSectionValue(
    rawText,
    ['comportamento obtido', 'resultado obtido', 'relatado', 'comportamento atual', 'obtido'],
    stopLabels,
  )
  const initialAnalysis = extractSectionValue(
    rawText,
    ['analise inicial', 'analise', 'observacoes', 'observacao', 'comentarios'],
    stopLabels,
  )
  const analystOpinion =
    extractSectionByHeading(
      rawText,
      ['parecer do analista', 'parecer do analista/consultor', 'parecer', 'analista/consultor'],
      ['passos para reproducao', 'changelog', 'solucao', 'setup da correcao'],
    ) || initialAnalysis
  const developerChangelog =
    extractSectionValue(
      rawText,
      ['changelog do dev', 'changelog', 'arquivos alterados', 'artefatos alterados', 'correcao aplicada'],
      stopLabels,
    ) ||
    extractSectionByHeading(rawText, ['changelog'], ['solucao', 'setup da correcao', 'versao do setup']) ||
    ''
  const environment =
    extractSingleLineValue(rawText, ['ambiente']) || extractLabeledValueFromLines(rawText, ['ambiente'])
  const version =
    extractSingleLineValue(rawText, ['versao / hotfix', 'versao', 'hotfix', 'release']) ||
    extractLabeledValueFromLines(rawText, ['versao / hotfix', 'versao', 'hotfix', 'release'])
  const origin =
    extractSingleLineValue(rawText, ['origem']) || extractLabeledValueFromLines(rawText, ['origem'])
  const companyName =
    extractSingleLineValue(rawText, ['cliente', 'empresa']) || extractLabeledValueFromLines(rawText, ['cliente', 'empresa'])

  const matchedHints = [
    ticketId ? 'ID do chamado' : '',
    title ? 'Titulo' : '',
    projectId ? 'Projeto' : '',
    portalArea ? 'Portal / Area' : '',
    moduleId ? 'Modulo principal' : '',
    customerProblemDescription ? 'Descricao do problema' : '',
    expectedBehavior ? 'Comportamento esperado' : '',
    reportedBehavior ? 'Comportamento obtido' : '',
    initialAnalysis ? 'Analise inicial' : '',
    developerChangelog ? 'Changelog do dev' : '',
  ].filter(Boolean)

  return {
    ticketUpdates: {
      ticketId,
      title,
      projectId,
      portalArea: portalArea as TicketContext['portalArea'],
      moduleId,
      environment,
      version,
      origin: (origin as TicketContext['origin']) || undefined,
      customerProblemDescription,
      baseReference:
        extractSectionValue(rawText, ['base', 'base de dados', 'conexao'], stopLabels) ||
        extractSectionByHeading(rawText, ['base', 'base de dados', 'conexao'], stopLabels),
      accessUrl:
        extractSingleLineValue(rawText, ['dll/url', 'dll', 'url']) ||
        extractLabeledValueFromLines(rawText, ['dll/url', 'dll', 'url']),
      username:
        extractSingleLineValue(rawText, ['usuario', 'login']) ||
        extractLabeledValueFromLines(rawText, ['usuario', 'login']),
      password:
        extractSingleLineValue(rawText, ['senha']) ||
        extractLabeledValueFromLines(rawText, ['senha']),
      companyCode: companyName,
      unitCode:
        extractSingleLineValue(rawText, ['unidade']) ||
        extractLabeledValueFromLines(rawText, ['unidade']),
      branchName:
        extractSingleLineValue(rawText, ['branch']) ||
        extractLabeledValueFromLines(rawText, ['branch']),
      developerChangelog,
    },
    problemUpdates: {
      problemDescription: customerProblemDescription,
      expectedBehavior,
      reportedBehavior,
      initialAnalysis: analystOpinion,
    },
    rawText,
    matchedHints,
  }
}
