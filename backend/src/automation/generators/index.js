import { generateCypress } from './cypress-generator.js'
import { generatePlaywright } from './playwright-generator.js'
import { generateSelenium } from './selenium-generator.js'

export function generateAutomation(blueprint, options = {}) {
  switch (blueprint.framework) {
    case 'playwright':
      return generatePlaywright(blueprint, options)
    case 'selenium':
      return generateSelenium(blueprint, options)
    case 'cypress':
    default:
      return generateCypress(blueprint, options)
  }
}

