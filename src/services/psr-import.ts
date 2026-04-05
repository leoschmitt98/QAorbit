import JSZip from 'jszip'
import type { ProblemStructuring, TicketContext } from '@/types/domain'

export interface PsrImportResult {
  ticketUpdates: Partial<TicketContext>
  problemUpdates: Partial<ProblemStructuring>
  rawText: string
}

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function cleanMultilineText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function extractAnswer(text: string, questionNumber: 1 | 2 | 3 | 4) {
  const nextQuestion = questionNumber === 4 ? '' : `${questionNumber + 1}\\s*[\\.)]`
  const regex = new RegExp(
    `${questionNumber}\\s*[\\.)]\\s*[^?]+\\?\\s*([\\s\\S]*?)${nextQuestion ? `(?=${nextQuestion})` : '$'}`,
    'i',
  )
  return cleanMultilineText(text.match(regex)?.[1] || '')
}

function extractValue(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i')
  return cleanText(text.match(regex)?.[1] || '')
}

function extractBetween(text: string, start: RegExp, end?: RegExp) {
  const startMatch = start.exec(text)
  if (!startMatch) return ''

  const afterStart = text.slice(startMatch.index + startMatch[0].length)
  if (!end) return cleanMultilineText(afterStart)

  const endMatch = end.exec(afterStart)
  return cleanMultilineText(endMatch ? afterStart.slice(0, endMatch.index) : afterStart)
}

function extractAccessBlock(text: string) {
  const lines = [
    text.match(/\[\s*([^\]]+)\s*\]/)?.[0] || '',
    text.match(/ConnectionName\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/DriverName\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/LibraryName\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/GetDriverFunc\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/VendorLib\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/BlobSize\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/DataBase\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/User_Name\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/Password\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/PasswordRequired\s*=\s*[^\n]+/i)?.[0] || '',
    text.match(/EnableBCD\s*=\s*[^\n]+/i)?.[0] || '',
  ]

  return cleanMultilineText(lines.filter(Boolean).join('\n'))
}

function extractPassword(text: string) {
  return cleanText(text.match(/Password\s*=\s*([^\n]+)/i)?.[1] || '')
}

export async function importPsrDocument(file: File): Promise<PsrImportResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentXml = await zip.file('word/document.xml')?.async('string')

  if (!documentXml) {
    throw new Error('Nao foi possivel localizar o conteudo principal do arquivo .docx.')
  }

  const paragraphMatches = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? []
  const paragraphs = paragraphMatches
    .map((paragraphXml) => {
      const textParts = Array.from(paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map((match) =>
        match[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
      )
      return cleanText(textParts.join(' '))
    })
    .filter(Boolean)

  const rawText = cleanMultilineText(paragraphs.join('\n'))

  const ticketId = extractValue(rawText, 'Numero do chamado')
  const version = extractValue(rawText, 'Versao Sistema')
  const dllVersion = extractValue(rawText, 'Versao DLL')
  const username = extractValue(rawText, 'Usuario')
  const companyUnitMatch = rawText.match(/Empresa\/Unidade\s*:\s*([^\s/]+)\s*\/\s*([^\s]+)/i)
  const question1 = extractAnswer(rawText, 1)
  const question2 = extractAnswer(rawText, 2)
  const question3 = extractAnswer(rawText, 3)
  const question4 = extractAnswer(rawText, 4) || extractBetween(rawText, /Informe a base de dados utilizada[^:]*:/i)
  const accessUrl = rawText.match(/https?:\/\/[^\s]+/i)?.[0] || ''
  const baseReference =
    question4 && /(ConnectionName|DataBase|User_Name|PasswordRequired|EnableBCD|\[.+\])/i.test(question4)
      ? question4
      : extractAccessBlock(rawText) || question4
  const branchName = cleanText(dllVersion.replace(/^vers[aã]o\s+/i, ''))
  const password = extractPassword(rawText)

  return {
    ticketUpdates: {
      ticketId,
      version,
      username,
      password,
      companyCode: companyUnitMatch?.[1] || '',
      unitCode: companyUnitMatch?.[2] || '',
      branchName,
      accessUrl,
      baseReference,
      documentoBaseName: file.name,
    },
    problemUpdates: {
      problemDescription: question1,
      expectedBehavior: question2,
      initialAnalysis: question3 ? `Passo a passo do suporte:\n${question3}` : '',
      testData: question4,
    },
    rawText,
  }
}
