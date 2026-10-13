import type { RenderElement } from 'claude-code'

import { skinsCatalog } from './catalog'
import type { Lang } from './i18n'
import type { Look } from './rows'

// Every component the skin draws, numbered and named: the same catalog the Components tab of
// /mods shows, so a note on #4 is a note on the real thing.
export function galleryPane(look: Look, columns: number, lang: Lang) {
  const { Box, Text } = look.ui
  const { palette } = look.skin

  return (
    <Box flexDirection="column">
      {skinsCatalog(look, columns, lang).map((entry, i) => (
        <Box key={`gallery-${entry.id}`} flexDirection="column" marginBottom={1}>
          <Text color={palette.muted} bold>{`${i + 1}  ${entry.name}`}</Text>
          {entry.tree as RenderElement}
        </Box>
      ))}
    </Box>
  )
}
