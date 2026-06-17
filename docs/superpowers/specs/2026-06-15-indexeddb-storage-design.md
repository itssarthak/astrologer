# IndexedDB storage migration — design

**Date:** 2026-06-15
**Status:** Implemented (TDD; all gates green — see below)
**Scope:** Move app persistence from localStorage to IndexedDB, with localStorage kept as a transparent fallback. Add a storage-usage warning flag.

## Motivation

All four drivers apply:

- **Size limits** — chat history grows unbounded; localStorage's ~5MB cap is (or will be) hit.
- **Write performance** — `appendMessage` currently rewrites the entire history array as JSON on every message. Per-record IndexedDB writes avoid that.
- **Robustness / structure** — real object stores with indexes instead of JSON blobs.
- **Standardization** — IndexedDB as the primary persistence primitive for app data.

## Current state (what exists today)

All storage is synchronous localStorage under `src/lib/storage/`:

- `chat.js` — per-`(profileId, tab)` chat history (the unbounded store).
- `profiles.js` — birth profiles list + active profile id.
- `keys.js` — API key singleton; uses the `storage` event for cross-tab sync (`subscribeApiKey`).
- `today.js` — daily transit cache per profile.

Two small ephemeral stores live outside `lib/storage` and are **out of scope** (see Decisions): GitHub star-count cache (`GitHubLink.jsx`), TTS auto-speak + voice-URI prefs (`useTextToSpeech.js`).

**The crux:** every consumer reads storage *synchronously at mount*:
`ProfilesContext` (`useState(() => getProfiles())`), `useApiKey`, `useChatThread`, `TodayTab`, and critically `tools.js` reads `getActiveProfile()`/`getProfiles()` *during LLM tool execution*. IndexedDB is async-only, so bridging that gap without rippling `await` everywhere is the central design problem.

## Chosen approach: A — Hybrid (sync cache + async chats)

Rejected alternatives:

- **B — fully async everywhere:** every getter returns a Promise; root bootstrap; guards/tests/tools all handle loading. "Textbook correct" but maximal churn in a live app.
- **C — `idb-keyval`/`localForage`:** thin async KV wrapper; still has the async ripple of B, adds a dependency, and KV doesn't give structured per-message records for chats.

Approach A delivers all four motivations with the smallest blast radius: small always-needed data is hydrated into a synchronous in-memory cache (so guards and `tools.js` are untouched), and only chats — the one large/unbounded store — go fully async.

## Architecture & schema

A new `src/lib/storage/db.js` owns one IndexedDB database (`askmyastro`, versioned) and the low-level async primitives: `open()` (creates/upgrades schema in `onupgradeneeded`, detects availability once), `idbGetAll`, `idbGet`, `idbPut`, `idbDelete`, and an index query for messages.

Object stores:

- `kv` — singletons: API key, active-profile-id (key → value).
- `profiles` — one record per profile, keyed by `id`.
- `today` — daily transit cache, keyed by `profileId`.
- `messages` — **one record per chat message**, keyed by message `id`, with an index on `[profileId, tab]` for per-thread reads and a `seq`/timestamp for ordering. This is what delivers per-record appends instead of whole-array rewrites.

The existing module files (`chat.js`, `profiles.js`, `keys.js`, `today.js`) **keep their public function names** and delegate to `db.js` + the cache. Consumers barely change.

## localStorage fallback semantics (replaces any explicit migration)

No migrate-then-clear step. localStorage stays as a permanent fallback, which collapses migration risk and IDB-unavailability into one mechanism.

- **Reads:** IndexedDB first; on a miss *or* if IDB is unavailable, read localStorage. Legacy data is read from its old home and "migrates" lazily the next time that record is written.
- **Writes (small stores — profiles, key, today):** dual-write to **both** IDB and localStorage. They're tiny, so the mirror is a free safety net.
- **Writes (chats):** when IDB is available, write to **IDB only** — this is what actually relieves the localStorage size cap. Legacy chat threads still *read* from localStorage as fallback; if IDB is unavailable, chats fall back to localStorage writes too (degraded mode, old size limits — acceptable).
- **No deletes.** Old localStorage entries remain as a safety net.

## Sync cache + hydration gate

**"Hydration"** = loading data out of IndexedDB into a plain module-level in-memory variable once at startup, so the rest of the app can read it synchronously. We pay the async cost exactly once, up front; synchronous getters then read the variable with unchanged signatures.

```js
// db.js — cache at module scope
let cache = { profiles: [], activeProfileId: null, apiKey: null, today: {} }
let ready = false

export async function hydrate() {
  await open()
  cache.profiles = await idbGetAll('profiles')   // slow async part, paid once
  cache.apiKey   = await idbGet('kv', 'apiKey')
  // ...today, activeProfileId, seeding from localStorage where IDB is empty
  ready = true
}

// profiles.js — synchronous, unchanged signature
export function getProfiles() { return cache.profiles }
```

**Hydration gate at the root:** a `<StorageGate>` wrapper (above `ProfilesProvider`) calls `hydrate()` in an effect, holds a `ready` flag, and renders a splash/null until ready. This prevents the gap where a guard reads an empty cache and wrongly bounces an existing user to onboarding (the "onboarding flash"). Routes mount only after the cache is populated.

