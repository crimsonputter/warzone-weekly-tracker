import type { GameManifest, WeaponDef } from './types'
import { bundledManifest } from './data/weapons'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function asWeaponDef(v: unknown): WeaponDef | null {
  if (!isRecord(v)) return null
  const id = v.id
  const name = v.name
  const category = v.category
  const challenges = v.challenges
  const dlc = v.dlc
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof category !== 'string' ||
    !Array.isArray(challenges) ||
    challenges.some((c) => typeof c !== 'string')
  ) {
    return null
  }
  return {
    id,
    name,
    category: category as WeaponDef['category'],
    dlc: Boolean(dlc),
    challenges: challenges as string[],
  }
}

function parseRemote(raw: unknown): Partial<GameManifest> | null {
  if (!isRecord(raw)) return null
  const out: Partial<GameManifest> = {}
  if (typeof raw.version === 'number') out.version = raw.version
  if (typeof raw.game === 'string') out.game = raw.game
  if (typeof raw.title === 'string') out.title = raw.title
  if (typeof raw.updatedAt === 'string') out.updatedAt = raw.updatedAt
  if (typeof raw.sourceNote === 'string') out.sourceNote = raw.sourceNote
  if (Array.isArray(raw.weapons)) {
    const ws = raw.weapons.map(asWeaponDef).filter(Boolean) as WeaponDef[]
    if (ws.length) out.weapons = ws
  }
  if (Array.isArray(raw.weeklyChallenges)) {
    const wk = raw.weeklyChallenges.filter(isRecord).map((w) => {
      const id = w.id
      const title = w.title
      const description = w.description
      const endsAt = w.endsAt
      if (typeof id !== 'string' || typeof title !== 'string') return null
      return {
        id,
        title,
        description: typeof description === 'string' ? description : '',
        endsAt: typeof endsAt === 'string' ? endsAt : undefined,
      }
    })
    const clean = wk.filter(Boolean) as GameManifest['weeklyChallenges']
    if (clean.length) out.weeklyChallenges = clean
  }
  if (Array.isArray(raw.masterCamos)) {
    const mc = raw.masterCamos.filter(isRecord).map((m) => {
      const id = m.id
      const name = m.name
      const short = m.short
      if (
        id !== 'golden' &&
        id !== 'starglass' &&
        id !== 'absoluteZero'
      )
        return null
      if (typeof name !== 'string') return null
      return {
        id,
        name,
        short: typeof short === 'string' ? short : name,
      }
    })
    const clean = mc.filter(Boolean) as GameManifest['masterCamos']
    if (clean.length) out.masterCamos = clean
  }
  return out
}

/** Deep-merge remote JSON over the bundled manifest (remote wins for provided sections). */
export function mergeManifest(remoteRaw: unknown): GameManifest {
  const remote = parseRemote(remoteRaw)
  if (!remote) return bundledManifest
  return {
    ...bundledManifest,
    ...remote,
    weapons: remote.weapons?.length ? remote.weapons : bundledManifest.weapons,
    weeklyChallenges: remote.weeklyChallenges?.length
      ? remote.weeklyChallenges
      : bundledManifest.weeklyChallenges,
    masterCamos: remote.masterCamos?.length
      ? remote.masterCamos
      : bundledManifest.masterCamos,
  }
}
