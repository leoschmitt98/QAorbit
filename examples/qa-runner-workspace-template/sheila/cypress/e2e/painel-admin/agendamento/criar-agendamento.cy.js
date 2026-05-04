import blueprint from '../../../fixtures/qa-orbit/painel-admin/agendamento/criar-agendamento.json'
import { runQaOrbitBlueprint } from '../../../support/qa-orbit/run-blueprint'

describe('Sheila - Painel Admin - Criar agendamento', () => {
  it('executa o fluxo base de criacao de agendamento', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
