import { kitOf } from './kit/kit'
import type { Kit } from './kit/kit'
import { toneOf } from './kit/tone'
import type { Tone } from './kit/tone'
import type { Look } from './rows'
import type { Skin, Slot } from './skin'

// The palette as element colours, for every row drawn in text. On Claude Code's own skin the
// roles are the app's theme keys (body text undefined: the app's own colour), so text follows
// the app exactly, light or dark; on any other skin they are the skin's hex. The tool-kind
// slots and the bands (surface, zebra) stay hex. `line` is the kit's hairline, for outlines.
export type Ink = Readonly<Record<Slot, string | undefined>> & { readonly line: string }

export const toneOfSkin = (skin: Skin, isLight: boolean): Tone => toneOf({ name: skin.name, palette: skin.palette, isLight })

export function inkFrom(t: Tone): Ink {
  const { hex } = t

  return {
    read: hex.read,
    write: hex.write,
    run: hex.run,
    search: hex.search,
    web: hex.web,
    mcp: hex.mcp,
    other: hex.other,
    surface: hex.surface,
    zebra: hex.zebra,
    user: t.ink.accent,
    fg: t.ink.fg,
    muted: t.ink.muted,
    ok: t.ink.ok,
    err: t.ink.err,
    warn: t.ink.warn,
    line: t.ink.line,
  }
}

// The kit drawn with a look's elements, for the pieces the pack shares.
export const kitFor = (look: Look, columns = 80): Kit => kitOf({ ...look.ui, ...(look.svg === undefined ? {} : { Svg: look.svg }) }, look.t, look.surface, columns)