Startup sequence:

1. App boots → `StorageGate` shows splash, calls `hydrate()`.
2. `hydrate()` does the one-time async load from IDB (seeding from localStorage where empty).
3. `ready` flips true → routes render.
4. From here, every `getProfiles()`/`getApiKey()`/`getActiveProfile()` is an instant synchronous cache read.

**After hydration the public API is unchanged:**

- *Sync getters* (`getProfiles`, `getActiveProfile`, `getApiKey`, `getTodayTransit`) read the cache → **`ProfilesContext`, `useApiKey`, and `tools.js` need zero changes.**
- *Setters* update the cache synchronously (React state + next sync read stay correct) **and** fire-and-forget the async IDB write + localStorage mirror. Write failures are logged; the cache stays authoritative for the session.

**Chats are the one async consumer** (deliberately not globally cached — potentially large, needed one screen at a time):

- `getHistory` → `loadHistory` (async; reads the `[profileId, tab]` index ordered; falls back to legacy localStorage).
- `appendMessage` → async per-record put.
- `clearHistory` → async delete of that thread's records (+ remove legacy localStorage key).
- `useChatThread` changes from `useState(() => getHistory())` to init-`[]`-then-load-in-effect; its post-send re-sync becomes an async load.
- `useChat` awaits its `appendMessage` calls.

That is the bulk of the consumer churn — contained to two hooks.

**Cross-tab key sync:** the `storage` event is dead for IDB; replace it in `keys.js` with a `BroadcastChannel` to preserve the current cross-tab behavior of `subscribeApiKey`.

## Storage-usage warning flag

- `useStorageEstimate()` wraps `navigator.storage.estimate()` → `{ usage, quota, percent }` (covers IDB + localStorage + caches for the origin, so it reflects the real quota). Refreshes on mount, after chat writes, and on tab-visibility regain. If the API is missing, returns `null` and nothing renders.
- **Threshold ≥ 90%** → render a small flag in the **Sidebar footer**: e.g. `⚠ Storage almost full · 92%`, with a tooltip hinting the user can clear old chats. Dismissible for the session; re-surfaces if usage climbs another step (e.g. crosses 95%).
- Degraded mode (no `navigator.storage.estimate`): fall back to measuring localStorage bytes against an assumed ~5MB. If nothing is measurable, the flag never renders (no false alarms).
- UI-only — no agent wiring. The CLAUDE.md agent/UI sync rule governs *computed astrology data*, which this is not.

## Error handling & degraded path

- **Availability decided once** at `hydrate()` via `open()` → a module-level `idbAvailable` flag the whole layer reads. No scattered per-call try/catch.
- **Normal path:** reads from cache (small) or the `messages` index (chats); writes to IDB (+ localStorage mirror for small stores). A write rejection (e.g. quota mid-session) is caught and `console.warn`'d; the cache stays authoritative so the UI doesn't lose the action. A quota failure also trips the storage flag, so the user is already being told to free space.
- **Degraded path** (`idbAvailable === false`): every getter/setter routes to the old localStorage code paths. App behaves exactly as today, including the ~5MB cap. There is no state where storage simply breaks. The hydration gate still resolves (it never hangs on a DB that won't open) — into degraded mode.
- **Corruption:** reads stay defensive (`try/catch → [] / null`), same as today. A single unreadable profile/thread is skipped, never fatal (mirrors the existing "one bad profile must never break the app" principle in `useProfileMigration`).

## Testing

Per CLAUDE.md, tests are the bar.

- **Unit (vitest + `fake-indexeddb` dev dep):**
  - `db.js`: schema/upgrade creates all stores + `[profileId, tab]` index; get/put/delete/index-query round-trip.
  - Store modules: getter/setter through the cache; write-through lands in IDB; fallback reads return legacy localStorage when IDB empty; degraded mode (`idbAvailable=false`) routes to localStorage.
  - `chat.js`: per-record append, ordered load, clear deletes only the right thread, legacy-thread read fallback.
  - `useStorageEstimate`: ≥90% → flag; missing API → no flag; degraded localStorage measurement.
- **Component/hook (@testing-library/react):**
  - `<StorageGate>` shows splash until hydrated, then children; existing-user profile does **not** flash onboarding.
  - `useChatThread` async load: messages appear after mount; post-send re-sync; profile-switch reload.
- **E2E (playwright):** existing chat/profile flows still pass unchanged (proves the public-API-preserving design held); new spec: create profile → send messages → reload → data persists from IDB.

**Merge gates:** `.venv-test/bin/python -m pytest tests/python`, `npx vitest run`, `npx playwright test`, `npm run lint` (0 errors), `npm run build`.

## Rollout

Ship plainly — the localStorage fallback *is* the safety mechanism. First load lazy-migrates as records are touched; existing users notice only more headroom. No data-loss window because localStorage is never deleted.

## Decisions / out of scope

- **GitHub star cache + TTS prefs stay on localStorage** (YAGNI): trivially small, genuinely ephemeral, no size pressure. Reversible if full 100% consolidation is later wanted.
- **Cross-tab key sync preserved** via `BroadcastChannel` (rather than dropped).
- **Two storage idioms** (sync-cached small stores vs async chats) is an accepted, contained cost of keeping the blast radius small.
