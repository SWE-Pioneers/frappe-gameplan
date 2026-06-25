/**
 * useDraftSync — keep an in-progress draft synced across reloads, tabs, and devices.
 *
 * Backed by {@link module:data/draftStore} (IndexedDB, instant + durable) in front of a
 * `GP Draft` row on the server (authoritative + cross-device). Every edit is written to
 * IndexedDB immediately and pushed to the server on a debounce. The server row is created
 * lazily on the first saveable change, so we never persist empty drafts.
 *
 * Two kinds of drafts, with opposite identity rules (see {@link DraftIdentity}):
 *  - Singleton (comment-in-progress, in-flight edit): one row per (user, type, mode, target).
 *    Two tabs editing the same thing share it — that is correct, not a collision.
 *  - Standalone (new discussion): each composition is its own row. Two tabs must NOT collide,
 *    so the local key is per-instance until the server assigns a unique name.
 */
import { ref, computed, watch, toValue, nextTick, onScopeDispose, type MaybeRefOrGetter } from 'vue'
import { call, debounce, toast } from 'frappe-ui'
import { session } from './session'
import {
  getDraftRecord,
  putDraftRecord,
  deleteDraftRecord,
  listDraftRecords,
  singletonKey,
  broadcastDraftChange,
  onDraftChange,
  type DraftIdentity,
  type DraftPayload,
  type DraftRecord,
} from './draftStore'

export type { DraftIdentity, DraftPayload } from './draftStore'

const FIND_DRAFT = 'gameplan.gameplan.doctype.gp_draft.gp_draft.find_my_draft'
const COMMIT_DRAFT = 'gameplan.gameplan.doctype.gp_draft.gp_draft.commit_draft'

export interface UseDraftSyncOptions {
  /** What this draft is for. May be reactive. */
  identity: MaybeRefOrGetter<DraftIdentity>
  /** For standalone drafts, the server name bound to the URL (e.g. `?draft=`). Read on load
   *  to resume an existing draft; the composable sets it when it creates the row. */
  draftName?: MaybeRefOrGetter<string | null>
  /** When false, the composable is dormant: no load, no persistence. Flipping it true (e.g.
   *  when an inline editor opens) triggers the initial load + restore. Defaults to true. */
  enabled?: MaybeRefOrGetter<boolean>
  /** Debounce for the server push. IndexedDB writes are always immediate. Defaults to 500ms. */
  debounceMs?: number
  /** Gate persistence on meaningful content. Defaults to "title or body is non-empty". */
  canSave?: (payload: DraftPayload) => boolean
  /** Seed `data` when no stored draft is found (e.g. the live document for an edit). */
  initialPayload?: () => DraftPayload
  /** Called once when the server row is created — lets standalone callers sync the URL. */
  onCreate?: (serverName: string) => void
}

function hasContent(payload: DraftPayload): boolean {
  const body = (payload.content ?? '').trim()
  const title = (payload.title ?? '').trim()
  return (body.length > 0 && body !== '<p></p>') || title.length > 0
}

let instanceCounter = 0

