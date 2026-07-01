# Shell Extraction Plan: Gameplan → frappe-ui

Extract Gameplan's app shell into composition-based frappe-ui component families
so other Frappe apps can build the same shell from parts.

**Principles** (settled during Phase 1):

- Design the consumer template first, then hide the wiring inside the library.
  Prefer a placeable component over a `provide*()` composable. Infer context
  (DOM, tree position) instead of adding options. Zero-config happy path.
- No Gameplan data stores, doctype fields, or route-name literals in library
  code. Data arrives via props/slots; navigation via `to: RouteLocationRaw`.
- Follow the SettingsDialog family conventions: `src/components/<Family>/` with
  `index.ts`, colocated `<Family>.md`, generated `.api.md` (`yarn docs:gen`),
  `.cy.ts` component tests, `stories/`. Semantic tokens only, styling hooks via
  `data-slot`/`data-state`, never `*Class` props.
- Each phase = one frappe-ui PR + one Gameplan migration PR. Gameplan pins the
  published package, so sequence is: frappe-ui PR → beta release → Gameplan PR.
  Local dev runs `yarn dev:frappe-ui`. Manual review gate after every phase.
- Sweep for **template usages without imports** when migrating (Vue renders
  unresolved components silently as native elements — see Phase 1's Space.vue
  bug). Check `<Name` occurrences against imports, not just import lines.
- **Naming: one namespace per family; a variant is a suffix, not a rival
  prefix.** Name the whole family under a single prefix so it sorts together in
  autocomplete and reads as a set. A device/variant qualifier is a *suffix*
  (`PageHeaderMobile`), never a competing prefix (`MobileHeader` — mixes the
  "role" and "device" axes and looks like an unrelated component). Settled
  Phase 1; **revisit Phase 4's `Mobile*` / `AppShell` names against this bar
  before building** (likely `AppShell` + `AppShellMobile*`, TBD).
- **Stories demo one component, simply.** Each `stories/*.vue` shows a single
  component in place — no scroll containers, teleport, or multi-part
  composition. A static preview can't convey a teleport anyway; how the parts
  assemble goes on a dedicated composition/recipe page, not a story.
- **Don't grow the component to serve its docs.** When a preview can't
  represent something (e.g. two previews sharing a module-singleton, or a
  teleport), fix it in the *story*, not by widening the component's runtime
  contract. Production complexity must earn its keep in real app usage, not a
  docs page.
- **Docs prose stays lean.** `ComponentPreview` exposes source via its "View
  Code" toggle — don't duplicate it with `vue` code blocks. Prose covers
  behavior/API notes only.
