import type { Palette } from './skin'
import { escape, fitText, headerIcon, MONO, pill, pillWidth, riseDelay, rule, staggerEnd, staggerStep, svgCard } from './svg-kit'

// An edit as a card: the file, how many lines it added and removed, and the changed
// lines with their numbers, green and red, rising in one after another.

const HEADER_H = 44
const LINE_H = 22
const GAP_H = 20
const CODE = 12.5
const MAX_LINES = 30

export type Hunk = { oldStart: number; newStart: number; lines: readonly string[] }

export type DiffInput = { path: string; hunks: readonly Hunk[]; isNewFile: boolean }

type Line = { kind: 'add' | 'del' | 'ctx'; text: string; old?: number; new?: number } | { kind: 'gap'; at: number }

// The patch's lines in order, numbered on each side, with a gap mark between hunks.
export function diffLines(hunks: readonly Hunk[]): Line[] {
  return hunks.flatMap((hunk, h) => {
    let oldNo = hunk.oldStart
    let newNo = hunk.newStart
    const lines: Line[] = h === 0 ? [] : [{ kind: 'gap', at: hunk.newStart }]

    for (const raw of hunk.lines) {
      if (raw.startsWith('\\')) {
        continue
      }

      const text = raw.slice(1).replace(/\t/g, '  ')

      if (raw.startsWith('+')) {
        lines.push({ kind: 'add', text, new: newNo++ })
      } else if (raw.startsWith('-')) {
        lines.push({ kind: 'del', text, old: oldNo++ })
      } else {
        lines.push({ kind: 'ctx', text, old: oldNo++, new: newNo++ })
      }
    }

    return lines
  })
}

// A new file's patch can arrive empty: its content stands in as added lines.
export function hunksOf(output: unknown): DiffInput | null {
  const record = (typeof output === 'object' && output !== null ? output : {}) as Record<string, unknown>
  const path = typeof record.filePath === 'string' ? record.filePath : ''
  const isNewFile = record.type === 'create'
  const patch = Array.isArray(record.structuredPatch) ? (record.structuredPatch as Hunk[]) : []

  if (path === '') {
    return null
  }

  if (patch.length > 0) {
    return { path, hunks: patch, isNewFile }
  }

  if (isNewFile && typeof record.content === 'string') {
    return { path, hunks: [{ oldStart: 0, newStart: 1, lines: record.content.split('\n').map(line => `+${line}`) }], isNewFile }
  }

  return null
}

export function diffSvg(input: DiffInput, shownPath: string, palette: Palette, width: number): { source: string; height: number; alt: string; entranceMs: number } {
  const all = diffLines(input.hunks)
  const shown = all.slice(0, MAX_LINES)
  const step = staggerStep(shown.length, 18)
  const hidden = all.length - shown.length
  const added = all.filter(line => line.kind === 'add').length
  const removed = all.filter(line => line.kind === 'del').length
  const codeX = 112
  const codeWidth = width - codeX - 16

  let y = HEADER_H
  const rows = shown.map((line, i) => {
    const top = y

    if (line.kind === 'gap') {
      y += GAP_H

      return `<g ${riseDelay(i, step)} class="rise"><text x="${codeX}" y="${top + 14}" font-size="11" style="fill:${palette.muted}">⋯  line ${line.at}</text></g>`
    }

    y += LINE_H

    const tint = line.kind === 'add' ? palette.ok : line.kind === 'del' ? palette.err : undefined
    const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ''
    const band = tint === undefined ? '' : `<rect y="${top}" width="${width}" height="${LINE_H}" fill="${tint}" fill-opacity=".1"/>`
    const number = (value: number | undefined, x: number) =>
      value === undefined ? '' : `<text x="${x}" y="${top + 15}" text-anchor="end" font-family="${MONO}" font-size="11" style="fill:${palette.muted}">${value}</text>`

    return `<g ${riseDelay(i, step)} class="rise">${band}${number(line.old, 44)}${number(line.new, 80)}<text x="96" y="${top + 15}" font-family="${MONO}" font-size="${CODE}" style="fill:${tint ?? palette.muted}">${sign}</text><text x="${codeX}" y="${top + 15}" font-family="${MONO}" font-size="${CODE}" style="fill:${line.kind === 'ctx' ? palette.muted : palette.fg}" xml:space="preserve">${escape(fitText(line.text, codeWidth, true, CODE))}</text></g>`
  })

  const footer = hidden > 0 ? `<text x="${codeX}" y="${y + 18}" font-size="11.5" style="fill:${palette.muted}">${hidden} more line${hidden === 1 ? '' : 's'}</text>` : ''
  const height = y + (hidden > 0 ? 30 : 8)
  // The header: the kit's file icon, the path in mono, then +added −removed and, for a file
  // the edit made, the `new file` pill at the right.
  const tag = input.isNewFile ? pill(width - 16, 12, 'new file', palette.ok) : ''
  const countsRight = width - 16 - (input.isNewFile ? pillWidth('new file') + 10 : 0)
  const counts = `<text x="${countsRight}" y="26.5" text-anchor="end" font-family="${MONO}" font-size="12"><tspan style="fill:${palette.ok}">+${added}</tspan><tspan style="fill:${palette.muted}">  </tspan><tspan style="fill:${palette.err}">−${removed}</tspan></text>`
  const header = [
    headerIcon(input.isNewFile ? 'file' : 'write', 16, 14, palette),
    `<text x="42" y="26.5" font-family="${MONO}" font-size="12.5" style="fill:${palette.fg};font-weight:600">${escape(fitText(shownPath, width - 230, true, 12.5))}</text>`,
    counts,
    tag,
    rule(HEADER_H, width, palette),
  ].join('')

  return {
    source: svgCard(width, height, palette, '', header + rows.join('') + footer),
    height,
    alt: `${shownPath}: +${added} −${removed}`,
    entranceMs: staggerEnd(shown.length, step),
  }
}
