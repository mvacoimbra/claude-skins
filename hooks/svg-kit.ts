import { iconAt } from './kit/icons'
import type { IconName } from './kit/icons'
import { mix } from './kit/tone'
import type { Palette } from './skin'

// What every vector card shares: fonts, text measuring and fitting, escaping, and the
// card shell, in the pack kit's grammar. Cards have no background of their own: the desktop
// draws an Svg as an image, so the page shows through, and bands are faint tints of the text
// colour. The outline is the kit's hairline at the radius of its groups; headers are the
// system sans, the title in the body text and the rest muted; mono is for code, paths and
// numbers only; icons are the kit's.

export const FONT = `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif`
export const MONO = `ui-monospace, 'Cascadia Code', 'JetBrains Mono', Consolas, monospace`

export const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Width of a string in pixels, close enough to lay out a card without a renderer.
export function measure(text: string, isMono: boolean, size: number): number {
  if (isMono) {
    return [...text].length * size * 0.6
  }

  return [...text].reduce((sum, char) => {
    if ('iljtf.,:;|!\'` '.includes(char)) {
      return sum + size * 0.3
    }

    if ('mwMW@%'.includes(char)) {
      return sum + size * 0.82
    }

    return sum + (char >= 'A' && char <= 'Z' ? size * 0.64 : size * 0.54)
  }, 0)
}

export function fitText(text: string, width: number, isMono: boolean, size: number): string {
  if (measure(text, isMono, size) <= width) {
    return text
  }

  // One pass: a width is the sum of its characters', so the cut is where the running sum
  // and the ellipsis no longer fit. Re-measuring the whole text per character dropped was
  // quadratic, and a code card's alt text runs to thousands of characters.
  const chars = [...text]
  const room = width - measure('…', isMono, size)
  let used = 0
  let kept = 0

  for (const char of chars) {
    used += measure(char, isMono, size)

    if (used > room) {
      break
    }

    kept += 1
  }

  return `${chars.slice(0, Math.max(1, kept)).join('')}…`
}

// The room a reply gives a card, from the width the desktop reports in cells of its code
// font, kept to a range a card reads well at. The reported width runs wider than the
// reply column, so this errs small: a card that fits beats one that runs off the edge.
const PX_PER_COLUMN = 6.4

export const cardWidth = (columns: number, min = 480, max = 1600): number =>
  Math.round(Math.min(max, Math.max(min, columns * PX_PER_COLUMN)))

const RISE_MS = 450
const FADE_MS = 300
const STAGGER_BUDGET_MS = 360

// Rows that rise in one after another, honouring reduced motion.
export const MOTION = [
  `.rise{opacity:0;animation:rise ${RISE_MS}ms cubic-bezier(.2,.8,.2,1) forwards}`,
  `.card{animation:fade ${FADE_MS}ms ease-out}`,
  '@keyframes rise{from{opacity:0;transform:translateY(5px)}to{opacity:1}}',
  '@keyframes fade{from{opacity:0}to{opacity:1}}',
  '@media (prefers-reduced-motion:reduce){.rise,.card{animation:none;opacity:1}}',
].join('')

// Every entrance at its end state. The desktop draws each new source as a new image and
// plays its animation from the start, so a card drawn again (a reply streaming in, a
// scroll) is drawn settled, or it would fade out and back in on each redraw.
const SETTLED = '.rise,.card,.row,.rule,.fill{animation:none!important;opacity:1!important;stroke-dashoffset:0!important}'

export const settled = (source: string): string => source.replace('</style>', `${SETTLED}</style>`)

export const staggerStep = (count: number, stepMs: number): number => Math.min(stepMs, STAGGER_BUDGET_MS / Math.max(1, count - 1))

export const riseDelay =(index: number, stepMs: number, startMs = 80): string =>
  `style="animation-delay:${Math.round(startMs + index * stepMs)}ms"`

export const staggerEnd = (count: number, stepMs: number, startMs = 80, durationMs = RISE_MS): number =>
  Math.max(FADE_MS, Math.ceil(startMs + Math.max(0, count - 1) * stepMs + durationMs))

export const riseEnd = (source: string): number =>
  Math.max(RISE_MS, ...[...source.matchAll(/animation-delay:(\d+)ms/g)].map(([, delay = '0']) => Number(delay) + RISE_MS))

// The kit's group outline: Claude Code's rounded border.
const RADIUS = 8

const luminance = (hex: string): number => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#808080'

  return parseInt(h.slice(1, 3), 16) * 0.2126 + parseInt(h.slice(3, 5), 16) * 0.7152 + parseInt(h.slice(5, 7), 16) * 0.0722
}

