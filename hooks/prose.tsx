import type { AlertType, Block, Line, Run, RunStyle, Task } from './blocks'
import { safeHref, touchOf } from './links'
import { icon } from './kit/kit'
import type { IconName } from './kit/icons'
import { inkOf } from './kit/tone'
import type { KitTone } from './kit/tone'
import { kitFor } from './ink'
import type { Look } from './rows'
import type { Palette } from './skin'

type Glyphs = { mark: string; done: string; open: string }

// Each alert as the kit's notice draws one: a state's tone and icon, a hairline outline. The
// glyphs are the terminal's, which draws no icons.
const ALERTS: Record<AlertType, { title: string; tone: KitTone; icon: IconName; unicode: string; ascii: string }> = {
  note: { title: 'Note', tone: 'accent', icon: 'info', unicode: 'ℹ', ascii: 'i' },
  tip: { title: 'Tip', tone: 'ok', icon: 'check', unicode: '✦', ascii: '*' },
  important: { title: 'Important', tone: 'accent', icon: 'alert', unicode: '❖', ascii: '!' },
  warning: { title: 'Warning', tone: 'warn', icon: 'alert', unicode: '▲', ascii: '!' },
  caution: { title: 'Caution', tone: 'err', icon: 'alert', unicode: '✖', ascii: 'x' },
}

const glyphs = (look: Look): Glyphs =>
  look.prefs.icons === 'ascii' ? { mark: '-', done: '[x]', open: '[ ]' } : { mark: '•', done: '☑', open: '☐' }

// The slot each highlighted kind of text takes from the skin.
const SLOTS: Partial<Record<RunStyle, keyof Palette>> = {
  code: 'search',
  number: 'user',
  duration: 'user',
  version: 'mcp',
  path: 'read',
  url: 'web',
}

// The colour a path takes: created this turn (ok), edited (warn), else the path colour.
function pathSlot(look: Look, text: string): keyof Palette {
  const touch = look.touched === undefined ? undefined : touchOf(look.touched.files, text, look.touched.cwd)

  return touch === 'created' ? 'ok' : touch === 'edited' ? 'warn' : 'read'
}

function runText(look: Look, run: Run) {
  const { Link, Text } = look.ui
  const palette = look.ink
  const slot = run.style === 'path' ? pathSlot(look, run.text) : SLOTS[run.style]
  const href = run.style === 'url' && look.links === true ? safeHref(run.text) : null

  // A URL the engine's Link takes is one where the surface draws links; any other is text.
  if (href !== null) {
    return (
      <Text color={palette.web} underline>
        <Link href={href}>{run.text}</Link>
      </Text>
    )
  }

  return (
    <Text
      color={slot === undefined ? palette.fg : palette[slot]}
      bold={run.style === 'bold'}
      italic={run.style === 'italic'}
      strikethrough={run.style === 'strike'}
      {...(run.style === 'code' ? { backgroundColor: palette.surface } : {})}
    >
      {run.text}
    </Text>
  )
}

function lineRow(look: Look, line: Line) {
  const { Box, Text } = look.ui
  const body = <Text>{line.runs.map(run => runText(look, run))}</Text>

  if (line.bullet === null) {
    return body
  }

  const mark = line.bullet === '•' ? glyphs(look).mark : line.bullet

  return (
    <Box flexDirection="row" paddingLeft={line.depth * 2}>
      <Text color={look.ink.muted}>{`${mark} `}</Text>
      {body}
    </Box>
  )
}

function headingRow(look: Look, level: number, text: string) {
  const { Text } = look.ui
  const palette = look.ink

  return (
    <Text color={level <= 2 ? palette.user : palette.fg} bold underline={level === 1}>
      {level <= 2 ? `${look.prefs.icons === 'ascii' ? '#' : '▍'} ${text}` : text}
    </Text>
  )
}

function alertBox(look: Look, type: AlertType, body: string) {
  const { Box, Text, Markdown } = look.ui
  const alert = ALERTS[type]
  const k = kitFor(look)
  const color = inkOf(look.t, alert.tone)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={look.ink.line} paddingX={1}>
      {k.vector ? (
        <Box flexDirection="row" columnGap={1} alignItems="center">
          {icon(k, alert.icon, alert.tone)}
          <Text color={color} bold>
            {alert.title}
          </Text>
        </Box>
      ) : (
        <Text color={color} bold>{`${look.prefs.icons === 'ascii' ? alert.ascii : alert.unicode} ${alert.title}`}</Text>
      )}
      {body === '' ? null : <Markdown text={body} />}
    </Box>
  )
}

function taskRows(look: Look, items: readonly Task[]) {
  const { Box, Text } = look.ui
  const palette = look.ink
  const mark = glyphs(look)
  const done = items.filter(item => item.done).length

  return (
    <Box flexDirection="column">
      {items.map(item => (
        <Box flexDirection="row" paddingLeft={item.depth * 2}>
          <Text color={item.done ? palette.ok : palette.muted}>{`${item.done ? mark.done : mark.open} `}</Text>
          <Text color={item.done ? palette.muted : palette.fg}>{item.text}</Text>
        </Box>
      ))}
      <Text color={palette.muted}>{`${done}/${items.length} done`}</Text>
    </Box>
  )
}

// One row per block; paragraphs and headings sit a line apart, as markdown would set them.
export function blockRows(look: Look, blocks: readonly Block[]) {
  const { Box, Markdown } = look.ui

  return blocks.map((block, i) => {
    const gap = i === 0 ? 0 : 1

    switch (block.kind) {
      case 'markdown':
        return <Markdown text={block.text} />
      case 'heading':
        return <Box marginTop={gap}>{headingRow(look, block.level, block.text)}</Box>
      case 'alert':
        return <Box marginTop={gap}>{alertBox(look, block.type, block.body)}</Box>
      case 'tasks':
        return <Box marginTop={gap}>{taskRows(look, block.items)}</Box>
      case 'paragraph':
        return (
          <Box flexDirection="column" marginTop={blocks[i - 1]?.kind === 'heading' ? 0 : gap}>
            {block.lines.map(line => lineRow(look, line))}
          </Box>
        )
    }
  })
}
