// High-order coverage for the Phase 06 scoped composer + drafts work:
// - the only "+ New discussion" entry point is inside the community discussions
//   list and opens the scoped composer (`/community/:communityId/new-discussion`)
// - publishing lands on the scoped `Discussion` route
// - the global Drafts page exposes no "+ New" affordance
// - a legacy draft without a project still opens via `/new-discussion?draft=...`
describe('Community composer and drafts', () => {
  const community = 'engineering'
  let spaceId: string

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })

    // One joined public community with a space, so it is a valid landing
    // destination and the scoped-route guard does not 404.
    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Engineering' },
        { doctype: 'GP Project', title: 'Gameplan', team: community },
      ],
    })
      .its('body.message')
      .then((names) => {
        spaceId = String(names[1])
        cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: [community],
        })
      })
  })

  it('opens the scoped composer from the community discussions list and publishes there', () => {
    cy.visit(`/g/community/${community}/discussions`)

    // The community discussions list is the only "+ New discussion" entry point.
    cy.button('Add new').click()
    cy.url().should('include', `/community/${community}/new-discussion`)
    cy.contains('New Discussion').should('exist')

    // Capture draft autosaves so we can wait for the content to actually reach the server
    // before publishing, rather than a fixed delay that races the autosave debounce (the row
    // is created on space-select; the title/content land on a following autosave).
    const draftContent = 'Published from the scoped composer.'
    let draftContentSaved = false
    cy.intercept('POST', '**/api/method/frappe.client.*', (req) => {
      if (JSON.stringify(req.body ?? {}).includes(draftContent)) draftContentSaved = true
    })

    cy.get('textarea[placeholder="Title"]').type('Scoped composer discussion{enter}')
    cy.get('[contenteditable=true]').click().type(draftContent)

    // The scoped space picker only offers spaces from the route's community.
    // The metadata combobox can sit under the sticky editor toolbar, so force
    // the trigger open, then pick the option.
    cy.contains('button[aria-haspopup="listbox"]', 'Select Space').click({ force: true })
    cy.get('[role="option"]').contains('Gameplan').click()

    // Retries until an autosave carrying the content (and so the title) has completed.
    cy.wrap(null).should(() => expect(draftContentSaved, 'draft content autosaved').to.be.true)

    cy.button('Publish').click()

    // Publishing lands on the canonical scoped Discussion route.
    cy.url().should('include', `/community/${community}/space/${spaceId}/discussion/`)
    cy.contains('Scoped composer discussion').should('exist')
  })

  it('shows no "+ New" button on the global Drafts page', () => {
    cy.visit('/g/drafts')
    cy.contains('Drafts').should('exist')
    cy.scope('header').contains('button', 'Add new').should('not.exist')
  })

  it('opens a legacy draft without a project on the unscoped route', () => {
    // A draft with no project/community stays on the legacy composer route.
    cy.request('POST', '/api/method/frappe.client.insert', {
      doc: {
        doctype: 'GP Draft',
        type: 'Discussion',
        title: 'Legacy unscoped draft',
        content: '<p>Legacy body</p>',
      },
    })
      .its('body.message.name')
      .then((draftName) => {
        cy.visit('/g/drafts')
        cy.contains('Legacy unscoped draft').click()

        cy.url().should('include', `/new-discussion?draft=${draftName}`)
        cy.url().should('not.include', '/community/')
        cy.get('textarea[placeholder="Title"]').should('have.value', 'Legacy unscoped draft')
      })
  })
})