export function useDraftSync(options: UseDraftSyncOptions) {
  const { identity, debounceMs = 500, canSave = hasContent, initialPayload, onCreate } = options

  const data = ref<DraftPayload>(initialPayload ? initialPayload() : { content: '' })
  const ready = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const savedAt = ref<number | null>(null)
  const restored = ref(false)
  // Tracks whether the last server push failed, so we toast once per streak (not per keystroke).
  const pushFailed = ref(false)
  const serverName = ref<string | null>(toValue(options.draftName ?? null))

  // Last local edit vs last successful push, on THIS device. Drives reconciliation
  // without comparing clocks across machines.
  const updatedAt = ref(0)
  const syncedAt = ref<number | null>(null)
  const dirty = computed(() => updatedAt.value > (syncedAt.value ?? 0))

  // Standalone drafts get a per-instance local key so two tabs never share IndexedDB
  // state before a unique server name exists.
  const instanceId = `local-${Date.now()}-${++instanceCounter}`
  const isSingleton = computed(() => {
    const id = toValue(identity)
    return id.mode === 'Edit' || Boolean(id.referenceName)
  })
  const key = computed(() => {
    const id = toValue(identity)
    if (isSingleton.value) return singletonKey(id)
    return serverName.value
      ? `Discussion::New::${serverName.value}`
      : `Discussion::New::${instanceId}`
  })

  const isEnabled = () => toValue(options.enabled ?? true)

  // Suppress the change-watcher while we apply a restored/loaded payload.
  const applying = ref(false)
  function applyPayload(payload: DraftPayload) {
    applying.value = true
    data.value = { ...data.value, ...payload }
    nextTick(() => {
      applying.value = false
    })
  }

  function payloadFromDoc(doc: Record<string, any>): DraftPayload {
    const payload: DraftPayload = { content: doc.content ?? '' }
    if ('title' in data.value) payload.title = doc.title ?? ''
    if ('project' in data.value) payload.project = doc.project ?? null
    return payload
  }

  function identityFields() {
    const id = toValue(identity)
    const fields: Record<string, unknown> = { type: id.type, mode: id.mode }
    if (id.referenceName) {
      fields.reference_doctype = id.referenceDoctype
      fields.reference_name = id.referenceName
    }
    return fields
  }

  function payloadFields() {
    const fields: Record<string, unknown> = { content: data.value.content ?? '' }
    if (data.value.title !== undefined) fields.title = data.value.title ?? ''
    if (data.value.project !== undefined) fields.project = data.value.project || null
    return fields
  }

  let previousKey: string | null = null
  async function persistLocal() {
    const record: DraftRecord = {
      key: key.value,
      identity: toValue(identity),
      payload: { ...data.value },
      serverName: serverName.value,
      updatedAt: updatedAt.value,
      syncedAt: syncedAt.value,
      user: session.user,
    }
    await putDraftRecord(record)
    if (previousKey && previousKey !== record.key) {
      await deleteDraftRecord(previousKey)
    }
    previousKey = record.key
    broadcastDraftChange(record.key)
  }

  async function pushToServer() {
    if (!isEnabled() || !dirty.value || !canSave(data.value)) return
    saving.value = true
    try {
      if (serverName.value) {
        await call('frappe.client.set_value', {
          doctype: 'GP Draft',
          name: serverName.value,
          fieldname: payloadFields(),
        })
      } else {
        const doc = await call('frappe.client.insert', {
          doc: { doctype: 'GP Draft', ...identityFields(), ...payloadFields() },
        })
        serverName.value = doc.name
        onCreate?.(doc.name)
      }
      syncedAt.value = Date.now()
      savedAt.value = syncedAt.value
      await persistLocal()
      pushFailed.value = false
    } catch (error) {
      // Keep the local copy; the next edit (or unmount flush) retries. Standalone
      // new-discussion drafts that never land here are adopted later by
      // recoverOrphanedDrafts(), so a missed push no longer strands a draft locally.
      console.error('Draft sync failed', error)
      // Tell the user once per failure streak so a silently-failing save can't quietly
      // lose server-side persistence. Reset on the next success above.
      if (!pushFailed.value) {
        pushFailed.value = true
        toast.error('Could not save your draft to the server — keeping a local copy and retrying.')
      }
    } finally {
      saving.value = false
    }
  }

  const debouncedPush = debounce(pushToServer, debounceMs)

  watch(
    () => [data.value.title, data.value.content, data.value.project],
    () => {
      if (!ready.value || applying.value || !isEnabled()) return
      updatedAt.value = Date.now()
      if (!canSave(data.value)) return
      void persistLocal()
      debouncedPush()
    },
  )

  async function fetchServerDraft(): Promise<Record<string, any> | null> {
    try {
      if (serverName.value) {
        return await call('frappe.client.get', { doctype: 'GP Draft', name: serverName.value })
      }
      if (isSingleton.value) {
        const id = toValue(identity)
        return await call(FIND_DRAFT, {
          type: id.type,
          mode: id.mode,
          reference_doctype: id.referenceDoctype,
          reference_name: id.referenceName,
        })
      }
    } catch (error) {
      console.error('Draft lookup failed', error)
    }
    return null
  }

  async function load() {
    if (ready.value || loading.value) return
    loading.value = true
    try {
      // The IndexedDB store is origin-wide, so on a shared browser profile a record under
      // this deterministic key may belong to a previously logged-in user. Ignore a record
      // explicitly owned by someone else — restoring it would surface their draft content and
      // sync our edits against their server row. Legacy records (written before the `user`
      // field) are kept for continuity and get stamped on the next save.
      const localRaw = await getDraftRecord(key.value)
      const local =
        localRaw && localRaw.user != null && localRaw.user !== session.user ? null : localRaw
      const server = await fetchServerDraft()

      if (local && local.updatedAt > (local.syncedAt ?? 0)) {
        // Un-pushed local edits take precedence over the server copy.
        applyPayload(local.payload)
        serverName.value = local.serverName ?? server?.name ?? serverName.value
        updatedAt.value = local.updatedAt
        syncedAt.value = local.syncedAt
        previousKey = local.key
        restored.value = hasContent(local.payload)
      } else if (server) {
        applyPayload(payloadFromDoc(server))
        serverName.value = server.name
        syncedAt.value = Date.now()
        updatedAt.value = syncedAt.value
        await persistLocal()
        restored.value = hasContent(payloadFromDoc(server))
      } else if (local) {
        applyPayload(local.payload)
        serverName.value = local.serverName ?? null
        updatedAt.value = local.updatedAt
        syncedAt.value = local.syncedAt
        previousKey = local.key
        restored.value = hasContent(local.payload)
      } else if (initialPayload) {
        applyPayload(initialPayload())
      }
    } finally {
      ready.value = true
      loading.value = false
    }
  }

  watch(
    () => isEnabled(),
    (enabled) => {
      if (enabled) void load()
    },
    { immediate: true },
  )

  // Keep sibling tabs of the same draft coherent — but never clobber un-pushed edits
  // typed in this tab.
  const unsubscribe = onDraftChange(async (changedKey) => {
    if (changedKey !== key.value || dirty.value || !ready.value) return
    const record = await getDraftRecord(key.value)
    if (record) {
      applyPayload(record.payload)
      serverName.value = record.serverName ?? serverName.value
      updatedAt.value = record.updatedAt
      syncedAt.value = record.syncedAt
    }
  })

  function reset() {
    debouncedPush.cancel?.()
    serverName.value = null
    updatedAt.value = 0
    syncedAt.value = null
    savedAt.value = null
    restored.value = false
    previousKey = null
    applyPayload(initialPayload ? initialPayload() : { content: '' })
  }

  /** Drop the local copy and reset, leaving the server untouched. Use after a finalize
   *  that already removed the server row (e.g. publish). */
  async function forget() {
    const localKey = key.value
    reset()
    await deleteDraftRecord(localKey)
    broadcastDraftChange(localKey)
  }

  /** Force any pending change to the server now (creating the row if needed). */
  async function flush() {
    debouncedPush.cancel?.()
    await pushToServer()
    return serverName.value
  }

  /** Discard the draft entirely: delete the server row (if any) and the local copy. */
  async function clear() {
    const name = serverName.value
    await forget()
    if (name) {
      try {
        await call('frappe.client.delete', { doctype: 'GP Draft', name })
      } catch (error) {
        console.error('Failed to delete draft', error)
      }
    }
  }

  /** Finalize an edit/comment draft after its content has been saved onto the target:
   *  migrate attachments server-side, delete the row, drop the local copy. */
  async function commit() {
    debouncedPush.cancel?.()
    const name = serverName.value
    const id = toValue(identity)
    const localKey = key.value
    reset()
    await deleteDraftRecord(localKey)
    broadcastDraftChange(localKey)
    if (name && id.referenceDoctype && id.referenceName) {
      try {
        await call(COMMIT_DRAFT, {
          name,
          reference_doctype: id.referenceDoctype,
          reference_name: id.referenceName,
        })
      } catch (error) {
        console.error('Failed to commit draft', error)
      }
    } else if (name) {
      // No target to migrate into (shouldn't happen for singletons) — just delete.
      try {
        await call('frappe.client.delete', { doctype: 'GP Draft', name })
      } catch (error) {
        console.error('Failed to delete draft', error)
      }
    }
  }

  onScopeDispose(() => {
    unsubscribe()
    // Best-effort: push un-synced edits as we leave so nothing is lost on navigation.
    if (dirty.value && canSave(data.value)) void pushToServer()
  })

  return {
    data,
    ready,
    saving,
    savedAt,
    /** There are local edits not yet pushed to the server. */
    dirty,
    /** A pre-existing draft was found and restored on load. */
    restored,
    serverName,
    flush,
    clear,
    commit,
    forget,
  }
}

