// Another mod's noun skins calls, for the editor and tsc only (not this plugin's contract):
// cache-tax's state, for the band's countdown until the prompt cache goes cold.
import type { CacheState } from '../hooks/cache'

declare module 'claude-code' {
  interface EngineInterface {
    cachetax: { state: () => Promise<CacheState> }
  }
}
