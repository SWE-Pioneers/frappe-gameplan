import { defineConfig } from 'cypress'

export default defineConfig({
  // JUnit XML per spec; CI parses these to post a results comment on the PR
  // (replaces Cypress Cloud recording). [hash] keeps one file per spec.
  reporter: 'mocha-junit-reporter',
  reporterOptions: {
    mochaFile: 'cypress/results/results-[hash].xml',
    toConsole: true,
  },
  video: true,
  e2e: {
    baseUrl: 'http://gameplan-demo.test:8000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // Harvests window.__coverage__ from the istanbul-instrumented build and, at
      // the end of the run, writes .nyc_output + an nyc report. No-op unless the
      // bundle was built with COVERAGE=true (otherwise there's nothing to collect).
      require('@cypress/code-coverage/task')(on, config)
      return config
    },
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
})
