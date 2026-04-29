import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
  },
})
