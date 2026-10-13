import type { Prefs, SettingsTab, SkinSlot } from '../types'
import type { ToggleWord } from './command'

export type Lang = Prefs['lang']

// One option in the settings pane: what it is called and one line on what it does.
type Option = { name: string; help: string }

// Every word the settings pane draws, in each language it speaks. English is the default.
export type Strings = {
  tabs: Record<SettingsTab, string>
  on: string
  off: string
  theme: {
    skin: string
    offSkin: string
    preview: string
    folder: string
    pinned: string
    followsDefault: string
    pin: string
    unpin: string
    share: string
    ask: string
    askExample: string
  }
  toggles: Record<ToggleWord | 'calm', Option>
  prompt: Option & Record<Prefs['prompt'], string>
  icons: Option & Record<Prefs['icons'], string>
  words: Option & Record<Prefs['words'], string>
  tables: Option & Record<Prefs['tables'], string>
  lang: Option & Record<Lang, string>
  colors: {
    help: string
    paint: string
    slots: Record<SkinSlot, Option>
  }
  actions: {
    copy: Option
    copyCode: Option
    gallery: Option
  }
  toasts: {
    copiedReply: string
    copiedCode: string
    cannotCopy: string
    pinned: string
    unpinned: (skin: string) => string
    shared: (skin: string) => string
  }
  footer: string
}

const en: Strings = {
  tabs: { theme: 'Theme', look: 'Look', content: 'Content', band: 'Usage band', colors: 'Colors', actions: 'Actions' },
  on: 'on',
  off: 'off',
  theme: {
    skin: 'Skin',
    offSkin: "off · Claude Code's own look",
    preview: 'Preview',
    folder: 'This folder',
    pinned: 'has its own look',
    followsDefault: 'follows the default',
    pin: 'Use only here',
    unpin: 'Follow the default',
    share: 'Make this the default',
    ask: 'Or ask Claude:',
    askExample: '“make me a skin that feels like a sunset”',
  },
  toggles: {
    rail: { name: 'Turn rail', help: 'Terminal only: a line joining the tool rows of a turn' },
    shimmer: { name: 'Shimmer', help: 'A band of light across the spinner word' },
    calm: { name: 'Calm mode', help: 'No motion, one line per tool row, read-only output folded. Off puts your settings back' },
    markdown: { name: 'Rich replies', help: 'Alerts, task lists and prose drawn by the skin' },
    highlight: { name: 'Code highlighting', help: "Code blocks and shell output in the skin's colors" },
    shell: { name: 'Shell card', help: 'The command, its exit status, stderr apart, long output folded' },
    commands: { name: 'Command output', help: 'Tables and code in /cost, /context and plugin output as cards' },
    charts: { name: 'Charts', help: 'Mermaid fences drawn as charts' },
    hints: { name: 'Chart hints', help: 'A short note (about 130 tokens) telling Claude that charts draw here' },
    math: { name: 'Math', help: 'Formulas as typeset cards, inline TeX as Unicode' },
    links: { name: 'Links', help: 'Bare URLs as clickable links' },
    copy: { name: 'Copy buttons', help: 'On tables, code, diagrams and whole replies' },
    fold: { name: 'Fold long blocks', help: 'Long code, tables and shell output fold behind ▾ N more' },
    quiet: { name: 'Quiet output', help: 'Reads, searches and read-only commands fold to one row' },
    clip: { name: 'Clip output', help: 'Long command output keeps its first 8 and last 4 lines' },
    band: { name: 'Usage band', help: 'Context and plan-limit meters above the prompt' },
    countdown: { name: 'Reset countdown', help: 'When each plan limit resets, beside its meter' },
  },
  prompt: {
    name: 'Your messages',
    help: "Terminal only: where your prompt sits. The desktop keeps the app's own bubble",
    left: 'left',
    right: 'right',
    plain: 'no outline',
  },
  icons: { name: 'Icons', help: 'The glyphs in rows and charts', unicode: 'unicode', ascii: 'ascii' },
  words: { name: 'Spinner words', help: 'Whose words the spinner and the turn footer show', skin: "the skin's", claude: "Claude Code's" },
  tables: { name: 'Tables and code', help: 'Cards, selectable text on the desktop, or Claude Code’s own', on: 'cards', text: 'text', off: 'off' },
  lang: { name: 'Language', help: 'The language of this screen', en: 'English', pt: 'Português' },
  colors: {
    help: 'Pick a color, then type a hex. Repainting a built-in skin saves it as your own my-<skin>.',
    paint: 'paint',
    slots: {
      user: { name: 'Accent', help: 'the rail, your prompt marker, the spinner' },
      fg: { name: 'Text', help: 'body text' },
      muted: { name: 'Muted', help: 'commands, paths, timings' },
      surface: { name: 'Surface', help: 'behind table headers and inline code' },
      zebra: { name: 'Zebra', help: 'every other table row' },
      ok: { name: 'Success', help: 'a finished call' },
      err: { name: 'Error', help: 'a failed call' },
      warn: { name: 'Warning', help: 'an interrupted call' },
      read: { name: 'Read', help: 'Read' },
      write: { name: 'Write', help: 'Edit and Write' },
      run: { name: 'Run', help: 'Bash and PowerShell' },
      search: { name: 'Search', help: 'Glob and Grep' },
      web: { name: 'Web', help: 'WebFetch and WebSearch' },
      mcp: { name: 'MCP', help: 'MCP tools' },
      other: { name: 'Other', help: 'anything else in a group' },
    },
  },
  actions: {
    copy: { name: 'Copy last reply', help: "Claude's last reply, as Markdown" },
    copyCode: { name: 'Copy last code block', help: 'Only the last code block of that reply' },
    gallery: { name: 'Open the gallery', help: 'Every element the skin draws, numbered, to point at when asking for a change' },
  },
  toasts: {
    copiedReply: 'Copied the reply',
    copiedCode: 'Copied the code',
    cannotCopy: 'Could not copy here',
    pinned: 'this folder keeps its own look',
    unpinned: skin => `this folder follows the default: ${skin}`,
    shared: skin => `default look: ${skin}`,
  },
  footer: 'Esc closes · Tab and the arrows move · 1–6 switch tabs',
}

