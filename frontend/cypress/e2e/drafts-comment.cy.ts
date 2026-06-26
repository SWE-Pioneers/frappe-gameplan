// A half-written reply auto-saves as a comment draft (GP Draft, type=Comment). These
// tests verify it surfaces on the global Drafts list and that opening it lands on the
// discussion with the reply composer restored — the feature added alongside the
// new-discussion drafts that the list already showed.
describe('Drafts - Comment Drafts', () => {
  const community = 'engineering'
  let spaceId: string
  let discussionId: string

  const replyText = 'This is a half-written reply that should be saved as a draft.'

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })

    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Engineering' },
        { doctype: 'GP Project', title: 'Gameplan', team: community },
      ],
    })
      .its('body.message')
      .then((data) => {
        spaceId = String(data[1])
        // Scoped routes only resolve a joined community.
        cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: [community],
        })
        cy.request('POST', '/api/method/frappe.client.insert', {
          doc: {
            doctype: 'GP Discussion',
            project: spaceId,
            title: 'Test discussion',
            content: 'This is a test discussion',
          },
        })
          .its('body.message')
          .then((discussion) => {
            discussionId = String(discussion.name)
          })
      })
  })

  // The Drafts list fetches via get_my_drafts; waiting on it avoids a detached-element
  // race where the cached render is replaced by the network render mid-command.
  // Match anywhere in the URL via regex — the method path segment is dotted
  // (…gp_draft.gp_draft.get_my_drafts), which a minimatch glob can't target cleanly.
  const interceptDrafts = () => cy.intercept(/get_my_drafts/).as('getDrafts')

  it('shows a comment draft in the list and reopens it with the composer restored', () => {
    // The draft is created lazily on the first push via frappe.client.insert.
    cy.intercept('POST', '/api/method/frappe.client.insert').as('draftInsert')

    cy.visit(`/g/community/${community}/space/${spaceId}/discussion/${discussionId}`)

    // Start a reply but never submit it — typing alone auto-saves a comment draft.
    cy.button('Add a comment').click()
    cy.get('[contenteditable=true]').should('be.visible').click().type(replyText)
    cy.wait('@draftInsert') // server row created

    // The reply now appears on the global Drafts list, labelled as a reply and showing
    // the parent discussion's title plus the reply preview.
    interceptDrafts()
    cy.visit('/g/drafts')
    cy.wait('@getDrafts') // let the list settle before asserting/clicking
    cy.contains('Test discussion').should('exist')
    cy.contains(replyText).should('exist')
    cy.get('.lucide-reply').should('exist')

    // Opening it lands on the discussion with the composer restored.
    cy.contains(replyText).click()
    cy.url().should('include', `/space/${spaceId}/discussion/${discussionId}`)
    cy.get('[contenteditable=true]').should('be.visible').should('contain.text', replyText)
  })

  it('removes the comment draft from the list once submitted', () => {
    cy.intercept('POST', '/api/method/frappe.client.insert').as('draftInsert')
    cy.intercept('POST', '/api/v2/document/GP%20Comment').as('comment')

    cy.visit(`/g/community/${community}/space/${spaceId}/discussion/${discussionId}`)

    cy.button('Add a comment').click()
    cy.get('[contenteditable=true]').should('be.visible').click().type(replyText)
    cy.wait('@draftInsert')

    // Posting the reply commits the draft, which deletes the GP Draft row.
    cy.button('Submit').click()
    cy.wait('@comment')

    interceptDrafts()
    cy.visit('/g/drafts')
    cy.wait('@getDrafts')
    cy.contains(replyText).should('not.exist')
  })
})
