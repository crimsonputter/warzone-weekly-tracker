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

ipcMain.handle('manifest:fetch', async (_, url) => {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 25_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
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
