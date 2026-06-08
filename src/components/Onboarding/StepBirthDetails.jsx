import BirthDetailsForm from '../shared/BirthDetailsForm'

export default function StepBirthDetails({ onNext }) {
  const handleSubmit = formData => {
    onNext(formData)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text">Your birth details</h2>
        <p className="text-sm text-muted mt-1">Computed locally — never uploaded. Add more profiles later for Kundali Match.</p>
      </div>
      <BirthDetailsForm onSubmit={handleSubmit} submitLabel="Compute my chart →" />
    </div>
  )
}
