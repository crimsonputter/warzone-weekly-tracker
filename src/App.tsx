import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { GameManifest, ProgressState, WeaponCategory } from './types'
import { bundledManifest } from './data/weapons'
import { mergeManifest } from './manifestMerge'

const CAT_ORDER: WeaponCategory[] = [
  'AR',
  'SMG',
  'SHOTGUN',
  'LMG',
  'RIFLE',
  'SNIPER',
  'Pistol',
  'MELEE',
  'SPECIAL',
  'LAUNCHERS',
]

const LS_PROGRESS = 'wz-tracker-progress'
const LS_SETTINGS = 'wz-tracker-settings'

function emptyProgress(): ProgressState {
  return { challenges: {}, masters: {}, weekly: {} }
}

async function loadProgress(): Promise<ProgressState> {
  if (window.tracker) return window.tracker.loadProgress()
  try {
    const raw = localStorage.getItem(LS_PROGRESS)
    return raw ? (JSON.parse(raw) as ProgressState) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

async function saveProgress(data: ProgressState): Promise<void> {
  if (window.tracker) return window.tracker.saveProgress(data)
  localStorage.setItem(LS_PROGRESS, JSON.stringify(data))
}

type Settings = { manifestUrl: string; autoRefreshMinutes: number }

async function loadSettings(): Promise<Settings> {
  if (window.tracker) return window.tracker.loadSettings()
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    return raw
      ? (JSON.parse(raw) as Settings)
      : { manifestUrl: '', autoRefreshMinutes: 360 }
  } catch {
    return { manifestUrl: '', autoRefreshMinutes: 360 }
  }
}

async function saveSettings(data: Settings): Promise<void> {
  if (window.tracker) return window.tracker.saveSettings(data)
  localStorage.setItem(LS_SETTINGS, JSON.stringify(data))
}

function weaponProgress(
  manifest: GameManifest,
  progress: ProgressState,
): number {
  let done = 0
  let total = 0
  for (const w of manifest.weapons) {
    const map = progress.challenges[w.id] ?? {}
    for (let i = 0; i < w.challenges.length; i += 1) {
      total += 1
      if (map[String(i)]) done += 1
    }
  }
  return total ? Math.round((done / total) * 1000) / 10 : 0
}

function categoryProgress(
  manifest: GameManifest,
  progress: ProgressState,
  cat: WeaponCategory,
): number {
  const subset = manifest.weapons.filter((w) => w.category === cat)
  let done = 0
  let total = 0
  for (const w of subset) {
    const map = progress.challenges[w.id] ?? {}
    for (let i = 0; i < w.challenges.length; i += 1) {
      total += 1
      if (map[String(i)]) done += 1
    }
  }
  return total ? Math.round((done / total) * 1000) / 10 : 0
}

function masterCounts(manifest: GameManifest, progress: ProgressState) {
  const n = manifest.weapons.length
  const keys = ['golden', 'starglass', 'absoluteZero'] as const
  const out: Record<(typeof keys)[number], number> = {
    golden: 0,
    starglass: 0,
    absoluteZero: 0,
  }
  for (const w of manifest.weapons) {
    const m = progress.masters[w.id]
    if (!m) continue
    for (const k of keys) if (m[k]) out[k] += 1
  }
  return { n, out }
}

export default function App() {
  const [manifest, setManifest] = useState<GameManifest>(bundledManifest)
  const [progress, setProgress] = useState<ProgressState>(emptyProgress())
  const [settings, setSettings] = useState<Settings>({
    manifestUrl: '',
    autoRefreshMinutes: 360,
  })
  const [tab, setTab] = useState<
    'weapons' | 'weekly' | 'settings'
  >('weapons')
  const [cat, setCat] = useState<WeaponCategory | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback((next: ProgressState) => {
    if (saveT.current) clearTimeout(saveT.current)
    saveT.current = setTimeout(() => {
      void saveProgress(next)
    }, 400)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [p, s] = await Promise.all([loadProgress(), loadSettings()])
      if (cancelled) return
      setProgress({
        challenges: p.challenges ?? {},
        masters: p.masters ?? {},
        weekly: p.weekly ?? {},
      })
      setSettings(s)
      if (s.manifestUrl.trim() && window.tracker?.fetchManifest) {
        try {
          const raw = await window.tracker.fetchManifest(s.manifestUrl.trim())
          if (!cancelled) setManifest(mergeManifest(raw))
        } catch {
          /* quiet on boot */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tryRemote = useCallback(
    async (url: string, quiet: boolean) => {
      if (!url.trim()) {
        if (!quiet) setFetchMsg('Add a manifest URL first.')
        return
      }
      if (!window.tracker?.fetchManifest) {
        if (!quiet)
          setFetchMsg('Live fetch needs the desktop app (Electron).')
        return
      }
      setFetching(true)
      if (!quiet) setFetchMsg(null)
      try {
        const raw = await window.tracker.fetchManifest(url.trim())
        setManifest(mergeManifest(raw))
        if (!quiet) setFetchMsg('Manifest updated.')
      } catch (e) {
        if (!quiet)
          setFetchMsg(
            e instanceof Error ? e.message : 'Failed to fetch manifest.',
          )
      } finally {
        setFetching(false)
      }
    },
    [],
  )

  useEffect(() => {
    const mins = settings.autoRefreshMinutes
    if (!settings.manifestUrl.trim() || mins <= 0) return
    const id = setInterval(() => {
      void tryRemote(settings.manifestUrl, true)
    }, mins * 60_000)
    return () => clearInterval(id)
  }, [settings.manifestUrl, settings.autoRefreshMinutes, tryRemote])

  const overall = useMemo(
    () => weaponProgress(manifest, progress),
    [manifest, progress],
  )
  const masters = useMemo(
    () => masterCounts(manifest, progress),
    [manifest, progress],
  )

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return manifest.weapons.filter((w) => {
      if (cat !== 'ALL' && w.category !== cat) return false
      if (!qq) return true
      return (
        w.name.toLowerCase().includes(qq) ||
        w.category.toLowerCase().includes(qq)
      )
    })
  }, [manifest.weapons, cat, q])

  const setChallenge = (
    weaponId: string,
    idx: number,
    done: boolean,
  ) => {
    setProgress((prev) => {
      const next: ProgressState = {
        ...prev,
        challenges: { ...prev.challenges },
      }
      const cur = { ...(next.challenges[weaponId] ?? {}) }
      cur[String(idx)] = done
      next.challenges[weaponId] = cur
      scheduleSave(next)
      return next
    })
  }

  const setMaster = (
    weaponId: string,
    key: 'golden' | 'starglass' | 'absoluteZero',
    done: boolean,
  ) => {
    setProgress((prev) => {
      const next: ProgressState = { ...prev, masters: { ...prev.masters } }
      const cur = { ...(next.masters[weaponId] ?? {}) }
      cur[key] = done
      next.masters[weaponId] = cur
      scheduleSave(next)
      return next
    })
  }

  const setWeekly = (id: string, done: boolean) => {
    setProgress((prev) => {
      const next: ProgressState = { ...prev, weekly: { ...prev.weekly } }
      next.weekly[id] = done
      scheduleSave(next)
      return next
    })
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">BO7 Warzone</div>
        <button
          type="button"
          className={`nav-btn ${tab === 'weapons' ? 'active' : ''}`}
          onClick={() => setTab('weapons')}
        >
          Weapons
        </button>
        <button
          type="button"
          className={`nav-btn ${tab === 'weekly' ? 'active' : ''}`}
          onClick={() => setTab('weekly')}
        >
          Weeklies
        </button>
        <button
          type="button"
          className={`nav-btn ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </aside>

      <main className="main">
        {tab === 'weapons' && (
          <>
            <header className="header">
              <div className="title-block">
                <h1>Apocalypse camo tracker</h1>
                <p className="sub">
                  Local progress — optional live JSON for new guns & weeklies.
                </p>
              </div>
              <div className="pills">
                <span className="pill">
                  Overall <strong>{overall}%</strong>
                </span>
                {manifest.masterCamos.map((m) => (
                  <span key={m.id} className="pill">
                    {m.short}{' '}
                    <strong>
                      {masters.out[m.id]}/{masters.n}
                    </strong>
                  </span>
                ))}
              </div>
            </header>

            <div className="toolbar">
              <input
                className="search"
                placeholder="Search weapons…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="search"
                value={cat}
                onChange={(e) =>
                  setCat(e.target.value as WeaponCategory | 'ALL')
                }
                aria-label="Category"
              >
                <option value="ALL">All categories</option>
                {CAT_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c} ({categoryProgress(manifest, progress, c)}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid">
              {filtered.map((w) => {
                const map = progress.challenges[w.id] ?? {}
                const done = w.challenges.reduce(
                  (acc, _, i) => acc + (map[String(i)] ? 1 : 0),
                  0,
                )
                const pct = w.challenges.length
                  ? Math.round((done / w.challenges.length) * 1000) / 10
                  : 0
                const open = openId === w.id
                const wm = progress.masters[w.id] ?? {}
                return (
                  <section key={w.id} className="card">
                    <button
                      type="button"
                      className="card-head"
                      onClick={() => setOpenId(open ? null : w.id)}
                    >
                      <div>
                        <div className="weapon-name">{w.name}</div>
                        <div className="meta">
                          <span className="tag">{w.category}</span>
                          {w.dlc && <span className="tag dlc">DLC</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="bar" aria-hidden>
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pct">{pct}%</span>
                      </div>
                    </button>
                    {open && (
                      <div className="body">
                        <div className="masters">
                          {manifest.masterCamos.map((m) => (
                            <label key={m.id} className="master">
                              <input
                                type="checkbox"
                                checked={Boolean(wm[m.id])}
                                onChange={(e) =>
                                  setMaster(w.id, m.id, e.target.checked)
                                }
                              />
                              {m.name}
                            </label>
                          ))}
                        </div>
                        {w.challenges.map((label, idx) => (
                          <div key={`${w.id}-${idx}`} className="challenge">
                            <input
                              id={`${w.id}-${idx}`}
                              type="checkbox"
                              checked={Boolean(map[String(idx)])}
                              onChange={(e) =>
                                setChallenge(w.id, idx, e.target.checked)
                              }
                            />
                            <label htmlFor={`${w.id}-${idx}`}>{label}</label>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </>
        )}

        {tab === 'weekly' && (
          <>
            <header className="header">
              <div className="title-block">
                <h1>Weekly challenges</h1>
                <p className="sub">
                  Pulled from your live manifest when configured. Bundled entry
                  explains how to host JSON.
                </p>
              </div>
            </header>
            <div className="card" style={{ padding: '0.5rem 1rem' }}>
              {manifest.weeklyChallenges.map((w) => (
                <div key={w.id} className="week-item">
                  <input
                    type="checkbox"
                    checked={Boolean(progress.weekly[w.id])}
                    onChange={(e) => setWeekly(w.id, e.target.checked)}
                  />
                  <div>
                    <div style={{ fontWeight: 650 }}>{w.title}</div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      {w.description}
                    </div>
                    {w.endsAt && (
                      <div className="hint">Ends: {w.endsAt}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <>
            <header className="header">
              <div className="title-block">
                <h1>Settings</h1>
                <p className="sub">
                  Host a JSON file (GitHub raw, Gist, S3, etc.) that matches the
                  bundled schema to refresh weapons & weeklies without a store
                  update.
                </p>
              </div>
            </header>
            <div className="settings">
              <div className="field">
                <label htmlFor="url">Manifest URL (HTTPS JSON)</label>
                <input
                  id="url"
                  value={settings.manifestUrl}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, manifestUrl: e.target.value }))
                  }
                  placeholder="https://…/bo7wz-manifest.json"
                />
                <p className="hint">
                  Templates: <code>live-manifest.example.json</code> (full schema),{' '}
                  <code>weekly-challenges.template.json</code> (season/week id pattern +
                  sample weeklies). Use <code>weeklyChallenges[]</code> (and optional{' '}
                  <code>weapons[]</code>) in your hosted JSON.
                </p>
              </div>
              <div className="field">
                <label htmlFor="mins">Auto-refresh (minutes, 0 = off)</label>
                <input
                  id="mins"
                  type="number"
                  min={0}
                  value={settings.autoRefreshMinutes}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      autoRefreshMinutes: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={fetching}
                  onClick={() => {
                    void saveSettings(settings).then(() =>
                      tryRemote(settings.manifestUrl, false),
                    )
                  }}
                >
                  Save & fetch now
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveSettings(settings)}
                >
                  Save only
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const u = 'https://wzhub.gg/camo/bo7wz'
                    if (window.tracker?.openExternal)
                      void window.tracker.openExternal(u)
                    else window.open(u, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Open WZHUB reference
                </button>
              </div>
              {fetchMsg && (
                <p className={`status ${fetchMsg.includes('Fail') || fetchMsg.includes('HTTP') ? 'err' : ''}`}>
                  {fetchMsg}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
