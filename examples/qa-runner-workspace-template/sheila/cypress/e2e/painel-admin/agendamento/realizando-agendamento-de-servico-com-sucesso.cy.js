import blueprint from '../../../fixtures/qa-orbit/painel-admin/agendamento/realizando-agendamento-de-servico-com-sucesso.json'
import { runQaOrbitBlueprint } from '../../../support/qa-orbit/run-blueprint'

describe('Sheila - Painel Admin - Realizando agendamento de servico com sucesso', () => {
  it('executa o fluxo exportado pelo QA Orbit', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
