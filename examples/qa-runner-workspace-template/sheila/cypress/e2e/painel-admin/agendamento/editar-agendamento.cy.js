import blueprint from '../../../fixtures/qa-orbit/painel-admin/agendamento/editar-agendamento.json'
import { runQaOrbitBlueprint } from '../../../support/qa-orbit/run-blueprint'

describe('Sheila - Painel Admin - Editar agendamento', () => {
  it('executa o fluxo base de edicao de agendamento', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
