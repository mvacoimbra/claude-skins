import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, RenderSurface, Timer } from 'claude-code'

import type { CustomSkin, Disclosure, Prefs, SkinSlot, SkinsActArgs, SkinsActResult, SkinsCatalogEntry, SkinsMarkdownArgs, SkinsPanel, SkinsPanelArgs, Touch, TurnStats, UsageSnap } from '../types'
import { DEFAULT_PREFS, parsePrefs, TOGGLES, withCalm } from './command'
import { buildCustom, resolveSkin, skinNames, withSlot } from './custom'
import { forTheme, gnomeDark, macDark, resolveLight, windowsDark } from './light'
import { parseFolders, prefsFor, withFolder, withoutFolder } from './folders'
import { DESIGN_TOOL, runDesign } from './designer'
import type { DesignState } from './designer'
import { clipLines, diffstat, pick } from './format'
import { bodyOf, inputFields, isOpen } from './detail'
import { disclosedRow, openedRows } from './detail-rows'
import { copyOf } from './markdown'
import { CHART_HINT } from './mermaid'
import { commandSegments } from './command-output'
import { askBand, desktopSpinnerRow, diffCard, footerRow, terminalCard, usageBand, groupRow, promptRow, quietResult, replyRows, spinnerRow, toolRow } from './rows'
import type { Look, SvgElement, Ui } from './rows'
import { galleryOff, galleryPane } from './gallery'
import { keepsOwnRow, SHELLS, shellResultOf } from './shell'
import { OUTPUT_FOLD, shellRows } from './shell-rows'
import { CHOICES, skinsPanel } from './panel'
import { skinsCatalog, staticTree } from './catalog'
import type { Choice, FolderWord } from './panel'
import { STRINGS } from './i18n'
import type { Lang } from './i18n'
import { cacheLine, sameLine } from './cache'
import type { CacheLine } from './cache'
import { SLOTS } from './custom'
import { sightings } from './sightings'
import { ICONS } from './skin'
import type { Skin } from './skin'
import { hunksOf } from './svg-diff'
import { shellOutputOf } from './svg-terminal'
import { countdownsOf, limitLabel, metersOf } from './svg-usage'
import { shortenPath } from './format'
import { kindOf, summarize, toolLabel } from './tools'
import { commandOf, errorLine, isQuiet, quietLabel } from './quiet'
import { MAX_MARKDOWN, replySegments } from './reply'
import { isDue, isNewer, LATEST_URL, STAR_NOTICE, starStep, updateNotice, versionOf } from './updates'
import { hyperlinksFrom, touchOf } from './links'
import { NATIVE, NATIVE_NAME } from './kit/tone'
import { inkFrom, toneOfSkin } from './ink'
import type { KitSkin } from './kit/tone'
import type { Checked, Star } from './updates'

const GALLERY = 'skins-gallery'
const DESIGN = `mcp__skins__${DESIGN_TOOL.name}`
const DESIGN_MATCH = /^mcp__skins__design$/

// A longer prompt keeps Claude Code's own drawing, which folds a big paste.
const MAX_PROMPT = 4000

// The settings pane's prompt button cycles through these.

const CLIP_HEAD = 8
const CLIP_TAIL = 4
const FRAME_MS = 90
// Countdowns read to the minute, so they are looked at once a minute.
// The limits' reset countdowns tick each second; cache-tax's countdown reads to the minute.
const COUNTDOWN_MS = 1000
const CACHE_TICK_MS = 60_000
const SETTLE_LEAD_MS = FRAME_MS
const FAST_RETRIES = 4
const RETRY_MAX_MS = 1000
const STALE_AHEAD_MS = RETRY_MAX_MS + 1000
const KEPT_TURNS = 40
// How often an `auto` theme asks the system again: nothing tells a plugin it changed.
const APPEARANCE_MS = 5000

const prefsAtom = atom({ plugin: 'skins', key: 'prefs' } as const, DEFAULT_PREFS)
const customAtom = atom({ plugin: 'skins', key: 'custom' } as const, {})
const startedAtom = atom({ plugin: 'skins', key: 'startedAt' } as const, 0)
const frameAtom = atom({ plugin: 'skins', key: 'frame' } as const, 0)
const turnsAtom = atom({ plugin: 'skins', key: 'turns' } as const, {})
const durationAtom = atom({ plugin: 'skins', key: 'duration' } as const, -1)
const editingAtom = atom({ plugin: 'skins', key: 'editing' } as const, 'user' as SkinSlot)
const cacheLineAtom = atom({ plugin: 'skins', key: 'cacheLine' } as const, null as CacheLine | null)
const lightAtom = atom({ plugin: 'skins', key: 'isLight' } as const, false)
const imagesAtom = atom({ plugin: 'skins', key: 'images' } as const, false)
// Whether a call only looked, so quiet output folds its result away.
const quietAtom = atom({ plugin: 'skins', key: 'quiet' } as const, false)
const commandAtom = atom({ plugin: 'skins', key: 'command' } as const, '')
const usageAtom = atom({ plugin: 'skins', key: 'usage' } as const, { context: null, limits: [] } as UsageSnap)
// The band's countdowns as last drawn; it changes only when one of them reads differently.
const countdownsAtom = atom({ plugin: 'skins', key: 'countdowns' } as const, {} as Record<string, string>)
const compactingAtom = atom({ plugin: 'skins', key: 'compacting' } as const, false)
const pinnedAtom = atom({ plugin: 'skins', key: 'pinned' } as const, false)
const settleAtom = atom({ plugin: 'skins', key: 'settle' } as const, 0)
// Whether each tool row is open, as the person left it; `auto` opens a failed call.
const disclosureAtom = atom({ plugin: 'skins', key: 'disclosure' } as const, 'auto' as Disclosure)
// Whether an opened row shows its answer whole, past the fold.
const allAtom = atom({ plugin: 'skins', key: 'showAll' } as const, false)
// Files this turn created or edited, by absolute path.
const touchedAtom = atom({ plugin: 'skins', key: 'touched' } as const, {} as Record<string, Touch>)
// Per drawing, the blocks the person unfolded.
const foldsAtom = atom({ plugin: 'skins', key: 'folds' } as const, [] as string[])
// The main loop's last answer, for `/skin copy`.
const lastReplyAtom = atom({ plugin: 'skins', key: 'lastReply' } as const, '')

const EDITS = new Set(['Edit', 'MultiEdit', 'Write'])
const WRITES = new Set([...EDITS, 'NotebookEdit'])

// Only a person's own typing becomes a prompt row: a task notification or a peer's
// message is not theirs to dress as theirs.
const TYPED = new Set(['composer', 'bridge', 'sdk'])

