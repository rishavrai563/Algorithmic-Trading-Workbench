export default function MetricCard({ label, value, helper, tone = '' }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className={`metric-value ${tone}`}>{value}</strong>
      {helper && <small className="metric-helper">{helper}</small>}
    </div>
  )
}
