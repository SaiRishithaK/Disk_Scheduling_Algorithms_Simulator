import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  HardDrive,
  Home,
  Info,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  Timer,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ALGORITHMS, runAlgorithm, validateInput } from './algorithms/diskScheduling'
import './index.css'

const defaults = {
  diskSize: '200',
  initialHead: '53',
  requests: '98,183,37,122,14,124,65,67',
  algorithm: 'FCFS',
  direction: 'right',
  seekTime: '1',
}

const algorithmDescriptions = {
  FCFS: 'Services requests in the exact order they arrive.',
  SSTF: 'Always moves to the closest pending request, with lower-cylinder tie-breaking.',
  SCAN: 'Moves to the boundary in the chosen direction, reverses, and continues.',
  'C-SCAN': 'Moves to the boundary, wraps to the opposite boundary, and continues.',
  LOOK: 'Reverses at the final request instead of traveling to the physical boundary.',
  'C-LOOK': 'Reverses by jumping to the extreme request on the opposite side.',
}

function parseRequests(value) {
  if (!value.trim()) return []
  if (/[^0-9,\s-]/.test(value)) return ['bad']
  return value.split(',').map((item) => item.trim()).filter(Boolean).map(Number)
}

function Sidebar({ view, setView, open, setOpen }) {
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><HardDrive size={20} /></div>
        <div><strong>DiskLab</strong><span>OS simulator</span></div>
      </div>
      <nav aria-label="Primary navigation">
        <button className={view === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('dashboard'); setOpen(false) }}>
          <Home size={18} /> Dashboard
        </button>
        <button className={view === 'compare' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('compare'); setOpen(false) }}>
          <BarChart3 size={18} /> Compare
        </button>
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot" />
        <div><span>Engine status</span><strong>Ready</strong></div>
      </div>
    </aside>
  )
}

function Field({ label, error, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  )
}

function InputPanel({ values, setValues, onRun, onReset, errors }) {
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const directional = ['SCAN', 'C-SCAN', 'LOOK', 'C-LOOK'].includes(values.algorithm)
  return (
    <section className="panel input-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Configuration</span><h2>Simulation input</h2></div>
        <CircleGauge size={20} />
      </div>
      <div className="input-grid">
        <Field label="Disk size" error={errors.diskSize}>
          <input type="number" min="1" value={values.diskSize} onChange={(event) => update('diskSize', event.target.value)} aria-invalid={!!errors.diskSize} />
        </Field>
        <Field label="Initial head" error={errors.initialHead}>
          <input type="number" min="0" value={values.initialHead} onChange={(event) => update('initialHead', event.target.value)} aria-invalid={!!errors.initialHead} />
        </Field>
        <Field label="Request queue" error={errors.requests} hint="Comma-separated cylinder numbers">
          <input value={values.requests} onChange={(event) => update('requests', event.target.value)} aria-invalid={!!errors.requests} />
        </Field>
        <Field label="Algorithm">
          <select value={values.algorithm} onChange={(event) => update('algorithm', event.target.value)}>
            {ALGORITHMS.map((algorithm) => <option key={algorithm}>{algorithm}</option>)}
          </select>
        </Field>
        <Field label="Initial direction" hint={directional ? undefined : 'Only used by directional algorithms'}>
          <div className="segmented">
            <button type="button" disabled={!directional} className={values.direction === 'left' ? 'selected' : ''} onClick={() => update('direction', 'left')}>Left</button>
            <button type="button" disabled={!directional} className={values.direction === 'right' ? 'selected' : ''} onClick={() => update('direction', 'right')}>Right</button>
          </div>
        </Field>
        <Field label="Seek time / cylinder" error={errors.seekTime} hint="Milliseconds">
          <input type="number" min="0.1" step="0.1" value={values.seekTime} onChange={(event) => update('seekTime', event.target.value)} aria-invalid={!!errors.seekTime} />
        </Field>
      </div>
      <div className="action-row">
        <button className="button secondary" type="button" onClick={onReset}><RotateCcw size={16} /> Reset</button>
        <button className="button primary" type="button" onClick={onRun}><Play size={16} fill="currentColor" /> Run simulation</button>
      </div>
    </section>
  )
}

function AlgorithmInfo({ algorithm }) {
  return (
    <section className="panel info-panel">
      <div className="info-icon"><Info size={18} /></div>
      <div><span>Active algorithm</span><strong>{algorithm}</strong><p>{algorithmDescriptions[algorithm]}</p></div>
    </section>
  )
}

function MetricsCards({ result }) {
  const cards = [
    { label: 'Total head movement', value: result.totalHeadMovement, unit: 'cylinders', icon: Zap, accent: 'cyan' },
    { label: 'Average seek distance', value: result.averageSeekDistance.toFixed(2), unit: 'cylinders/request', icon: CircleGauge, accent: 'violet' },
    { label: 'Average seek time', value: result.averageSeekTime.toFixed(2), unit: 'ms/request', icon: Timer, accent: 'blue' },
    { label: 'Serviced requests', value: result.requestCount, unit: 'requests', icon: HardDrive, accent: 'green' },
  ]
  return (
    <div className="metrics-grid">
      {cards.map(({ label, value, unit, icon: Icon, accent }) => (
        <article className="metric-card" key={label}>
          <div className={`metric-icon ${accent}`}><Icon size={18} /></div>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{unit}</small>
        </article>
      ))}
    </div>
  )
}

