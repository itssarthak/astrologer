import { describe, it, expect } from 'vitest'
import { shouldApplyUpdate, setUpdateBusy } from '../../src/lib/swUpdate'

describe('shouldApplyUpdate', () => {
  it('applies only when a refresh is pending, not busy, and the tab is hidden', () => {
    expect(shouldApplyUpdate({ needRefresh: true, hidden: true, busy: false })).toBe(true)
  })

  it('never applies while visible (would interrupt the user)', () => {
    expect(shouldApplyUpdate({ needRefresh: true, hidden: false, busy: false })).toBe(false)
  })

  it('never applies while busy (mid chat stream / compute)', () => {
    expect(shouldApplyUpdate({ needRefresh: true, hidden: true, busy: true })).toBe(false)
  })

  it('does nothing when no refresh is pending', () => {
    expect(shouldApplyUpdate({ needRefresh: false, hidden: true, busy: false })).toBe(false)
  })

  it('reads the module busy flag when busy is not passed', () => {
    setUpdateBusy(true)
    expect(shouldApplyUpdate({ needRefresh: true, hidden: true })).toBe(false)
    setUpdateBusy(false)
    expect(shouldApplyUpdate({ needRefresh: true, hidden: true })).toBe(true)
  })
})
