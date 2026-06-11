const FEATURES = [
  { icon: '☀', name: 'Daily Transit Read', desc: 'What today feels like, computed fresh each morning' },
  { icon: '◈', name: 'Birth Chart', desc: 'Full Vedic D1 — yogas, doshas, dashas' },
  { icon: '⊕', name: 'Kundali Match', desc: 'Guna Milan + deep synastry between two charts' },
  { icon: '∞', name: 'Numerology', desc: 'Chaldean + Pythagorean from your name & DOB' },
]

export default function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="text-5xl mb-3">🪐</div>
        <h1 className="text-2xl font-bold text-text">Your personal astrologer</h1>
      </div>

      <div className="rounded-xl p-4 bg-dark-bg text-gold flex flex-col gap-2">
        <div className="flex items-center gap-2 font-bold text-sm">🔒 100% private by design</div>
        <p className="text-xs text-gold/80 leading-relaxed">
          Your birth data never leaves your device — no accounts, no cloud storage. We use only
          anonymous usage analytics; your chart, details, and API keys stay private.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {['No sign-up', 'No cloud storage', 'Anonymous analytics', 'Open source'].map(p => (
            <span key={p} className="px-2 py-0.5 rounded-full text-xs border border-gold/30 bg-white/10 text-gold/90">{p}</span>
          ))}
        </div>
      </div>

      {FEATURES.map(f => (
        <div key={f.name} className="flex gap-3 p-3 rounded-lg bg-surface border border-border">
          <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
          <div>
            <div className="font-semibold text-sm text-text">{f.name}</div>
            <div className="text-xs text-muted leading-relaxed">{f.desc}</div>
          </div>
        </div>
      ))}

      <button onClick={onNext}
        className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">
        Get Started →
      </button>
    </div>
  )
}
