export default function Sparkline({ data, height = 190, benchmark = false }) {
  const width = 760
  const values = data.map((d) => d.value)
  const min = Math.min(...values) - 2
  const max = Math.max(...values) + 2
  const xStep = width / Math.max(1, data.length - 1)
  const points = data.map((d, i) => {
    const x = i * xStep
    const y = height - ((d.value - min) / (max - min)) * (height - 18) - 8
    return `${x},${y}`
  }).join(' ')

  const benchPoints = data.map((d, i) => {
    const benchmarkValue = 100 + i * 1.65
    const x = i * xStep
    const y = height - ((benchmarkValue - min) / (max - min)) * (height - 18) - 8
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Equity curve chart">
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="grid-line" />
        ))}
        <polyline points={points} fill="none" className="chart-line" />
        {benchmark && <polyline points={benchPoints} fill="none" className="chart-benchmark" />}
      </svg>
      <div className="chart-axis"><span>2020</span><span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2025</span></div>
      {benchmark && <div className="legend"><span><i className="legend-line main" /> Strategy</span><span><i className="legend-line bench" /> Benchmark</span></div>}
    </div>
  )
}
