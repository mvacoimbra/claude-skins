import type { Palette } from './skin'
import { outputTokens, roleColors } from './highlight'
import { CONTROL_SLOT, escape, HEADER_MID, fitText, headerIcon, headerMeta, headerTitle, MONO, pill, PILL_H, riseDelay, rule, staggerEnd, staggerStep, svgCard } from './svg-kit'

// A shell command's output as a terminal card: a status pill, the output in mono with
// stderr in the error colour, and long output folded to its head and tail.

const HEADER_H = 56
const LINE_H = 20
const CODE = 12.5
const HEAD = 6
const TAIL = 6

// Escape sequences for colour and cursor moves, which a card cannot draw.
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g

export type ShellOutput = { stdout: string; stderr: string; interrupted: boolean; timedOutAfterMs?: number; returnCodeInterpretation?: string }

export function shellOutputOf(output: unknown): ShellOutput | null {
  const record = (typeof output === 'object' && output !== null ? output : {}) as Record<string, unknown>

  if (typeof record.stdout !== 'string' || typeof record.stderr !== 'string') {
    return null
  }

  return {
    stdout: record.stdout,
    stderr: record.stderr,
    interrupted: record.interrupted === true,
    ...(typeof record.timedOutAfterMs === 'number' ? { timedOutAfterMs: record.timedOutAfterMs } : {}),
    ...(typeof record.returnCodeInterpretation === 'string' ? { returnCodeInterpretation: record.returnCodeInterpretation } : {}),
  }
}

type Line = { text: string; isErr: boolean } | { fold: number }

// A stream's lines, colour codes stripped and trailing blank lines dropped.
export function streamLines(text: string, isErr: boolean): { text: string; isErr: boolean }[] {
  const lines = text.replace(ANSI, '').replace(/\r/g, '').replace(/\t/g, '  ').split('\n')
  const end = lines.length - [...lines].reverse().findIndex(line => line.trim() !== '')

  return lines.every(line => line.trim() === '') ? [] : lines.slice(0, end).map(line => ({ text: line, isErr }))
}

export function outputLines(output: ShellOutput): Line[] {
  const kept = [...streamLines(output.stdout, false), ...streamLines(output.stderr, true)]

  return kept.length <= HEAD + TAIL + 1
    ? kept
    : [...kept.slice(0, HEAD), { fold: kept.length - HEAD - TAIL }, ...kept.slice(kept.length - TAIL)]
}

// `hasControl` leaves the header's right corner free for a Copy button laid over it.
// `colour` picks out paths, numbers and verdicts in stdout with the skin's colours.
export function terminalSvg(output: ShellOutput, isErrored: boolean, palette: Palette, width: number, hasControl = false, colour = false): { source: string; width: number; height: number; alt: string; entranceMs: number } {
  const lines = outputLines(output)
  const step = staggerStep(Math.max(1, lines.length), 22)
  const status = output.interrupted
    ? { text: 'interrupted', color: palette.warn }
    : output.timedOutAfterMs !== undefined
      ? { text: 'timed out', color: palette.warn }
      : isErrored
        ? { text: 'failed', color: palette.err }
        : { text: 'ok', color: palette.ok }

  const rows = (lines.length === 0 ? [{ text: 'no output', isErr: false, isNote: true }] : lines).map((line, i) => {
    const top = HEADER_H + 6 + i * LINE_H

    if ('fold' in line) {
      return `<g class="rise" ${riseDelay(i, step)}><text x="20" y="${top + 14}" font-size="11.5" style="fill:${palette.muted}">⋯  ${line.fold} more lines</text></g>`
    }

    const color = 'isNote' in line ? palette.muted : line.isErr ? palette.err : palette.fg
    const text = fitText(line.text, width - 40, true, CODE)
    const body =
      colour && !line.isErr && !('isNote' in line)
        ? outputTokens(text)
            .map(token => `<tspan style="fill:${roleColors(palette)[token.role]}">${escape(token.text)}</tspan>`)
            .join('')
        : escape(text)

    return `<g class="rise" ${riseDelay(i, step)}><text x="20" y="${top + 14}" font-family="${MONO}" font-size="${CODE}" style="fill:${color}" xml:space="preserve">${body}</text></g>`
  })

  const height = HEADER_H + 6 + Math.max(1, lines.length) * LINE_H + 10
  // The header: the kit's run icon, `Output` in the body text with how the command's exit
  // code reads muted after it, and the status pill at the right.
  const interpretation = output.returnCodeInterpretation
  const header = [
    headerIcon('run', 16, HEADER_MID - 8, palette),
    headerTitle(42, HEADER_MID + 4.5, 'Output'),
    interpretation === undefined ? '' : headerMeta(42 + 52, HEADER_MID + 4.5, `· ${interpretation}`, palette),
    pill(width - 16 - (hasControl ? CONTROL_SLOT : 0), HEADER_MID - PILL_H / 2, status.text, status.color),
    rule(HEADER_H, width, palette),
  ].join('')

  return {
    source: svgCard(width, height, palette, '', header + rows.join('')),
    width,
    height,
    alt: lines.map(line => ('fold' in line ? `… ${line.fold} more lines` : line.text)).join('\n') || 'no output',
    entranceMs: staggerEnd(Math.max(1, lines.length), step),
  }
}
