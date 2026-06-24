type InsertedDoc = {
  name: string
  slug?: string
}

describe('Community merge URL healing', () => {
  const sourceCommunity = 'source-community'
  const middleCommunity = 'middle-community'
  const finalCommunity = 'final-community'
  let sourceSpaceId: string
  let discussionId: string
  let discussionSlug: string
  let pageId: string
  let pageSlug: string
  let taskId: string

  beforeEach(() => {
    cy.login()
    cy.request({
      method: 'POST',
      url: '/api/method/gameplan.test_api.clear_data',
    })

    cy.request('POST', '/api/method/frappe.client.insert_many', {
      docs: [
        { doctype: 'GP Team', title: 'Source Community' },
        { doctype: 'GP Team', title: 'Middle Community' },
        { doctype: 'GP Team', title: 'Final Community' },
        { doctype: 'GP Project', title: 'Source Space', team: sourceCommunity },
      ],
    })
      .its('body.message')
      .then((names) => {
        sourceSpaceId = String(names[3])

        return cy.request('POST', '/api/v2/method/GP Team/update_joined_teams', {
          teams: [sourceCommunity, middleCommunity, finalCommunity],
        })
      })
      .then(() => {
        return insertDoc<InsertedDoc>({
          doctype: 'GP Discussion',
          title: 'Merge Route Discussion',
          content: 'Discussion body',
          project: sourceSpaceId,
        })
      })
      .then((discussion) => {
        discussionId = discussion.name
        discussionSlug = discussion.slug ?? 'merge-route-discussion'

        return insertDoc<InsertedDoc>({
          doctype: 'GP Page',
          title: 'Merge Route Page',
          content: 'Page body',
          project: sourceSpaceId,
        })
      })
      .then((page) => {
        pageId = page.name
        pageSlug = page.slug ?? 'merge-route-page'

        return insertDoc<InsertedDoc>({
          doctype: 'GP Task',
          title: 'Merge Route Task',
          description: 'Task body',
          project: sourceSpaceId,
        })
      })
      .then((task) => {
        taskId = task.name

        return mergeCommunity(sourceCommunity, middleCommunity)
      })
      .then(() => {
        return mergeCommunity(middleCommunity, finalCommunity)
      })
  })

  it('heals stale discussion, page, and task URLs from the content record', () => {
    assertHealsToCanonicalRoute(
      `/g/community/${sourceCommunity}/space/${sourceSpaceId}/discussion/${discussionId}/${discussionSlug}`,
      `/g/community/${finalCommunity}/space/${sourceSpaceId}/discussion/${discussionId}/${discussionSlug}`,
    )
    cy.contains('h1:visible', 'Merge Route Discussion').should('exist')

    assertHealsToCanonicalRoute(
      `/g/community/${middleCommunity}/space/${sourceSpaceId}/pages/${pageId}/${pageSlug}`,
      `/g/community/${finalCommunity}/space/${sourceSpaceId}/pages/${pageId}/${pageSlug}`,
    )
    cy.get('input[placeholder="Title"]:visible').should('have.value', 'Merge Route Page')

    assertHealsToCanonicalRoute(
      `/g/community/${sourceCommunity}/space/${sourceSpaceId}/tasks/${taskId}`,
      `/g/community/${finalCommunity}/space/${sourceSpaceId}/tasks/${taskId}`,
    )
    cy.get('input[placeholder="Title"]:visible').should('have.value', 'Merge Route Task')
  })
})

function insertDoc<T>(doc: Record<string, unknown>) {
  return cy
    .request('POST', '/api/method/frappe.client.insert', { doc })
    .its('body.message')
    .then((inserted) => inserted as T)
}

function mergeCommunity(source: string, target: string) {
  return cy.request('POST', `/api/v2/document/GP%20Team/${source}/method/merge_into_team`, {
    team: target,
  })
}

function assertHealsToCanonicalRoute(stalePath: string, canonicalPath: string) {
  cy.visit(stalePath)
  cy.location('pathname').should('eq', canonicalPath)
}
