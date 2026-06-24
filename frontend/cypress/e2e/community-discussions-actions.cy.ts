describe('Community discussions actions', () => {
  const community = 'business-apps'
  let spaceId: string
  let discussionId: string

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })

    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Business Apps' },
        { doctype: 'GP Project', title: 'ERPNext', team: community },
      ],
    })
      .its('body.message')
      .then((names) => {
        spaceId = String(names[1])

        return cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: [community],
        })
      })
      .then(() => {
        return cy.request('POST', '/api/method/frappe.client.insert', {
          doc: {
            doctype: 'GP Discussion',
            title: 'Unread purchase approval flow',
            content: 'Needs review',
            project: spaceId,
          },
        })
      })
      .its('body.message')
      .then((discussion) => {
        discussionId = discussion.name

        return cy.request('POST', '/api/method/frappe.client.insert', {
          doc: {
            doctype: 'GP Unread Record',
            user: 'Administrator',
            discussion: discussionId,
            project: spaceId,
            is_unread: 1,
          },
        })
      })
  })

  it('switches discussion feeds with tabs and marks a community as read', () => {
    cy.visit(`/g/community/${community}/discussions`)
    cy.contains('button:visible', 'All Discussions').should('be.visible')
    cy.contains('button:visible', 'Participating').should('be.visible')
    cy.contains('button:visible', 'Unread').should('be.visible')
    cy.contains('Unread purchase approval flow').should('be.visible')
    cy.scope('header')
      .contains('a', 'Business Apps')
      .parent()
      .within(() => {
        cy.iconButton('Community actions').should('be.visible')
      })

    cy.iconButton('Community actions').first().click()
    cy.get('[role="menuitem"]:visible').contains('Manage spaces').first().click()
    cy.url().should('include', `/g/configure/${community}`)

    cy.visit(`/g/community/${community}/discussions`)
    cy.iconButton('Community actions').first().click()
    cy.get('[role="menuitem"]:visible').contains('Manage members').first().click()
    cy.url().should('include', `/g/configure/${community}/members`)

    cy.visit(`/g/community/${community}/discussions`)
    cy.contains('button:visible', 'Unread').first().click()
    cy.url().should('include', `/community/${community}/discussions/unread`)
    cy.contains('Unread purchase approval flow').should('be.visible')

    cy.iconButton('Community actions').first().click()
    cy.get('[role="menuitem"]:visible').contains('Mark all as read').first().click()
    cy.scope('dialog').button('Mark all as read').first().click()
    cy.contains('Unread purchase approval flow').should('not.exist')
    cy.contains('No discussions').should('be.visible')

    cy.request('POST', '/api/method/frappe.client.get_value', {
      doctype: 'GP Unread Record',
      filters: {
        user: 'Administrator',
        discussion: discussionId,
        project: spaceId,
      },
      fieldname: 'is_unread',
    })
      .its('body.message.is_unread')
      .should('eq', 0)
  })
})
