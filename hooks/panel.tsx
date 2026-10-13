import type { Prefs, SettingsTab, SkinSlot, SkinsItem, SkinsPanel } from '../types'
import { TOGGLES } from './command'
import type { ToggleWord } from './command'
import { SLOTS } from './custom'
import { STRINGS } from './i18n'
import type { Lang, Strings } from './i18n'
import type { Table } from './markdown'
import { footerRow, groupRow, promptRow, tableRows, toolRow } from './rows'
import type { Look } from './rows'

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
  names: readonly string[]
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

// A turn as the skin would draw it, built from the same rows the transcript uses.
function preview(look: Look, width: number) {
  const { Box } = look.ui
  const word = look.skin.done[0] ?? 'Done'

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={look.skin.palette.muted} paddingX={1}>
      {promptRow(look, 'add rate limiting to the hub api')}
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
      {tableRows(look, SAMPLE, Math.max(20, width - 4))}
      {footerRow(look, word, 41_000, { tools: 6, added: 18, removed: 3 })}
    </Box>
  )
}

// The order the tab's sections show in; their titles are the strings' `tabs`.
const SECTIONS: readonly SettingsTab[] = ['theme', 'look', 'content', 'band', 'colors', 'actions']

const CONTENT: readonly ToggleWord[] = ['markdown', 'highlight', 'shell', 'commands', 'charts', 'hints', 'math', 'links', 'copy', 'fold', 'quiet', 'clip']

// skins' tab in the /mods pane: the hub draws it, and each press comes back as `act`.
export function skinsPanel(look: Look, model: PanelModel): SkinsPanel {
  const { prefs } = look
  const { palette } = look.skin
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

  const items: Record<SettingsTab, SkinsItem[]> = {
    theme: [
      {
        kind: 'choice',
        id: 'skin',
        label: t.theme.skin,
        value: prefs.skin,
        options: [...model.names.map(name => ({ value: name, label: name })), { value: 'off', label: t.theme.offSkin }],
      },
      { kind: 'text', text: t.theme.preview, tone: 'muted' },
      { kind: 'tree', tree: preview(look, model.columns) },
      { kind: 'info', label: t.theme.folder, value: model.pinned ? t.theme.pinned : t.theme.followsDefault },
      model.pinned ? { kind: 'action', id: 'folder:unpin', label: t.theme.unpin } : { kind: 'action', id: 'folder:pin', label: t.theme.pin },
      { kind: 'action', id: 'folder:share', label: t.theme.share },
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
      ...SLOTS.map((slot): SkinsItem => ({ kind: 'swatch', id: `edit:${slot}`, label: t.colors.slots[slot].name, color: palette[slot], selected: slot === model.editing })),
      { kind: 'info', label: t.editing, value: `${t.colors.slots[model.editing].name} · ${t.colors.slots[model.editing].help}` },
      { kind: 'input', id: 'paint', label: palette[model.editing], placeholder: '#rrggbb', submitLabel: t.colors.paint },
    ],
    actions: [
      { kind: 'action', id: 'copy', label: t.actions.copy.name, help: t.actions.copy.help },
      { kind: 'action', id: 'copy-code', label: t.actions.copyCode.name, help: t.actions.copyCode.help },
      { kind: 'action', id: 'gallery', label: t.actions.gallery.name, help: t.actions.gallery.help },
    ],
  }

  return {
    title: 'Skins',
    summary: t.summary(prefs.skin, model.pinned),
    tone: prefs.skin === 'off' ? 'muted' : 'accent',
    sections: SECTIONS.map(id => ({ id, title: t.tabs[id], items: items[id] })),
  }
}
