import type { ElementTable } from 'claude-code'

import type { Prefs, SettingsTab, SkinSlot } from '../types'
import type { ToggleWord } from './command'
import { SLOTS } from './custom'
import { STRINGS } from './i18n'
import type { Strings } from './i18n'
import type { Table } from './markdown'
import { footerRow, groupRow, promptRow, tableRows, toolRow } from './rows'
import type { Look } from './rows'

export type PaneUi = Pick<ElementTable<'terminal' | 'desktop'>, 'Box' | 'Text' | 'Markdown' | 'Button' | 'Input' | 'Select'>

export const TABS: readonly SettingsTab[] = ['theme', 'look', 'content', 'band', 'colors', 'actions']

// The settings a row of choices sets, each to one of its values.
export type Choice = 'prompt' | 'icons' | 'words' | 'tables' | 'lang'

const CHOICES: { readonly [K in Choice]: readonly Prefs[K][] } = {
  prompt: ['left', 'right', 'plain'],
  icons: ['unicode', 'ascii'],
  words: ['skin', 'claude'],
  tables: ['on', 'text', 'off'],
  lang: ['en', 'pt'],
}

export type FolderWord = 'pin' | 'unpin' | 'share'

export type SettingsModel = {
  names: readonly string[]
  editing: SkinSlot
  width: number
  tab: SettingsTab
  // Whether this folder keeps a look of its own rather than the default.
  pinned: boolean
}

