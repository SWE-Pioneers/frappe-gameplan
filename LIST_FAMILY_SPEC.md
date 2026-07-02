# List Family Spec — `frappe-ui/list`

Composition-based list primitives for Frappe apps, shipped as a new subpath
export. Replaces the hand-rolled list layouts in Gameplan (Discussions, Drafts,
Notifications, People, Members/Communities settings) and, eventually, the
config-driven `ListView` in the main entry.

Follows the principles in [SHELL_EXTRACTION_PLAN.md](./SHELL_EXTRACTION_PLAN.md):
consumer template first, placeable components over composable wiring, infer
context instead of adding options, semantic tokens only, styling hooks via
`data-slot`/`data-state`, never `*Class` props.

---

## Why a subpath

- `frappe-ui/list` → `src/molecules/list/index.ts`, same pattern as
  `frappe-ui/editor` → `src/molecules/editor` (wired via `exports` in
  `package.json`).
- The old `ListView` family in the main entry stays untouched — no breaking
  change, no compat layer. Existing consumers (CRM, Helpdesk, Drive) are
  unaffected.
- The import path disambiguates, so the good names are free to reuse:
  `List`, `ListRow`, `ListHeader`, `ListCell`.
- Once this family covers `ListView`'s use cases, mark `ListView` as legacy in
  docs. Note: during the transition, editor auto-import may offer `ListRow`
  from both entries — docs should steer to `frappe-ui/list`.

## One grid — feed rows are the default column template

Every list surface is a column grid; a feed row is just the default template.
It is a 3-column grid — `[auto, minmax(0,1fr), auto]` = leading media,
content, right-aligned trailing — plus the inset divider, which spans the
grid from the content column onward so it starts at the text edge by
construction (exact spans in Divider system). Rows are
always filled with `ListCell`s — there is no separate "feed shape". What goes
*inside* a cell is app content: typography, avatars, badges, unread emphasis.
The family owns geometry — columns, dividers, hover surfaces, selection and
sort chrome — and nothing readable.

| Consumers | Column template |
| --- | --- |
| Discussions, Drafts, Notifications | default (`auto`, `minmax(0,1fr)`, `auto`) |
| Members Settings, Communities Settings, People (desktop) | explicit `columns` prop + `ListHeader` |

People is the proof: explicit columns on desktop, and collapsing on mobile is
just overriding the `--list-columns` var back to the default template with a
responsive class — no dedicated API (see `List` below).

One real layout difference remains: each `ListRow` is its own grid sharing the
`--list-columns` template, so `auto` tracks size independently per row. That
is exactly right for feed rows (trailing widths vary row to row) and exactly
wrong for tables — which is why table-style lists must pass deterministic
track sizes (fixed / `minmax` rem values), as all current consumers already
do.

### What this fixes (current hand-rolled state)

- Three different divider treatments: bare `border-t` (DiscussionRow),
  `border-outline-gray-1` (DiscussionRowSkeleton),
  `border-outline-elevation-2` (Drafts); People uses a fourth (`mx-2 border-b`,
  no hover-hide).
- `index`/`total` props threaded through every row only to hide the last
  divider.
- Grid templates duplicated as string literals between header and rows
  (`grid-cols-[minmax(0,1fr)_12.5rem_7.5rem_2rem]` twice in MembersSettings;
  same pattern twice in CommunitiesSettings and People). Drift silently
  misaligns columns.
- An inline `h()`-rendered SortHeader in MembersSettings.
- Manual virtualization wiring: `useVirtualList` pointed at SettingsBody's
  viewport via `watchEffect` + scroll-event forwarding
  (`MembersSettings.vue`).

---

## Target API

### Feed mode (Discussions)

