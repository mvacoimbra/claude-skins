import { NATIVE, NATIVE_NAME } from '../kit/tone'
import type { Skin } from '../skin'

// Claude Code's own colours, dark and light, as the pack's kit carries them: the skin every
// mod wears when nothing else is picked. Its words are plain ones, close to the app's.
const skin: Skin = {
  name: NATIVE_NAME,
  label: 'Claude',
  palette: NATIVE.dark,
  light: NATIVE.light,
  spinner: ['Thinking', 'Working', 'Pondering', 'Computing', 'Processing'],
  done: ['Done', 'Finished', 'Completed'],
}

export default skin
