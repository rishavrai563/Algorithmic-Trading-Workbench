import { useState, useCallback, useEffect } from 'react'
import { defaultStrategyCode } from '../data/sampleData'

/*
 * VisualBlocksEditor — A drag-and-drop no-code strategy builder.
 *
 * Users construct trading logic by adding, configuring, and reordering
 * "blocks" — each block represents a logical unit (Indicator, Condition, Action).
 * The component then compiles the block tree into valid LEAN Python code.
 */

// ── Block Templates ──────────────────────────────────────────────
const INDICATOR_TEMPLATES = {
  RSI:  { type: 'indicator', indicator: 'RSI',  params: { period: 14 } },
  SMA:  { type: 'indicator', indicator: 'SMA',  params: { period: 20 } },
  EMA:  { type: 'indicator', indicator: 'EMA',  params: { period: 12 } },
  MACD: { type: 'indicator', indicator: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
}

const CONDITION_OPERATORS = ['<', '>', '<=', '>=', '==', 'crosses above', 'crosses below']
const ACTION_TYPES = ['BUY (Go Long)', 'SELL (Liquidate)', 'SHORT', 'COVER']

// ── Helpers ──────────────────────────────────────────────────────
let blockIdCounter = 1
const newId = () => `block-${blockIdCounter++}`

function createBlock(template) {
  return {
    id: newId(),
    ...JSON.parse(JSON.stringify(template)),
  }
}

const defaultBlocks = [
  { id: newId(), type: 'indicator', indicator: 'RSI', params: { period: 14 } },
  { id: newId(), type: 'condition', left: 'RSI', operator: '<', right: '30' },
  { id: newId(), type: 'action', action: 'BUY (Go Long)' },
  { id: newId(), type: 'separator', label: 'EXIT PATH' },
  { id: newId(), type: 'indicator', indicator: 'RSI', params: { period: 14 } },
  { id: newId(), type: 'condition', left: 'RSI', operator: '>', right: '70' },
  { id: newId(), type: 'action', action: 'SELL (Liquidate)' },
]

// ── Code Generator ───────────────────────────────────────────────
function generatePythonCode(blocks) {
  // Collect all indicators
  const indicators = blocks.filter(b => b.type === 'indicator')
  const conditions = blocks.filter(b => b.type === 'condition')
  const actions = blocks.filter(b => b.type === 'action')

  // Build indicator initialization code
  const indicatorInits = []
  const indicatorReadyChecks = []
  const usedIndicators = new Set()

  indicators.forEach(ind => {
    const key = ind.indicator.toLowerCase()
    if (usedIndicators.has(key)) return
    usedIndicators.add(key)

    switch (ind.indicator) {
      case 'RSI':
        indicatorInits.push(`        self.rsi = RelativeStrengthIndex(${ind.params.period}, MovingAverageType.WILDERS)`)
        indicatorInits.push(`        self.register_indicator(self.asset_symbol, self.rsi, None)`)
        indicatorReadyChecks.push('self.rsi.is_ready')
        break
      case 'SMA':
        indicatorInits.push(`        self.sma = self.sma(self.asset_symbol, ${ind.params.period}, Resolution.DAILY)`)
        indicatorReadyChecks.push('self.sma.is_ready')
        break
      case 'EMA':
        indicatorInits.push(`        self.ema = self.ema(self.asset_symbol, ${ind.params.period}, Resolution.DAILY)`)
        indicatorReadyChecks.push('self.ema.is_ready')
        break
      case 'MACD':
        indicatorInits.push(`        self.macd = self.macd(self.asset_symbol, ${ind.params.fastPeriod}, ${ind.params.slowPeriod}, ${ind.params.signalPeriod}, MovingAverageType.EXPONENTIAL, Resolution.DAILY)`)
        indicatorReadyChecks.push('self.macd.is_ready')
        break
    }
  })

  // Build condition-action pairs
  const buildCondition = (cond) => {
    const left = cond.left?.toLowerCase() || 'rsi'
    const leftExpr = `self.${left}.current.value`
    const right = cond.right || '30'
    const rightIsNum = !isNaN(parseFloat(right))
    const rightExpr = rightIsNum ? right : `self.${right.toLowerCase()}.current.value`
    return `${leftExpr} ${cond.operator} ${rightExpr}`
  }

  const buildAction = (action) => {
    if (action.action.startsWith('BUY')) return '            self.set_holdings(self.asset_symbol, 1.0)'
    if (action.action.startsWith('SELL')) return '            self.liquidate(self.asset_symbol)'
    if (action.action === 'SHORT') return '            self.set_holdings(self.asset_symbol, -1.0)'
    if (action.action === 'COVER') return '            self.liquidate(self.asset_symbol)'
    return '            pass'
  }

  // Build pairs: condition + next action
  const paths = []
  let currentPath = []
  blocks.forEach(b => {
    if (b.type === 'separator') {
      if (currentPath.length > 0) paths.push(currentPath)
      currentPath = []
    } else {
      currentPath.push(b)
    }
  })
  if (currentPath.length > 0) paths.push(currentPath)

  const onDataLines = []
  paths.forEach((path, pathIdx) => {
    const pathConditions = path.filter(b => b.type === 'condition')
    const pathActions = path.filter(b => b.type === 'action')

    if (pathConditions.length === 0 || pathActions.length === 0) return

    const keyword = pathIdx === 0 ? 'if' : 'elif'
    const condStr = pathConditions.map(buildCondition).join(' and ')

    // Add portfolio check
    const action = pathActions[0]
    let portfolioCheck = ''
    if (action.action.startsWith('BUY')) portfolioCheck = ' and not self.portfolio.invested'
    if (action.action.startsWith('SELL')) portfolioCheck = ' and self.portfolio.invested'

    onDataLines.push(`        ${keyword} ${condStr}${portfolioCheck}:`)
    onDataLines.push(buildAction(action))
    onDataLines.push(`            self.debug(f"${action.action.split(' ')[0]} at {price:.2f}")`)
  })

  const readyCheck = indicatorReadyChecks.length > 0
    ? `        if not (${indicatorReadyChecks.join(' and ')}):\n            return`
    : ''

  return `# region imports
from AlgorithmImports import *
from datetime import datetime
# endregion

# These constants are injected by the C# backend before execution.
DATA_FILE = "__DATA_FILE__"
ASSET_SYMBOL = "__ASSET_SYMBOL__"


class CustomMarketData(PythonData):
    def get_source(self, config, date, is_live_mode):
        return SubscriptionDataSource(
            f"/Lean/Data/custom/{DATA_FILE}",
            SubscriptionTransportMedium.LOCAL_FILE
        )

    def reader(self, config, line, date, is_live_mode):
        if not line.strip() or line.startswith("Date"):
            return None
        try:
            parts = line.split(",")
            data = CustomMarketData()
            data.Symbol = config.Symbol
            data.Time = datetime.strptime(parts[0].strip(), "%Y-%m-%d")
            data.Value = float(parts[4])
            data["Open"] = float(parts[1])
            data["High"] = float(parts[2])
            data["Low"] = float(parts[3])
            data["Close"] = float(parts[4])
            data["Volume"] = float(parts[5])
            return data
        except (ValueError, IndexError):
            return None


class VisualBlocksStrategy(QCAlgorithm):
    def initialize(self):
        start_str = self.get_parameter("start-date", "2024-06-01")
        end_str = self.get_parameter("end-date", "2025-01-01")
        start_parts = start_str.split("-")
        end_parts = end_str.split("-")
        self.set_start_date(int(start_parts[0]), int(start_parts[1]), int(start_parts[2]))
        self.set_end_date(int(end_parts[0]), int(end_parts[1]), int(end_parts[2]))
        self.set_cash(100000)

        self.asset = self.add_data(CustomMarketData, ASSET_SYMBOL, Resolution.DAILY)
        self.asset_symbol = self.asset.Symbol

${indicatorInits.join('\n')}

    def on_data(self, data):
        if not data.contains_key(self.asset_symbol):
            return
${readyCheck}

        price = data[self.asset_symbol].Value

${onDataLines.join('\n')}
`
}

function parsePythonCodeToBlocks(code) {
  if (!code) return defaultBlocks
  
  const blocks = []
  
  // Parse Indicators from initialize()
  const rsiMatches = [...code.matchAll(/self\.rsi = RelativeStrengthIndex\(([^,]+),/g)]
  rsiMatches.forEach(m => blocks.push({ id: newId(), type: 'indicator', indicator: 'RSI', params: { period: parseInt(m[1]) || 14 } }))
  
  const smaMatches = [...code.matchAll(/self\.sma = self\.sma\(self\.asset_symbol, ([^,]+),/g)]
  smaMatches.forEach(m => blocks.push({ id: newId(), type: 'indicator', indicator: 'SMA', params: { period: parseInt(m[1]) || 20 } }))

  const emaMatches = [...code.matchAll(/self\.ema = self\.ema\(self\.asset_symbol, ([^,]+),/g)]
  emaMatches.forEach(m => blocks.push({ id: newId(), type: 'indicator', indicator: 'EMA', params: { period: parseInt(m[1]) || 12 } }))

  const macdMatches = [...code.matchAll(/self\.macd = self\.macd\(self\.asset_symbol, ([^,]+), ([^,]+), ([^,]+),/g)]
  macdMatches.forEach(m => blocks.push({ id: newId(), type: 'indicator', indicator: 'MACD', params: { fastPeriod: parseInt(m[1])||12, slowPeriod: parseInt(m[2])||26, signalPeriod: parseInt(m[3])||9 } }))

  // Parse paths from on_data()
  // We look for if/elif blocks followed by an action
  const lines = code.split('\n')
  let currentConditions = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('if ') || line.startsWith('elif ')) {
      // It's a condition block.
      // Example: if self.rsi.current.value < 30 and not self.portfolio.invested:
      if (blocks.some(b => b.type === 'condition' || b.type === 'action')) {
        // Add separator before next path if we already have a path
        blocks.push({ id: newId(), type: 'separator', label: 'EXIT PATH' })
      }
      
      const conditionParts = line.replace(/^(if|elif)\s+/, '').replace(/:$/, '').split(' and ')
      conditionParts.forEach(cond => {
        if (cond.includes('self.portfolio.invested')) return // skip portfolio checks
        
        // Parse left operator right
        // e.g. self.rsi.current.value < 30
        const match = cond.match(/self\.(\w+)\.current\.value\s*(<|<=|>|>=|==)\s*(self\.(\w+)\.current\.value|[\d.]+)/)
        if (match) {
          const left = match[1].toUpperCase()
          const op = match[2]
          const right = match[3].startsWith('self.') ? match[4].toUpperCase() : match[3]
          blocks.push({ id: newId(), type: 'condition', left, operator: op, right })
        }
      })
      
      // Look ahead for the action
      if (i + 1 < lines.length) {
        const nextLine = lines[i+1].trim()
        if (nextLine.includes('self.set_holdings') && nextLine.includes('-1')) {
          blocks.push({ id: newId(), type: 'action', action: 'SHORT' })
        } else if (nextLine.includes('self.set_holdings')) {
          blocks.push({ id: newId(), type: 'action', action: 'BUY (Go Long)' })
        } else if (nextLine.includes('self.liquidate')) {
          // Could be sell or cover. In the visual builder, SELL is the default liquidate action.
          blocks.push({ id: newId(), type: 'action', action: 'SELL (Liquidate)' })
        }
      }
    }
  }

  return blocks.length > 0 ? blocks : defaultBlocks
}


// ── Block Component ──────────────────────────────────────────────
function BlockCard({ block, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast, allIndicators }) {
  if (block.type === 'separator') {
    return (
      <div className="vb-separator">
        <div className="vb-separator-line" />
        <span className="vb-separator-label">{block.label || 'NEW PATH'}</span>
        <div className="vb-separator-line" />
        <button className="vb-delete-btn" onClick={onDelete} title="Remove separator">✕</button>
      </div>
    )
  }

  const colors = {
    indicator: { bg: '#eff6ff', border: '#93c5fd', icon: '📊', label: 'INDICATOR' },
    condition: { bg: '#fefce8', border: '#fde047', icon: '⚡', label: 'CONDITION' },
    action:    { bg: '#f0fdf4', border: '#86efac', icon: '🎯', label: 'ACTION' },
  }
  const style = colors[block.type] || colors.indicator

  return (
    <div className="vb-block" style={{ background: style.bg, borderColor: style.border }}>
      <div className="vb-block-header">
        <span className="vb-block-icon">{style.icon}</span>
        <strong className="vb-block-label">{style.label}</strong>
        <div className="vb-block-actions">
          {!isFirst && <button onClick={onMoveUp} title="Move up">↑</button>}
          {!isLast && <button onClick={onMoveDown} title="Move down">↓</button>}
          <button onClick={onDelete} title="Delete block" className="vb-delete-btn">✕</button>
        </div>
      </div>
      <div className="vb-block-body">
        {block.type === 'indicator' && (
          <>
            <label>
              Type
              <select value={block.indicator} onChange={(e) => onUpdate({ ...block, indicator: e.target.value, params: INDICATOR_TEMPLATES[e.target.value]?.params || {} })}>
                {Object.keys(INDICATOR_TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            {Object.entries(block.params || {}).map(([pk, pv]) => (
              <label key={pk}>
                {pk}
                <input type="number" value={pv} onChange={(e) => onUpdate({ ...block, params: { ...block.params, [pk]: Number(e.target.value) } })} />
              </label>
            ))}
          </>
        )}
        {block.type === 'condition' && (
          <div className="vb-condition-row">
            <select value={block.left || 'RSI'} onChange={(e) => onUpdate({ ...block, left: e.target.value })}>
              {allIndicators.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
            <select value={block.operator || '<'} onChange={(e) => onUpdate({ ...block, operator: e.target.value })}>
              {CONDITION_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input type="text" value={block.right || ''} placeholder="Value or indicator" onChange={(e) => onUpdate({ ...block, right: e.target.value })} />
          </div>
        )}
        {block.type === 'action' && (
          <select value={block.action || 'BUY (Go Long)'} onChange={(e) => onUpdate({ ...block, action: e.target.value })}>
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export default function VisualBlocksEditor({ draft, draftCode, onCodeGenerated }) {
  const [blocks, setBlocks] = useState(() => parsePythonCodeToBlocks(draftCode))
  const [showPreview, setShowPreview] = useState(false)
  const [lastCompiledCode, setLastCompiledCode] = useState('')

  // Two-way sync: if draftCode changes externally (i.e. the user typed in the code editor), parse it!
  // We compare with lastCompiledCode to avoid overwriting our blocks if the code change was caused BY the blocks compiling.
  useEffect(() => {
    if (draftCode && draftCode !== lastCompiledCode) {
      setBlocks(parsePythonCodeToBlocks(draftCode))
    }
  }, [draftCode, lastCompiledCode])

  // Regenerate code whenever blocks change
  useEffect(() => {
    const code = generatePythonCode(blocks)
    setLastCompiledCode(code)
    onCodeGenerated(code)
  }, [blocks, onCodeGenerated])

  const generatedCode = generatePythonCode(blocks)

  // All indicator names for condition dropdowns
  const allIndicators = [...new Set(blocks.filter(b => b.type === 'indicator').map(b => b.indicator))]
  if (allIndicators.length === 0) allIndicators.push('RSI')

  const addBlock = useCallback((type) => {
    let newBlock
    switch (type) {
      case 'indicator': newBlock = createBlock(INDICATOR_TEMPLATES.RSI); break
      case 'condition':  newBlock = { id: newId(), type: 'condition', left: allIndicators[0] || 'RSI', operator: '<', right: '30' }; break
      case 'action':     newBlock = { id: newId(), type: 'action', action: 'BUY (Go Long)' }; break
      case 'separator':  newBlock = { id: newId(), type: 'separator', label: 'EXIT PATH' }; break
      default: return
    }
    setBlocks(prev => [...prev, newBlock])
  }, [allIndicators])

  const updateBlock = useCallback((idx, updated) => {
    setBlocks(prev => prev.map((b, i) => i === idx ? updated : b))
  }, [])

  const deleteBlock = useCallback((idx) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const moveBlock = useCallback((idx, dir) => {
    setBlocks(prev => {
      const arr = [...prev]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }, [])

  return (
    <>
      <div className="section-title">
        <h2>Visual Strategy Builder</h2>
        <button className="text-button" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? 'Hide' : 'Show'} Generated Code
        </button>
      </div>

      {/* Toolbar */}
      <div className="vb-toolbar">
        <span style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Add Block:</span>
        <button className="vb-add-btn indicator" onClick={() => addBlock('indicator')}>📊 Indicator</button>
        <button className="vb-add-btn condition" onClick={() => addBlock('condition')}>⚡ Condition</button>
        <button className="vb-add-btn action" onClick={() => addBlock('action')}>🎯 Action</button>
        <button className="vb-add-btn separator" onClick={() => addBlock('separator')}>➕ New Path</button>
      </div>

      {/* Blocks Canvas */}
      <div className="vb-canvas">
        {blocks.map((block, idx) => (
          <div key={block.id}>
            <BlockCard
              block={block}
              onUpdate={(updated) => updateBlock(idx, updated)}
              onDelete={() => deleteBlock(idx)}
              onMoveUp={() => moveBlock(idx, -1)}
              onMoveDown={() => moveBlock(idx, 1)}
              isFirst={idx === 0}
              isLast={idx === blocks.length - 1}
              allIndicators={allIndicators}
            />
            {idx < blocks.length - 1 && block.type !== 'separator' && blocks[idx + 1]?.type !== 'separator' && (
              <div className="vb-connector">
                <div className="vb-connector-line" />
                <span className="vb-connector-arrow">▼</span>
              </div>
            )}
          </div>
        ))}
        {blocks.length === 0 && (
          <div className="vb-empty">
            <p>Click the buttons above to add blocks and build your strategy visually.</p>
          </div>
        )}
      </div>

      {/* Code Preview */}
      {showPreview && (
        <div className="vb-preview">
          <div className="section-title">
            <h2>Generated Python Code</h2>
            <span className="muted">This code will be sent to the LEAN engine</span>
          </div>
          <pre className="vb-code-preview">{generatedCode}</pre>
        </div>
      )}
    </>
  )
}
