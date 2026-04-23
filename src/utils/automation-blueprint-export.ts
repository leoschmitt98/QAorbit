import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import type { AutomationBlueprint, AutomationBlueprintStep } from '@/types/automation-blueprint'

function slugify(value: string) {
  return String(value || 'blueprint-automacao')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function imageUrlToBytes(imageUrl: string) {
  if (!imageUrl) return null
  const response = await fetch(imageUrl)
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

function stepToMarkdown(step: AutomationBlueprintStep) {
  return [
    `## Passo ${step.order} - ${step.title || 'Sem título'}`,
    '',
    `- Tela/Módulo: ${step.screen || '-'}`,
    `- Ação: ${step.action}`,
    `- Tipo do elemento: ${step.elementType || '-'}`,
    `- Texto visível: ${step.visibleText || '-'}`,
    `- ID: ${step.elementId || '-'}`,
    `- Classes: ${step.elementClasses.join(', ') || '-'}`,
    `- Name: ${step.elementName || '-'}`,
    `- data-testid: ${step.dataTestId || '-'}`,
    `- Seletor sugerido: ${step.suggestedSelector || '-'}`,
    `- Seletor alternativo: ${step.alternativeSelector || '-'}`,
    `- Confiança: ${step.selectorConfidence}`,
    `- Motivo: ${step.selectorReason || '-'}`,
    `- Valor digitado: ${step.typedValue || '-'}`,
    `- Resultado esperado: ${step.expectedStepResult || '-'}`,
    `- Linha Cypress: \`${step.cypressLine || '-'}\``,
    `- Observações: ${step.notes || '-'}`,
    '',
    '### HTML de referência',
    '',
    '```html',
    step.htmlReference || '<!-- sem html -->',
    '```',
    '',
  ].join('\n')
}

export function downloadBlueprintJson(blueprint: AutomationBlueprint) {
  const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: 'application/json;charset=utf-8' })
  downloadBlob(blob, `${slugify(blueprint.flowName || 'blueprint-automacao')}.json`)
}

export function downloadBlueprintMarkdown(blueprint: AutomationBlueprint) {
  const content = [
    `# ${blueprint.flowName || 'Blueprint de automação'}`,
    '',
    `- Sistema/Portal: ${blueprint.system || '-'}`,
    `- Módulo: ${blueprint.module || '-'}`,
    `- Objetivo: ${blueprint.objective || '-'}`,
    `- Pré-condições: ${blueprint.preconditions || '-'}`,
    `- Massa de teste: ${blueprint.testData || '-'}`,
    `- Resultado esperado final: ${blueprint.expectedResult || '-'}`,
    '',
    '# Passos',
    '',
    ...blueprint.steps.map(stepToMarkdown),
    '# Preview Cypress',
    '',
    '```javascript',
    ...blueprint.steps.map((step) => step.cypressLine || '// passo sem linha cypress'),
    '```',
    '',
  ].join('\n')

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, `${slugify(blueprint.flowName || 'blueprint-automacao')}.md`)
}

export async function downloadBlueprintDocx(blueprint: AutomationBlueprint) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: blueprint.flowName || 'Blueprint de automação', bold: true })],
    }),
    new Paragraph({ text: `Sistema/Portal: ${blueprint.system || '-'}` }),
    new Paragraph({ text: `Módulo: ${blueprint.module || '-'}` }),
    new Paragraph({ text: `Objetivo: ${blueprint.objective || '-'}` }),
    new Paragraph({ text: `Pré-condições: ${blueprint.preconditions || '-'}` }),
    new Paragraph({ text: `Massa de teste: ${blueprint.testData || '-'}` }),
    new Paragraph({ text: `Resultado esperado final: ${blueprint.expectedResult || '-'}` }),
    new Paragraph({ text: '' }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Passos do fluxo' }),
  ]

  for (const step of blueprint.steps) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: `Passo ${step.order} - ${step.title || 'Sem título'}` }))
    children.push(new Paragraph({ text: `Tela/Módulo: ${step.screen || '-'}` }))
    children.push(new Paragraph({ text: `Ação executada: ${step.action}` }))
    children.push(new Paragraph({ text: `Elemento: ${step.elementType || '-'} | Texto visível: ${step.visibleText || '-'}` }))
    children.push(new Paragraph({ text: `Seletor sugerido: ${step.suggestedSelector || '-'}` }))
    children.push(new Paragraph({ text: `Seletor alternativo: ${step.alternativeSelector || '-'}` }))
    children.push(new Paragraph({ text: `Confiança: ${step.selectorConfidence}` }))
    children.push(new Paragraph({ text: `Motivo da escolha: ${step.selectorReason || '-'}` }))
    children.push(new Paragraph({ text: `Valor digitado: ${step.typedValue || '-'}` }))
    children.push(new Paragraph({ text: `Resultado esperado do passo: ${step.expectedStepResult || '-'}` }))
    children.push(new Paragraph({ text: `Linha Cypress: ${step.cypressLine || '-'}` }))
    children.push(new Paragraph({ text: `Observações: ${step.notes || '-'}` }))
    children.push(new Paragraph({ text: `HTML de referência: ${step.htmlReference || '-'}` }))

    const imageBytes = await imageUrlToBytes(step.imageUrl)
    if (imageBytes) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBytes,
              type: 'png',
              transformation: { width: 520, height: 300 },
            }),
          ],
        }),
      )
    }

    children.push(new Paragraph({ text: '' }))
  }

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Preview Cypress consolidado' }))
  for (const step of blueprint.steps) {
    children.push(new Paragraph({ text: step.cypressLine || '// passo sem linha cypress' }))
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(document)
  downloadBlob(blob, `${slugify(blueprint.flowName || 'blueprint-automacao')}.docx`)
}
