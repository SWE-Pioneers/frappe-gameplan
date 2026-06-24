// Catch-up coverage for the phase 01-03 shell IA (deferred per AGENT_RUNBOOK):
// the rail community switcher, scoped discussions URLs, and the global bookmarks
// destination living outside any community.
describe('Community shell IA', () => {
  const first = 'design'
  const second = 'support'

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })

    // Two joined public communities, each with a space, so both are valid landing
    // destinations and appear in the rail switcher.
    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Design' },
        { doctype: 'GP Team', title: 'Support' },
        { doctype: 'GP Project', title: 'Brand', team: first },
        { doctype: 'GP Project', title: 'Tickets', team: second },
      ],
    })

    cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
      teams: [first, second],
    })
  })

  // The rail lists each joined community as a direct button; its aria-label is the
  // community title (optionally suffixed with an unread count).
  function switchCommunity(optionLabel: string) {
    cy.get(
      `button[aria-label="${optionLabel}"]:visible, button[aria-label^="${optionLabel}, "]:visible`,
    )
      .first()
      .click()
  }

  it('lands on a scoped discussions URL with the sidebar feed rows', () => {
    cy.visit('/g')
    cy.url().should('match', /\/community\/[^/]+\/discussions/)
    cy.contains('All Discussions').should('be.visible')
    cy.contains('Unread').should('be.visible')
    cy.contains('Participating').should('be.visible')
  })

  it('switches communities from the rail switcher', () => {
    cy.visit(`/g/community/${first}/discussions`)
    cy.url().should('include', `/community/${first}/discussions`)
    cy.contains('a', 'Brand').should('be.visible')

    switchCommunity('Support')
    cy.url().should('include', `/community/${second}/discussions`)
    cy.contains('a', 'Tickets').should('be.visible')
  })

  it('keeps bookmarks a global destination outside any community', () => {
    cy.visit('/g/bookmarks')
    cy.url().should('include', '/bookmarks')
    cy.url().should('not.include', '/community/')
  })
})
