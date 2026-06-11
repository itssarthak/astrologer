// src/pages/Onboarding.jsx
import { useState } from 'react'
import { getApiKey } from '../lib/storage/keys'
import StepWelcome from '../components/Onboarding/StepWelcome'
import StepApiKey from '../components/Onboarding/StepApiKey'
import StepBirthDetails from '../components/Onboarding/StepBirthDetails'
import StepComputing from '../components/Onboarding/StepComputing'
import GitHubLink from '../components/shared/GitHubLink'

const TOTAL = 4

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [birthData, setBirthData] = useState(null)

  const afterWelcome = () => setStep(getApiKey() ? 3 : 2)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <GitHubLink />
      </div>
      <div className="w-full max-w-md">
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i + 1 <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          {step === 1 && <StepWelcome onNext={afterWelcome} />}
          {step === 2 && <StepApiKey onNext={() => setStep(3)} />}
          {step === 3 && <StepBirthDetails onNext={data => { setBirthData(data); setStep(4) }} />}
          {step === 4 && <StepComputing birthData={birthData} />}
        </div>

        <p className="text-center text-xs text-muted mt-4">
          Step {step} of {TOTAL}
        </p>
      </div>
    </div>
  )
}
