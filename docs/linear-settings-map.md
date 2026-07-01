# Linear Settings Map

Reference map captured from Linear's public docs while redesigning Gameplan settings.

| Area           | Pages / Sections     |           Scope | What it controls                                                                                                       |
| -------------- | -------------------- | --------------: | ---------------------------------------------------------------------------------------------------------------------- |
| Account        | Profile              |        Personal | Name, username/display identity, avatar, email                                                                         |
| Account        | Preferences          |        Personal | Theme/display, default home view, name display, calendar week behavior, desktop app behavior, auto-assignment behavior |
| Account        | Notifications        |        Personal | Desktop, mobile, email, Slack notification categories                                                                  |
| Account        | Security & Access    |        Personal | Sessions/devices, passkeys, personal API keys, authorized OAuth apps                                                   |
| Account        | Code & Reviews       |        Personal | Branch name format, code review preferences, code viewer theme/font, coding tool behavior                              |
| Workspace      | General / Workspace  |          Shared | Workspace identity, basic workspace-level configuration                                                                |
| Workspace      | Labels               |          Shared | Workspace labels and label groups available across teams                                                               |
| Workspace      | Templates            |          Shared | Issue/project templates reusable across workspace or integrations                                                      |
| Workspace      | Integrations         |    Shared/Admin | GitHub, Slack, Microsoft Teams, Linear Asks, support tools, etc.                                                       |
| Workspace      | Import / Export      |           Admin | Import from Jira/GitHub/Asana/etc., export workspace/member data                                                       |
| Teams          | General              |            Team | Team name/key/icon, team visibility, SCIM group mapping                                                                |
| Teams          | Members              |            Team | Team membership, owners, private-team access                                                                           |
| Teams          | Workflow             |            Team | Issue statuses, default status, workflow behavior                                                                      |
| Teams          | Labels               |            Team | Team-scoped labels and label groups                                                                                    |
| Teams          | Cycles               |            Team | Enable/configure cycles, cadence, active/upcoming cycles                                                               |
| Teams          | Triage               |            Team | Triage inbox behavior, responsibility, routing rules                                                                   |
| Teams          | Templates            |            Team | Team-specific issue/project templates                                                                                  |
| Teams          | Access & Permissions |            Team | Who can manage team settings, members, workflows                                                                       |
| Administration | Members              | Workspace Admin | Invites, roles, suspended users, member CSV export                                                                     |
| Administration | Teams                | Workspace Admin | Manage all teams, including private teams                                                                              |
| Administration | Security             | Workspace Admin | Login restrictions, SAML/SSO, SCIM, approved domains                                                                   |
| Administration | API                  | Workspace Admin | Workspace webhooks and OAuth applications                                                                              |
| Administration | Billing / Plan       | Workspace Admin | Subscription, plan, invoices, seats                                                                                    |

## IA Pattern

| Scope          | Principle                                             |
| -------------- | ----------------------------------------------------- |
| Account        | My experience across the app                          |
| Workspace      | Shared defaults and objects everyone can use          |
| Team           | Workflow configuration for a specific operating group |
| Administration | Org control, security, billing, and governance        |

## Gameplan Adaptation

| Linear concept | Gameplan equivalent                                    |
| -------------- | ------------------------------------------------------ |
| Account        | Personal profile, theme, sidebar preferences, password |
| Workspace      | App-wide defaults if/when introduced                   |
| Team           | Community and Space configuration                      |
| Administration | Global members, invites, roles                         |
