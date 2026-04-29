function resolveValue(value) {
  if (!value) return ''
  const match = String(value).match(/^\{\{(.+)}}$/)
  if (match) return Cypress.env(match[1]) || ''
  return value
}

function getTarget(step) {
  const target = step.target || {}

  if (target.recommendedCommand === 'contains') {
    return cy.contains(target.selector || 'body', target.text || '')
  }

  return cy.get(target.selector)
}

function runStep(step) {
  cy.log(`${step.order} - ${step.action}`)

  const el = getTarget(step)

  if (step.action === 'click') {
    el.should('be.visible').click()
    return
  }

  if (step.action === 'type') {
    el.should('be.visible').clear().type(resolveValue(step.value), { log: false })
    return
  }

  if (step.action === 'select') {
    el.should('be.visible').select(resolveValue(step.value))
    return
  }

  if (step.action === 'check') {
    el.should('be.visible').check()
    return
  }

  if (step.action === 'uncheck') {
    el.should('be.visible').uncheck()
    return
  }

  if (step.action === 'submit') {
    el.should('be.visible').submit()
    return
  }

  if (step.action === 'assertText') {
    el.should('contain.text', resolveValue(step.value))
    return
  }

  if (step.action === 'assertVisible') {
    el.should('be.visible')
  }
}

export function runQaOrbitBlueprint(blueprint) {
  if (!blueprint?.startUrl) {
    throw new Error('Blueprint sem startUrl.')
  }

  const configuredBaseUrl = Cypress.config('baseUrl')
  cy.visit(configuredBaseUrl ? '/' : blueprint.startUrl)

  ;[...(blueprint.steps || [])]
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach(runStep)
}
