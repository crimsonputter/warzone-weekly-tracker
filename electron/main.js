import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function progressPath() {
  return path.join(app.getPath('userData'), 'progress.json')
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

ipcMain.handle('progress:load', () => {
  try {
    const raw = fs.readFileSync(progressPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { challenges: {}, masters: {}, weekly: {} }
  }
})

ipcMain.handle('progress:save', (_, data) => {
  fs.mkdirSync(path.dirname(progressPath()), { recursive: true })
  fs.writeFileSync(progressPath(), JSON.stringify(data, null, 2), 'utf-8')
})

ipcMain.handle('settings:load', () => {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
  } catch {
    return {
      manifestUrl: '',
      autoRefreshMinutes: 360,
    }
  }
})

ipcMain.handle('settings:save', (_, data) => {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2), 'utf-8')
})

/** Turn a GitHub file page URL into a raw.githubusercontent.com JSON URL. */
function normalizeManifestUrl(input) {
  const s = String(input ?? '').trim()
  if (!s) return s
  try {
    const u = new URL(s)
    if (u.hostname !== 'github.com') return s
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 5 || parts[2] !== 'blob') return s
    const user = parts[0]
    const repo = parts[1]
    const branch = parts[3]
    const filePath = parts.slice(4).join('/')
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}`
  } catch {
    return s
  }
}

ipcMain.handle('manifest:fetch', async (_, url) => {
  const resolved = normalizeManifestUrl(url)
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 25_000)
  try {
    const res = await fetch(resolved, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = (await res.text()).replace(/^\uFEFF/, '').trim()
    if (text.startsWith('<')) {
      throw new Error(
        'Got a web page (HTML), not JSON. On GitHub open the file → Raw → copy that raw.githubusercontent.com URL into Settings.',
      )
    }
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Response was not valid JSON.')
    }
  } finally {
    clearTimeout(t)
  }
})

ipcMain.handle('shell:openExternal', async (_, url) => {
  await shell.openExternal(url)
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
