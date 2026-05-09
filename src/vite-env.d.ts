/// <reference types="vite/client" />

import type { AppSettings, ProgressState } from './types'

export type TrackerApi = {
  loadProgress: () => Promise<ProgressState>
  saveProgress: (data: ProgressState) => Promise<void>
  loadSettings: () => Promise<AppSettings>
  saveSettings: (data: AppSettings) => Promise<void>
  fetchManifest: (url: string) => Promise<unknown>
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    tracker?: TrackerApi
  }
}

export {}
