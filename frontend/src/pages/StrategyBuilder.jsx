import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../App'
import { getSupportedAssets, searchAssets } from '../api/backtest'
import { saveStrategy, deleteStrategy } from '../api/strategies'
import Editor from '@monaco-editor/react'
import VisualBlocksEditor from '../components/VisualBlocksEditor'

export default function StrategyBuilder() {
  const navigate = useNavigate()
  const { strategy, setStrategy, strategyCode, setStrategyCode, activeStrategyId, refreshData } = useApp()
  const [draft, setDraft] = useState(strategy)
  const [draftCode, setDraftCode] = useState(strategyCode)
  const [mode, setMode] = useState('CODE') // 'CODE' or 'VISUAL'
  const [supportedAssets, setSupportedAssets] = useState([strategy.asset])
  const [editorMarkers, setEditorMarkers] = useState([])
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const assetInputRef = useRef(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  useEffect(() => {
    getSupportedAssets()
      .then(data => {
        if (data.assets && data.assets.length > 0) {
          setSupportedAssets(data.assets)
        }
      })
      .catch(() => {})
  }, [])

  // Sync when global strategy changes (e.g. from Dashboard click)
  useEffect(() => {
    setDraft(strategy)
  }, [strategy])
  useEffect(() => {
    setDraftCode(strategyCode)
  }, [strategyCode])

  const update = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  
  const handleAssetSearch = async (query) => {
    update('asset', query.toUpperCase())
    if (query.length >= 2) {
      try {
        const data = await searchAssets(query)
        if (data.assets && data.assets.length > 0) {
          setSupportedAssets(Array.from(new Set([...data.assets, strategy.asset])))
        }
      } catch (err) {
        // Ignore search errors, fallback to existing options
      }
    }
  }

  const handleContinue = () => {
    setStrategy(draft)
    setStrategyCode(draftCode)
    navigate('/parameters')
  }

  // Save to backend
  const handleSave = async () => {
    if (!activeStrategyId) {
      // No active strategy — just apply locally
      setStrategy(draft)
      setStrategyCode(draftCode)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
      return
    }
    setSaveStatus('saving')
    try {
      // Extract parameter values from draft (non-metadata keys)
      const metaKeys = ['name', 'asset', 'timeframe', 'startDate', 'endDate']
      const paramValues = {}
      Object.entries(draft).forEach(([k, v]) => {
        if (!metaKeys.includes(k) && typeof v === 'number') paramValues[k] = v
      })

      await saveStrategy(activeStrategyId, {
        name: draft.name,
        asset: draft.asset,
        timeframe: draft.timeframe,
        startDate: draft.startDate,
        endDate: draft.endDate,
        pythonCode: draftCode,
        parameterValues: paramValues,
      })

      setStrategy(draft)
      setStrategyCode(draftCode)
      await refreshData()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  // Delete from backend
  const confirmDelete = () => {
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!activeStrategyId) return
    setShowDeleteModal(false)
    try {
      await deleteStrategy(activeStrategyId)
      await refreshData()
      navigate('/dashboard')
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Failed to delete strategy. It might already be removed.')
    }
  }

  // Handle clicking outside asset dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (assetInputRef.current && !assetInputRef.current.contains(event.target)) {
        setShowAssetDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Monaco editor mount handler
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Add Ctrl+Enter shortcut to run backtest
    editor.addAction({
      id: 'run-backtest',
      label: 'Run Backtest',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleContinue()
    })
  }, [])

  // Validate Python code on change and set markers
  const handleEditorChange = useCallback((value) => {
    setDraftCode(value || '')

    if (!monacoRef.current || !editorRef.current) return
    const monaco = monacoRef.current
    const model = editorRef.current.getModel()
    if (!model) return

    const markers = []
    const lines = (value || '').split('\n')

    lines.forEach((line, idx) => {
      // Flag mixed tabs and spaces
      if (/^\t+ /.test(line) || /^ +\t/.test(line)) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: 'Mixed tabs and spaces — Python will throw an IndentationError.',
          startLineNumber: idx + 1, startColumn: 1,
          endLineNumber: idx + 1, endColumn: line.length + 1,
        })
      }
      // Flag common Python syntax mistakes
      if (/def\s+\w+\s*\([^)]*\)\s*[^:]\s*$/.test(line.trimEnd()) && !line.trimEnd().endsWith(':') && line.trim().startsWith('def ')) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Missing colon (:) at end of function definition.',
          startLineNumber: idx + 1, startColumn: 1,
          endLineNumber: idx + 1, endColumn: line.length + 1,
        })
      }
      if (/class\s+\w+.*[^:]\s*$/.test(line.trimEnd()) && !line.trimEnd().endsWith(':') && line.trim().startsWith('class ')) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Missing colon (:) at end of class definition.',
          startLineNumber: idx + 1, startColumn: 1,
          endLineNumber: idx + 1, endColumn: line.length + 1,
        })
      }
    })

    monaco.editor.setModelMarkers(model, 'python-lint', markers)
    setEditorMarkers(markers)
  }, [])

  // Generate code from visual blocks
  const handleBlocksCodeGenerated = useCallback((generatedCode) => {
    setDraftCode(generatedCode)
  }, [])

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Step 1 of 3</div>
          <h1>Strategy Builder</h1>
          <p>Define the rules that generate trading actions using Python code or visual blocks.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saveStatus === 'saving' && <span className="muted" style={{ fontSize: '12px' }}>Saving...</span>}
          {saveStatus === 'saved' && <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
          {saveStatus === 'error' && <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>✕ Save failed</span>}
          
          {activeStrategyId && (
            <button className="button secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={confirmDelete}>🗑 Delete</button>
          )}
          <button className="button secondary" onClick={handleSave}>💾 Save</button>
          <button className="button secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>

      <div className="builder-controls">
        <div className="mode-toggle">
          <button className={`toggle-btn ${mode === 'CODE' ? 'active' : ''}`} onClick={() => setMode('CODE')}>CODE</button>
          <button className={`toggle-btn ${mode === 'VISUAL' ? 'active' : ''}`} onClick={() => setMode('VISUAL')}>VISUAL BLOCKS</button>
        </div>
      </div>

      <div className="builder-layout">
        <section className="panel builder-panel">
          {mode === 'CODE' ? (
            <div className="code-editor-container">
              <div className="section-title">
                <h2>Python QCAlgorithm</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="muted">LEAN Engine Compatible</span>
                  {editorMarkers.length > 0 && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                      background: editorMarkers.some(m => m.severity === 8) ? '#fee2e2' : '#fef9c3',
                      color: editorMarkers.some(m => m.severity === 8) ? '#b91c1c' : '#a16207',
                    }}>
                      {editorMarkers.length} issue{editorMarkers.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor
                  height="500px"
                  defaultLanguage="python"
                  value={draftCode}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    automaticLayout: true,
                    tabSize: 4,
                    insertSpaces: true,
                    wordWrap: 'on',
                    bracketPairColorization: { enabled: true },
                    padding: { top: 12 },
                    renderLineHighlight: 'line',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: '12px', color: '#94a3b8' }}>
                <span>Press Ctrl+Enter to run backtest</span>
                <span>Python · UTF-8 · LF</span>
              </div>
            </div>
          ) : (
            <VisualBlocksEditor
              draft={draft}
              draftCode={draftCode}
              onCodeGenerated={handleBlocksCodeGenerated}
            />
          )}
        </section>

        <aside className="panel inspector">
          <div className="section-title"><h2>Strategy Metadata</h2></div>
          <label>Strategy Name<input value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
          <label style={{ position: 'relative' }} ref={assetInputRef}>Asset
            <input 
              value={draft.asset} 
              onChange={(e) => {
                handleAssetSearch(e.target.value)
                setShowAssetDropdown(true)
              }}
              onFocus={() => setShowAssetDropdown(true)}
              placeholder="Type ticker symbol..."
              autoComplete="off"
            />
            {showAssetDropdown && supportedAssets.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, 
                backgroundColor: '#fff', border: '1px solid #e2e8f0', 
                borderRadius: '8px', zIndex: 10, marginTop: '4px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                maxHeight: '200px', overflowY: 'auto'
              }}>
                {supportedAssets.map(a => (
                  <div 
                    key={a} 
                    style={{ padding: '8px 12px', cursor: 'pointer', color: '#0f172a', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                    onClick={() => {
                      update('asset', a)
                      setShowAssetDropdown(false)
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {a}
                  </div>
                ))}
              </div>
            )}
          </label>
          <label>Timeframe
            <select value={draft.timeframe} onChange={(e) => update('timeframe', e.target.value)}>
              <option>Daily</option>
              <option>30 Min</option>
              <option>Weekly</option>
            </select>
          </label>
          <label>Start Date<input type="date" value={draft.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
          <label>End Date<input type="date" value={draft.endDate} onChange={(e) => update('endDate', e.target.value)} /></label>
          <div className="form-actions" style={{ marginTop: 'auto' }}>
            <button className="button secondary" onClick={() => { setDraft(strategy); setDraftCode(strategyCode); }}>Reset</button>
            <button className="button primary" onClick={handleContinue}>Continue to Parameters →</button>
          </div>
        </aside>
      </div>

      {showDeleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
            width: '400px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '18px', fontWeight: 600 }}>Delete Strategy</h3>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete <strong>"{draft.name}"</strong>?<br/><br/>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="button secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="button" style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