```vue
<List v-model:selection="selectedDiscussions" :selectable="selectable">
  <ListRow v-for="d in discussions" :key="d.name" :value="d.name" :to="discussionRoute(d)">
    <ListCell><UserAvatarWithHover :user="d.owner" size="2xl" /></ListCell>
    <ListCell>
      <!-- app content: title + meta line, unread weight
           (Gameplan's own shared component across its feed pages) -->
    </ListCell>
    <ListCell class="justify-end">
      <!-- app content: timestamp, unread badge -->
    </ListCell>
  </ListRow>
</List>
```

### Column mode (Members Settings)

```vue
<List :columns="['minmax(0,1fr)', '12.5rem', '7.5rem', '2rem']" :row-height="60">
  <ListHeader>
    <!-- sort state, toggle rules, and glyphs are app code; the cell renders
         the chrome for whatever `direction` it's handed -->
    <ListHeaderCellSort :direction="directionFor('name')" @click="toggleSort('name')">
      User
      <template #suffix="{ direction }"><SortIcon :direction="direction" /></template>
    </ListHeaderCellSort>
    <ListHeaderCellSort :direction="directionFor('role')" @click="toggleSort('role')">
      Role
      <template #suffix="{ direction }"><SortIcon :direction="direction" /></template>
    </ListHeaderCellSort>
    <ListHeaderCellSort :direction="directionFor('creation')" @click="toggleSort('creation', 'desc')">
      User since
      <template #suffix="{ direction }"><SortIcon :direction="direction" /></template>
    </ListHeaderCellSort>
    <ListHeaderCell class="justify-end" />
  </ListHeader>
  <ListRows :items="filteredUsers" virtual v-slot="{ item: user }">
    <ListRow>
      <ListCell><!-- avatar + name/email --></ListCell>
      <ListCell><Select :options="roleOptions" /></ListCell>
      <ListCell>{{ memberSince(user) }}</ListCell>
      <ListCell class="justify-end"><Button variant="ghost" icon="lucide-trash-2" /></ListCell>
    </ListRow>
  </ListRows>
</List>
```

---

## Components

### `List`

The container. Owns everything that must be consistent across rows.

Props:

- `columns?: string[]` — grid track sizes. Written to a `--list-columns` CSS
  var that `ListHeader` and `ListRow` consume, so header and rows can never
  drift. Defaults to the feed template `['auto', 'minmax(0,1fr)', 'auto']`
  (leading, content, trailing). Table-style lists must use deterministic track
  sizes — `auto` tracks size per row (see above).

  `--list-columns` is a **public styling hook**, not an implementation detail.
  Responsive layout variation is deliberately *not* API — apps override the
  var with plain CSS at whatever breakpoint they want. People collapsing to a
  feed list on mobile is just:

  ```vue
  <List
    :columns="['minmax(8rem,1fr)', '5.5rem', '5.5rem', '5.5rem', '5.5rem']"
    class="max-sm:[--list-columns:auto_minmax(0,1fr)_auto]"
  >
  ```

  with `max-sm:hidden` on the numeric cells and on the `ListHeader`. Any other
  variation (different templates per breakpoint, a denser tablet layout) works
  the same way without new props.

  Column gap follows the same contract: header and rows apply
  `gap: var(--list-gap, 0.5rem)`, and the var is a public hook (Members uses
  the default; Communities sets `3rem`, People `1.5rem`). Like the template,
  it lives on the List so header and rows can never disagree.

  Authoring: the frappe-ui Tailwind preset ships `list-gap-*` and
  `list-row-px-*` utilities (spacing scale + variants + arbitrary values) as
  sugar over `--list-gap` / `--list-row-padding-x`, e.g.
  `max-sm:list-gap-3 sm:list-gap-4`.
- `divider?: 'inset' | 'full' | 'none'` — defaults to `'inset'` with the
  default template, `'full'` with explicit `columns`.
- `selectable?: boolean` — reveals the checkbox column (animated) and switches
  row click from navigate to toggle. Implementation note: the row grid is
  always `var(--list-checkbox-width, 0px) var(--list-columns)` — the checkbox
  track exists at `0px` even when not selectable, and the reveal animates the
  var to `32px`. Keeping the track always present means grid line numbers
  never shift, so the divider spans (see Divider system) are constants and app
  columns are unaffected.
