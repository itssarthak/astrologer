import { useState } from 'react'
import { useGeocode } from '../../hooks/useGeocode'
import LoadingSpinner from './LoadingSpinner'

const GENDERS = [['male', 'Male'], ['female', 'Female'], ['other', 'Other']]

export default function BirthDetailsForm({ onSubmit, submitLabel = 'Continue', initialValues = {} }) {
  const [name, setName] = useState(initialValues.name ?? '')
  const [dob, setDob] = useState(initialValues.dob ?? '')
  const [time, setTime] = useState(initialValues.time ?? '')
  const [gender, setGender] = useState(initialValues.gender ?? '')
  const [place, setPlace] = useState(initialValues.place ?? '')
  const [selectedPlace, setSelectedPlace] = useState(
    initialValues.lat ? { display_name: initialValues.place, lat: String(initialValues.lat), lon: String(initialValues.lon) } : null
  )
  const [submitting, setSubmitting] = useState(false)
  const { results, loading, search, fetchTimezone, clear } = useGeocode()

  const handlePlaceChange = e => {
    setPlace(e.target.value)
    setSelectedPlace(null)
    search(e.target.value)
  }

  const handleSelectPlace = result => {
    setPlace(result.display_name)
    setSelectedPlace(result)
    clear()
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!name || !dob || !time || !selectedPlace) return
    setSubmitting(true)
    try {
      const tzOffset = await fetchTimezone(parseFloat(selectedPlace.lat), parseFloat(selectedPlace.lon))
      onSubmit({
        name,
        dob,
        time,
        gender,
        place: selectedPlace.display_name,
        lat: parseFloat(selectedPlace.lat),
        lon: parseFloat(selectedPlace.lon),
        timezone_offset: tzOffset,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="bf-name" className="text-xs font-semibold text-text-2 uppercase tracking-wide">Full name</label>
        <input id="bf-name" type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary"
          placeholder="e.g. Jane Smith" required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bf-dob" className="text-xs font-semibold text-text-2 uppercase tracking-wide">Date of birth</label>
        <input id="bf-dob" type="date" value={dob} onChange={e => setDob(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary"
          required />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bf-time" className="text-xs font-semibold text-text-2 uppercase tracking-wide">Time of birth</label>
        <input id="bf-time" type="time" value={time} onChange={e => setTime(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary"
          required />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-text-2 uppercase tracking-wide">
          Gender <span className="text-muted normal-case font-normal">— for Kundali Match</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {GENDERS.map(([val, label]) => (
            <button key={val} type="button" onClick={() => setGender(val)} aria-pressed={gender === val}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                gender === val
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-white text-muted hover:border-border-strong'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 relative">
        <label htmlFor="bf-place" className="text-xs font-semibold text-text-2 uppercase tracking-wide">Place of birth</label>
        <input id="bf-place" type="text" value={place} onChange={handlePlaceChange}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text focus:outline-none focus:border-primary"
          placeholder="Delhi, India" autoComplete="off" required />
        {loading && <LoadingSpinner size="sm" className="absolute right-3 top-8" />}
        {results.length > 0 && !selectedPlace && (
          <ul className="absolute top-full left-0 right-0 z-20 bg-white border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <li key={r.place_id ?? `${r.lat},${r.lon}` ?? i} onClick={() => handleSelectPlace(r)}
                className="px-3 py-2 text-sm text-text hover:bg-primary-light cursor-pointer border-b border-border last:border-0">
                {r.display_name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" disabled={submitting || !selectedPlace}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {submitting ? <span className="flex items-center justify-center gap-2"><LoadingSpinner size="sm" />Processing...</span> : submitLabel}
      </button>
    </form>
  )
}
