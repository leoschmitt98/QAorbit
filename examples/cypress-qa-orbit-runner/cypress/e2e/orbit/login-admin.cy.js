import blueprint from '../../fixtures/qa-orbit/login-admin.json'
import { runQaOrbitBlueprint } from '../../support/qa-orbit/run-blueprint'

describe('QA Orbit - Login senha valida', () => {
  it('executa o fluxo de login com senha valida exportado pelo Smart Recorder', () => {
    runQaOrbitBlueprint(blueprint)
  })
})