- `rowHeight?: number` — px; sets `--list-row-height`. Required for
  virtualization; otherwise rows use `min-height`. Responsive heights
  (Discussions is 68px mobile / 60px desktop) are non-virtual — set them with
  classes on the rows, not this prop.

Models:

- `v-model:selection: string[]` — selected row `value`s.

Sort is deliberately not a List model. Sort state, toggle rules, and the
ordering itself (client-side comparator or `useList` orderBy) are app code;
the family only renders chrome for whatever direction the app hands each
`ListHeaderCellSort`.

Provides context (column template, divider policy, selection state) to
descendants via injection — none of it is public API.

### `ListRow`

Props:

- `to?: RouteLocationRaw` — renders as RouterLink; no `to` + click listener →
  button; neither → plain div.
- `value?: string` — selection key; required when the list is selectable.

Default slot: `ListCell` children, aligned to the List's `--list-columns`
grid. That's the only way to fill a row — no separate feed shape, no
slot-presence mode switching. Feed rows are three cells on the default
template; cell contents (title/subtitle typography, unread emphasis, badges)
are entirely app-authored.

Emits: `click` (only when not a link). Selection toggling is internal — click
when selectable, plus Enter/Space and checkbox interaction — and surfaces only
through `v-model:selection` on `List`.

Behavior owned by the row:

- Hover surface: `sm:rounded-[10px] sm:hover:bg-surface-gray-1`,
  `active:bg-surface-gray-2` (mobile press). Marked `data-interactive` when it
  is a link/button — the divider hover-hide keys off this, so non-interactive
  rows (Members) keep their dividers on hover.
- The animated checkbox reveal (width `0 → 32px` transition + scale-in),
  ported from DiscussionRow.
- Its own divider element (see Divider system).

### `ListCell`

