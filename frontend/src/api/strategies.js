/**
 * API client for the Strategies & History backend.
 */

const API_BASE = '/api'

// ── Strategies ─────────────────────────────────────────

export async function fetchStrategies() {
  const res = await fetch(`${API_BASE}/strategies`)
  if (!res.ok) throw new Error('Failed to load strategies')
  return res.json()
}

export async function fetchStrategy(id) {
  const res = await fetch(`${API_BASE}/strategies/${id}`)
  if (!res.ok) throw new Error('Strategy not found')
  return res.json()
}

export async function createStrategy(profile) {
  const res = await fetch(`${API_BASE}/strategies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!res.ok) throw new Error('Failed to create strategy')
  return res.json()
}

export async function saveStrategy(id, profile) {
  const res = await fetch(`${API_BASE}/strategies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!res.ok) throw new Error('Failed to save strategy')
  return res.json()
}

export async function deleteStrategy(id) {
  const res = await fetch(`${API_BASE}/strategies/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete strategy')
  return res.json()
}

// ── Backtest History ───────────────────────────────────

export async function fetchAllHistory() {
  const res = await fetch(`${API_BASE}/strategies/history`)
  if (!res.ok) throw new Error('Failed to load history')
  return res.json()
}

export async function fetchStrategyHistory(strategyId) {
  const res = await fetch(`${API_BASE}/strategies/${strategyId}/history`)
  if (!res.ok) throw new Error('Failed to load strategy history')
  return res.json()
}

export async function recordBacktest(strategyId, record) {
  const res = await fetch(`${API_BASE}/strategies/${strategyId}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!res.ok) throw new Error('Failed to record backtest')
  return res.json()
}
