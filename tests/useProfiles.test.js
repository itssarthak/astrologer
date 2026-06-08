import { renderHook, act } from '@testing-library/react'
import { useProfiles } from '../src/hooks/useProfiles'

beforeEach(() => localStorage.clear())

test('returns empty profiles by default', () => {
  const { result } = renderHook(() => useProfiles())
  expect(result.current.profiles).toEqual([])
  expect(result.current.activeProfile).toBeNull()
})

test('addProfile saves and updates state', () => {
  const { result } = renderHook(() => useProfiles())
  const profile = { id: 'p1', name: 'Alice', dob: '1990-01-01', time: '12:00', lat: 0, lon: 0, timezone_offset: 0, place: 'London', createdAt: '2026-01-01T00:00:00Z' }
  act(() => result.current.addProfile(profile))
  expect(result.current.profiles).toHaveLength(1)
  expect(result.current.profiles[0].name).toBe('Alice')
  expect(result.current.activeProfile?.id).toBe('p1')  // auto-activated
})

test('removeProfile removes profile and clears active', () => {
  const { result } = renderHook(() => useProfiles())
  const profile = { id: 'p1', name: 'Alice', dob: '1990-01-01', time: '12:00', lat: 0, lon: 0, timezone_offset: 0, place: 'London', createdAt: '2026-01-01T00:00:00Z' }
  act(() => result.current.addProfile(profile))
  act(() => result.current.removeProfile('p1'))
  expect(result.current.profiles).toHaveLength(0)
  expect(result.current.activeProfile).toBeNull()
})

test('switchProfile updates active profile', () => {
  const { result } = renderHook(() => useProfiles())
  const p1 = { id: 'p1', name: 'Alice', dob: '1990-01-01', time: '12:00', lat: 0, lon: 0, timezone_offset: 0, place: 'London', createdAt: '2026-01-01T00:00:00Z' }
  const p2 = { id: 'p2', name: 'Bob', dob: '1992-05-10', time: '08:00', lat: 0, lon: 0, timezone_offset: 0, place: 'Paris', createdAt: '2026-01-01T00:00:00Z' }
  act(() => { result.current.addProfile(p1); result.current.addProfile(p2) })
  act(() => result.current.switchProfile('p2'))
  expect(result.current.activeProfile?.name).toBe('Bob')
})
