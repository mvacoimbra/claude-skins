import { countdownOf } from './svg-usage'

// Where the prompt cache stands, as cache-tax's `$.cachetax.state` answers it: `coldAt` is when it
// goes cold unless a request reads it first, `warmUntil` when the keep-warm window ends.
export type CacheState = {
  phase: 'warm' | 'cold' | 'unknown' | 'stopped'
  coldAt: number | null
  warmUntil: number | null
}

// The band's line on the prompt cache, and the palette slot it is drawn in. `short` is the
// timer alone (`42m`, `5h10`), empty once the cache is cold: the desktop shows it beside the
// cache icon, with `text` in a hover card; the terminal reads `cache 42m`.
export type CacheLine = { text: string; tone: 'ok' | 'warn' | 'err'; short: string }

const SOON_MS = 10 * 60 * 1000

// How long until the cache goes cold: kept warm while a window runs, a countdown otherwise, and
// nothing before the first request or after compaction, when there is nothing to lose yet.
export function cacheLine(state: CacheState, now: number): CacheLine | null {
  if (state.phase === 'cold') {
    return { text: 'cache: cold', tone: 'err', short: '' }
  }

  if (state.coldAt === null) {
    return null
  }

  if (state.warmUntil !== null && state.warmUntil > now) {
    const left = countdownOf(state.warmUntil - now)

    return { text: `cache: kept warm ${left}`, tone: 'ok', short: left }
  }

  const left = state.coldAt - now

  return { text: `cache: cold in ${countdownOf(left)}`, tone: left <= SOON_MS ? 'warn' : 'ok', short: countdownOf(left) }
}

export const sameLine = (a: CacheLine | null, b: CacheLine | null): boolean => a?.text === b?.text && a?.tone === b?.tone && a?.short === b?.short

// The terminal's short form: `cache 42m`, or `cache cold`.
export const cacheShort = (line: CacheLine): string => `cache ${line.short === '' ? 'cold' : line.short}`
