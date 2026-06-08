const ABBREV = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
  'North Node': 'Ra', 'South Node': 'Ke',
}

// North Indian 4x4 grid: cell (col, row) → house number
// Corners: (0,0)=H12, (3,0)=H3, (0,3)=H9, (3,3)=H6
// Center 2x2: (1,1)(2,1)(1,2)(2,2) = lagna display area (no house)
const CELL_HOUSE = {
  '0,0': 12, '1,0': 1, '2,0': 2, '3,0': 3,
  '0,1': 11,                              '3,1': 4,
  '0,2': 10,                              '3,2': 5,
  '0,3': 9,  '1,3': 8, '2,3': 7, '3,3': 6,
}

export default function KundliChart({ chart, size = 400 }) {
  if (!chart) return null

  const cellSize = size / 4
  const houses = {}
  ;(chart.houses ?? []).forEach(h => { houses[h.number] = h })

  const lagnaSign = chart.ascendant?.sign ?? chart.houses?.[0]?.sign ?? ''

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" style={{ maxWidth: size }}>
      {/* Outer border */}
      <rect x={0} y={0} width={size} height={size} fill="#fdf6ee" stroke="#e8d5b7" strokeWidth="1" />

      {/* Grid lines */}
      {[1, 2, 3].map(i => (
        <g key={i}>
          <line x1={i * cellSize} y1={0} x2={i * cellSize} y2={size} stroke="#e8d5b7" strokeWidth="0.5" />
          <line x1={0} y1={i * cellSize} x2={size} y2={i * cellSize} stroke="#e8d5b7" strokeWidth="0.5" />
        </g>
      ))}

      {/* Center diamond — inner square for lagna display */}
      <rect x={cellSize} y={cellSize} width={cellSize * 2} height={cellSize * 2} fill="#fff8f0" stroke="#e8d5b7" strokeWidth="1" />
      {/* Diagonal crosses inside center */}
      <line x1={cellSize} y1={cellSize} x2={cellSize * 3} y2={cellSize * 3} stroke="#e8d5b7" strokeWidth="0.5" />
      <line x1={cellSize * 3} y1={cellSize} x2={cellSize} y2={cellSize * 3} stroke="#e8d5b7" strokeWidth="0.5" />

      {/* Lagna label in center */}
      <text x={size / 2} y={size / 2 - 8} textAnchor="middle" dominantBaseline="middle"
        fill="#c45c1a" fontSize={cellSize * 0.18} fontWeight="600">
        {lagnaSign}
      </text>
      <text x={size / 2} y={size / 2 + 10} textAnchor="middle" dominantBaseline="middle"
        fill="#8a7060" fontSize={cellSize * 0.13}>
        Lagna
      </text>

      {/* House cells */}
      {Object.entries(CELL_HOUSE).map(([key, houseNum]) => {
        const [col, row] = key.split(',').map(Number)
        const x = col * cellSize
        const y = row * cellSize
        const house = houses[houseNum]
        const occupants = house?.occupants ?? []
        const sign = house?.sign ?? ''

        return (
          <g key={key}>
            {/* House number */}
            <text x={x + 5} y={y + 13}
              fill="#b89070" fontSize={cellSize * 0.12} fontWeight="500">
              {houseNum}
            </text>
            {/* Sign name */}
            <text x={x + cellSize / 2} y={y + cellSize * 0.38} textAnchor="middle"
              fill="#8a7060" fontSize={cellSize * 0.13}>
              {sign}
            </text>
            {/* Planet abbreviations */}
            {occupants.slice(0, 4).map((occ, i) => (
              <text key={i} x={x + cellSize / 2} y={y + cellSize * 0.58 + i * (cellSize * 0.19)}
                textAnchor="middle"
                fill="#c45c1a" fontSize={cellSize * 0.16} fontWeight="600">
                {ABBREV[occ.celestialBody] ?? occ.celestialBody?.slice(0, 2)}
                {occ.motion_type === 'retrograde' ? 'R' : ''}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