// The skin in use, as drawn now (its light palette on a light appearance), and the appearance.
type Active = { prefs: Prefs; skin: Skin; custom: Record<string, CustomSkin>; isLight: boolean }

const NO_STATS: TurnStats = { tools: 0, added: 0, removed: 0 }

async function activeSkin($: EngineInterface): Promise<Active | null> {
  const prefs = await read($, prefsAtom)
  const custom = await read($, customAtom)
  const skin = resolveSkin(prefs.skin, custom)

  if (skin === undefined) {
    return null
  }

  const isLight = await read($, lightAtom)

  return { prefs, skin: forTheme(skin, isLight), custom, isLight }
}

// Where each system keeps its appearance, and how to read the answer.
const PROBES = [
  { argv: ['defaults', 'read', '-g', 'AppleInterfaceStyle'], dark: macDark },
  {
    argv: ['reg', 'query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'AppsUseLightTheme'],
    dark: windowsDark,
  },
  { argv: ['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme'], dark: gnomeDark },
] as const

// Read once a session or a turn and kept here: each read through `$` is a dispatch, and
// every row draws often. Whether the terminal draws OSC 8 links, the session's folder, and
// whether this turn has touched a file at all (the list itself is `touchedAtom`).
let hyperlinks = false
let sessionCwd: string | undefined
let hasTouched = false

const cwdOf = async ($: EngineInterface): Promise<string> => sessionCwd ?? (await $.session.cwd())

// The probe that answered last, so the timer asks one system rather than all three.
let answering: (typeof PROBES)[number] | undefined

// The system's appearance, for an `auto` theme. Undefined when no probe answers.
async function systemDark($: EngineInterface): Promise<boolean | undefined> {
  for (const probe of answering === undefined ? PROBES : [answering, ...PROBES]) {
    try {
      const dark = probe.dark(await $.process.run([...probe.argv], { timeoutMs: 2000 }))

      if (dark !== undefined) {
        answering = probe
        return dark
      }
    } catch {
      // The other systems' tools are missing here; that is expected, not a failure.
    }
  }

  answering = undefined
  return undefined
}

// Claude Code's own theme decides whether skins draw for a light or a dark background:
// `SKINS_THEME` first, then the theme setting, and for `auto` the terminal and the system.
// `theme` is a value just written, which `$.config.list()` does not answer with yet.
// Resolves true when the answer came from the system's appearance, which can change under it.
async function refreshTheme($: EngineInterface, theme?: unknown): Promise<boolean> {
  const hints = {
    override: await $.env.get('SKINS_THEME'),
    theme: theme ?? (await $.config.list()).find(row => row.key === 'theme')?.value,
    colorfgbg: await $.env.get('COLORFGBG'),
  }
  // Asks the system only when nothing before it decided.
  const needsSystem = resolveLight(hints) !== resolveLight({ ...hints, systemDark: false })
  const dark = needsSystem ? await systemDark($) : undefined
  const isLight = resolveLight({ ...hints, systemDark: dark })

  // A write redraws every row, and the system is asked again every few seconds.
  if ((await read($, lightAtom)) !== isLight) {
    await update($, lightAtom, () => isLight)
  }

  return dark !== undefined
}

// Asks the system again on a timer while the theme follows it; any other theme stops it.
let appearance: Timer | undefined

async function followTheme($: EngineInterface, theme?: unknown): Promise<void> {
  const followsSystem = await refreshTheme($, theme)

  appearance?.cancel()
  appearance = followsSystem
    ? $.clock.every(APPEARANCE_MS, () => {
        void refreshTheme($).catch((error: unknown) => {
          $.ui.log(error instanceof Error ? error.message : String(error), { to: 'debug' })
        })
      })
    : undefined
}

// Every surface's element table names Svg, but the terminal draws it as nothing, so
// vector icons are for the other surfaces only.
const lookOf = (
  ui: Ui & { Svg?: SvgElement },
  active: Active,
  surface: RenderSurface,
  copy?: (text: string) => void,
): Look => {
  const t = toneOfSkin(active.skin, active.isLight)

  return {
  ui,
  skin: active.skin,
  t,
  ink: inkFrom(t),
  icons: ICONS[active.prefs.icons],
  prefs: active.prefs,
  surface,
  ...(surface !== 'terminal' && ui.Svg !== undefined ? { svg: ui.Svg } : {}),
  // `/skin copy off` takes every copy button away.
  ...(copy === undefined || !active.prefs.copy ? {} : { copy }),
  }
}

// What a drawing adds to its look from the session: links where they can be drawn, this
// turn's files, and the blocks the person unfolded in it. Each is a read on every draw, so
// a drawing asks only for what it can show.
type Needs = { links?: boolean; touched?: boolean; folds?: boolean; cwd?: string }

async function sessionLook($: EngineInterface, e: { requestId: string; surface: RenderSurface }, look: Look, needs: Needs): Promise<Look> {
  const folds = memberOf(foldsAtom, e)
  const links = needs.links === true && look.prefs.links && (e.surface !== 'terminal' || hyperlinks)
  const touched = needs.touched === true && hasTouched ? { files: await read($, touchedAtom), cwd: needs.cwd ?? (await cwdOf($)) } : undefined
  const open = needs.folds === true && look.prefs.fold ? new Set(await read($, folds)) : undefined

  return {
    ...look,
    links,
    ...(touched === undefined ? {} : { touched }),
    ...(open === undefined
      ? {}
      : {
          folds: {
            open,
            toggle: (key: string) =>
              void update($, folds, keys => (keys.includes(key) ? keys.filter(kept => kept !== key) : [...keys, key])),
          },
        }),
  }
}

// What a reply's blocks can show: links where it has a URL, file colours where it names a
// path, fold controls where it has code or a table.
const replyNeeds = (text: string, segments: readonly { kind: string }[]): Needs => ({
  links: /https?:\/\//.test(text),
  touched: /[\w.-]\/[\w.-]|\w\.[A-Za-z]{1,5}\b/.test(text),
  folds: segments.some(segment => segment.kind === 'code' || segment.kind === 'table'),
})

// Whether the terminal draws OSC 8 links, from the environment it was started in.
async function readHyperlinks($: EngineInterface): Promise<void> {
  // Each name spelled out: the engine lists the variables a module reads from its source.
  const supported = hyperlinksFrom({
    FORCE_HYPERLINK: await $.env.get('FORCE_HYPERLINK'),
    TERM_PROGRAM: await $.env.get('TERM_PROGRAM'),
    TERM_PROGRAM_VERSION: await $.env.get('TERM_PROGRAM_VERSION'),
    TERM: await $.env.get('TERM'),
    WT_SESSION: await $.env.get('WT_SESSION'),
    VTE_VERSION: await $.env.get('VTE_VERSION'),
    KONSOLE_VERSION: await $.env.get('KONSOLE_VERSION'),
    TMUX: await $.env.get('TMUX'),
    CI: await $.env.get('CI'),
  })

  hyperlinks = supported
}

// A drawing's cards animate on their first draw only, keyed by the drawing's instance
// (the message id, the tool_use_id) so two replies never share a card.
const seenCards = sightings()
const settling = new Map<string, { at: number; cards: string[] }>()
let settlingNow = new Set<string>()
let refusals = 0

const drawingOf = (e: { surface: RenderSurface; requestId: string }): string => `${e.surface}:${e.requestId}`

const drawnBy = (drawing: string, drawnAt: number) => (key: string, entranceMs: number) => {
  const card = `${drawing}:${key}`

  if (settlingNow.delete(card)) {
    seenCards(card)

    return false
  }

  const isFirst = seenCards(card)

  if (isFirst) {
    const pending = settling.get(drawing)

    settling.set(drawing, {
      at: Math.max(pending?.at ?? 0, drawnAt + entranceMs - SETTLE_LEAD_MS),
      cards: [...(pending?.cards ?? []), card],
    })
  }

  return isFirst
}

// Calm draws every card settled, its first draw included.
async function firstDraws($: EngineInterface, e: { surface: RenderSurface; requestId: string }, prefs: Prefs): Promise<(key: string, entranceMs: number) => boolean> {
  const drawing = drawingOf(e)
  settling.delete(drawing)

  return prefs.calm === null ? drawnBy(drawing, await $.clock.now()) : () => false
}

async function withSettle<T>($: EngineInterface, e: { surface: RenderSurface; requestId: string }, drawn: T): Promise<T> {
  if (settling.has(drawingOf(e))) {
    await read($, settleAtom)
  }

  return drawn
}

async function settleEntrances($: EngineInterface, isForced = false): Promise<boolean> {
  const now = await $.clock.now()
  const isDue = (at: number): boolean => at <= now || at > now + STALE_AHEAD_MS

  if (settling.size === 0 || (!isForced && ![...settling.values()].some(pending => isDue(pending.at)))) {
    return true
  }

  const moved = [...settling]
  settlingNow = new Set(moved.flatMap(([, pending]) => pending.cards))
  settling.clear()

  return update($, settleAtom, round => round + 1).then(
    () => {
      refusals = 0

      return true
    },
    (error: unknown) => {
      refusals += 1
      const retryAt = now + Math.min(RETRY_MAX_MS, refusals <= FAST_RETRIES ? 0 : FRAME_MS * 2 ** (refusals - FAST_RETRIES))

      for (const [drawing, pending] of moved) {
        if (!settling.has(drawing)) {
          settling.set(drawing, { ...pending, at: retryAt })
        }
      }

      $.ui.log(`settle: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })

      return false
    },
  )
}

// Made skins from the store, each checked again: the store may hold an older shape.
function parseCustom(raw: unknown): Record<string, CustomSkin> {
  const saved = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  return Object.fromEntries(
    Object.values(saved)
      .map(draft => buildCustom(draft as Record<string, unknown>, undefined))
      .filter((skin): skin is CustomSkin => typeof skin !== 'string')
      .map(skin => [skin.name, skin]),
  )
}

// The same value, whatever order its keys were written in.
function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`
  }

  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'undefined'
}

// The user's store is the only source of truth for skins' settings: one file per user, shared
// by every session. This reads it into the session's atoms (this folder's own prefs when it is
// pinned), and writes only an atom whose value changed, so a draw follows a real change only.
// Called at the start, before every /mods panel, and on a slow clock, so a change made in one
// session reaches the others.
async function syncFromStore($: EngineInterface): Promise<void> {
  const custom = parseCustom(await $.store.get('custom'))
  const names = skinNames(custom)
  const folders = parseFolders(await $.store.get('folders'), names)
  const folder = await cwdOf($)
  const prefs = prefsFor(folder, folders, parsePrefs(await $.store.get('prefs'), names))
  const pinned = Object.hasOwn(folders, folder)

  if (stable(await read($, customAtom)) !== stable(custom)) {
    await update($, customAtom, () => custom)
  }

  if (stable(await read($, prefsAtom)) !== stable(prefs)) {
    await update($, prefsAtom, () => prefs)
  }

  if ((await read($, pinnedAtom)) !== pinned) {
    await update($, pinnedAtom, () => pinned)
  }
}

// How often the store is read again for another session's change.
const SYNC_MS = 3000
let syncTicker: Timer | undefined

function followStore($: EngineInterface): void {
  syncTicker?.cancel()
  syncTicker = $.clock.every(SYNC_MS, () => {
    void syncFromStore($).catch((error: unknown) => {
      $.ui.log(`settings sync: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
    })
  })
}

async function load($: EngineInterface): Promise<void> {
  sessionCwd = await $.session.cwd()
  await syncFromStore($)
  followStore($)
  // Links stay text if the environment cannot be read; the look loads either way.
  await readHyperlinks($).catch((error: unknown) => {
    $.ui.log(`hyperlink check: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  })
}

// The session the prefs were last loaded for. /clear, /resume and /branch reset $.state to its
// defaults and skip session.start, and on a Team or Enterprise plan the built-in guard
// (cc-plugin-sec-default) keeps classic.SessionStart from user-tier mods: the new session's first
// appended rows catch the change instead. No await between the check and the write, so a burst of
// appends loads once.
let loadedFor: string | undefined

// Undefined where nothing answers for the session's id (a test's engine): then there is nothing to compare.
const sessionId = ($: EngineInterface): Promise<string | undefined> => $.session.id().catch(() => undefined)

async function reloadIfNewSession($: EngineInterface): Promise<void> {
  const id = await sessionId($)

  if (id === undefined || id === loadedFor) {
    return
  }

  loadedFor = id
  await load($)
  await followTheme($)
}

// A pinned folder keeps its prefs to itself; every other folder shares the default.
async function savePrefs($: EngineInterface, prefs: Prefs): Promise<void> {
  if (!(await read($, pinnedAtom))) {
    await $.store.set('prefs', prefs)

    return
  }

  const names = skinNames(await read($, customAtom))
  const folders = parseFolders(await $.store.get('folders'), names)
  await $.store.set('folders', withFolder(folders, await $.session.cwd(), prefs))
}

// The settings pane's folder buttons: this folder's own look, or the default.
async function runFolderAction($: EngineInterface, word: FolderWord, lang: Lang): Promise<string> {
  const folder = await $.session.cwd()
  const custom = await read($, customAtom)
  const names = skinNames(custom)
  const folders = parseFolders(await $.store.get('folders'), names)
  const prefs = await read($, prefsAtom)
  const t = STRINGS[lang].toasts

  switch (word) {
    case 'pin':
      await $.store.set('folders', withFolder(folders, folder, prefs))
      await update($, pinnedAtom, () => true)

      return t.pinned
    case 'unpin': {
      const fallback = parsePrefs(await $.store.get('prefs'), names)
      await $.store.set('folders', withoutFolder(folders, folder))
      await update($, pinnedAtom, () => false)
      await update($, prefsAtom, () => fallback)

      return t.unpinned(fallback.skin)
    }
    case 'share':
      await $.store.set('prefs', prefs)

      return t.shared(prefs.skin)
  }
}

async function refreshUsage($: EngineInterface): Promise<void> {
  const usage = await $.session.usage()
  const snap: UsageSnap = {
    context: usage.context.percent ?? null,
    limits: usage.rateLimits.map(limit => {
      const resetsAt = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)

      return { label: limitLabel(limit.kind), percent: limit.percentUsed, ...(Number.isNaN(resetsAt) ? {} : { resetsAt }) }
    }),
  }
  // A window that resets moves its reset time even where its percent stays the same.
  const drawn = (of: UsageSnap) => JSON.stringify([metersOf(of), of.limits.map(limit => limit.resetsAt ?? null)])

  if (drawn(await read($, usageAtom)) === drawn(snap)) {
    return
  }

  await settleEntrances($, true)
  await update($, usageAtom, () => snap)
}

// Redraws the band when a countdown it shows would read differently, and not otherwise:
// a redraw settles the cards still entering first, as a usage change does.
async function tickCountdowns($: EngineInterface): Promise<void> {
  const prefs = await read($, prefsAtom)

  if (!prefs.countdown || !prefs.band) {
    return
  }

  const next = countdownsOf(await read($, usageAtom), await $.clock.now())

  if (JSON.stringify(next) === JSON.stringify(await read($, countdownsAtom))) {
    return
  }

  await settleEntrances($, true)
  await update($, countdownsAtom, () => next)
}

// True when it showed the update notice, so the star ask can keep out of its way.
async function checkForUpdate($: EngineInterface): Promise<boolean> {
  const now = await $.clock.now()

  if (!isDue(await $.store.get('updateCheck'), now)) {
    return false
  }

  // Stamped before the fetch, so an offline machine is not asked again every session.
  await $.store.set('updateCheck', { at: now } satisfies Checked)

  const current = versionOf(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))
  const response = await $.http.fetch(LATEST_URL)

  if (!response.ok) {
    throw new Error(`update check: ${LATEST_URL} answered ${response.status}`)
  }

  const latest = versionOf(response.text)

  if (current !== undefined && latest !== undefined && isNewer(latest, current)) {
    $.ui.toast(updateNotice(latest, current), { timeoutMs: 12_000 })
    return true
  }

  return false
}

async function askForStar($: EngineInterface): Promise<void> {
  const step = starStep(await $.store.get('star'), await $.clock.now())

  if (step.save !== undefined) {
    await $.store.set('star', step.save satisfies Star)
  }

  if (step.ask) {
    $.ui.toast(STAR_NOTICE, { timeoutMs: 12_000 })
  }
}

// Every change goes to the user's store at once, then to this session's atoms: the store
// first, so the sync clock never reads it back older than the atoms.
async function commit($: EngineInterface, state: DesignState): Promise<void> {
  await $.store.set('custom', state.custom)
  await savePrefs($, state.prefs)
  await update($, customAtom, () => state.custom)
  await update($, prefsAtom, () => state.prefs)
}

async function designState($: EngineInterface): Promise<DesignState> {
  return { prefs: await read($, prefsAtom), custom: await read($, customAtom) }
}

const SURFACES: readonly RenderSurface[] = ['terminal', 'desktop', 'vscode', 'mobile']

// `$.skins.markdown`: markdown drawn the way the skin draws a reply, for another mod's
// drawing. Undefined when the skin is off or the text holds nothing it draws. No copy or
// fold controls: a press cannot cross from one mod's tree to another's.
async function drawMarkdown($: EngineInterface, args: SkinsMarkdownArgs): Promise<RenderElement | undefined> {
  if (!SURFACES.includes(args.surface) || typeof args.text !== 'string' || !Number.isFinite(args.columns)) {
    throw new Error('skins.markdown takes { surface, text, columns }: a surface name, a string and a number')
  }

  const active = await activeSkin($)
  const segments = active === null || args.text.length > MAX_MARKDOWN * 4 ? null : replySegments(args.text, active.prefs, args.surface)

  if (active === null || segments === null) {
    return undefined
  }

  const ui = $.ui.resolve({ surface: args.surface, component: 'AssistantMessage' })
  const svg = args.surface !== 'terminal' && active.prefs.tables === 'on' && 'Svg' in ui ? ui.Svg : undefined
  const links = active.prefs.links && (args.surface !== 'terminal' || hyperlinks)

  return replyRows({ ...lookOf(ui, active, args.surface), links, isFirstDraw: () => false }, segments, Math.max(20, Math.floor(args.columns)), svg)
}

// skins' tab in the /mods pane, drawn on the surface the hub draws on.
async function panelFor($: EngineInterface, args: SkinsPanelArgs, lang: Lang): Promise<SkinsPanel> {
  const prefs = await read($, prefsAtom)
  const custom = await read($, customAtom)
  const isLight = await read($, lightAtom)
  const found = resolveSkin(prefs.skin, custom) ?? resolveSkin(DEFAULT_PREFS.skin, custom)

  if (found === undefined || !SURFACES.includes(args.surface)) {
    throw new Error('skins.panel takes { lang, surface, columns } with a surface skins draws on')
  }

  const skin = forTheme(found, isLight)
  const look = lookOf($.ui.resolve({ surface: args.surface, component: 'AssistantMessage' }), { prefs, custom, skin, isLight }, args.surface)

  return skinsPanel(look, {
    skins: skinNames(custom).map(name => ({ name, label: resolveSkin(name, custom)?.label ?? name })),
    editPalette: found.palette,
    editing: await read($, editingAtom),
    columns: Math.max(20, Math.floor(args.columns)),
    pinned: await read($, pinnedAtom),
    lang,
  })
}

// Every component skins draws, named, for the Components tab of /mods.
async function catalogFor($: EngineInterface, args: SkinsPanelArgs): Promise<SkinsCatalogEntry[]> {
  const active = await activeSkin($)
  const prefs = active?.prefs ?? (await read($, prefsAtom))
  const custom = await read($, customAtom)
  const isLight = await read($, lightAtom)
  const fallback = resolveSkin(DEFAULT_PREFS.skin, custom)
  const skin = active?.skin ?? (fallback === undefined ? undefined : forTheme(fallback, isLight))

  if (skin === undefined || !SURFACES.includes(args.surface)) {
    throw new Error('skins.catalog takes { lang, surface, columns } with a surface skins draws on')
  }

  const ui = $.ui.resolve({ surface: args.surface, component: 'AssistantMessage' })
  const look = lookOf(ui, { prefs: { ...prefs, skin: skin.name }, custom, skin, isLight }, args.surface)

  return skinsCatalog(look, Math.max(20, Math.floor(args.columns)), args.lang === 'pt' ? 'pt' : 'en').map(entry => ({ ...entry, tree: staticTree(entry.tree, look.t) }))
}

const isChoice = (field: string): field is Choice => Object.hasOwn(CHOICES, field)

// A press in skins' tab: `skin`, `toggle:<word>`, `calm`, `choice:<field>`, `edit:<slot>`,
// `paint`, `folder:<pin|unpin|share>`, `copy`, `copy-code` and `gallery`.
async function actOnPanel($: EngineInterface, args: SkinsActArgs, lang: Lang): Promise<SkinsActResult> {
  const prefs = await read($, prefsAtom)
  const custom = await read($, customAtom)
  const state = { prefs, custom }
  const value = args.value ?? ''
  const at = args.id.indexOf(':')
  const head = at === -1 ? args.id : args.id.slice(0, at)
  const rest = at === -1 ? '' : args.id.slice(at + 1)
  const toasts = STRINGS[lang].toasts

  switch (head) {
    case 'skin':
      if (value === 'off' || skinNames(custom).includes(value)) {
        await commit($, { ...state, prefs: { ...prefs, skin: value } })
      }

      return {}
    case 'toggle':
      if (Object.hasOwn(TOGGLES, rest)) {
        await commit($, { ...state, prefs: { ...prefs, [TOGGLES[rest as keyof typeof TOGGLES]]: value === 'on' } })
      }

      return {}
    case 'calm':
      await commit($, { ...state, prefs: withCalm(prefs, value !== 'off') })

      return {}
    case 'choice':
      if (isChoice(rest) && (CHOICES[rest] as readonly string[]).includes(value)) {
        await commit($, { ...state, prefs: { ...prefs, [rest]: value } })
      }

      return {}
    case 'edit':
      if ((SLOTS as readonly string[]).includes(rest)) {
        await update($, editingAtom, () => rest as SkinSlot)
      }

      return {}
    case 'paint': {
      const made = withSlot(prefs.skin === 'off' ? DEFAULT_PREFS.skin : prefs.skin, custom, await read($, editingAtom), value)

      if (typeof made === 'string') {
        return { message: made }
      }

      await commit($, { prefs: { ...prefs, skin: made.name }, custom: { ...custom, [made.name]: made.skin } })

      return {}
    }
    case 'folder':
      return rest === 'pin' || rest === 'unpin' || rest === 'share' ? { message: await runFolderAction($, rest, lang) } : {}
    case 'copy':
    case 'copy-code': {
      const code = head === 'copy-code'
      const copied = copyOf(await read($, lastReplyAtom), code)

      if ('message' in copied) {
        return { message: copied.message }
      }

      const result = await $.ui.copy({ text: copied.text })

      return { message: result.isCopied ? (code ? toasts.copiedCode : toasts.copiedReply) : toasts.cannotCopy }
    }
    case 'gallery':
      await $.ui.open({ id: GALLERY, title: 'Skin gallery', focus: true, closeOnEscape: true })

      return {}
    default:
      return {}
  }
}

// `$.skins.palette`: the active skin as it is drawn now, light palette on a light appearance;
// Claude Code's own colours while skins is off. A copy, so nothing of this mod crosses.
async function paletteOf($: EngineInterface): Promise<KitSkin> {
  const active = await activeSkin($)
  const isLight = await read($, lightAtom)

  if (active === null) {
    return { name: NATIVE_NAME, palette: { ...(isLight ? NATIVE.light : NATIVE.dark) }, isLight }
  }

  return { name: active.skin.name, palette: { ...active.skin.palette }, isLight }
}

// cache-tax's countdown until the prompt cache goes cold, for the band; null without cache-tax.
async function cacheLineOf($: EngineInterface): Promise<CacheLine | null> {
  try {
    return cacheLine(await $.cachetax.state(), await $.clock.now())
  } catch {
    return null
  }
}

// The minute tick: the band draws again only when the countdown's words change.
async function tickCache($: EngineInterface): Promise<void> {
  if (!(await read($, prefsAtom)).band) {
    return
  }

  const next = await cacheLineOf($)

  if (!sameLine(next, await read($, cacheLineAtom))) {
    await update($, cacheLineAtom, () => next)
  }
}

export const register: Register = on => {
  // The language the /mods pane last asked for, for what a press answers.
  let panelLang: Lang = 'en'

  // Adds `$.skins` for other mods. A call is the `skins.<method>` event, which a hook below
  // answers with this session's `$`; each method here is the chain's floor.
  on('engine.create', async ($, e, next) => {
    const built = await next(e)

    return {
      ...built,
      skins: {
        markdown: async () => undefined,
        panel: async () => ({ title: 'Skins', sections: [] }),
        act: async () => ({}),
        band: async () => false,
        catalog: async () => [],
        palette: async () => ({ name: NATIVE_NAME, palette: NATIVE.dark, isLight: false }),
      },
    }
  })

  on('skins.markdown', async ($, e) => ({ value: await drawMarkdown($, e) }))

  on('skins.panel', async ($, e) => {
    panelLang = e.lang === 'pt' ? 'pt' : 'en'
    // Another session may have changed a setting since this one last looked.
    await syncFromStore($)

    return { value: await panelFor($, e, panelLang) }
  })

  on('skins.act', async ($, e) => ({ value: await actOnPanel($, e, panelLang) }))

  on('skins.catalog', async ($, e) => ({ value: await catalogFor($, e) }))

  on('skins.palette', async $ => ({ value: await paletteOf($) }))

  on('skins.band', async $ => {
    const active = await activeSkin($)

    return { value: active !== null && active.prefs.band }
  })

  // What the turn on the main loop has done so far, for its footer.
  let stats: TurnStats = NO_STATS
  let isWorking = false
  let ticker: Timer | undefined
  let countdownTicker: Timer | undefined
  let cacheTicker: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: DESIGN_TOOL.name,
      description: DESIGN_TOOL.description,
      inputSchema: DESIGN_TOOL.inputSchema,
    })
    loadedFor = await sessionId($)
    await load($)
    await refreshUsage($)
    await followTheme($)

    // Off the start's path: a slow or offline network must not hold the session up.
    // The star ask waits a session when the update notice is showing; one toast at a time.
    const logDebug = (error: unknown) => $.ui.log(error instanceof Error ? error.message : String(error), { to: 'debug' })
    void checkForUpdate($)
      .catch((error: unknown) => {
        logDebug(error)
        return false
      })
      .then(told => (told ? undefined : askForStar($)))
      .catch(logDebug)

    // Only the spinner reads the frame, so a tick redraws the spinner and nothing else.
    ticker?.cancel()
    ticker = $.clock.every(FRAME_MS, () => {
      if (isWorking) {
        void update($, frameAtom, frame => frame + 1)
      }

      if (settling.size > 0) {
        void settleEntrances($)
      }
    })
    countdownTicker?.cancel()
    countdownTicker = $.clock.every(COUNTDOWN_MS, () => {
      void tickCountdowns($).catch((error: unknown) => {
        $.ui.log(`countdown tick: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
      })
    })
    cacheTicker?.cancel()
    cacheTicker = $.clock.every(CACHE_TICK_MS, () => {
      void tickCache($).catch((error: unknown) => {
        $.ui.log(`cache tick: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
      })
    })

    return next(e)
  })

  // Where the guard does not hold it back, this comes first; session.append then finds the session loaded.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await reloadIfNewSession($)

    return next(e)
  })

  on('ui.invalidate', async ($, e, next) => {
    if (e.event === 'ui.render' && !(await settleEntrances($, true)) && refusals <= FAST_RETRIES) {
      await $.clock.sleep(FRAME_MS / 3)
      await settleEntrances($, true)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    stats = NO_STATS
    isWorking = true
    // A worktree can move the session between turns.
    sessionCwd = await $.session.cwd()
    hasTouched = false
    await update($, touchedAtom, () => ({}))
    const now = await $.clock.now()
    await update($, startedAtom, () => now)

    return next(e)
  })

  on('config.set', async ($, e, next) => {
    const result = await next(e)

    // The written value: inside this hook $.config.list() still answers with the old one.
    if (e.key === 'theme' && result.deny === undefined) {
      await followTheme($, result.value)
    }

    return result
  })

  // Loads the prefs again for a new session (see loadedFor), and notes which prompts carried images,
  // so their row keeps Claude Code's drawing of them.
  on('session.append', async ($, e, next) => {
    await reloadIfNewSession($)
    const stored = await next(e)
    const hasImage = e.door === 'prompt' && e.message.content.some(block => block.type === 'image')

    if (hasImage && stored.uuid !== undefined) {
      await update($, memberOf(imagesAtom, { requestId: stored.uuid }), () => true)
    }

    return stored
  })

  // A turn's end and a plan limit's move are when the band's numbers change.
  on('session.measure', async ($, e, next) => {
    await refreshUsage($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await refreshUsage($)
      isWorking = false
      const finished = stats
      await update($, turnsAtom, turns =>
        Object.fromEntries([...Object.entries(turns), [String(e.durationMs), finished]].slice(-KEPT_TURNS)),
      )

      if (e.answer.trim() !== '') {
        await update($, lastReplyAtom, () => e.answer)
      }
    }

    return next(e)
  })

  // Times every call and counts the main loop's calls and changed lines.
  on('tool.call', async ($, e, next) => {
    // Its output card's header names the command, which the result does not carry.
    if (SHELLS.has(e.tool)) {
      const command = commandOf(e)
      await update($, memberOf(commandAtom, { requestId: e.tool_use_id }), () => command)
    }

    const startedAt = await $.clock.now()
    const ran = await next(e)
    const ms = (await $.clock.now()) - startedAt

    await update($, memberOf(durationAtom, { requestId: e.tool_use_id }), () => ms)

    // The call's arguments ride on the event itself (`e.command` for Bash).
    if (isQuiet(e.tool, e)) {
      await update($, memberOf(quietAtom, { requestId: e.tool_use_id }), () => true)
    }

    // A file the call made or changed takes its colour in this turn's rows and prose.
    const file = (e as { file_path?: unknown; notebook_path?: unknown }).file_path ?? (e as { notebook_path?: unknown }).notebook_path

    if (WRITES.has(e.tool) && ran.deny === undefined && typeof file === 'string' && file !== '') {
      const touch: Touch = (ran.result as { type?: unknown } | undefined)?.type === 'create' ? 'created' : 'edited'
      hasTouched = true
      await update($, touchedAtom, touched => (touched[file] === 'created' ? touched : { ...touched, [file]: touch }))
    }

    if (e.agentId === undefined && e.tool !== DESIGN && ran.deny === undefined) {
      const diff = diffstat(ran.result)
      stats = {
        tools: stats.tools + 1,
        added: stats.added + (diff?.added ?? 0),
        removed: stats.removed + (diff?.removed ?? 0),
      }
    }

    return ran
  })

  on('tool.call', { tool: DESIGN_MATCH }, async ($, e) => {
    const outcome = runDesign(e, await designState($))

    if (outcome.isError) {
      return { deny: outcome.text }
    }

    await commit($, outcome.state)

    return { result: outcome.text }
  })

  // Every element the skin draws, numbered, to point at when asking for a change.
  on('ui.render', { component: 'Pane', requestId: GALLERY }, async ($, e) => {
    const active = await activeSkin($)
    const ui = $.ui.resolve(e)

    if (active === null) {
      return galleryOff(ui, e.surface, await read($, lightAtom), panelLang)
    }

    const look = lookOf(ui, active, e.surface)

    return withSettle($, e, galleryPane({ ...look, ...(look.svg === undefined ? {} : { isFirstDraw: await firstDraws($, e, active.prefs) }) }, e.props.bodyColumns, panelLang))
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const kind = kindOf(e.props.tool)
    const active = await activeSkin($)

    if (kind === null || active === null) {
      return next(e)
    }

    const cwd = await cwdOf($)
    const ms = e.props.isRunning ? -1 : await read($, memberOf(durationAtom, e))
    const diff = diffstat(e.props.output)
    const target = summarize(e.props.tool, e.props.input, cwd)

    const meta = {
      ...(ms >= 0 && !e.props.isRunning ? { ms } : {}),
      ...(diff === null ? {} : diff),
    }
    const copy = (text: string) => {
      void $.ui.copy({ text, surface: e.surface }).then(result => $.ui.toast(result.isCopied ? 'Copied' : 'Could not copy here'))
    }
    const fields = (e.props.input ?? {}) as { file_path?: unknown; notebook_path?: unknown }
    const path = fields.file_path ?? fields.notebook_path
    // The chevron opens the row onto the call's input and its answer.
    const disclosure = memberOf(disclosureAtom, e)
    const open = isOpen(await read($, disclosure), e.props.isErrored)
    const base = await sessionLook($, e, lookOf($.ui.resolve(e), active, e.surface, copy), {
      touched: typeof path === 'string',
      folds: open,
      cwd,
    })
    const look = base.svg === undefined ? base : { ...base, isFirstDraw: await firstDraws($, e, active.prefs) }
    // A file this turn made or changed keeps its colour in every row that names it.
    const touch = typeof path === 'string' && look.touched !== undefined ? touchOf(look.touched.files, path, cwd) : undefined
    const label = active.prefs.quiet && isQuiet(e.props.tool, e.props.input) ? quietLabel(e.props.tool) : toolLabel(e.props.tool)
    const row = toolRow(look, e.props, kind, target, meta, label, touch)
    const toggle = () => void update($, disclosure, () => (open ? 'closed' : 'open'))

    if (!open) {
      return withSettle($, e, disclosedRow(look, row, false, toggle))
    }

    const all = memberOf(allAtom, e)
    const isAll = await read($, all)
    const opened = await openedRows(look, {
      fields: inputFields(e.props.tool, e.props.input, cwd),
      body: bodyOf(e.props.tool, e.props.output, e.props.isErrored, e.props.isRunning, cwd),
      command: commandOf(e.props.input),
      isErrored: e.props.isErrored,
      cwd,
      columns: e.viewport?.columns ?? 100,
      isAll,
      toggleAll: () => void update($, all, () => !isAll),
      stock: () => next(e),
    })

    return withSettle($, e, disclosedRow(look, row, true, toggle, opened))
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const active = await activeSkin($)

    if (active === null || e.props.isExpanded) {
      return next(e)
    }

    return groupRow(lookOf($.ui.resolve(e), active, e.surface), e.props.calls)
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const active = await activeSkin($)
    const output = e.props.output as { stdout?: unknown } | null
    const copy = (text: string) => {
      void $.ui.copy({ text, surface: e.surface }).then(result => $.ui.toast(result.isCopied ? 'Copied' : 'Could not copy here'))
    }
    // Only the terminal's shell card has a fold control here.
    const needs = { folds: e.surface === 'terminal' && SHELLS.has(e.props.tool) }
    const look = active === null ? undefined : await sessionLook($, e, lookOf($.ui.resolve(e), active, e.surface, copy), needs)
    const columns = e.viewport?.columns ?? 100
    // An opened row draws the answer itself; one it cannot draw keeps Claude Code's here.
    const isOpened =
      active !== null &&
      kindOf(e.props.tool) !== null &&
      isOpen(await read($, memberOf(disclosureAtom, e)), e.props.isErrored) &&
      bodyOf(e.props.tool, e.props.output, e.props.isErrored, false, '').kind !== 'stock'

    if (isOpened) {
      const { Box } = $.ui.resolve(e)

      return <Box />
    }

    // Calm never folds a failure away: it is drawn whole, past quiet and the clip.
    const isCalmFailure = look !== undefined && look.prefs.calm !== null && e.props.isErrored

    // A call that only looked folds away; a failure keeps the line that says why.
    if (look !== undefined && look.prefs.quiet && !isCalmFailure && (await read($, memberOf(quietAtom, e)))) {
      return quietResult(look, e.props.isErrored ? errorLine(e.props.output) : null)
    }

    // The desktop gets cards: a diff for an edit, a terminal for a shell command.
    if (look?.svg !== undefined && EDITS.has(e.props.tool) && !e.props.isErrored) {
      const diff = hunksOf(e.props.output)

      if (diff !== null) {
        const shown = shortenPath(diff.path, await $.session.cwd())

        return withSettle($, e, diffCard({ ...look, isFirstDraw: await firstDraws($, e, look.prefs) }, look.svg, diff, shown, columns))
      }
    }

    const isShellCard = look !== undefined && look.prefs.shell && SHELLS.has(e.props.tool) && !keepsOwnRow(e.props.output)

    if (look?.svg !== undefined && isShellCard) {
      const shell = shellOutputOf(e.props.output)

      if (shell !== null) {
        return withSettle($, e, terminalCard({ ...look, isFirstDraw: await firstDraws($, e, look.prefs) }, look.svg, shell, e.props.isErrored, columns))
      }
    }

    // The terminal's card is text: the command and its exit status, stderr apart, folded.
    if (look !== undefined && e.surface === 'terminal' && isShellCard) {
      const shell = shellResultOf(e.props.output, e.props.isErrored)

      if (shell !== null) {
        // `/skin fold off`, or the person's `▾ N more`, shows the output whole.
        const isWhole = !look.prefs.fold || look.folds?.open.has(OUTPUT_FOLD) === true
        const fold = isWhole ? null : { head: CLIP_HEAD, tail: CLIP_TAIL }

        return shellRows(look, await read($, memberOf(commandAtom, e)), shell, e.props.isErrored, {
          stdout: fold,
          stderr: isCalmFailure ? null : fold,
        })
      }
    }

    if (!active?.prefs.clipOutput || isCalmFailure || !SHELLS.has(e.props.tool) || typeof output?.stdout !== 'string') {
      return next(e)
    }

    const stdout = clipLines(output.stdout, CLIP_HEAD, CLIP_TAIL)

    return stdout === output.stdout
      ? next(e)
      : next({ ...e, props: { ...e.props, output: { ...output, stdout } } })
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const active = await activeSkin($)

    // Off the terminal your messages keep Claude Code's own component: it carries the copy
    // and rewind buttons, the context menu and selectable text, which an outline would lose.
    if (active === null || e.surface !== 'terminal' || !TYPED.has(e.props.origin.kind) || e.props.text.length > MAX_PROMPT) {
      return next(e)
    }

    const look = lookOf($.ui.resolve(e), active, e.surface)
    const hasImages = await read($, memberOf(imagesAtom, e))

    // Claude Code draws the images; the text is already in the outline above them.
    return promptRow(look, e.props.text, hasImages ? await next({ ...e, props: { ...e.props, text: '' } }) : undefined)
  })

  // While charts are drawn, the model learns it can answer a "show me" with a Mermaid
  // fence. Nothing for a headless run, which draws nothing.
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const active = await activeSkin($)
    const isHeadless = e.surfaces.length === 0 || e.traits.includes('bare') || e.traits.includes('print')

    if (active === null || !active.prefs.charts || !active.prefs.hints || isHeadless) {
      return result
    }

    return { sections: [...result.sections, { id: 'skins:charts', text: CHART_HINT, scope: 'session' as const }] }
  })

  // A reply keeps Claude Code's own drawing unless it holds a card or markdown the pack draws.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const active = await activeSkin($)

    const text = e.props.text

    if (active === null) {
      return next(e)
    }

    const { prefs } = active
    const segments = replySegments(text, prefs, e.surface)

    if (segments === null) {
      return next(e)
    }

    // Every surface's table names Svg, but the terminal draws it as nothing. As text, tables
    // are text grids and code the app's own selectable blocks.
    const ui = $.ui.resolve(e)
    const svg = e.surface !== 'terminal' && active.prefs.tables === 'on' && 'Svg' in ui ? ui.Svg : undefined
    const copy = (copied: string) => {
      void $.ui.copy({ text: copied, surface: e.surface }).then(result => $.ui.toast(result.isCopied ? 'Copied' : 'Could not copy here'))
    }

    const base = await sessionLook($, e, lookOf(ui, active, e.surface, copy), replyNeeds(text, segments))
    const look = base.svg === undefined ? base : { ...base, isFirstDraw: await firstDraws($, e, prefs) }

    // A reply of several blocks can be copied whole, as Claude wrote it.
    return withSettle($, e, replyRows(look, segments, e.viewport?.columns ?? 100, svg, segments.length > 1 ? text : undefined))
  })

  // A slash command's output (`/cost`, `/context`, a plugin's) drawn the way a reply is: its
  // tables and code as cards, a run of `key: value` lines as a table. /skin's own rows are
  // already the skin's.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    const active = await activeSkin($)

    if (active === null || !active.prefs.commands || active.prefs.tables === 'off' || e.props.isErrored || e.props.command === 'skin') {
      return next(e)
    }

    const segments = e.props.text.length > MAX_MARKDOWN ? null : commandSegments(e.props.text, e.props.command)

    if (segments === null) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const svg = e.surface !== 'terminal' && active.prefs.tables === 'on' && 'Svg' in ui ? ui.Svg : undefined
    const copy = (copied: string) => {
      void $.ui.copy({ text: copied, surface: e.surface }).then(result => $.ui.toast(result.isCopied ? 'Copied' : 'Could not copy here'))
    }

    const base = await sessionLook($, e, lookOf(ui, active, e.surface, copy), replyNeeds(e.props.text, segments))
    const look = base.svg === undefined ? base : { ...base, isFirstDraw: await firstDraws($, e, active.prefs) }

    return withSettle($, e, replyRows(look, segments, e.viewport?.columns ?? 100, svg))
  })

  // The terminal's spinner gets the skin's word with a shimmer; the desktop's keeps its
  // word, which says what the step is doing, beside an animated icon.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const active = await activeSkin($)

    if (active === null) {
      return next(e)
    }

    if (e.surface !== 'terminal') {
      const look = lookOf($.ui.resolve(e), active, e.surface)

      // Calm keeps the app's own, quieter spinner.
      return look.svg === undefined || active.prefs.calm !== null
        ? next(e)
        : desktopSpinnerRow(look, look.svg, e.props.mode, e.props.message ?? e.props.word)
    }

    // words claude keeps Claude Code's own word, whatever the skin says.
    const word = active.prefs.words === 'claude' ? e.props.word : (pick(active.skin.spinner, e.props.word) ?? e.props.word)

    if (!active.prefs.shimmer || e.props.message !== null) {
      return next({ ...e, props: { ...e.props, word } })
    }

    const frame = await read($, frameAtom)
    const startedAt = await read($, startedAtom)
    const elapsed = startedAt === 0 ? 0 : (await $.clock.now()) - startedAt

    return spinnerRow(lookOf($.ui.resolve(e), active, e.surface), word, frame, elapsed)
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const active = await activeSkin($)

    if (active === null) {
      return next(e)
    }

    const turns = await read($, turnsAtom)
    const word = active.prefs.words === 'claude' ? e.props.word : (pick(active.skin.done, e.props.word) ?? e.props.word)

    return footerRow(lookOf($.ui.resolve(e), active, e.surface), word, e.props.durationMs, turns[String(e.props.durationMs)])
  })

  // The band above the prompt: context and plan limits. Another mod's drawing there,
  // and a survey, keep their place.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const active = await activeSkin($)
    const usage = await read($, usageAtom)
    // Drawn from the clock so a countdown switched on shows at once; reading the atom
    // redraws the band when the minute tick changes one.
    const countdowns = active?.prefs.countdown === true ? (await read($, countdownsAtom), countdownsOf(usage, await $.clock.now())) : {}
    const meters = metersOf(usage, countdowns)
    // Reading the atom redraws the band when the minute tick changes the countdown's words.
    const cache = active?.prefs.band === true ? (await read($, cacheLineAtom), await cacheLineOf($)) : null

    if (active === null || !active.prefs.band || e.props.hasSurvey || (meters.length === 0 && cache === null)) {
      return next(e)
    }

    const plain = lookOf($.ui.resolve(e), active, e.surface)
    const { Box } = plain.ui
    const theirs = await next(e)
    // Compacting mid-turn would cut the turn's own context out from under it.
    // Runs Claude Code's own /compact, so the person sees its usual progress and result.
    // Work a press starts is abandoned when the press ends, which cancels a compaction
    // still running, so a timer starts it in a dispatch of its own, which returns the run
    // so that dispatch lasts until the compaction ends. The button hides until then, so
    // repeated presses do not queue one /compact each.
    const isCompacting = await read($, compactingAtom)
    const compact = () => {
      void update($, compactingAtom, () => true)
      $.clock.after(1, () =>
        $.command
          .run({ command: 'compact' })
          .catch((error: unknown) => $.ui.toast(`Compacting failed: ${error instanceof Error ? error.message : String(error)}`))
          .finally(() => update($, compactingAtom, () => false)),
      )
    }
    const look = { ...plain, ...(plain.svg === undefined ? {} : { isFirstDraw: await firstDraws($, e, active.prefs) }) }

    return withSettle(
      $,
      e,
      <Box flexDirection="column">
        {usageBand(look, meters, !e.props.isWorking && !isCompacting, compact, cache, undefined, e.props.bodyColumns)}
        {theirs}
      </Box>,
    )
  })

  // Claude Code's own dialog stays whole: the skin only adds a band above it.
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const active = await activeSkin($)
    const theirs = await next(e)

    if (active === null) {
      return theirs
    }

    const headers = e.props.questions
      .map(question => (question as { header?: unknown } | null)?.header)
      .filter((header): header is string => typeof header === 'string' && header !== '')
    const look = lookOf($.ui.resolve(e), active, e.surface)
    const { Box } = look.ui

    return headers.length === 0 ? (
      theirs
    ) : (
      <Box flexDirection="column">
        {askBand(look, headers)}
        {theirs}
      </Box>
    )
  })
}
