// Pure update-policy + a tiny busy signal the service-worker orchestrator consults.
// Deliberately free of any `virtual:pwa-register` / service-worker import so it stays
// unit-testable and safe to import from React (e.g. the busy hook) without dragging the
// PWA virtual module into the test/runtime graph.

let _busy = false

// The active tab reports whether a request (chat stream / compute) is in flight.
export function setUpdateBusy(value) {
  _busy = !!value
}

// Apply a pending update only at a safe moment: a new version is waiting, nothing is in
// flight, and the tab is hidden (the user is away) — so the reload is invisible and never
// interrupts a reading or a streamed reply.
export function shouldApplyUpdate({ needRefresh, hidden, busy = _busy }) {
  return !!needRefresh && !busy && !!hidden
}