const pt: Strings = {
  tabs: { theme: 'Tema', look: 'Aparência', content: 'Conteúdo', band: 'Faixa de uso', colors: 'Cores', actions: 'Ações' },
  on: 'ligado',
  off: 'desligado',
  theme: {
    skin: 'Skin',
    offSkin: 'desligado · visual do próprio Claude Code',
    preview: 'Prévia',
    folder: 'Esta pasta',
    pinned: 'tem visual próprio',
    followsDefault: 'segue o padrão',
    pin: 'Usar só aqui',
    unpin: 'Seguir o padrão',
    share: 'Tornar padrão',
    ask: 'Ou peça ao Claude:',
    askExample: '“faz um skin com cara de pôr do sol”',
  },
  toggles: {
    rail: { name: 'Trilho do turno', help: 'Só no terminal: uma linha ligando as ferramentas de um turno' },
    shimmer: { name: 'Brilho', help: 'Uma faixa de luz passando pela palavra do spinner' },
    calm: { name: 'Modo calmo', help: 'Sem animação, uma linha por ferramenta, saídas de leitura dobradas. Desligar devolve suas configurações' },
    markdown: { name: 'Respostas ricas', help: 'Alertas, listas de tarefas e texto desenhados pelo skin' },
    highlight: { name: 'Realce de código', help: 'Blocos de código e saída do shell nas cores do skin' },
    shell: { name: 'Card do shell', help: 'O comando, o status de saída, o stderr separado, saídas longas dobradas' },
    commands: { name: 'Saída de comandos', help: 'Tabelas e código do /cost, /context e de plugins como cards' },
    charts: { name: 'Gráficos', help: 'Blocos Mermaid desenhados como gráficos' },
    hints: { name: 'Dica de gráficos', help: 'Uma nota curta (cerca de 130 tokens) avisando o Claude que gráficos são desenhados aqui' },
    math: { name: 'Matemática', help: 'Fórmulas como cards tipografados, TeX inline como Unicode' },
    links: { name: 'Links', help: 'URLs soltas como links clicáveis' },
    copy: { name: 'Botões de copiar', help: 'Em tabelas, código, diagramas e respostas inteiras' },
    fold: { name: 'Dobrar blocos longos', help: 'Código, tabelas e saídas longas dobram atrás de ▾ N more' },
    quiet: { name: 'Saída silenciosa', help: 'Leituras, buscas e comandos só de leitura viram uma linha' },
    clip: { name: 'Cortar saída', help: 'Saídas longas de comandos mostram só as 8 primeiras e as 4 últimas linhas' },
    band: { name: 'Faixa de uso', help: 'Medidores de contexto e de limite do plano acima do prompt' },
    countdown: { name: 'Contagem para renovar', help: 'Quando cada limite do plano renova, ao lado do medidor' },
  },
  prompt: {
    name: 'Suas mensagens',
    help: 'Só no terminal: onde fica o seu prompt. No desktop fica o balão do próprio app',
    left: 'esquerda',
    right: 'direita',
    plain: 'sem borda',
  },
  icons: { name: 'Ícones', help: 'Os símbolos das linhas e dos gráficos', unicode: 'unicode', ascii: 'ascii' },
  words: { name: 'Palavras do spinner', help: 'De quem são as palavras do spinner e do rodapé do turno', skin: 'do skin', claude: 'do Claude Code' },
  tables: { name: 'Tabelas e código', help: 'Cards, texto selecionável no desktop, ou o desenho do Claude Code', on: 'cards', text: 'texto', off: 'desligado' },
  lang: { name: 'Idioma', help: 'O idioma desta tela', en: 'English', pt: 'Português' },
  colors: {
    help: 'Escolha uma cor e digite o hex. Repintar um skin pronto salva como o seu my-<skin>.',
    paint: 'pintar',
    slots: {
      user: { name: 'Destaque', help: 'o trilho, o marcador do prompt, o spinner' },
      fg: { name: 'Texto', help: 'texto principal' },
      muted: { name: 'Suave', help: 'comandos, caminhos, tempos' },
      surface: { name: 'Superfície', help: 'atrás do cabeçalho das tabelas e do código inline' },
      zebra: { name: 'Zebra', help: 'linhas alternadas das tabelas' },
      ok: { name: 'Sucesso', help: 'uma chamada concluída' },
      err: { name: 'Erro', help: 'uma chamada que falhou' },
      warn: { name: 'Aviso', help: 'uma chamada interrompida' },
      read: { name: 'Leitura', help: 'Read' },
      write: { name: 'Escrita', help: 'Edit e Write' },
      run: { name: 'Execução', help: 'Bash e PowerShell' },
      search: { name: 'Busca', help: 'Glob e Grep' },
      web: { name: 'Web', help: 'WebFetch e WebSearch' },
      mcp: { name: 'MCP', help: 'ferramentas MCP' },
      other: { name: 'Outras', help: 'o resto, num grupo' },
    },
  },
  actions: {
    copy: { name: 'Copiar a última resposta', help: 'A última resposta do Claude, em Markdown' },
    copyCode: { name: 'Copiar o último bloco de código', help: 'Só o último bloco de código dessa resposta' },
    gallery: { name: 'Abrir a galeria', help: 'Todos os elementos que o skin desenha, numerados, para apontar ao pedir uma mudança' },
  },
  toasts: {
    copiedReply: 'Resposta copiada',
    copiedCode: 'Código copiado',
    cannotCopy: 'Não deu para copiar aqui',
    pinned: 'esta pasta tem visual próprio',
    unpinned: skin => `esta pasta segue o padrão: ${skin}`,
    shared: skin => `visual padrão: ${skin}`,
  },
  footer: 'Esc fecha · Tab e as setas navegam · 1–6 trocam de aba',
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, pt }
