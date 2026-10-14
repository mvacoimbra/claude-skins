import type { RenderElement, RenderSurface } from 'claude-code'

import { skinsCatalog } from './catalog'
import type { Lang } from './i18n'
import { kitFor } from './ink'
import { empty, heading, kitOf, stack, text } from './kit/kit'
import type { KitUi } from './kit/kit'
import { NATIVE, NATIVE_NAME, toneOf } from './kit/tone'
import type { Look } from './rows'

const WORDS = {
  en: {
    intro: (skin: string) => `Every component skins draws, in ${skin}. Name one by its number when you ask for a change.`,
    off: 'The gallery shows a skin.',
    offHint: 'Pick one in the Skins tab of /mods first.',
  },
  pt: {
    intro: (skin: string) => `Cada componente que o skins desenha, em ${skin}. Cite o número ao pedir uma mudança.`,
    off: 'A galeria mostra um skin.',
    offHint: 'Escolha um na aba Skins do /mods primeiro.',
  },
} as const

// Every component the skin draws, numbered and named: the same catalog the Components tab of
// /mods shows, so a note on #4 is a note on the real thing. In the kit's grammar: each entry
// a heading with its number, its line of help muted under it, then the component itself.
export function galleryPane(look: Look, columns: number, lang: Lang) {
  const k = kitFor(look, columns)
  const { Box } = look.ui

  return stack(k, 'gallery', [
    <Box key="gallery-intro" paddingX={1}>
      {text(k, WORDS[lang].intro(look.skin.label), 'muted')}
    </Box>,
    ...skinsCatalog(look, columns, lang).map((entry, i) => (
      <Box key={`gallery-${entry.id}`} flexDirection="column">
        {heading(k, `${i + 1}  ${entry.name}`)}
        {entry.help ? <Box paddingX={1}>{text(k, entry.help, 'muted')}</Box> : null}
        <Box flexDirection="column" paddingX={1}>
          {entry.tree as RenderElement}
        </Box>
      </Box>
    )),
  ])
}

// What the gallery shows while skins is off, in Claude Code's own colours.
export function galleryOff(ui: KitUi, surface: RenderSurface, isLight: boolean, lang: Lang) {
  return empty(kitOf(ui, toneOf({ name: NATIVE_NAME, palette: isLight ? NATIVE.light : NATIVE.dark, isLight }), surface, 80), 'gallery-off', WORDS[lang].off, WORDS[lang].offHint)
}
