export type WeaponCategory =
  | 'AR'
  | 'SMG'
  | 'SHOTGUN'
  | 'LMG'
  | 'RIFLE'
  | 'SNIPER'
  | 'Pistol'
  | 'MELEE'
  | 'SPECIAL'
  | 'LAUNCHERS'

export type WeaponDef = {
  id: string
  name: string
  category: WeaponCategory
  dlc: boolean
  challenges: string[]
}

export type MasterCamoDef = {
  id: 'golden' | 'starglass' | 'absoluteZero'
  name: string
  short: string
}

export type WeeklyChallengeDef = {
  id: string
  title: string
  description: string
  /** ISO end date if known */
  endsAt?: string
}

export type ProgressState = {
  challenges: Record<string, Record<string, boolean>>
  masters: Record<
    string,
    { golden?: boolean; starglass?: boolean; absoluteZero?: boolean }
  >
  weekly: Record<string, boolean>
}

export type AppSettings = {
  manifestUrl: string
  autoRefreshMinutes: number
}

export type GameManifest = {
  version: number
  game: string
  title: string
  updatedAt: string
  sourceNote?: string
  masterCamos: MasterCamoDef[]
  weapons: WeaponDef[]
  weeklyChallenges: WeeklyChallengeDef[]
}
