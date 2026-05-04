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

function getVisibleEnabledElements(step) {
  const target = step.target || {}

  if (target.recommendedCommand === 'contains') {
    return cy
      .contains(target.selector || 'body', target.text || '')
      .filter(':visible')
  }

  return cy
    .get(target.selector)
    .filter(':visible')
    .not(':disabled')
    .filter((_, element) => element.getAttribute('aria-disabled') !== 'true')
}

function clickFirstDayWithAvailableSlot(step) {
  const target = step.target || {}
  const availabilitySelector = target.availabilitySelector || "[data-cy^='slot-time-']"
  const emptyStateText =
    target.emptyStateText || 'Nao ha horarios disponiveis nesta data.'

  cy.get(target.selector)
    .filter(':visible')
    .not(':disabled')
    .filter((_, element) => element.getAttribute('aria-disabled') !== 'true')
    .then(($days) => {
      const days = Array.from($days)

      if (!days.length) {
        throw new Error('Nenhuma data visivel e habilitada foi encontrada no calendario.')
      }

      const tryDay = (index) => {
        if (index >= days.length) {
          throw new Error(
            'Nenhuma data com horarios disponiveis foi encontrada para este fluxo.'
          )
        }

        cy.wrap(days[index]).scrollIntoView().click()

        cy.get('body', { timeout: 10000 })
          .should(($body) => {
            const hasAvailability = $body.find(availabilitySelector).length > 0
            const hasEmptyState = emptyStateText
              ? $body.text().includes(emptyStateText)
              : false

            expect(
              hasAvailability || hasEmptyState,
              'horarios disponiveis ou mensagem de indisponibilidade'
            ).to.equal(true)
          })
          .then(($body) => {
            if ($body.find(availabilitySelector).length > 0) {
              return
            }

            tryDay(index + 1)
          })
      }

      tryDay(0)
    })
}

function runStep(step) {
  cy.log(`${step.order} - ${step.action}`)

  if (step.action === 'click') {
    if (step.target?.pick === 'firstDayWithAvailableSlot') {
      clickFirstDayWithAvailableSlot(step)
      return
    }

    if (step.target?.pick === 'firstVisibleEnabled') {
      getVisibleEnabledElements(step)
        .first()
        .scrollIntoView()
        .click()
      return
    }

    const el = getTarget(step)
    el.should('be.visible').click()
    return
  }

  const el = getTarget(step)

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
