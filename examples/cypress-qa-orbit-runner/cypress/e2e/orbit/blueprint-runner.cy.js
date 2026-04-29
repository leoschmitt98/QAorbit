import blueprint from '../../fixtures/qa-orbit/blueprint.json'
import { runQaOrbitBlueprint } from '../../support/qa-orbit/run-blueprint'

describe('QA Orbit Blueprint Runner', () => {
  it(`executa blueprint: ${blueprint.name}`, () => {
    runQaOrbitBlueprint(blueprint)
  })
})
