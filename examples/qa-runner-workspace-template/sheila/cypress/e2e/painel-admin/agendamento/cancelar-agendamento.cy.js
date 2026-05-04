import blueprint from '../../../fixtures/qa-orbit/painel-admin/agendamento/cancelar-agendamento.json'
import { runQaOrbitBlueprint } from '../../../support/qa-orbit/run-blueprint'

describe('Sheila - Painel Admin - Cancelar agendamento', () => {
  it('executa o fluxo base de cancelamento de agendamento', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
