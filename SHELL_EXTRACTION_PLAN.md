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

## Phase 2 — Rail family ✅ (done, pending PRs)

Source: `frontend/src/components/AppRail/` (AppRail.vue 332 lines, RailIcon,
UnreadBadge). Only two things extracted — the styled column frame + shared
tooltip context (`Rail`), and the item cell (`RailItem`). **Layout and scrolling
are the consumer's job (plain CSS)** — settled during the phase (see below); the
library ships no layout slots and no scroll/gradient logic.

### Final API

```vue
<Rail>
  <RailItem label="Home" variant="ghost" :active="isHome" @click="goHome">
    <GameplanLogo />
  </RailItem>

  <!-- The app owns the scroll region + gradients; flex-1 pushes the rest down. -->
  <div class="relative flex min-h-0 w-full flex-1 flex-col">
    <RailItem
      v-for="c in activeCommunities"
      :key="c.name"
      :label="c.title"
      :active="c.name === communityState.id"
      :badge="unreadByCommunity[c.name]"
      :badge-style="badgeStyle"
      @click="goToCommunity(c)"
    >
      <CommunityImage :community="c" />
    </RailItem>
  </div>

  <RailItem label="Search" variant="ghost" icon="lucide-search" @click="..." />
  <UserDropdown />
</Rail>
```

- `Rail` — a bare frame: fixed 50px `bg-surface-sidebar` column + one
  `TooltipProvider` (`hover-delay=0`) + a single default slot. No layout slots,
  no scroll logic. Consumers arrange children with flex utilities.
- `RailItem` — props `label` (tooltip + aria), `icon?` (CSS class) or default
  slot for custom content (images, avatars), `to?: RouteLocationRaw`,
  `active?: boolean`, `badge?: number`, `badgeStyle?: 'count' | 'dot'`,
  `variant?: 'tile' | 'ghost'`. `tile` (default) = filled cell + left indicator
  bar when active (communities); `ghost` = transparent/raised-when-active
  (icon shortcuts). Renders as RouterLink (`to`) or button; emits `click` in
  both cases. `data-slot`/`data-state`/`data-variant` styling hooks.
- Badge rendering (count formatting, teleport-to-`body` pill, `dot`, aria-label)
  is internal (`RailItemBadge`) — folded in Gameplan's `UnreadBadge` +
  `formatUnreadCount`/`unreadAriaLabel`. Library takes neutral `'count' | 'dot'`.

**Two API decisions, resolved:**
1. *Active treatment* — kept **both** via `RailItem` `variant` (`tile` bar+fill
   for communities, `ghost` raised-highlight for shortcuts), rather than forcing
   one canonical style.
2. *Scroll frame* — **not** extracted. Tried `Rail` owning `#top`/default/
   `#bottom` slots + gradients, then a placeable `RailScrollArea`; settled on the
   minimal cut — `Rail` + `RailItem` only, scroll+gradient stays in Gameplan's
   `AppRail.vue` (app-specific polish belongs in the app). The gradient JS
   (`scrollTop`/`scrollHeight` measurement) has no clean cross-browser CSS-at-rest
   equivalent, so it lives at the call site.

### Stays in Gameplan

The scroll container + top/bottom gradient logic, community list + unread
aggregation (`unreadByCommunity`), sidebar badge-style preference, admin gating
(`useCanManageCommunities`), CustomizeSidebarDialog, `showBorder`/
`showCommunityActiveState` route policy (plain props/classes at the call site),
UserDropdown, GameplanLogo, CommunityImage.

### Steps (done)

1. frappe-ui: `Rail` family (`Rail`, `RailItem`, internal `RailItemBadge`) with
   `types.ts`, docs, single-component story, `.cy.ts` (6 passing).
2. Gameplan: rewrote `AppRail.vue` over `Rail`/`RailItem`, keeping the scroll
   region + gradients inline. Deleted `RailIcon.vue`, `UnreadBadge.vue`.
3. Verified on `gameplan-demo.test:8081` (dev:frappe-ui): active indicator +
   dot badge on current community, tile/ghost variants, aria label folds count,
   tooltips, admin item, console clean, `yarn build` green.

Remaining: frappe-ui PR → beta release → Gameplan PR (bump `frappe-ui` dep).

---

## Phase 3 — Sidebar rework ✅ (done, pending PRs)

frappe-ui already had `src/components/Sidebar/` — config-object-driven
(`header: {...}`, `sections: [{ items: [...] }]`), the opposite of the
composition style. Reworked in place (same names, composition-first, the
SettingsDialog `49d2a14ef` refactor replayed) — did **not** ship a second sidebar.

**Three decisions settled with the user reshaped the original sketch below:**
1. **Bare frame (Rail-style), not a structured frame.** `Sidebar` owns width +
   `bg-surface-sidebar` + collapse machinery + one default slot. The app composes
   its own header, scroll region, and footer. Width moved to an inline `width`/
   `collapsedWidth` prop (CSS length) so apps override it without a Tailwind
   class fight (Gameplan `width="14rem"`).
