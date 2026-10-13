import { test as base } from 'claude-code/testing'
import type { Engine, Plugin, TestBody } from 'claude-code/testing'

import type { SkinsItem, SkinsPanel } from '../types'

// Only another module can call a plugin's noun. This stand-in for the /mods hub calls `$.skins`
// from two commands of its own, hands the answer back as JSON, and toasts what a press answers,
// as the hub does.
export const HUB: Plugin = {
  name: 'hub',
  register(on) {
    on('command.run', { command: 'hub-panel' }, async ($, e) => ({ text: JSON.stringify(await $.skins.panel(JSON.parse(e.args))) }))
    on('command.run', { command: 'hub-act' }, async ($, e) => {
      const result = await $.skins.act(JSON.parse(e.args))

      if (result.message) {
        $.ui.toast(result.message)
      }

      return { text: JSON.stringify(result) }
    })
  },
}

// Every test runs beside the hub stand-in.
export function test(name: string, body: TestBody): void
export function test(name: string, options: Record<string, unknown>, body: TestBody): void
export function test(name: string, a: unknown, b?: unknown): void {
  const options = (b === undefined ? {} : a) as Record<string, unknown>
  const body = (b === undefined ? a : b) as TestBody
  const plugins = Array.isArray(options.plugins) ? options.plugins : []
  ;(base as unknown as (n: string, o: Record<string, unknown>, f: TestBody) => void)(name, { ...options, plugins: [HUB, ...plugins] }, body)
}

async function call($: Engine, command: string, args: unknown) {
  const answer = await $.command.run({ command, args: JSON.stringify(args), origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })

  return JSON.parse(answer.text ?? 'null')
}

export const panelOf = ($: Engine, lang: 'en' | 'pt' = 'en', surface: 'terminal' | 'desktop' = 'terminal', columns = 80): Promise<SkinsPanel> =>
  call($, 'hub-panel', { lang, surface, columns })

export const act = ($: Engine, id: string, value?: string): Promise<{ message?: string }> => call($, 'hub-act', value === undefined ? { id } : { id, value })

export const itemOf = (panel: SkinsPanel, id: string): SkinsItem | undefined => panel.sections.flatMap(section => section.items).find(item => 'id' in item && item.id === id)

const CHOICE_FIELDS = ['prompt', 'icons', 'words', 'tables']

const TOGGLE_WORDS = ['rail', 'shimmer', 'band', 'countdown', 'clip', 'markdown', 'quiet', 'charts', 'math', 'commands', 'shell', 'highlight', 'hints', 'links', 'copy', 'fold']

// Presses in skins' tab what `/skin <words>` used to do: a skin's name, `<option> on|off`,
// `<choice> <value>`, `calm [on|off]`, `pin`, `unpin`, `share`, `copy`, `copy code` and `gallery`.
export async function viaPane($: Engine, words: string) {
  const [head = '', value] = words.trim().split(/\s+/)

  if (head === 'copy' && (value === undefined || value === 'code')) {
    return act($, value === 'code' ? 'copy-code' : 'copy')
  }

  if (head === 'gallery') {
    return act($, 'gallery')
  }

  if (head === 'pin' || head === 'unpin' || head === 'share') {
    return act($, `folder:${head}`)
  }

  if (CHOICE_FIELDS.includes(head)) {
    return act($, `choice:${head}`, value)
  }

  if (head === 'calm') {
    return act($, 'calm', value ?? 'on')
  }

  if (TOGGLE_WORDS.includes(head)) {
    return act($, `toggle:${head}`, value ?? 'on')
  }

  return act($, 'skin', head)
}

// Whether skins' tab shows that choice made: `skin-<name>` for the skin, `toggle-<word>` for an
// option, `toggle-calm` for calm.
export async function isMarked($: Engine, key: string) {
  const panel = await panelOf($)

  if (key.startsWith('skin-')) {
    const skin = itemOf(panel, 'skin')

    return skin?.kind === 'choice' && skin.value === key.slice('skin-'.length)
  }

  const word = key.slice('toggle-'.length)
  const item = itemOf(panel, word === 'calm' ? 'calm' : `toggle:${word}`)

  return item?.kind === 'toggle' && item.value
}