export type SettingsActions = {
  tab: (tab: SettingsTab) => void
  pick: (name: string) => void
  toggle: (word: ToggleWord) => void
  calm: () => void
  choose: <K extends Choice>(field: K, value: Prefs[K]) => void
  edit: (slot: SkinSlot) => void
  paint: (hex: string) => void
  folder: (word: FolderWord) => void
  copy: (code: boolean) => void
  gallery: () => void
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

const mark = (on: boolean): string => (on ? '●' : '○')

// Each option is a name, its control and one line of help: beside the control in a wide
// pane, under it in a narrow one.
const NAME_COLUMNS = 22
const WIDE = 72

// The settings pane: a row of tabs, one tab's options, and how to move around.
export function settingsPane(look: Look, ui: PaneUi, model: SettingsModel, actions: SettingsActions) {
  const { Box, Text, Button, Input } = ui
  const { palette } = look.skin
  const { prefs } = look
  const t: Strings = STRINGS[prefs.lang]
  const wide = model.width >= WIDE

  const heading = (text: string) => (
    <Text bold color={palette.fg}>
      {text}
    </Text>
  )

  const help = (text: string) => (
    <Box flexShrink={1} paddingLeft={wide ? 0 : 2}>
      <Text color={palette.muted}>{text}</Text>
    </Box>
  )

  const option = (key: string, name: string, text: string, control: ReturnType<typeof Box>) => (
    <Box key={`option-${key}`} flexDirection={wide ? 'row' : 'column'} columnGap={2}>
      <Box flexDirection="row" columnGap={2} flexShrink={0}>
        <Box width={NAME_COLUMNS} flexShrink={0}>
          <Text color={palette.fg}>{name}</Text>
        </Box>
        {control}
      </Box>
      {help(text)}
    </Box>
  )

  const onOff = (key: string, on: boolean, press: () => void) => (
    <Button key={key} plain dimColor={!on} label={`${mark(on)} ${on ? t.on : t.off}`} onPress={press} />
  )

  const toggle = (word: ToggleWord) =>
    option(word, t.toggles[word].name, t.toggles[word].help, onOff(`toggle-${word}`, prefs[word === 'clip' ? 'clipOutput' : word] as boolean, () => actions.toggle(word)))

  const choice = <K extends Choice>(field: K) => {
    const words = t[field] as Strings[Choice] & Record<string, string>

    return option(
      field,
      words.name,
      words.help,
      <Box flexDirection="row" columnGap={2}>
        {CHOICES[field].map(value => (
          <Button
            key={`${field}-${value}`}
            plain
            dimColor={prefs[field] !== value}
            label={`${mark(prefs[field] === value)} ${words[value]}`}
            onPress={() => actions.choose(field, value)}
          />
        ))}
      </Box>,
    )
  }

  // A one-off action: its button, and what it does beside it.
  const action = (key: string, words: { name: string; help: string }, press: () => void) => (
    <Box key={`action-row-${key}`} flexDirection={wide ? 'row' : 'column'} columnGap={2}>
      <Box flexShrink={0}>
        <Button key={`action-${key}`} label={words.name} onPress={press} />
      </Box>
      {help(words.help)}
    </Box>
  )

  const skinButton = (name: string, label: string) => (
    <Button key={`skin-${name}`} plain dimColor={prefs.skin !== name} label={`${mark(prefs.skin === name)} ${label}`} onPress={() => actions.pick(name)} />
  )

  const tabs = (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      {TABS.map((tab, i) => (
        <Button
          key={`tab-${tab}`}
          label={t.tabs[tab]}
          hotkey={String(i + 1)}
          variant={tab === model.tab ? 'primary' : 'secondary'}
          onPress={() => actions.tab(tab)}
        />
      ))}
    </Box>
  )

  const body = (() => {
    switch (model.tab) {
      case 'theme':
        return (
          <Box flexDirection="column" rowGap={1}>
            <Box flexDirection="column">
              {heading(t.theme.skin)}
              <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
                {model.names.map(name => skinButton(name, name))}
              </Box>
              {skinButton('off', t.theme.offSkin)}
            </Box>
            <Box flexDirection="column">
              {heading(t.theme.preview)}
              {preview(look, model.width)}
            </Box>
            <Box flexDirection="column">
              {heading(t.theme.folder)}
              <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
                <Text color={palette.muted}>{model.pinned ? t.theme.pinned : t.theme.followsDefault}</Text>
                {model.pinned ? (
                  <Button key="folder-unpin" label={t.theme.unpin} onPress={() => actions.folder('unpin')} />
                ) : (
                  <Button key="folder-pin" label={t.theme.pin} onPress={() => actions.folder('pin')} />
                )}
                <Button key="folder-share" label={t.theme.share} onPress={() => actions.folder('share')} />
              </Box>
            </Box>
            <Text color={palette.muted}>
              {t.theme.ask} <Text color={palette.fg}>{t.theme.askExample}</Text>
            </Text>
          </Box>
        )
      case 'look':
        return (
          <Box flexDirection="column" rowGap={1}>
            {choice('prompt')}
            {choice('icons')}
            {choice('words')}
            {toggle('rail')}
            {toggle('shimmer')}
            {option('calm', t.toggles.calm.name, t.toggles.calm.help, onOff('toggle-calm', prefs.calm !== null, () => actions.calm()))}
            {choice('lang')}
          </Box>
        )
      case 'content':
        return (
          <Box flexDirection="column" rowGap={1}>
            {choice('tables')}
            {toggle('markdown')}
            {toggle('highlight')}
            {toggle('shell')}
            {toggle('commands')}
            {toggle('charts')}
            {toggle('hints')}
            {toggle('math')}
            {toggle('links')}
            {toggle('copy')}
            {toggle('fold')}
            {toggle('quiet')}
            {toggle('clip')}
          </Box>
        )
      case 'band':
        return (
          <Box flexDirection="column" rowGap={1}>
            {toggle('band')}
            {toggle('countdown')}
          </Box>
        )
      case 'colors':
        return (
          <Box flexDirection="column" rowGap={1}>
            <Text color={palette.muted}>{t.colors.help}</Text>
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              {SLOTS.map(slot => (
                <Box key={`slot-box-${slot}`} flexDirection="row" columnGap={1} width={wide ? 30 : 26}>
                  <Text color={palette.fg}>{slot === model.editing ? '▸' : ' '}</Text>
                  <Text backgroundColor={palette[slot]}>{'    '}</Text>
                  <Button key={`slot-${slot}`} label={t.colors.slots[slot].name} plain dimColor={slot !== model.editing} onPress={() => actions.edit(slot)} />
                  <Text color={palette.muted}>{palette[slot]}</Text>
                </Box>
              ))}
            </Box>
            <Box flexDirection="column">
              <Text color={palette.fg}>
                {t.colors.slots[model.editing].name}
                <Text color={palette.muted}>{` · ${t.colors.slots[model.editing].help}`}</Text>
              </Text>
              <Input
                key="hex"
                label={palette[model.editing]}
                placeholder="#rrggbb"
                value=""
                submitLabel={t.colors.paint}
                onSubmit={(value: string) => actions.paint(value.trim())}
              />
            </Box>
          </Box>
        )
      case 'actions':
        return (
          <Box flexDirection="column" rowGap={1}>
            {action('copy', t.actions.copy, () => actions.copy(false))}
            {action('copy-code', t.actions.copyCode, () => actions.copy(true))}
            {action('gallery', t.actions.gallery, () => actions.gallery())}
          </Box>
        )
    }
  })()

  return (
    <Box flexDirection="column" rowGap={1}>
      {tabs}
      {body}
      <Text color={palette.muted}>{t.footer}</Text>
    </Box>
  )
}
