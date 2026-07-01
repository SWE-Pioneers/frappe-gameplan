describe('Command palette', () => {
  const community = 'frappe-cloud'
  let generalSpace: string
  let uxSpace: string
  let discussionId: string

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })
    cy.clearLocalStorage()

    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Frappe Cloud' },
        { doctype: 'GP Team', title: 'Design Systems' },
        { doctype: 'GP Project', title: 'General', team: community },
        { doctype: 'GP Project', title: 'UX', team: community },
        { doctype: 'GP Project', title: 'Research', team: 'design-systems' },
      ],
    })
      .its('body.message')
      .then((names) => {
        generalSpace = String(names[2])
        uxSpace = String(names[3])

        return cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: [community, 'design-systems'],
        })
      })
      .then(() => {
        return cy.request('POST', '/api/method/frappe.client.insert', {
          doc: {
            doctype: 'GP Discussion',
            title: 'Palette unread discussion',
            content: 'Needs command palette coverage',
            project: generalSpace,
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
            project: generalSpace,
            is_unread: 1,
          },
        })
      })
  })

  it('ignores stale server search responses and keeps the active row stable', () => {
    cy.intercept('GET', '**/gameplan.command_palette.search_sqlite*', (req) => {
      const query = new URL(req.url).searchParams.get('query')
      if (query === 'mar') {
        req.reply({
          delay: 900,
          body: {
            data: [
              {
                title: 'Discussions',
                items: [searchResultItem('Old Mar Discussion', generalSpace)],
              },
            ],
          },
        })
        return
      }

      if (query === 'mark') {
        req.reply({
          delay: 10,
          body: {
            data: [
              {
                title: 'Discussions',
                items: [searchResultItem('New Mark Discussion', generalSpace)],
              },
            ],
          },
        })
        return
      }

      req.reply({ body: { data: [] } })
    })

    visitCommunityDiscussions()
    openCommandPalette()
    commandPaletteInput().type('mar')
    cy.wait(650)
    commandPaletteInput().type('k')
    commandPaletteInput().invoke('attr', 'aria-activedescendant').as('activeRow')

    cy.wait(1000)
    cy.get('[role="listbox"]').should('contain', 'New Mark Discussion')
    cy.get('[role="listbox"]').should('not.contain', 'Old Mar Discussion')
    cy.get<string>('@activeRow').then((activeRow) => {
      commandPaletteInput().should('have.attr', 'aria-activedescendant', activeRow)
    })
  })

  it('opens with the first row active even when the mouse is centered', () => {
    visitCommunityDiscussions()
    cy.get('body').trigger('mousemove', { clientX: 640, clientY: 250 })

    openCommandPalette()

    assertFirstOptionActive()
  })

  it('keeps the first result active while typing a query', () => {
    visitCommunityDiscussions()
    openCommandPalette()
    commandPaletteInput().type('{downArrow}')
    cy.get('[role="option"]').then(($options) => {
      cy.get('[role="option"][aria-selected="true"]').should('have.attr', 'id', $options[1].id)
    })

    commandPaletteInput().type('frappe')

    assertFirstOptionActive()
    cy.get('[role="option"][aria-selected="true"]').should('not.contain', 'Search for "frappe"')
  })

  it('keeps the mark-all-as-read dialog open when selected with Enter', () => {
    visitCommunityDiscussions()
    openCommandPalette()
    commandPaletteInput().type('read all')
    cy.contains('[role="option"]', 'Mark all as read').should('have.attr', 'aria-selected', 'true')

    commandPaletteInput().type('{enter}')

    cy.contains('[role="dialog"]', 'Mark all as read').should('be.visible')
    commandPaletteInput().should('not.exist')
  })

  it('groups Settings tabs and spaces under their parent headings', () => {
    visitCommunityDiscussions()
    openCommandPalette()
    commandPaletteInput().type('settings')

    resultGroup('Settings').within(() => {
      cy.contains('[role="option"]', 'Profile').should('exist')
      cy.contains('[role="option"]', 'Preferences').should('exist')
      cy.contains('[role="option"]', 'Notifications').should('exist')
    })

    commandPaletteInput().clear().type('frappe')
    cy.get('[role="option"][aria-selected="true"]').should('not.contain', 'Search for "frappe"')
    resultGroup('Frappe Cloud').within(() => {
      cy.contains('[role="option"]', 'General').should('exist')
      cy.contains('[role="option"]', 'UX').should('exist')
      cy.contains('[role="option"]', 'Frappe Cloud').should('not.exist')
    })
    cy.contains('[role="option"]', 'Search for "frappe"').should('exist')
  })

  function visitCommunityDiscussions() {
    cy.visit(`/g/community/${community}/discussions`)
    cy.contains('button:visible', 'All Discussions').should('be.visible')
  }

  function openCommandPalette() {
    cy.get('body').then(($body) => {
      $body[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      )
    })
    commandPaletteInput().should('be.visible')
  }

  function commandPaletteInput() {
    return cy.get('input[role="combobox"][aria-controls="command-palette-listbox"]')
  }

  function resultGroup(label: string) {
    return cy.get('[role="group"]').filter((_, element) => {
      const labelId = element.getAttribute('aria-labelledby')
      return labelId ? Cypress.$(`#${labelId}`).text().trim() === label : false
    })
  }

  function assertFirstOptionActive() {
    cy.get('[role="option"]').then(($options) => {
      cy.get('[role="option"][aria-selected="true"]').should('have.attr', 'id', $options[0].id)
    })
  }

  function searchResultItem(title: string, project: string) {
    return {
      author: 'Administrator',
      content: '',
      doctype: 'GP Discussion',
      id: title,
      modified: Math.floor(Date.now() / 1000),
      name: title.toLowerCase().replace(/\W+/g, '-'),
      project,
      score: 1,
      team: community,
      title,
    }
  }
})
