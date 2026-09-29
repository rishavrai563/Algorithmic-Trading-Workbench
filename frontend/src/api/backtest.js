/**
 * API client for the C# backend.
 * All backtest communication goes through these functions.
 */

const API_BASE = '/api'

/**
 * Submit a backtest request to the C# backend.
 * @param {string} strategyCode - Complete Python QCAlgorithm code
 * @param {object} configuration - { asset, resolution, startDate, endDate, startingCash }
 * @returns {Promise<object>} BacktestResponse from the server
 */
export async function runBacktest(strategyCode, configuration) {
  const response = await fetch(`${API_BASE}/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      strategyCode,
      language: 'python',
      configuration,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Server error (${response.status}): ${text}`)
  }

  return response.json()
}

export async function getJobStatus(jobId) {
  const response = await fetch(`${API_BASE}/backtest/${jobId}/status`)
  if (!response.ok) throw new Error('Failed to fetch job status')
  return response.json()
}

/**
 * Check Docker and LEAN image health.
 * @returns {Promise<{dockerAvailable: boolean, leanImageExists: boolean}>}
 */
export async function getBacktestStatus() {
  const response = await fetch(`${API_BASE}/backtest/status`)
  if (!response.ok) throw new Error('Failed to check backend status')
  return response.json()
}

/**
 * Get the list of supported assets from the backend.
 * @returns {Promise<{assets: string[]}>}
 */
export async function getSupportedAssets() {
  const response = await fetch(`${API_BASE}/backtest/assets`)
  if (!response.ok) throw new Error('Failed to load supported assets')
  return response.json()
}