2. **No public `SidebarSection`.** The flat set mirrors `Rail` + `RailItem`:
   `Sidebar` + `SidebarItem` + `SidebarLabel` + `SidebarCollapseToggle`. The old
   section bundled label/`#actions`/`#empty`/grouping — all plain divs the app
   already owns. `SidebarSection` survives **internal-only** as the adapter for
   the deprecated `sections` config prop.
3. **Gameplan stays no-collapse.** Migrated `AppSidebar` is a fixed
   `disable-collapse width="14rem"` panel — pure refactor, pixel parity. The
   frame keeps `v-model:collapsed` for other apps.

### Final API

```vue
<Sidebar disable-collapse width="14rem">
  <div class="p-2"><AppDropdown /></div>          <!-- app pins its own header -->

  <ScrollAreaRoot> <ScrollAreaViewport>           <!-- app owns scroll (styled bar) -->
    <div class="flex items-center justify-between">
      <SidebarLabel>Spaces</SidebarLabel>
      <div class="flex"><Button …sort/><Button …new/></div>   <!-- app owns #actions -->
    </div>

    <SidebarItem v-for="space in spacesList" :to="spaceRoute(space)" :active="…">
      <template #prefix><SpaceIcon :icon="space.icon" /></template>
      {{ space.title }} <LucideLock v-if="space.is_private" />   <!-- default slot = label -->
      <template #suffix>…unread count ↔ options menu (app polish)…</template>
    </SidebarItem>

    <div v-if="!spacesList.length">empty state</div>            <!-- app owns #empty -->
  </ScrollAreaViewport> <ScrollBar /> </ScrollAreaRoot>
</Sidebar>
```

- `SidebarItem` is now a **container** (not a single `<Button>`): a navigable
  main area (`RouterLink`/`button`, keyed off `to`) with the `#suffix` trailing
  zone as a **sibling**, so an options `Dropdown` isn't illegally nested inside a
  link/button. Slots: `#prefix` (fallback `icon`), default (fallback `label`),
  `#suffix`. `active` drives `data-state`; the row's `group/sidebar-item` is the
  hover hook the app uses for the count↔options swap. No `#options` slot — that
  hover-swap is app polish and lives in `#suffix`.
- Compat: `header`/`sections`/`items` config props still work for one release,
  reimplemented on the new sub-components; the existing config-object `.cy.ts`
  still passes to prove it. Mark deprecated; check CRM/Helpdesk/Drive before the
  removal release.

### Steps (done)

1. frappe-ui: reworked `Sidebar` (bare frame, dual-mode: default slot vs legacy
   config fallback), `SidebarItem` (container), new `SidebarLabel` +
   `SidebarCollapseToggle` + internal `SidebarItemIcon`; `SidebarSection` kept as
   legacy adapter (fixed its `isCollapsed`/`isSidebarCollapsed` shadowing).
   `types.ts` (JSDoc, `sidebarToggleKey` added) + `index.ts` + `Sidebar.md`
   anatomy prose + `docs:gen` + 3 stories (Default/Collapsed/Legacy) + rewritten
   `.cy.ts` (6 passing, incl. legacy-compat + sibling-menu). type-check clean,
   `yarn build` green, `docs:dev` boots clean.
2. Gameplan: rebuilt `AppSidebar.vue` over `Sidebar`/`SidebarItem`/`SidebarLabel`,
   keeping AppDropdown, the reka `ScrollArea`/`ScrollBar` trio, NewSpaceDialog,
   and all `@/data/*` logic. Deleted dead code (`communitySpaceList`, `spaces`
   import). `yarn build` green.
3. Verified on `gameplan-demo.test:8080` (dev:frappe-ui): space list w/ icons +
   truncation + private lock, active highlight across routes, unread count↔`…`
   hover swap, sort dropdown + hide-inactive switch, console clean, pixel parity.

Remaining: frappe-ui PR → beta release → Gameplan PR (bump `frappe-ui` dep).

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

## Track B — List family (`frappe-ui/list`)

**Spec: [LIST_FAMILY_SPEC.md](./LIST_FAMILY_SPEC.md)** — independent of
Phases 2–4, can ship in parallel.

Composition-based list primitives under a new subpath export
(`frappe-ui/list` → `src/molecules/list`, same pattern as `frappe-ui/editor`).
The old `ListView` in the main entry stays untouched, so `List`/`ListRow`/
`ListHeader` names are free to reuse. One anatomy, two render modes: feed rows
(Discussions, Drafts, Notifications) and column grids (Members/Communities
settings, People — which collapses to feed on mobile). Includes the
DiscussionRow divider system (auto-inset to text edge, CSS-only between-ness,
hover-hide on both edges), container-owned selection and sort, and optional
virtualization via `ListRows virtual`.

Rollout: frappe-ui PR → beta → Gameplan PR 1 (feed mode) → Gameplan PR 2
(column mode). Details, component specs, and open questions in the spec file.

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
