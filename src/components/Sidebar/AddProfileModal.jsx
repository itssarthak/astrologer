// src/components/Sidebar/AddProfileModal.jsx
import { useState, useContext } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ProfilesContext } from '../../contexts/ProfilesContext'
import { PyodideContext } from '../../contexts/PyodideContext'
import BirthDetailsForm from '../shared/BirthDetailsForm'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function AddProfileModal({ onClose }) {
  const { addProfile } = useContext(ProfilesContext)
  const { computeChart, computeNumerology, getYogasAndDoshas } = useContext(PyodideContext)
  const [computing, setComputing] = useState(false)
  const [computeError, setComputeError] = useState(null)

  const handleSubmit = async formData => {
    setComputing(true)
    setComputeError(null)
    try {
      const chartJson = await computeChart(formData.name, formData.dob, formData.time, formData.lat, formData.lon, formData.timezone_offset, formData.place)
      const yogasDoshas = await getYogasAndDoshas(chartJson, formData)
      const numerology = await computeNumerology(formData.name, formData.dob)

      addProfile({
        id: uuidv4(),
        ...formData,
        chart: chartJson,
        yogas: yogasDoshas.yogas_active ?? [],
        doshas: yogasDoshas.doshas ?? {},
        numerology,
        createdAt: new Date().toISOString(),
      })
      onClose()
    } catch (err) {
      setComputeError(err.message)
    } finally {
      setComputing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-text">Add Profile</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">✕</button>
        </div>
        {computeError && <p className="text-xs text-red-500 mb-3">{computeError}</p>}
        {computing ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted">Computing chart...</p>
          </div>
        ) : (
          <BirthDetailsForm onSubmit={handleSubmit} submitLabel="Compute & Save →" />
        )}
      </div>
    </div>
  )
}