export type DraftSync = ReturnType<typeof useDraftSync>

/**
 * Adopt new drafts that are stranded in IndexedDB with no server row. A draft only reaches
 * the (server-backed) Drafts list once its `GP Draft` row is created on the first
 * successful push. If that push never lands — offline, a server hiccup, or the composer
 * closing inside the debounce window — the draft lives on only locally and never appears in
 * the list. This covers both orphan shapes:
 *  - Standalone new discussions: keyed per-instance, so a later session never reconstructs
 *    the key to retry the push.
 *  - Comment replies: keyed deterministically (singleton), so a revisit would retry — but
 *    only if the user reopens that exact discussion. Until then the draft is invisible.
 *
 * This sweep is the safety net: it finds those orphans (mode New, no serverName, has
 * content), creates their rows, and lines the local record up with the new server name.
 * Returns how many drafts were recovered.
 */
export async function recoverOrphanedDrafts(): Promise<number> {
  const records = await listDraftRecords()
  let recovered = 0
  for (const record of records) {
    const id = record.identity
    // The IndexedDB store is origin-wide, so on a shared browser profile it can hold drafts
    // authored by a previously logged-in user. Never adopt those as the current user —
    // inserting them would surface another account's private content under this one. Records
    // written before the `user` field exists are treated as not-mine and skipped.
    if (record.user !== session.user) continue

    // Only brand-new drafts can be orphaned: an Edit draft already has a server doc, and a
    // record carrying a serverName already created its row.
    if (id.mode !== 'New' || record.serverName || !hasContent(record.payload)) continue

    const isStandaloneDiscussion = id.type === 'Discussion' && !id.referenceName
    const isCommentReply = id.type === 'Comment' && Boolean(id.referenceName)
    if (!isStandaloneDiscussion && !isCommentReply) continue

    // A reply whose parent discussion was deleted or moved out of reach can't be routed to:
    // get_my_drafts drops it because the parent won't resolve. Recovering it anyway would
    // create an orphan row and mark the local draft "recovered" so it never retries or shows.
    // Skip it unless the parent still resolves under the current user's permissions.
    if (isCommentReply && !(await parentDocResolves(id.referenceDoctype, id.referenceName))) {
      continue
    }

    try {
      // Comment drafts have a deterministic server identity (type + mode + reference), so a
      // prior recovery may have inserted the row before crashing ahead of the local update.
      // Adopt that existing row instead of inserting a duplicate. Standalone discussions have
      // no such key, so a tiny insert-then-crash window remains (unchanged, pre-existing).
      let doc = isCommentReply
        ? await call(FIND_DRAFT, {
            type: id.type,
            mode: id.mode,
            reference_doctype: id.referenceDoctype,
            reference_name: id.referenceName,
          })
        : null

      if (!doc) {
        const fields: Record<string, unknown> = { content: record.payload.content ?? '' }
        if (record.payload.title !== undefined) fields.title = record.payload.title ?? ''
        if (record.payload.project !== undefined) fields.project = record.payload.project || null
        if (isCommentReply) {
          fields.reference_doctype = id.referenceDoctype
          fields.reference_name = id.referenceName
        }

        doc = await call('frappe.client.insert', {
          doc: { doctype: 'GP Draft', type: id.type, mode: id.mode, ...fields },
        })
      }

      // Standalone discussion drafts re-key from their per-instance id to the server name;
      // comment replies keep their deterministic singleton key and only gain a serverName.
      const newKey = isCommentReply ? singletonKey(id) : `Discussion::New::${doc.name}`
      await putDraftRecord({ ...record, key: newKey, serverName: doc.name, syncedAt: Date.now() })
      if (newKey !== record.key) await deleteDraftRecord(record.key)
      broadcastDraftChange(newKey)
      recovered++
    } catch (error) {
      console.error('Failed to recover orphaned draft', error)
    }
  }
  return recovered
}

/** Whether a referenced document still exists and is readable by the current user.
 *  get_value is permission-checked, so a deleted doc or one in a now-inaccessible space
 *  comes back empty — exactly the cases where recovering a reply draft would strand it. */
async function parentDocResolves(
  doctype: string | null | undefined,
  name: string | null | undefined,
): Promise<boolean> {
  if (!doctype || !name) return false
  try {
    const res = await call('frappe.client.get_value', { doctype, filters: { name }, fieldname: 'name' })
    return Boolean(res?.name)
  } catch {
    return false
  }
}
