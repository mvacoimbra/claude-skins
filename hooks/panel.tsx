import type { Prefs, SettingsTab, SkinSlot, SkinsItem, SkinsPanel } from '../types'
import { TOGGLES } from './command'
import type { ToggleWord } from './command'
import { staticTree } from './kit/kit'
import { SLOTS } from './custom'
import { STRINGS } from './i18n'
import type { Lang, Strings } from './i18n'
import type { Table } from './markdown'
import { footerRow, groupRow, promptRow, replyRows, toolRow } from './rows'
import type { Look } from './rows'
import type { Palette } from './skin'
import { settled } from './svg-kit'
import { tableSvg } from './svg-table'

// The settings a row of choices sets, each to one of its values.
export type Choice = 'prompt' | 'icons' | 'words' | 'tables'

export const CHOICES: { readonly [K in Choice]: readonly Prefs[K][] } = {
  prompt: ['left', 'right', 'plain'],
  icons: ['unicode', 'ascii'],
  words: ['skin', 'claude'],
  tables: ['on', 'text', 'off'],
}

export type FolderWord = 'pin' | 'unpin' | 'share'

export type PanelModel = {
  // Every skin that can be picked, built-in and made, by name with the label it shows.
  skins: readonly { name: string; label: string }[]
  // The palette the colour editor paints: the skin's own, whatever the appearance.
  editPalette: Palette
  editing: SkinSlot
  columns: number
  // Whether this folder keeps a look of its own rather than the default.
  pinned: boolean
  lang: Lang
}

const SAMPLE: Table = {
  kind: 'table',
  header: ['Route', 'Limit', 'Window'],
  align: ['left', 'right', 'left'],
  rows: [
    ['/chat', '60', '1 min'],
    ['/upload', '10', '1 min'],
    ['/search', '120', '1 min'],
  ],
}

const done = { isRunning: false, isErrored: false, isInterrupted: false }

// About the pixels a column of the hub's pane takes on the desktop.
const PX_PER_COLUMN = 7

function tableCard(look: Look, width: number) {
  const built = tableSvg(SAMPLE, look.skin.palette, Math.max(0, width - 6) * PX_PER_COLUMN)

  return { source: settled(built.source), alt: built.alt, width: built.width, height: built.height }
}

// A turn as the skin would draw it, built from the same rows the transcript uses, in a well:
// a faint background and no outline of its own, so it never nests inside the hub's group. On
// the desktop your message keeps the app's own bubble, so the sample is plain text at the right.
export function preview(look: Look, width: number) {
  const { Box, Text } = look.ui
  const word = look.skin.done[0] ?? 'Done'
  const still = { ...look, copy: undefined, isFirstDraw: () => false }
  const prompt = 'add rate limiting to the hub api'

  return (
    <Box flexDirection="column" backgroundColor={look.t.ink.hover} paddingX={1} paddingY={1} rowGap={0}>
      {look.surface === 'terminal' ? (
        promptRow(look, prompt)
      ) : (
        <Box flexDirection="row" justifyContent="flex-end" marginBottom={1}>
          <Text color={look.ink.fg}>{prompt}</Text>
        </Box>
      )}
      {toolRow(look, { tool: 'Bash', input: {}, ...done }, 'run', 'pnpm test --filter hub', { ms: 2140 })}
      {toolRow(look, { tool: 'Edit', input: {}, ...done }, 'write', 'apps/hub/src/server.ts', {
        ms: 380,
        added: 18,
        removed: 3,
      })}
      {groupRow(look, [
        { tool: 'Read', input: {}, ...done },
        { tool: 'Read', input: {}, ...done },
        { tool: 'Grep', input: {}, ...done },
      ])}
      {look.svg === undefined ? (
        replyRows(still, [SAMPLE], Math.max(20, width - 4), look.svg)
      ) : (
        // The table card at the width the well leaves it, drawn settled.
        <Box marginY={1} alignSelf="flex-start">
          <look.svg {...tableCard(look, width)} />
        </Box>
      )}
      {footerRow(look, word, 41_000, { tools: 6, added: 18, removed: 3 })}
    </Box>
  )
}