function HeadMovementChart({ result, visibleCount }) {
  const data = result.traversalWaypoints.slice(0, visibleCount)
  const requestSteps = new Set(result.traversalWaypoints.filter((point) => point.type === 'request').map((point) => point.step))
  const customDot = (props) => {
    const { cx, cy, payload } = props
    if (!payload || !requestSteps.has(payload.step)) return null
    return <circle cx={cx} cy={cy} r={4} fill="#22d3ee" stroke="#0f172a" strokeWidth={2} />
  }
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Visualization</span><h2>Head movement</h2></div>
        <div className="legend"><span><i className="dot request" />Request</span><span><i className="dot boundary" />Boundary / wrap</span></div>
      </div>
      <div className="chart-wrap" aria-label="Head movement chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.10)" strokeDasharray="3 3" />
            <XAxis dataKey="step" type="number" domain={[0, Math.max(result.traversalWaypoints.length - 1, 1)]} label={{ value: 'Traversal step', position: 'insideBottom', offset: -4 }} stroke="#64748b" />
            <YAxis domain={[0, result.diskSize - 1]} label={{ value: 'Cylinder', angle: -90, position: 'insideLeft' }} stroke="#64748b" />
            <Tooltip content={<ChartTooltip />} />
            <Line type="linear" dataKey="cylinder" stroke="#60a5fa" strokeWidth={3} dot={customDot} activeDot={{ r: 6, fill: '#22d3ee' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>Step {point.step}</strong>
      <span>Cylinder {point.cylinder}</span>
      <span>Movement {point.distance}</span>
      <span className="event-label">{point.type}</span>
    </div>
  )
}

function AnimationControls({ result, visibleCount, setVisibleCount }) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const max = result.traversalWaypoints.length
  useEffect(() => {
    if (!playing) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= max) { setPlaying(false); return count }
        return count + 1
      })
    }, reduceMotion ? 180 : 900 / speed)
    return () => window.clearInterval(timer)
  }, [playing, speed, max, setVisibleCount])
  const current = result.traversalWaypoints[Math.max(0, visibleCount - 1)]
  return (
    <section className="panel controls-panel">
      <div className="current-position"><span>Current position</span><strong>{current?.cylinder ?? result.initialHead}</strong></div>
      <div className="controls">
        <button aria-label="Restart" onClick={() => { setVisibleCount(1); setPlaying(false) }}><SkipBack size={17} /></button>
        <button aria-label="Step backward" onClick={() => { setPlaying(false); setVisibleCount((count) => Math.max(1, count - 1)) }}><ChevronLeft size={18} /></button>
        {playing
          ? <button className="play-control" aria-label="Pause" onClick={() => setPlaying(false)}><Pause size={18} fill="currentColor" /></button>
          : <button className="play-control" aria-label={visibleCount >= max ? 'Restart and play' : 'Play'} onClick={() => { if (visibleCount >= max) setVisibleCount(1); setPlaying(true) }}><Play size={18} fill="currentColor" /></button>}
        <button aria-label="Step forward" onClick={() => { setPlaying(false); setVisibleCount((count) => Math.min(max, count + 1)) }}><ChevronRight size={18} /></button>
      </div>
      <div className="speed-control">
        <span>Speed</span>
        {[0.5, 1, 2].map((value) => <button key={value} className={speed === value ? 'selected' : ''} onClick={() => setSpeed(value)}>{value}x</button>)}
      </div>
    </section>
  )
}

function ServiceSequence({ result }) {
  return (
    <section className="panel sequence-panel">
      <div className="panel-heading"><div><span className="eyebrow">Order</span><h2>Service sequence</h2></div></div>
      <div className="service-chips">
        {result.servicedRequestOrder.map((cylinder, index) => <span key={`${cylinder}-${index}`}>{cylinder}</span>)}
      </div>
    </section>
  )
}

