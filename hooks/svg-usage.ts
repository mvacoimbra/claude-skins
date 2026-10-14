import type { UsageSnap } from '../types'
import type { Palette } from './skin'
import { escape, FONT, measure } from './svg-kit'

// The band above the prompt: how full the context window is and how much of each plan
// limit is spent, as rings that fill in when they draw. Each ring is the pack kit's `meter`:
// the same 7px ring on an 18px square, the same 2.5 stroke on a faint muted track, the accent
// until 80 %, then warn, then err from 95 %; the percent in the body text, bold, its label and
// countdown muted beside it.

const RING_R = 7
const RING_BOX = RING_R * 2 + 4
const RING_STROKE = 2.5
const FILL_MS = 900
const ITEM_W = 120
const TEXT_SIZE = 13
// The kit's `columnGap={1}` between a ring and its words, and between meters.
const GAP = 8
const ITEM_GAP = 20
const MINUTE_MS = 60_000

// `resets`, where shown, is the time left until the limit resets, as `countdownOf` writes it.
export type Meter = { label: string; percent: number; resets?: string }

// The time left until a reset, to the minute: `3d4h`, `1h05`, `12m`, and `now` once it is due.
export function countdownOf(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE_MS)

  if (minutes <= 0) {
    return 'now'
  }

  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60

  if (days > 0) {
    return `${days}d${hours}h`
  }

  return hours > 0 ? `${hours}h${String(rest).padStart(2, '0')}` : `${rest}m`
}

// The time left until a reset, to the second: `3d 4h05m09s`, `4h05m09s`, `5m09s`, `9s`, and
// `now` once it is due.
export function exactCountdownOf(ms: number): string {
  const seconds = Math.ceil(ms / 1000)

  if (seconds <= 0) {
    return 'now'
  }

  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const two = (n: number) => String(n).padStart(2, '0')

  if (days > 0) {
    return `${days}d ${hours}h${two(minutes)}m${two(rest)}s`
  }

  if (hours > 0) {
    return `${hours}h${two(minutes)}m${two(rest)}s`
  }

  return minutes > 0 ? `${minutes}m${two(rest)}s` : `${rest}s`
}

// Each limit's countdown by its label, to the second, for the limits that say when they reset.
export const countdownsOf = (usage: UsageSnap, now: number): Record<string, string> =>
  Object.fromEntries(usage.limits.flatMap(limit => (limit.resetsAt === undefined ? [] : [[limit.label, exactCountdownOf(limit.resetsAt - now)]])))

// What the band's entrance is keyed by: the numbers, not the countdowns, so a countdown
// ticking down redraws the rings settled instead of filling them again.
export const metersKey = (meters: readonly Meter[]): string => meters.map(meter => `${meter.label} ${meter.percent}%`).join(', ')

const meterText = (meter: Meter): string => `${meter.percent}% ${meter.label}${meter.resets === undefined ? '' : ` · ${meter.resets}`}`

// `five_hour` reads as `5h`, `seven_day` as `7d`; any other kind as its own name.
export function limitLabel(kind: string): string {
  const name = kind.toLowerCase()

  if (name.includes('five') || name.includes('5h') || name.includes('5_h')) {
    return '5h'
  }

  if (name.includes('seven') || name.includes('7d') || name.includes('week')) {
    return '7d'
  }

  return name.replace(/_/g, ' ')
}

// `countdowns`, by limit label, puts each limit's time to reset beside its meter.
export function metersOf(usage: UsageSnap, countdowns: Record<string, string> = {}): Meter[] {
  return [
    ...(usage.context === null ? [] : [{ label: 'context', percent: usage.context }]),
    ...usage.limits.map(limit => {
      const resets = countdowns[limit.label]

      return { label: limit.label, percent: limit.percent, ...(resets === undefined ? {} : { resets }) }
    }),
  ].map(meter => ({ ...meter, percent: Math.max(0, Math.min(100, Math.round(meter.percent))) }))
}

// Accent while there is room; the warning colour from 80 %, the error colour from 95 %.
export const meterSlot = (percent: number): 'err' | 'warn' | 'user' => (percent >= 95 ? 'err' : percent >= 80 ? 'warn' : 'user')

export const meterColor = (percent: number, palette: Palette): string => palette[meterSlot(percent)]

export function usageSvg(meters: readonly Meter[], palette: Palette): { source: string; width: number; height: number; alt: string; entranceMs: number } {
  // A meter with a countdown is wider than the rest; each starts where the one before ended.
  // The words measured with room to spare: the percent is bold, and the desktop's sans runs
  // wider than the estimate.
  const wordsW = (meter: Meter) => measure(`${meter.percent}%`, false, TEXT_SIZE) * 1.2 + measure(meterText(meter).slice(`${meter.percent}%`.length), false, TEXT_SIZE) * 1.2
  const widths = meters.map((meter, i) => Math.max(ITEM_W, Math.ceil(RING_BOX + GAP + wordsW(meter) + (i === meters.length - 1 ? 4 : ITEM_GAP))))
  const starts = widths.map((_, i) => widths.slice(0, i).reduce((sum, w) => sum + w, 0))
  const width = widths.reduce((sum, w) => sum + w, 0)
  const height = 24
  const mid = height / 2
  const circumference = 2 * Math.PI * RING_R

  const items = meters
    .map((meter, i) => {
      const x = (starts[i] ?? 0) + RING_BOX / 2
      const filled = (circumference * meter.percent) / 100
      const color = meterColor(meter.percent, palette)

      return [
        `<circle cx="${x}" cy="${mid}" r="${RING_R}" fill="none" stroke="${palette.muted}" stroke-opacity=".25" stroke-width="${RING_STROKE}"/>`,
        `<circle class="fill" cx="${x}" cy="${mid}" r="${RING_R}" fill="none" stroke="${color}" stroke-width="${RING_STROKE}" stroke-linecap="round" stroke-dasharray="${filled} ${circumference}" transform="rotate(-90 ${x} ${mid})" style="--len:${filled}"/>`,
        `<text x="${x + RING_BOX / 2 + GAP}" y="${mid + 4.5}" font-size="${TEXT_SIZE}"><tspan style="fill:${palette.fg};font-weight:600">${meter.percent}%</tspan><tspan style="fill:${palette.muted}"> ${escape(meter.label)}${meter.resets === undefined ? '' : ` · ${escape(meter.resets)}`}</tspan></text>`,
      ].join('')
    })
    .join('')

  const style = [
    `text{font-family:${FONT}}`,
    `.fill{animation:fill ${FILL_MS}ms cubic-bezier(.2,.8,.2,1)}`,
    '@keyframes fill{from{stroke-dasharray:0 100}}',
    '@media (prefers-reduced-motion:reduce){.fill{animation:none}}',
  ].join('')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>${style}</style>${items}</svg>`,
    width,
    height,
    alt: meters.map(meter => `${meter.label} ${meter.percent}%${meter.resets === undefined ? '' : `, resets in ${meter.resets}`}`).join(', '),
    entranceMs: FILL_MS,
  }
}

// The terminal's version: one line of block meters, `text` what follows each bar.
export function usageLine(meters: readonly Meter[]): { label: string; bar: string; percent: number; text: string }[] {
  return meters.map(meter => {
    const filled = Math.round(meter.percent / 12.5)

    return { label: meter.label, bar: '▰'.repeat(filled) + '▱'.repeat(8 - filled), percent: meter.percent, text: meterText(meter) }
  })
}
