import type { On } from 'claude-code'
import { expect, mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { NATIVE } from '../hooks/kit/tone'
import { toLight } from '../hooks/light'
import dracula from '../hooks/themes/dracula'
import nord from '../hooks/themes/nord'
import { act, itemOf, paletteOf, panelOf, test, viaPane } from './pane'

const SITE = { plugin: 'skins', viewport: { columns: 100, rows: 30 } } as const

const call = (id: string) => ({ tool_use_id: id, tool: 'Bash', input: { command: 'ls' }, isRunning: false, isErrored: false, isInterrupted: false })

const toolUse = (id: string) => ({ ...SITE, surface: 'terminal', component: 'ToolUse', requestId: id, props: call(id) }) as const

// The user's store, shared by every session: a test writes to it as another session would.
function engine(on: On, store: Record<string, unknown>, theme?: string) {
  const clock = mock.clock(on, { now: 10_000 })
  on('session.cwd', () => ({ value: '/work' }))
  on('env.get', () => ({ value: undefined }))
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 42 }, rateLimits: [] } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: { command: 'skin' } }))
  on('tool.register', () => ({ value: { tool: 'mcp__skins__design' } }))
  on('config.list', () => ({ value: (theme === undefined ? [] : [{ key: 'theme', label: 'Theme', kind: 'enum', value: theme, provider: { kind: 'engine' }, isLocked: false }]) as never }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['stock row'] }))

  return clock
}

const start = ($: Engine) => $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

// The colour a tool row draws its label in: the skin in use, as this session draws it.
async function labelColor($: Engine, id: string): Promise<unknown> {
  const row = await $.ui.mount(toolUse(id))
  const found = (await row.find({ type: 'Text', text: /Bash/ })) as { children?: readonly unknown[] } | undefined
  await row.unmount()
  const span = (found?.children ?? []).find(child => (child as { children?: unknown[] }).children?.[0] === 'Bash') as { props?: { color?: unknown } } | undefined

  return span?.props?.color
}

test('the palette noun answers Claude Code’s own colours by default, as plain data', async ($, on) => {
  engine(on, {})
  await start($)

  const answer = await paletteOf($)

  expect(answer).toEqual({ name: 'claude', palette: { ...NATIVE.dark }, isLight: false })
})

test('the palette noun answers the active skin, and Claude Code’s own while skins is off', async ($, on) => {
  engine(on, {})
  await start($)

  await viaPane($, 'dracula')
  expect(await paletteOf($)).toEqual({ name: 'dracula', palette: { ...dracula.palette }, isLight: false })

  await act($, 'skin', 'off')
  expect(await paletteOf($)).toEqual({ name: 'claude', palette: { ...NATIVE.dark }, isLight: false })
})

test('on a light appearance the palette noun answers the light palette, as the rows draw it', async ($, on) => {
  engine(on, {}, 'light')
  await start($)

  expect(await paletteOf($)).toEqual({ name: 'claude', palette: { ...NATIVE.light }, isLight: true })

  await viaPane($, 'nord')
  expect(await paletteOf($)).toEqual({ name: 'nord', palette: { ...(nord.light ?? toLight(nord.palette)) }, isLight: true })

  await act($, 'skin', 'off')
  expect(await paletteOf($)).toEqual({ name: 'claude', palette: { ...NATIVE.light }, isLight: true })
})

test('a made skin answers its own name and colours through the palette noun', async ($, on) => {
  engine(on, {})
  await start($)

  await viaPane($, 'nord')
  await act($, 'edit:user')
  await act($, 'paint', '#ff8800')

  const answer = await paletteOf($)
  expect(answer.name).toBe('my-nord')
  expect(answer.palette.user).toBe('#ff8800')
  expect(answer.palette.fg).toBe(nord.palette.fg)
})

test('every change is written to the user’s store at once', async ($, on) => {
  const store: Record<string, unknown> = {}
  engine(on, store)
  await start($)

  await viaPane($, 'dracula')
  await act($, 'toggle:rail', 'off')
  expect(store.prefs).toMatchObject({ skin: 'dracula', rail: false })

  await act($, 'edit:run')
  await act($, 'paint', '#00ff00')
  expect(Object.keys(store.custom as object)).toEqual(['my-dracula'])
  expect(store.prefs).toMatchObject({ skin: 'my-dracula' })
})

test('the /mods panel reads the store first, so a change made in another session shows at once', async ($, on) => {
  const store: Record<string, unknown> = {}
  engine(on, store)
  await start($)

  expect(itemOf(await panelOf($), 'skin')).toMatchObject({ value: 'claude' })

  // Another session picks nord and turns the rail off.
  store.prefs = { skin: 'nord', rail: false }

  const panel = await panelOf($)
  expect(itemOf(panel, 'skin')).toMatchObject({ value: 'nord' })
  expect(itemOf(panel, 'toggle:rail')).toMatchObject({ value: false })
  expect(panel.summary).toBe('Nord')
})

test('the 3 s clock picks up another session’s change, and draws follow it', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = engine(on, store)
  await start($)

  const before = await labelColor($, 'a1')
  store.prefs = { skin: 'dracula' }

  // Not before the clock comes round.
  expect(await labelColor($, 'a2')).toBe(before)

  await clock.advance(3000)
  expect(await labelColor($, 'a3')).toBe(dracula.palette.run)

  // A made skin another session saved arrives the same way.
  store.custom = { sunset: { name: 'sunset', label: 'Sunset', base: 'gruvbox', palette: { run: '#ff8800' }, spinner: [], done: [] } }
  store.prefs = { skin: 'sunset' }
  await clock.advance(3000)
  expect(await labelColor($, 'a4')).toBe('#ff8800')
})

test('the clock leaves the session alone while the store holds what it already shows', async ($, on) => {
  const store: Record<string, unknown> = { prefs: { skin: 'nord' } }
  const clock = engine(on, store)
  await start($)

  // The same prefs, written in another key order by another version: nothing changed.
  store.prefs = Object.fromEntries(Object.entries(store.prefs as object).reverse())
  const panel = await panelOf($)
  expect(itemOf(panel, 'skin')).toMatchObject({ value: 'nord' })

  await act($, 'toggle:shimmer', 'off')
  await clock.advance(3000)
  expect(itemOf(await panelOf($), 'toggle:shimmer')).toMatchObject({ value: false })
  expect(await labelColor($, 'b1')).toBe(nord.palette.run)
})

test('a pinned folder keeps its own skin while another session changes the default', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = engine(on, store)
  await start($)

  await viaPane($, 'pin')
  await viaPane($, 'nord')

  // Another session, in another folder, sets the default.
  store.prefs = { skin: 'dracula' }
  await clock.advance(3000)
  expect(await labelColor($, 'c1')).toBe(nord.palette.run)

  // Another session in this folder changes its pinned skin: it arrives here too.
  store.folders = { '/work': { skin: 'dracula' } }
  await clock.advance(3000)
  expect(await labelColor($, 'c2')).toBe(dracula.palette.run)
  expect(itemOf(await panelOf($), 'folder:unpin')).toBeDefined()

  // Unpinned elsewhere: this session follows the default again.
  store.folders = {}
  await clock.advance(3000)
  expect(itemOf(await panelOf($), 'folder:pin')).toBeDefined()
  expect(await labelColor($, 'c3')).toBe(dracula.palette.run)
})