- **Every component folder needs a `types.ts`** (public prop interfaces, with
  components doing `defineProps<XProps>()` from it so runtime and documented
  types can't drift). The `<PropsTable>` docs directive snippet-imports
  `<Folder>/types.ts`; a *missing* file is a hard `docs:dev` crash
  (`statSync` ENOENT during markdown render), not a warning.

---

## Phase 1 — PageHeader family ✅ (done, pending PRs)

`PageHeader`, `PageHeaderMobile`, `PageHeaderMobileTitle`,
`PageHeaderBackButton`, `PageHeaderBase`, `PageHeaderTarget` — one
`PageHeader*` namespace (the earlier `MobileHeader`/`MobileHeaderTitle`/
`MobileBackButton` names were renamed; see the naming principle above). Layout
drops in `<PageHeaderTarget />`; pages declare headers anywhere; teleport +
scroll-to-top are automatic (module-registry target stack; scroll container
discovered from the header's declaration site via a hidden anchor).

Stories deliberately show `PageHeader` and `PageHeaderMobile` on their own
(no target/teleport) — the compose-into-a-layout story belongs on the future
composition page. The single global target is intentional (one shell per app,
`App.vue` swaps layouts via a dynamic `:is`); the multi-shell case only arises
in docs previews and is handled there.

Remaining: frappe-ui PR → beta.19 release → Gameplan PR (bump `frappe-ui` dep,
this migration).

---

## Phase 2 — Rail family

Source: `frontend/src/components/AppRail/` (AppRail.vue 332 lines, RailIcon,
UnreadBadge). The frame is generic (fixed ~50px column, scrollable middle with
top/bottom scroll gradients, tooltip provider); the filling is Gameplan-specific
(communities, unread aggregation, shortcuts, logo, admin items).

### Target API

```vue
<Rail>
  <template #top>
    <RailItem label="Home" :to="homeRoute"><GameplanLogo /></RailItem>
  </template>

  <!-- default slot scrolls, with automatic overflow gradients -->
  <RailItem
    v-for="c in activeCommunities"
    :key="c.name"
    :label="c.title"
    :to="communityRoute(c)"
    :active="c.name === communityState.id"
    :badge="unreadByCommunity[c.name]"
  >
    <CommunityImage :community="c" />
  </RailItem>

  <template #bottom>
    <RailItem label="Search" :to="{ name: 'Search' }" icon="lucide-search" />
    <RailItem label="Notifications" :to="{ name: 'Notifications' }" icon="lucide-bell" :badge="unreadCount" />
    <UserDropdown />
  </template>
</Rail>
```

- `Rail` — the frame. Slots: `#top`, default (scrollable), `#bottom`. Owns
  scroll-gradient logic and tooltip provider. Props: none to start.
- `RailItem` — props `label` (tooltip + aria), `icon?` (CSS class) or default
  slot for custom content (images, avatars), `to?: RouteLocationRaw`,
  `active?: boolean`, `badge?: number`, `badgeStyle?: 'count' | 'dot'`.
  Renders the active indicator bar from `active` (`data-state`), emits `click`
  when no `to`.
- Badge rendering (count formatting, `aria-label`) is internal — fold in
  Gameplan's `UnreadBadge` + `formatUnreadCount`/`unreadAriaLabel` utils.

### Stays in Gameplan

Community list + unread aggregation (`unreadByCommunity`), sidebar badge-style
preference, admin gating (`useCanManageCommunities`), CustomizeSidebarDialog,
`showBorder`/`showCommunityActiveState` route policy (becomes plain props/classes
at the call site), UserDropdown, GameplanLogo.

### Steps

1. frappe-ui: add `Rail` family (Rail, RailItem) with docs/stories/cy tests.
2. Gameplan: rewrite `AppRail.vue` as a thin composition over `Rail`/`RailItem`
   (it stays a Gameplan component — it holds all the data wiring). Delete
   `RailIcon.vue`, `UnreadBadge.vue`.
3. Verify: rail scroll gradients with many communities, unread badges (count +
   dot styles), tooltips, active states, admin-only items, mobile unaffected.

---

## Phase 3 — Sidebar rework (breaking change in frappe-ui)

frappe-ui already has `src/components/Sidebar/` — but it's config-object-driven
(`header: {...}`, `sections: [{ items: [...] }]`), the opposite of the
composition style. **Rework it; do not ship a second sidebar.** This is the
SettingsDialog `49d2a14ef` refactor replayed: same names, composition-first.

Gameplan's `AppSidebar.vue` (204 lines, zero props, fully store-driven) is the
consumer to model: section header with actions (sort, add), item rows with
icon/label/suffix (lock, unread count), per-item options menu, empty state.

### Target API

```vue
<Sidebar v-model:collapsed="collapsed">
  <template #header>
    <AppDropdown />   <!-- app-specific -->
  </template>

  <SidebarSection label="Spaces">
    <template #actions>
      <Button variant="ghost" icon="lucide-arrow-up-down" @click="cycleSort" />
      <Button variant="ghost" icon="lucide-plus" @click="newSpace" />
    </template>

    <SidebarItem
      v-for="space in communitySpaces.list"
      :key="space.name"
      :label="space.title"
      :to="spaceRoute(space)"
      :active="isActiveSpace(space)"
      :suffix="getSpaceUnreadCount(space.name) || undefined"
    >
      <template #prefix><SpaceIcon :space="space" /></template>
      <template #options> ...dropdown items... </template>
    </SidebarItem>

    <template #empty>{{ communitySpaces.emptyMessage }}</template>
  </SidebarSection>
</Sidebar>
```

- Keep `v-model:collapsed`, the `sidebarCollapsedKey` injection, and responsive
  collapse — that part of the existing component is right.
- `SidebarItem` gets `#prefix`/`#suffix`/`#options` slots per the shared slot
  vocabulary; `active` drives `data-state`.
- Migration for existing consumers: keep the `sections`/`items` props working
  for one release by implementing them *on top of* the new sub-components
  internally, mark deprecated in docs, then remove. Check consumers (CRM,
  Helpdesk, Drive, …) before deciding the removal release.

### Steps

1. frappe-ui: rework Sidebar internals into sub-components; config props become
   a deprecated compatibility layer. Update docs/stories/cy tests to the
   composition API.
2. Gameplan: rebuild `AppSidebar.vue` on the new parts. Sorting, preferences,
   unread counts, NewSpaceDialog stay app-side.
3. Verify: Gameplan sidebar (sort, hide-inactive, unread, item options, empty
   state) + at least one config-driven consumer still working via the compat
   layer (run frappe-ui cy suite).

---

## Phase 4 — Shells

Source: `App.vue` (width-based layout switch), `DesktopLayout.vue`,
`MobileLayout.vue`. Two families — desktop and mobile are different mental
models (P8), so separate components, not a `mobile` prop.

### Target API

```vue
<!-- DesktopLayout.vue (Gameplan) -->
<AppShell>
  <template #rail><AppRail /></template>
  <template #sidebar><AppSidebar v-if="onCommunityRoute" /></template>

  <ReadOnlyBanner v-if="readOnlyMode" />
  <slot />   <!-- routed page -->
</AppShell>
```

```vue
<!-- MobileLayout.vue (Gameplan) -->
<MobileShell>
  <slot />

  <template #tabbar>
    <MobileTabBar v-if="!isNewCommentOpen">
      <MobileTab label="Home" icon="lucide-home" :to="{ name: 'Home' }" :active="isHomeRoute" />
      <MobileTab label="Notifications" icon="lucide-bell" :to="{ name: 'Notifications' }" :active="..." />
      <MobileTab label="Search" icon="lucide-search" :to="{ name: 'Search' }" :active="..." />
      <MobileTab label="You" :to="{ name: 'More' }" :active="isMoreRoute">
        <UserAvatar :user="sessionUser.name" />
      </MobileTab>
    </MobileTabBar>
  </template>
</MobileShell>
```

- `AppShell` — owns the desktop frame: rail slot, sidebar slot, the rounded
  content card, a built-in `PageHeaderTarget`, and the scroll container.
- `MobileShell` — fixed-inset column: built-in `PageHeaderTarget` (with
  standalone-mode safe-area padding), scroll area, `#tabbar` slot.
- `MobileTabBar` / `MobileTab` — tab row; `MobileTab` props `label`, `icon?` or
  default slot, `to`, `active`. Tapping the active tab scrolls to top (reuse the
  Phase 1 scroll-parent discovery).
- Scroll container: shells register their scroll element in a small module
  registry (same pattern as `PageHeaderTarget`); export `useScrollContainer()`
  → `{ el, scrollTo, scrollToTop, isScrolled }` to replace Gameplan's
  `window.scrollContainer` global and `utils/scrollContainer.ts`.
- Export `useScreenSize` / `useIsMobile(breakpoint = 640)`. The desktop↔mobile
  *switch stays in the app* (`App.vue`) — which shell to render is app policy.

### Stays in Gameplan

`communityScope`/`settingsOverlay` route-meta logic, `readOnlyMode` banner,
CommandPalette mounting, tab definitions and `isMoreRoute` list, the
`users.isFinished` gate.

### Steps

1. frappe-ui: `AppShell` family + `MobileShell` family (+ scroll-container
   registry, `useScreenSize`). Docs/stories/cy tests.
2. Gameplan: `DesktopLayout.vue`/`MobileLayout.vue` become thin compositions;
   delete `ScrollContainer.vue` and `utils/scrollContainer.ts` (migrate its
   consumers — `useScrollPosition` users, `DiscussionView`, `CommentsArea` —
   to `useScrollContainer`).
3. Verify: full app walkthrough desktop + mobile viewport, layout swap on live
   resize, scroll-to-top from headers and active tab, standalone (PWA)
   safe-area padding, settings overlay behavior unchanged.

---

## Cross-cutting checklist (every phase)

- [ ] frappe-ui: family folder + `export *` in `src/index.ts`; a `types.ts`
      per component (public prop interfaces; `defineProps<XProps>()` from it)
- [ ] Colocated `.md` (lean prose, no `vue` blocks that duplicate the preview),
      `yarn docs:gen` (revert unrelated `.api.md` churn), single-component
      stories, `.cy.ts` passing (`npx cypress run --component --spec ...`);
      `yarn docs:dev` boots clean
- [ ] Gameplan migration: imports rewritten **and** no-import template usage
      sweep; old components deleted; `yarn build` green
- [ ] Browser verification on `gameplan-demo.test:8080` (desktop + 390px
      mobile + live resize), console clean
- [ ] frappe-ui PR → beta release → Gameplan PR bumps the pin
- [ ] Suggest follow-up: adopt in one more app (CRM/Helpdesk) to validate the
      API isn't Gameplan-shaped