No props. Grid child of the row; a flex container with `items-center`,
`min-w-0` + truncation-friendly by default. Alignment is deliberately not
API — cells take justify utilities as plain classes (`class="justify-end"`
for People's numeric columns), responsively if needed.

### `ListHeader` / `ListHeaderCell` / `ListHeaderCellSort`

`ListHeader` renders the header row on the shared `--list-columns` grid
(`h-8`, `text-sm text-ink-gray-5`, bottom border). Apps that collapse columns
responsively hide it the same way (`max-sm:hidden`).

`ListHeaderCell` is the plain variant — just geometry: a truncating label
and plain `#prefix` / `#suffix` adornment slots. No props, no sort API.
Like `ListCell`, alignment is a class (`class="justify-end"` on People's
numeric column headers).

`ListHeaderCellSort` is the sortable variant, and it is controlled — it
holds no sort state:

- `direction?: 'asc' | 'desc' | null` — the column's active sort direction,
  `null`/omitted when inactive. The cell is a real `<button>` with
  `aria-sort` and an "Order by …" tooltip — replacing MembersSettings'
  inline `h()` SortHeader. The app updates its own sort state in the `click`
  handler; toggle rules and first-click direction are app code.
- Scoped slots `#prefix` / `#suffix` (both receive `{ direction }`) for
  app-supplied adornments; sort glyphs go in `#suffix`. The cell owns only
  the reveal behavior: an inactive column's suffix shows on hover.

Both variants render the same `data-slot="list-header-cell"` /
`role="columnheader"` geometry, so mixing them in one header (sortable
columns plus a plain "Actions" cell) is seamless. Component choice is the
mode switch — there is no `sortable` prop and no click-listener inference.

### `ListRows`

The iteration helper — a renderless `v-for` with optional windowing:

- Props: `items: T[]`, `virtual?: boolean | { itemHeight?: number; overscan?: number }`.
- Scoped slot: `{ item, index }`.
- `virtual` wraps vueuse `useVirtualList`. `itemHeight` defaults to the List's
  `rowHeight`. The scroll container is discovered automatically: the Phase 4
  scroll-container registry when available, else the nearest scrollable
  ancestor — replacing MembersSettings' manual `watchEffect` +
  scroll-forwarding into SettingsBody.
- Plain `v-for` of `ListRow` without `ListRows` stays fully supported. The
  underlying composable (`useVirtualRows`) is exported for exotic cases.

### Not in v1 (design for, don't build)

`ListSectionHeader` (the "Pinned" group label), `ListRowSkeleton`,
`ListEmptyState`. Gameplan keeps its own EmptyStateBox/skeletons until the
family stabilizes.

---

## Divider system

DiscussionRow's behavior, systematized. Three requirements from the original
design: start at the text edge (not the avatar), hide around the hovered row,
never render after the last row.

Mechanics:

1. **Divider-above, placed on the grid.** Each row renders one zero-height
   divider element overlaid at the top of its grid (`grid-row: 1`,
   `align-self: start`, `pointer-events: none`). Track 1 is always the
   checkbox track (see `selectable`), so the spans are constants:
   `divider="full"` spans `grid-column: 2 / -1` (everything after the
   checkbox track) and `divider="inset"` spans `3 / -1` (everything after the
   leading column — the text edge). The inset tracks the leading column's
   actual width with no `ml-16` magic number, because the grid line *is* the
   text edge. Corollary: a row that wants a text-aligned divider keeps its
   media in the leading column, not inside a combined first cell.
2. **Between-ness is pure CSS**, no `index`/`total` props:

   ```css
   [data-slot='list-row'] [data-slot='list-divider'] { opacity: 0; }
   [data-slot='list-row'] + [data-slot='list-row'] [data-slot='list-divider'] { opacity: 1; }
   ```

   The first row never shows one; trailing "Load more" buttons don't break it;
   it keeps working inside the virtualizer wrapper because windowed rows stay
   siblings (the first *rendered* row's missing divider sits at the window's
   top seam — overscan keeps it off-screen).
3. **Hover hides both edges** — the hovered row's own divider *and* the next
   row's — so the rounded hover surface floats free (a deliberate upgrade;
   today only the divider below hides):

   ```css
   [data-slot='list-row'][data-interactive]:hover [data-slot='list-divider'],
   [data-slot='list-row'][data-interactive]:hover + [data-slot='list-row'] [data-slot='list-divider'] {
     opacity: 0;
   }
   ```

   Gated on `data-interactive` so static rows (Members) keep their dividers.
4. **One token** (`border-outline-gray-1`, `transition-opacity`) replaces the
   four current variants.

---

## Styling hooks

`data-slot`: `list`, `list-header`, `list-header-cell`, `list-row`,
`list-cell`, `list-row-checkbox`, `list-divider`.

`data-state` / attributes: row `data-state="selected"`, `data-interactive`;
header cell `data-sort="asc" | "desc"` (absent when inactive).

Semantic tokens only; no color shades (Gameplan rule: gray only — the unread
amber badge stays app-authored content in its trailing cell).

## Accessibility

- Without a `ListHeader`: `role="list"` / `role="listitem"`.
- With a `ListHeader`: `role="table"` / `row` / `columnheader` / `cell`;
  `aria-sort` on the active header cell. Header presence is the signal — there
  is no mode prop.
- Selectable rows: checkbox has `role="checkbox"`, `aria-checked`, `tabindex`,
  Enter/Space toggling (ported from DiscussionRow).
- Sort header cells are real `<button>`s with an "Order by …" tooltip.

---

## Out of scope (scope guard)

Not a data grid, and not a typography system. No column resizing, no
cell-renderer registry, no built-in data fetching, no pagination — that's the
config-driven road the old `ListView` went down. No cell content components
either (title/subtitle rhythm, unread emphasis) — cells are app-authored.
This family is layout geometry; data, behavior, and everything readable stay
in app code.

---

## Rollout

