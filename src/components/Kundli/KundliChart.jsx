const ABBREV = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
  'North Node': 'Ra', 'South Node': 'Ke',
}

const SIGN_NUM = {
  Aries: 1, Taurus: 2, Gemini: 3, Cancer: 4, Leo: 5, Virgo: 6,
  Libra: 7, Scorpio: 8, Sagittarius: 9, Capricorn: 10, Aquarius: 11, Pisces: 12,
}

// Traditional North Indian (diamond) chart. The 12 houses sit in FIXED positions —
// house 1 (lagna) is always the top-centre diamond, and houses run counter-clockwise.
// Each house is a polygon; signs rotate through them. Coordinates are fractions of the
// square's side so the chart scales cleanly. q1..q4 are where the square's diagonals
// cross the inner diamond's edges.
const HOUSES = [
  { n: 1,  pts: [[0.5, 0],   [0.75, 0.25], [0.5, 0.5],  [0.25, 0.25]], cx: 0.5,  cy: 0.25 },
  { n: 2,  pts: [[0, 0],     [0.5, 0],     [0.25, 0.25]],              cx: 0.25, cy: 0.10 },
  { n: 3,  pts: [[0, 0],     [0.25, 0.25], [0, 0.5]],                  cx: 0.10, cy: 0.25 },
  { n: 4,  pts: [[0, 0.5],   [0.25, 0.25], [0.5, 0.5],  [0.25, 0.75]], cx: 0.25, cy: 0.5  },
  { n: 5,  pts: [[0, 0.5],   [0.25, 0.75], [0, 1]],                    cx: 0.10, cy: 0.75 },
  { n: 6,  pts: [[0, 1],     [0.25, 0.75], [0.5, 1]],                  cx: 0.25, cy: 0.90 },
  { n: 7,  pts: [[0.5, 1],   [0.25, 0.75], [0.5, 0.5],  [0.75, 0.75]], cx: 0.5,  cy: 0.75 },
  { n: 8,  pts: [[0.5, 1],   [0.75, 0.75], [1, 1]],                    cx: 0.75, cy: 0.90 },
  { n: 9,  pts: [[1, 1],     [0.75, 0.75], [1, 0.5]],                  cx: 0.90, cy: 0.75 },
  { n: 10, pts: [[1, 0.5],   [0.75, 0.75], [0.5, 0.5],  [0.75, 0.25]], cx: 0.75, cy: 0.5  },
  { n: 11, pts: [[1, 0.5],   [0.75, 0.25], [1, 0]],                    cx: 0.90, cy: 0.25 },
  { n: 12, pts: [[1, 0],     [0.75, 0.25], [0.5, 0]],                  cx: 0.75, cy: 0.10 },
]

export default function KundliChart({ chart, size = 360 }) {
  if (!chart) return null

  // Accept either a full birth chart (houses under d1Chart) or a divisional chart
  // (houses at the top level). Index houses by their number for fixed-position lookup.
  const houseList = chart.d1Chart?.houses ?? chart.houses ?? []
  const byNumber = {}
  houseList.forEach(h => { byNumber[h.number] = h })

  const S = size
  const pt = ([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full mx-auto block" style={{ maxWidth: S }}>
      {/* Outer square */}
      <rect x={0} y={0} width={S} height={S} fill="#fdf6ee" stroke="#c45c1a" strokeWidth="1.5" />
      {/* Diagonals (corner to corner) */}
      <line x1={0} y1={0} x2={S} y2={S} stroke="#e8d5b7" strokeWidth="1" />
      <line x1={S} y1={0} x2={0} y2={S} stroke="#e8d5b7" strokeWidth="1" />
      {/* Inner diamond connecting the edge midpoints */}
      <polygon points={`${pt([0.5, 0])} ${pt([1, 0.5])} ${pt([0.5, 1])} ${pt([0, 0.5])}`}
        fill="none" stroke="#e8d5b7" strokeWidth="1" />

      {HOUSES.map(({ n, cx, cy }) => {
        const house = byNumber[n]
        const signNum = house ? SIGN_NUM[house.sign] : null
        const occupants = house?.occupants ?? []
        const x = cx * S
        const y = cy * S
        // Sign number sits at the top of the cell; planets stack below it, clear of it.
        const planetTop = y + S * 0.02
        const startY = planetTop - ((occupants.length - 1) * S * 0.045)

        return (
          <g key={n}>
            {/* Rashi (sign) number for this house */}
            {signNum != null && (
              <text x={x} y={y - S * 0.095} textAnchor="middle" dominantBaseline="middle"
                fill="#b89070" fontSize={S * 0.045} fontWeight="500">
                {signNum}
              </text>
            )}
            {/* Planets in this house */}
            {occupants.slice(0, 5).map((occ, i) => (
              <text key={i} x={x} y={startY + i * S * 0.09} textAnchor="middle" dominantBaseline="middle"
                fill="#c45c1a" fontSize={S * 0.05} fontWeight="600">
                {ABBREV[occ.celestialBody] ?? occ.celestialBody?.slice(0, 2)}
                {occ.motion_type === 'retrograde' ? '℞' : ''}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
