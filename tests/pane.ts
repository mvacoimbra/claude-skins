import type { Engine } from 'claude-code/testing'

// The settings pane, as the tests mount it.
export const PANE = {
  plugin: 'skins',
  viewport: { columns: 100, rows: 30 },
  component: 'Pane',
  requestId: 'skins-settings',
  props: {
    title: 'Skins',
    isFocused: true,
    bodyColumns: 80,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// The tab of the settings pane each option sits on.
const TAB_OF: Record<string, string> = {
  prompt: 'look', icons: 'look', words: 'look', rail: 'look', shimmer: 'look', calm: 'look', lang: 'look',
  tables: 'content', markdown: 'content', highlight: 'content', shell: 'content', commands: 'content', charts: 'content',
  hints: 'content', math: 'content', links: 'content', copy: 'content', fold: 'content', quiet: 'content', clip: 'content',
  band: 'band', countdown: 'band',
}

const CHOICE_FIELDS = ['prompt', 'icons', 'words', 'tables', 'lang']

// What reading a button's label needs of a mounted drawing.
type Pane = { find: (query: { key: string }) => Promise<unknown> }

type Found = { props: Record<string, unknown> } | undefined

const labelOf = async (pane: Pane, key: string) => String(((await pane.find({ key })) as Found)?.props.label ?? '')

// Does what `/skin <words>` used to, by pressing the settings pane's buttons: a skin's
// name, `<option> on|off`, `<choice> <value>`, `calm`, `pin`, `unpin`, `share`, `copy`,
// `copy code` and `gallery`.
export async function viaPane($: Engine, words: string) {
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const [head = '', value] = words.trim().split(/\s+/)
  const press = async (tab: string, key: string) => {
    await pane.press({ key: `tab-${tab}` })
    await pane.press({ key })
  }

  if (head === 'copy' && (value === undefined || value === 'code')) {
    await press('actions', value === 'code' ? 'action-copy-code' : 'action-copy')
  } else if (head === 'gallery') {
    await press('actions', 'action-gallery')
  } else if (head === 'pin' || head === 'unpin' || head === 'share') {
    await press('theme', `folder-${head}`)
  } else if (CHOICE_FIELDS.includes(head)) {
    await press(TAB_OF[head] ?? 'look', `${head}-${value}`)
  } else if (TAB_OF[head] !== undefined) {
    await pane.press({ key: `tab-${TAB_OF[head]}` })
    const isOn = (await labelOf(pane, `toggle-${head}`)).startsWith('●')

    if (isOn !== ((value ?? 'on') === 'on')) {
      await pane.press({ key: `toggle-${head}` })
    }
  } else {
    await press('theme', `skin-${head}`)
  }

  await pane.unmount()
}

// Whether the settings pane marks that button chosen, on the tab it sits on.
export async function isMarked($: Engine, tab: string, key: string) {
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: `tab-${tab}` })
  const marked = (await labelOf(pane, key)).startsWith('●')
  await pane.unmount()

  return marked
}
