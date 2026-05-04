export const AUTOMATION_BLUEPRINT_VERSION = '1.0'

export function createAutomationBlueprint(input = {}) {
  return {
    id: input.id,
    name: input.name || 'Automacao QA Orbit',
    type: input.type || 'web-e2e',
    framework: input.framework || 'cypress',
    language: input.language || 'javascript',
    pattern: input.pattern || 'simple',
    baseUrl: input.baseUrl || '',
    specName: input.specName || 'qa-orbit.spec.js',
    steps: Array.isArray(input.steps) ? input.steps : [],
  }
}

export function createTestBattery(input = {}) {
  return {
    id: input.id,
    name: input.name || 'Bateria QA Orbit',
    description: input.description || '',
    framework: input.framework || 'cypress',
    baseUrl: input.baseUrl || '',
    workingDir: input.workingDir || '',
    items: Array.isArray(input.items) ? input.items : [],
  }
}