1. **frappe-ui PR** — `src/molecules/list/` (components + `useVirtualRows`),
   `"./list"` export in `package.json`, `types.ts` per component, colocated
   docs (`yarn docs:gen`), stories, `.cy.ts` component tests. Beta release.
2. **Gameplan PR 1 (feed mode)** — DiscussionRow/DiscussionList, Drafts,
   Notifications. Deletes divider plumbing and `index`/`total` props; aligns
   DiscussionRowSkeleton to the shared divider token. Adds a small
   Gameplan-side two-line content component shared by the three feed pages
   (title + meta line, unread weight) — a graduation candidate for frappe-ui
   only if other apps converge on the same shape.
3. **Gameplan PR 2 (column mode)** — MembersSettings (virtualization via
   `ListRows virtual`), CommunitiesSettings (CommunityRow + members/spaces
   lists), People — the stress test for the responsive `--list-columns`
   override recipe and per-cell responsive visibility.
4. **Follow-up candidates** — TaskList, Bookmarks, MyPages, Search results,
   MobileListRow (More page); adopt in one non-Gameplan app (CRM/Helpdesk) to
   validate the API isn't Gameplan-shaped.

Per-PR verification: divider hover behavior desktop, 390px mobile (People
collapse, press states), selection reveal animation (Discussions/Drafts), sort
headers (app-owned toggle rules, suffix hover reveal), virtual scrolling with a large
member list (no scroll drift against SettingsBody), dark mode, console clean.
Migration sweep rule from the plan applies: check `<Name` template usages
against imports, not just import lines.

---

## Implementation notes (as built in frappe-ui `src/molecules/list/`)

Two mechanical deviations from the spec above — same observable behavior,
different CSS plumbing:

- **The checkbox column is not a grid track.** A 0px first track would still
  get a `column-gap` next to it, giving every non-selectable list a phantom
  leading gap (0.5rem default, 3rem for Communities). Instead the row's
  `padding-inline-start` is `calc(var(--list-checkbox-width, 0px) + inset)`
  (the List sets the var to `32px` when selectable; the padding is the
  animated reveal) and the checkbox is an absolutely-positioned overlay in
  the padding area. Grid line numbers still never shift.
- **Dividers are absolutely-positioned grid children**, not in-flow items:
  in-flow explicit placement at `grid-row: 1` would block the cells'
  auto-placement. Abs-pos grid children resolve `grid-column` against the
  shared template without occupying cells, so `inset` spans `2 / -1` and
  `full` spans `1 / -1` (one less than the spec's track-based numbering,
  since the checkbox track doesn't exist). The inset divider still starts at
  the content column's edge by construction.

Also: structural row/header rules use plain `[data-slot]` attribute
specificity (not `:where()`) so Tailwind preflight's `button { padding: 0 }`
can't defeat them on button rows; only the `--list-columns` default is
zero-specificity, keeping the class-override recipe working. Interactive
rows get a `0.75rem` content inset by default, overridable via
`--list-row-padding-x`.

## Open questions

- **People's mobile content variation**: the layout swap is solved (override
  `--list-columns` responsively), and content lives in app-authored cells, so
  in principle responsive classes cover it (mobile-only stats line inside the
  first cell, `max-sm:hidden` numeric cells). Confirm during Gameplan PR 2
  that this stays readable in practice; if not, the fix is an app-side wrapper
  component, not new List API.
- **Row `active` state** (People uses `exact-active-class`): rely on
  RouterLink's built-in active classes, or add an `active` prop for parity
  with Rail/Sidebar items?
- **Selection model**: `string[]` matches current Gameplan state; revisit
  `Set<string>` if large-list toggle performance matters.
- **Sort tooltip**: keep the "Order by …" Tooltip inside `ListHeaderCellSort`
  or drop it (title attribute) to avoid the Tooltip dependency in the
  subpath. Softened by the cell split: only headers that use the sort
  variant pull in Tooltip at all.
