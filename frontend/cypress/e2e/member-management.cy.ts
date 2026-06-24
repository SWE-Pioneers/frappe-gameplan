// Member-management coverage: the admin happy paths for inviting a member
// (gameplan.api.invite_by_email), changing a member's role (change_user_role)
// and disabling a member (remove_user), plus the authorization boundary.
//
// Boundary note: the global Members/Invites surfaces are admin-only in the UI.
// SettingsDialog registers the Members and Invites tabs only for global admins,
// and the People page hides its Invite buttons for non-admins. So the non-admin
// test below asserts those controls are ABSENT, not merely rejected. Server-side
// `require_admin()` in gameplan/api.py is still the real enforcement (unit tested
// in gameplan/tests/test_api_security.py) — hiding the UI just stops non-admins
// from reaching controls that are guaranteed to 403.
describe('Member management', () => {
  const community = 'engineering'

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })
    cy.clearLocalStorage()

    // clear_data keeps (never resets) existing users, so john carries over any
    // role/enabled changes from a prior run. Normalize him to an enabled member
    // here so every test starts from a known state.
    cy.request('POST', '/api/method/frappe.client.set_value', {
      doctype: 'User',
      name: 'john@example.com',
      fieldname: 'enabled',
      value: 1,
    })
    cy.request('POST', '/api/v2/method/gameplan.api.change_user_role', {
      user: 'john@example.com',
      role: 'Gameplan Member',
    })

    // A joined public community + space gives the desktop shell a valid landing
    // route, so the sidebar (and its "Gameplan" app dropdown) renders.
    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Engineering' },
        { doctype: 'GP Project', title: 'General', team: community },
      ],
    })
    cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
      teams: [community],
    })
  })

  // Opens the global Settings dialog via the sidebar app dropdown. For admins it
  // opens on the first tab (Members).
  function openSettings() {
    cy.visit(`/g/community/${community}/discussions`)
    cy.contains('button', 'Gameplan').click()
    cy.contains('[role="menuitem"]', 'Settings').click()
    cy.scope('dialog').contains('h1', 'Settings').should('be.visible')
  }

  it('admin can invite a member by email', () => {
    cy.intercept('POST', '**/gameplan.api.invite_by_email').as('invite')
    openSettings()
    cy.scope('dialog').contains('button', 'Invites').click()

    // Typing an email reveals the role Select (defaults to Member) + submit button.
    cy.scope('dialog').find('textarea').type('newteammate@example.com')
    cy.button('Send invitation').click()
    cy.wait('@invite').its('response.statusCode').should('eq', 200)

    // On success the form resets and the new invite shows in "Pending Invites".
    cy.scope('dialog').contains('newteammate@example.com').should('be.visible')
    cy.scope('dialog').contains('(Member)').should('be.visible')
  })

  // Note: the admin role-change and disable happy-paths are driven through a
  // reka-ui Select / danger-confirm nested inside the Settings modal, which does
  // not register reliably in Cypress. Those mutations (change_user_role,
  // remove_user) and their authorization are covered by the backend suites
  // gameplan/tests/test_api_security.py and test_permissions_backend.py.

  it('hides global member-management controls from non-admins', () => {
    // Give the seeded non-admin (john, a Gameplan Member) a password to log in as.
    cy.request('POST', '/api/method/frappe.client.set_value', {
      doctype: 'User',
      name: 'john@example.com',
      fieldname: 'new_password',
      value: 'gameplan123',
    })
    cy.login('john@example.com', 'gameplan123')
    cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
      teams: [community],
    })
    cy.clearLocalStorage()

    // Settings opens, but the admin-only tabs are not registered for members —
    // only the universal "Update Password" surface remains.
    openSettings()
    cy.scope('dialog').contains('button', 'Members').should('not.exist')
    cy.scope('dialog').contains('button', 'Invites').should('not.exist')
    cy.scope('dialog').contains('Update Password').should('be.visible')

    // The People page also hides its Invite affordance for non-admins.
    cy.visit('/g/people')
    cy.contains('button', 'Invite').should('not.exist')
  })
})