// The order the tab's sections show in; their titles are the strings' `tabs`.
const SECTIONS: readonly SettingsTab[] = ['theme', 'look', 'content', 'band', 'colors', 'actions']

const CONTENT: readonly ToggleWord[] = ['markdown', 'highlight', 'shell', 'commands', 'charts', 'hints', 'math', 'links', 'copy', 'fold', 'quiet', 'clip']

// skins' tab in the /mods pane: the hub draws it, and each press comes back as `act`. Every
// setting here is the user's, in every session; a pinned folder keeps its own.
export function skinsPanel(look: Look, model: PanelModel): SkinsPanel {
  const { prefs } = look
  const palette = model.editPalette
  const t: Strings = STRINGS[model.lang]

  const toggle = (word: ToggleWord): SkinsItem => ({
    kind: 'toggle',
    id: `toggle:${word}`,
    label: t.toggles[word].name,
    help: t.toggles[word].help,
    value: prefs[TOGGLES[word]] as boolean,
  })

  const choice = <K extends Choice>(field: K): SkinsItem => {
    const words = t[field] as Strings[Choice] & Record<string, string>

    return {
      kind: 'choice',
      id: `choice:${field}`,
      label: words.name,
      help: words.help,
      value: prefs[field],
      options: CHOICES[field].map(value => ({ value, label: words[value] ?? value })),
    }
  }

  const label = model.skins.find(skin => skin.name === prefs.skin)?.label ?? prefs.skin
  const slot = t.colors.slots[model.editing]

  const items: Record<SettingsTab, SkinsItem[]> = {
    theme: [
      {
        kind: 'choice',
        id: 'skin',
        label: t.theme.skin,
        help: t.theme.skinHelp,
        value: prefs.skin,
        options: [...model.skins.map(skin => ({ value: skin.name, label: skin.label })), { value: 'off', label: t.theme.offSkin }],
      },
      { kind: 'text', text: t.theme.preview, tone: 'muted' },
      { kind: 'tree', tree: staticTree(preview(look, model.columns), look.t) },
      { kind: 'info', label: t.theme.folder, value: model.pinned ? t.theme.pinned : t.theme.followsDefault },
      model.pinned
        ? { kind: 'action', id: 'folder:unpin', label: t.theme.unpin, help: t.theme.unpinHelp }
        : { kind: 'action', id: 'folder:pin', label: t.theme.pin, help: t.theme.pinHelp },
      { kind: 'action', id: 'folder:share', label: t.theme.share, help: t.theme.shareHelp },
      { kind: 'text', text: `${t.theme.ask} ${t.theme.askExample}`, tone: 'muted' },
    ],
    look: [
      choice('prompt'),
      choice('icons'),
      choice('words'),
      toggle('rail'),
      toggle('shimmer'),
      { kind: 'toggle', id: 'calm', label: t.toggles.calm.name, help: t.toggles.calm.help, value: prefs.calm !== null },
    ],
    content: [choice('tables'), ...CONTENT.map(toggle)],
    band: [toggle('band'), toggle('countdown')],
    colors: [
      { kind: 'text', text: t.colors.help, tone: 'muted' },
      ...SLOTS.map((one): SkinsItem => ({ kind: 'swatch', id: `edit:${one}`, label: t.colors.slots[one].name, color: palette[one], selected: one === model.editing })),
      { kind: 'input', id: 'paint', label: t.colors.field(slot.name), help: t.colors.fieldHelp(palette[model.editing], slot.help), placeholder: '#rrggbb', submitLabel: t.colors.paint },
    ],
    actions: [
      { kind: 'action', id: 'copy', label: t.actions.copy.name, help: t.actions.copy.help },
      { kind: 'action', id: 'copy-code', label: t.actions.copyCode.name, help: t.actions.copyCode.help },
      { kind: 'action', id: 'gallery', label: t.actions.gallery.name, help: t.actions.gallery.help },
    ],
  }

  return {
    title: 'Skins',
    summary: t.summary(prefs.skin === 'off' ? null : label, model.pinned),
    tone: prefs.skin === 'off' ? 'muted' : 'accent',
    sections: SECTIONS.map(id => ({ id, title: t.tabs[id], items: items[id] })),
  }
}