function MovementBreakdown({ result }) {
  return (
    <section className="panel breakdown-panel">
      <div className="panel-heading"><div><span className="eyebrow">Detailed log</span><h2>Movement breakdown</h2></div></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Step</th><th>From</th><th>To</th><th>Distance</th><th>Event</th></tr></thead>
          <tbody>
            {result.movementBreakdown.map((point, index) => {
              const previous = index === 0 ? result.initialHead : result.movementBreakdown[index - 1].cylinder
              return (
                <tr key={index}>
                  <td>{point.step}</td><td>{previous}</td><td>{point.cylinder}</td><td>{point.distance}</td>
                  <td><span className={`event-chip ${point.type}`}>{point.type}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="traversal-order"><span>Complete traversal</span><strong>{result.traversalWaypoints.map((point) => point.cylinder).join(' → ')}</strong></div>
    </section>
  )
}

function ComparisonView({ inputValues, onInspect }) {
  const results = useMemo(() => {
    try {
      return ALGORITHMS.map((algorithm) => ({ algorithm, result: runAlgorithm(algorithm, inputValues) }))
    } catch {
      return []
    }
  }, [inputValues])
  if (!results.length) return <div className="compare-view"><section className="panel error-banner">Correct the simulation input before comparing algorithms.</section></div>
  const minimum = Math.min(...results.map(({ result }) => result.totalHeadMovement))
  const chartData = results.map(({ algorithm, result }) => ({ algorithm, movement: result.totalHeadMovement, time: result.averageSeekTime }))
  return (
    <div className="compare-view">
      <div className="compare-heading"><div><span className="eyebrow">Workload analysis</span><h1>Algorithm comparison</h1></div><p>Results for this workload only</p></div>
      <section className="panel comparison-panel">
        <div className="table-scroll">
          <table className="comparison-table">
            <thead><tr><th>Algorithm</th><th>Total movement</th><th>Average seek distance</th><th>Average seek time</th><th></th></tr></thead>
            <tbody>
              {results.map(({ algorithm, result }) => (
                <tr key={algorithm} className={result.totalHeadMovement === minimum ? 'minimum-row' : ''}>
                  <td><strong>{algorithm}</strong>{result.totalHeadMovement === minimum && <span className="best-chip">Minimum</span>}</td>
                  <td>{result.totalHeadMovement} cylinders</td><td>{result.averageSeekDistance.toFixed(2)} cyl/request</td><td>{result.averageSeekTime.toFixed(2)} ms/request</td>
                  <td><button className="inspect-button" onClick={() => onInspect(algorithm)}>Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel compare-chart">
        <div className="panel-heading"><div><span className="eyebrow">Movement & time</span><h2>Performance chart</h2></div></div>
        <div className="compare-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.10)" strokeDasharray="3 3" />
              <XAxis dataKey="algorithm" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #263244', borderRadius: 8 }} />
              <Bar dataKey="movement" name="Total cylinders" fill="#38bdf8" radius={[5, 5, 0, 0]} />
              <Bar dataKey="time" name="Average seek ms" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

function ErrorDisplay({ errors }) {
  if (!Object.keys(errors).length) return null
  return <div className="error-banner" role="alert">{Object.values(errors)[0]}</div>
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [values, setValues] = useState(defaults)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(() => runAlgorithm('FCFS', {
    diskSize: 200, initialHead: 53, requests: [98, 183, 37, 122, 14, 124, 65, 67], seekTime: 1, direction: 'right',
  }))
  const [visibleCount, setVisibleCount] = useState(1)

  const runSimulation = () => {
    const requests = parseRequests(values.requests)
    const input = {
      diskSize: Number(values.diskSize),
      initialHead: Number(values.initialHead),
      requests,
      direction: values.direction,
      seekTime: Number(values.seekTime),
    }
    const nextErrors = validateInput(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    try {
      setResult(runAlgorithm(values.algorithm, input))
      setVisibleCount(1)
    } catch (error) {
      setErrors({ general: error.message })
    }
  }

  const reset = () => { setValues(defaults); setErrors({}); setResult(runAlgorithm('FCFS', { diskSize: 200, initialHead: 53, requests: [98,183,37,122,14,124,65,67], seekTime: 1, direction: 'right' })); setVisibleCount(1) }
  const inspect = (algorithm) => {
    setValues((current) => ({ ...current, algorithm }))
    setView('dashboard')
    const requests = parseRequests(values.requests)
    try {
      setResult(runAlgorithm(algorithm, { diskSize: Number(values.diskSize), initialHead: Number(values.initialHead), requests, direction: values.direction, seekTime: Number(values.seekTime) }))
      setVisibleCount(1)
    } catch {
      // Errors are already reflected by the input view.
    }
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} open={sidebarOpen} setOpen={setSidebarOpen} />
      {sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button>
          <div><span className="eyebrow">Operating Systems Lab</span><h1>{view === 'dashboard' ? 'Disk Scheduling Simulator' : 'Performance Comparison'}</h1></div>
          <div className="topbar-status"><span /> Simulation engine</div>
        </header>
        {view === 'dashboard' ? (
          <div className="dashboard-layout">
            <aside className="left-column">
              <InputPanel values={values} setValues={setValues} onRun={runSimulation} onReset={reset} errors={errors} />
              <AlgorithmInfo algorithm={values.algorithm} />
            </aside>
            <div className="right-column">
              <ErrorDisplay errors={errors} />
              <MetricsCards result={result} />
              <HeadMovementChart result={result} visibleCount={visibleCount} />
              <AnimationControls result={result} visibleCount={visibleCount} setVisibleCount={setVisibleCount} />
              <div className="lower-grid"><ServiceSequence result={result} /><MovementBreakdown result={result} /></div>
            </div>
          </div>
        ) : (
          <ComparisonView inputValues={{
            diskSize: Number(values.diskSize) || 200,
            initialHead: Number(values.initialHead) || 53,
            requests: parseRequests(values.requests),
            direction: values.direction,
            seekTime: Number(values.seekTime) || 1,
          }} onInspect={inspect} />
        )}
      </main>
    </div>
  )
}
