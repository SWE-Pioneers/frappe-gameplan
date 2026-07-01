describe('Project', () => {
  // Space management moved out of the old `/configure/:community` pages and into
  // the Settings dialog (Communities tab). The "Community actions" menu on a
  // community's discussions page opens that dialog straight onto the community's
  // spaces list, where each space still exposes its "<title> Space Options" menu.
  function openCommunitySpaces(communityId) {
    cy.visit(`/g/community/${communityId}/discussions`)
    cy.iconButton('Community actions').first().click()
    cy.get('[role="menuitem"]:visible').contains('Manage spaces').first().click()
  }

  it('moves a space to another community and archives it', () => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })
    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        {
          doctype: 'GP Team',
          title: 'Engineering',
        },
        {
          doctype: 'GP Team',
          title: 'DevOps',
        },
        {
          doctype: 'GP Project',
          title: 'Project 1',
          team: 'engineering',
        },
      ],
    })
      .its('body.message')
      .then((names) => {
        const projectName = String(names[2])

        // Every space now belongs to a community, and scoped routes only resolve a
        // joined community, so join both teams before navigating to their spaces.
        cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: ['engineering', 'devops'],
        })

        // move to community
        openCommunitySpaces('engineering')
        cy.selectDropdownOption('Project 1 Space Options', 'Change Community')
        cy.selectCombobox('Select a community', 'DevOps')
        cy.button('Move to DevOps').click()
        cy.request('POST', '/api/method/frappe.client.get_value', {
          doctype: 'GP Project',
          filters: { name: projectName },
          fieldname: ['team'],
        })
          .its('body.message.team')
          .should('eq', 'devops')

        cy.visit(`/g/community/devops/space/${projectName}`)
        cy.url().should('include', `/g/community/devops/space/${projectName}`)
        cy.get('header').contains('Project 1').should('exist')

        // archive while pinned; this exercises the backend cleanup path that
        // removes current-user pins for archived spaces.
        cy.request('POST', '/api/method/frappe.client.insert', {
          doc: {
            doctype: 'GP Pinned Project',
            project: projectName,
          },
        })

        openCommunitySpaces('devops')
        cy.selectDropdownOption('Project 1 Space Options', 'Archive')
        // The archive confirmation stacks on top of the still-open Settings
        // dialog, so scope to it by title instead of asserting "no dialog".
        cy.contains('[role=dialog]', 'Archive space').as('archiveConfirm')
        cy.get('@archiveConfirm').contains('button', 'Archive').click()
        cy.contains('[role=dialog]', 'Archive space').should('not.exist')
        // Archiving removes the current user's pin for the space (backend cleanup).
        cy.request('POST', '/api/method/frappe.client.get_list', {
          doctype: 'GP Pinned Project',
          filters: { project: projectName },
          fields: ['name'],
        })
          .its('body.message')
          .should('have.length', 0)

        // Re-open the spaces list. Archived spaces are hidden until the visibility
        // filter is switched to "Archived", and render a disabled title input
        // (archived spaces are read-only).
        openCommunitySpaces('devops')
        cy.get('input[aria-label="Space title"]:disabled').should('not.exist')
        cy.contains('button[aria-haspopup="listbox"]', 'All (').click({ force: true })
        cy.get('[role="option"]:visible').contains('Archived').click()
        cy.get('input[aria-label="Space title"]:disabled').should('have.value', 'Project 1')
      })
  })
})