// Whether a palette is for a light background: its surface brighter than its text.
export const isLightPalette = (palette: Palette): boolean => luminance(palette.surface) > luminance(palette.fg)

// The kit's hairline (`Tone.hex.line`): the surface a step towards the text.
export const hairline = (palette: Palette): string => mix(palette.surface, palette.fg, isLightPalette(palette) ? 0.14 : 0.16)

// The hairline under a card's header, or between its parts.
export const rule = (y: number, width: number, palette: Palette, x = 0): string =>
  `<line x1="${x}" y1="${y - 0.5}" x2="${width}" y2="${y - 0.5}" stroke="${hairline(palette)}"/>`

// A header's title: the body text in the system sans, a step bolder.
export const headerTitle = (x: number, y: number, text: string, opts: { mono?: boolean; anchor?: 'start' | 'end' } = {}): string =>
  `<text x="${x}" y="${y}"${opts.anchor === 'end' ? ' text-anchor="end"' : ''}${opts.mono ? ` font-family="${MONO}" font-size="12.5"` : ' font-size="13"'} style="font-weight:600">${escape(text)}</text>`

// A header's detail or note: muted, the system sans unless it is a number or a path.
export const headerMeta = (x: number, y: number, text: string, palette: Palette, opts: { mono?: boolean; anchor?: 'start' | 'end' } = {}): string =>
  `<text x="${x}" y="${y}"${opts.anchor === 'end' ? ' text-anchor="end"' : ''}${opts.mono ? ` font-family="${MONO}" font-size="11.5"` : ' font-size="12"'} style="fill:${palette.muted}">${escape(text)}</text>`

// One of the kit's icons in a card header, muted as the kit draws icons.
export const headerIcon = (name: IconName, x: number, y: number, palette: Palette, size = 16): string => iconAt(name, x, y, size, palette.muted)

// The room a card leaves in its top-right corner for a Copy button laid over it.
export const CONTROL_SLOT = 84

// Where a header's labels centre: the line the Copy button laid over a card sits on,
// one text row down from the card's top edge.
export const HEADER_MID = 29

// The card: a rounded hairline outline, with everything inside clipped to its corners.
export function svgCard(width: number, height: number, palette: Palette, style: string, body: string): string {
  // Unique per size, so cards placed together in one document keep their own corners.
  const clip = `corners-${width}x${height}`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><clipPath id="${clip}"><rect width="${width}" height="${height}" rx="${RADIUS}"/></clipPath></defs>`,
    // Sans for text that names no font of its own: a CSS rule on all text would beat the
    // monospace attribute on code, paths and output.
    `<style>text{fill:${palette.fg}}text:not([font-family]){font-family:${FONT}}${MOTION}${style}</style>`,
    `<g class="card"><g clip-path="url(#${clip})">${body}</g>`,
    `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="${RADIUS - 0.5}" fill="none" stroke="${hairline(palette)}"/></g>`,
    `</svg>`,
  ].join('')
}

// A band behind a row, as a faint tint of the text colour, so it reads on any page.
export const tint = (palette: Palette, y: number, width: number, height: number, opacity = 0.05): string =>
  `<rect y="${y}" width="${width}" height="${height}" fill="${palette.fg}" fill-opacity="${opacity}"/>`

// A small rounded label in a state's colour, such as `ok`, `failed` or `new file`,
// right-aligned at `right`: the one pill every card uses. A word is the system sans; a
// number or a code (`exit 2`) is mono.
export const PILL_H = 20

export function pill(right: number, y: number, text: string, color: string, opts: { mono?: boolean } = {}): string {
  const size = opts.mono ? 11 : 11.5
  const width = Math.ceil(measure(text, opts.mono === true, size) + 16)
  const left = right - width

  return `<rect x="${left}" y="${y}" width="${width}" height="${PILL_H}" rx="${PILL_H / 2}" fill="${color}" fill-opacity=".14"/><text x="${left + width / 2}" y="${y + 14}" text-anchor="middle"${opts.mono ? ` font-family="${MONO}"` : ''} font-size="${size}" style="fill:${color};font-weight:500">${escape(text)}</text>`
}

// The width a pill takes, for laying out what sits beside it.
export const pillWidth = (text: string, opts: { mono?: boolean } = {}): number => Math.ceil(measure(text, opts.mono === true, opts.mono ? 11 : 11.5) + 16)

// A drawing's own pictogram that the kit's set has no name for (an architecture diagram's
// database, server, disk), drawn in the kit's stroke: 1.8, round caps and joins.
export const strokeIcon = (path: string, x: number, y: number, size: number, color: string): string =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</g>`
