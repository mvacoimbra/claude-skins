import type { RenderElement } from 'claude-code'

import type { SkinsCatalogEntry } from '../types'
import { cacheLine } from './cache'
import { codeRows } from './code-rows'
import { commandSegments } from './command-output'
import { disclosedRow } from './detail-rows'
import type { Lang } from './i18n'
import type { Table } from './markdown'
import { replySegments } from './reply'
import { askBand, codeCard, desktopSpinnerRow, diffCard, footerRow, groupRow, promptRow, quietResult, replyRows, spinnerRow, terminalCard, toolRow, usageBand } from './rows'
import type { Look } from './rows'
import { shellRows } from './shell-rows'
import type { ToolKind } from './skin'

// Every component skins draws, each named, from the same builders the transcript uses, so a
// note on one is a note on the real thing. Shown in the Components tab of /mods.

const done = { isRunning: false, isErrored: false, isInterrupted: false }

const TABLE: Table = {
  kind: 'table',
  header: ['Skin', 'Accent', 'Time'],
  align: ['left', 'left', 'right'],
  rows: [
    ['noir', '#f5f5f5', '41s'],
    ['tokyo-night', '#7aa2f7', '2.1s'],
    ['dracula', '#bd93f9', '340ms'],
  ],
}

const SHELL_FOLD = { stdout: { head: 8, tail: 4 }, stderr: { head: 8, tail: 4 } }

const CODE = ['// Rate limit per route, keyed by user', 'export function limit(route: string, perMinute = 60) {', '  return (used: number) => used < perMinute', '}'].join('\n')

const DIFF = {
  path: '/work/apps/hub/src/server.ts',
  isNewFile: false,
  hunks: [{ oldStart: 12, newStart: 12, lines: [' const app = fastify()', '-app.listen(7447)', '+app.register(rateLimit, { max: 60 })', '+app.listen(7447)'] }],
}

const fence = (body: string) => `\`\`\`mermaid\n${body}\n\`\`\``

// One sample of each chart kind skins draws from a ` ```mermaid ` fence.
const CHARTS: readonly { id: string; en: string; pt: string; body: string }[] = [
  { id: 'flowchart', en: 'Flowchart', pt: 'Fluxograma', body: 'flowchart TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C([Done])\n  B -. no .-> A' },
  { id: 'xychart', en: 'XY chart: bars and lines', pt: 'Gráfico XY: barras e linhas', body: 'xychart-beta\n  title "Sales"\n  x-axis [jan, feb, mar]\n  y-axis "Revenue"\n  bar [5, 12, 7]\n  line "Trend" [4, 9, 10]' },
  { id: 'pie', en: 'Pie chart', pt: 'Gráfico de pizza', body: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85.5\n  "Birds" : 40' },
  { id: 'gantt', en: 'Gantt chart', pt: 'Gráfico de Gantt', body: 'gantt\n  title Launch\n  dateFormat YYYY-MM-DD\n  section Build\n  Parser :done, p1, 2026-10-01, 4d\n  Cards  :active, p2, after p1, 2w\n  section Ship\n  Tests  :crit, after p2, 1d\n  Release :milestone, after p2, 0d' },
  { id: 'timeline', en: 'Timeline', pt: 'Linha do tempo', body: 'timeline\n  title Social\n  section Early\n  2002 : LinkedIn\n  2004 : Facebook : Google\n  section Video\n  2005 : YouTube' },
  { id: 'journey', en: 'User journey', pt: 'Jornada do usuário', body: 'journey\n  title Day\n  section Work\n    Make tea: 5: Me\n    Do work: 1: Me, Cat' },
  { id: 'kanban', en: 'Kanban board', pt: 'Quadro kanban', body: "kanban\n  Todo\n    [Write docs]\n    id2[Ship it]@{ assigned: 'sverre', priority: 'High' }\n  Done\n    [Pie]@{ ticket: 'SK-1' }" },
  { id: 'mindmap', en: 'Mind map', pt: 'Mapa mental', body: 'mindmap\n  root((Skins))\n    Charts\n      Pie\n    [Themes]\n      Dark' },
  { id: 'quadrant', en: 'Quadrant chart', pt: 'Gráfico de quadrantes', body: 'quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Cold --> Hot\n  quadrant-1 Expand\n  A: [0.3, 0.6]\n  B: [0.9, 0.1]' },
  { id: 'radar', en: 'Radar chart', pt: 'Gráfico de radar', body: 'radar-beta\n  title Grades\n  axis m["Math"], s["Science"]\n  axis e["English"]\n  curve a["Alice"]{85, 90, 80}\n  curve b["Bob"]{70, 75, 95}\n  max 100\n  min 0' },
  { id: 'sankey', en: 'Sankey diagram', pt: 'Diagrama de Sankey', body: 'sankey-beta\nFarm,Mill,120\nMill,Bread,80\nMill,Waste,40' },
  { id: 'gitgraph', en: 'Git graph', pt: 'Gráfico de git', body: 'gitGraph\n  commit id: "init"\n  branch dev\n  checkout dev\n  commit id: "feat" type: HIGHLIGHT\n  checkout main\n  commit type: REVERSE\n  merge dev tag: "v1"' },
  { id: 'treemap', en: 'Treemap', pt: 'Treemap', body: 'treemap-beta\n"Compute"\n    "EC2": 420\n    "Lambda"\n        "Edge": 30\n        "Core": 10.5\n"Network": 75' },
  { id: 'packet', en: 'Packet diagram', pt: 'Diagrama de pacote', body: 'packet-beta\n  title UDP\n  0-15: "Source Port"\n  16-31: "Destination Port"\n  32: "Flag"\n  +7: "Rest"' },
  { id: 'block', en: 'Block diagram', pt: 'Diagrama de blocos', body: 'block-beta\n  columns 3\n  a["Web"] b["API"] c["Worker"]\n  space:3\n  d[("Postgres")] space:2\n  c --> d' },
  { id: 'architecture', en: 'Architecture diagram', pt: 'Diagrama de arquitetura', body: 'architecture-beta\n  group cloud(cloud)[Cloud]\n  service gateway(internet)[Gateway] in cloud\n  service api(server)[API] in cloud\n  service db(database)[Database] in cloud\n  gateway:R --> L:api\n  api:R --> L:db' },
  { id: 'c4', en: 'C4 context diagram', pt: 'Diagrama de contexto C4', body: 'C4Context\n  title Banking\n  Person(customer, "Customer", "Has accounts")\n  System(core, "Core", "Accounts")\n  Rel(customer, core, "Reads", "HTTPS")' },
]

const ALERTS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const

const TOOLS: readonly { kind: ToolKind; tool: string; target: string }[] = [
  { kind: 'read', tool: 'Read', target: 'docs/protocols.md' },
  { kind: 'write', tool: 'Edit', target: 'apps/hub/src/server.ts' },
  { kind: 'run', tool: 'Bash', target: 'pnpm test --filter hub' },
  { kind: 'search', tool: 'Grep', target: 'rateLimit' },
  { kind: 'web', tool: 'WebFetch', target: 'https://fastify.dev/docs' },
  { kind: 'mcp', tool: 'mcp__linear__get_issue', target: 'ENG-42' },
]

type Names = { en: string; pt: string; helpEn: string; helpPt: string }

const n = (en: string, pt: string, helpEn: string, helpPt: string): Names => ({ en, pt, helpEn, helpPt })

// A tree another mod can draw: plain data, so a press, a field or a surface module, whose
// closures stay in this mod, becomes its label as text, and every function is left out.
export function staticTree(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(staticTree)
  }

  if (node === null || typeof node !== 'object') {
    return typeof node === 'function' ? undefined : node
  }

  const element = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown }

  if (element.type === 'Button' || element.type === 'Input' || element.type === 'Select' || element.type === 'Client') {
    const label = String(element.props?.label ?? element.props?.placeholder ?? element.props?.key ?? '')

    return { type: 'Text', props: element.props?.dimColor === true ? { dimColor: true } : {}, children: [element.type === 'Button' ? `[ ${label} ]` : label] }
  }

  return Object.fromEntries(
    Object.entries(element)
      .filter(([key, value]) => key !== 'press' && typeof value !== 'function')
      .map(([key, value]) => [key, key === 'props' && value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, prop]) => typeof prop !== 'function')) : staticTree(value)]),
  )
}

export function skinsCatalog(look: Look, columns: number, lang: Lang): SkinsCatalogEntry[] {
  const { Text, Box } = look.ui
  const { palette } = look.skin
  const svg = look.svg
  const width = Math.max(40, columns - 4)
  const entries: SkinsCatalogEntry[] = []
  const add = (id: string, names: Names, tree: RenderElement) =>
    entries.push({ id, name: lang === 'pt' ? names.pt : names.en, help: lang === 'pt' ? names.helpPt : names.helpEn, tree })
  const desktopOnly = (where: string) => <Text color={palette.muted}>{lang === 'pt' ? `Só no desktop; ${where}.` : `Desktop only; ${where}.`}</Text>
  // A reply drawn the way skins draws it, from markdown.
  const reply = (text: string): RenderElement => {
    const segments = replySegments(text, look.prefs, look.surface)

    return segments === null ? <look.ui.Markdown text={text} /> : replyRows({ ...look, isFirstDraw: () => false }, segments, width, svg)
  }

  add('prompt-row-left', n('Your prompt, left', 'Seu prompt, à esquerda', 'The outline around your message on the terminal', 'A borda em volta da sua mensagem no terminal'), promptRow({ ...look, prefs: { ...look.prefs, prompt: 'left' } }, 'add rate limiting to the hub api'))
  add('prompt-row-right', n('Your prompt, right', 'Seu prompt, à direita', 'The same, on the right', 'O mesmo, à direita'), promptRow({ ...look, prefs: { ...look.prefs, prompt: 'right' } }, 'add rate limiting to the hub api'))
  add('prompt-row-plain', n('Your prompt, no outline', 'Seu prompt, sem borda', 'A leading marker instead of the outline', 'Um marcador na frente em vez da borda'), promptRow({ ...look, prefs: { ...look.prefs, prompt: 'plain' } }, 'add rate limiting to the hub api'))

  for (const { kind, tool, target } of TOOLS) {
    add(
      `tool-row-${kind}`,
      n(`Tool row: ${kind}`, `Linha de ferramenta: ${kind}`, `A finished ${tool} call, in the ${kind} colour`, `Uma chamada de ${tool} concluída, na cor ${kind}`),
      toolRow(look, { tool, input: {}, ...done }, kind, target, { ms: 380 }),
    )
  }

  add('tool-row-changes', n('Tool row with lines changed', 'Linha de ferramenta com linhas alteradas', 'An edit with +added −removed and its time', 'Uma edição com +adicionadas −removidas e o tempo'), toolRow(look, { tool: 'Edit', input: {}, ...done }, 'write', 'apps/hub/src/server.ts', { ms: 380, added: 18, removed: 3 }))
  add('tool-row-created', n('Tool row: file created this turn', 'Linha de ferramenta: arquivo criado neste turno', 'The target in the ok colour', 'O alvo na cor de sucesso'), toolRow(look, { tool: 'Write', input: {}, ...done }, 'write', 'apps/hub/src/limit.ts', { ms: 90, added: 24 }, undefined, 'created'))
  add('tool-row-edited', n('Tool row: file edited this turn', 'Linha de ferramenta: arquivo editado neste turno', 'The target in the warn colour', 'O alvo na cor de aviso'), toolRow(look, { tool: 'Edit', input: {}, ...done }, 'write', 'apps/hub/src/server.ts', { ms: 120, added: 2, removed: 1 }, undefined, 'edited'))
  add('tool-row-running', n('Tool row: running', 'Linha de ferramenta: rodando', 'A call still in flight', 'Uma chamada ainda em andamento'), toolRow(look, { tool: 'Read', input: {}, ...done, isRunning: true }, 'read', 'docs/protocols.md', {}))
  add('tool-row-failed', n('Tool row: failed', 'Linha de ferramenta: falhou', 'A call that errored; it opens by itself', 'Uma chamada com erro; ela abre sozinha'), toolRow(look, { tool: 'Edit', input: {}, ...done, isErrored: true }, 'write', 'apps/hub/src/server.ts', {}))
  add('tool-row-interrupted', n('Tool row: interrupted', 'Linha de ferramenta: interrompida', 'A call stopped before it finished', 'Uma chamada parada antes de terminar'), toolRow(look, { tool: 'Bash', input: {}, ...done, isInterrupted: true }, 'run', 'pnpm dev', {}))
  add(
    'tool-row-opened',
    n('Tool row, opened', 'Linha de ferramenta, aberta', 'The ▸ chevron opens a row onto its input and answer', 'A seta ▸ abre a linha mostrando a entrada e a resposta'),
    disclosedRow(look, toolRow(look, { tool: 'Read', input: {}, ...done }, 'read', 'docs/protocols.md', { ms: 40 }), true, () => undefined, <Text color={palette.muted}>{'  1  # Protocols\n  2  The hub draws every tab itself.'}</Text>),
  )
  add('tool-group', n('Folded group of reads and searches', 'Grupo dobrado de leituras e buscas', 'A run of read-only calls on one row', 'Uma sequência de chamadas só de leitura numa linha'), groupRow(look, [{ tool: 'Read', input: {}, ...done }, { tool: 'Read', input: {}, ...done }, { tool: 'Grep', input: {}, ...done }]))
  add('quiet-failure', n('Quiet output: a failure line', 'Saída silenciosa: linha de falha', 'With quiet output on, a failed read keeps its one error line', 'Com saída silenciosa, uma leitura que falhou mantém a linha de erro'), quietResult(look, 'ENOENT: no such file, open docs/missing.md'))

  add('diff-card', n('Edit diff card', 'Card de diff de edição', 'An edit as numbered old and new lines', 'Uma edição como linhas antigas e novas numeradas'), svg === undefined ? desktopOnly(lang === 'pt' ? 'o terminal mantém o diff do Claude Code' : "the terminal keeps Claude Code's diff") : diffCard(look, svg, DIFF, 'apps/hub/src/server.ts', width))

  if (svg === undefined) {
    add('shell-card-ok', n('Shell card: passed', 'Card do shell: passou', 'A command, its output and ✓', 'Um comando, a saída e ✓'), shellRows(look, 'pnpm test --filter hub', { stdout: 'Test Files  12 passed (12)\n     Tests  148 passed (148)', stderr: '', interrupted: false }, false, SHELL_FOLD))
    add('shell-card-failed', n('Shell card: failed with stderr', 'Card do shell: falhou com stderr', 'The exit code and stderr under its own label', 'O código de saída e o stderr com rótulo próprio'), shellRows(look, 'pnpm tsc', { stdout: 'src/server.ts', stderr: 'error TS2322: Type string is not assignable to number', interrupted: false, exitCode: 2 }, true, SHELL_FOLD))
    add('shell-card-folded', n('Shell card: long output folded', 'Card do shell: saída longa dobrada', 'The first 8 and last 4 lines, with ▾ N more', 'As 8 primeiras e 4 últimas linhas, com ▾ N more'), shellRows(look, 'seq 40', { stdout: Array.from({ length: 40 }, (_, i) => String(i + 1)).join('\n'), stderr: '', interrupted: false }, false, SHELL_FOLD))
    add('code-rows', n('Code block, highlighted', 'Bloco de código, realçado', 'A fence framed, its language on the frame', 'Um bloco emoldurado, com a linguagem na moldura'), codeRows(look, 'ts', CODE))
  } else {
    add('shell-card-ok', n('Shell card: passed', 'Card do shell: passou', 'A terminal card with the output and ✓', 'Um card de terminal com a saída e ✓'), terminalCard(look, svg, { stdout: 'Test Files  12 passed (12)\n     Tests  148 passed (148)', stderr: '', interrupted: false }, false, width))
    add('shell-card-failed', n('Shell card: failed', 'Card do shell: falhou', 'stderr in red under its own label', 'stderr em vermelho com rótulo próprio'), terminalCard(look, svg, { stdout: '', stderr: 'error TS2322: Type string is not assignable to number', interrupted: false }, true, width, 'copy-output-failed'))
    add('code-card', n('Code block card', 'Card de bloco de código', 'Language, line numbers, highlighting and Copy', 'Linguagem, números de linha, realce e Copiar'), codeCard(look, 'ts', CODE, svg, width))
  }

  add('table-card', n('Table card', 'Card de tabela', 'A markdown table: header rule, zebra rows, colour swatches', 'Uma tabela markdown: cabeçalho, linhas zebradas, amostras de cor'), replyRows({ ...look, isFirstDraw: () => false }, [TABLE], width, svg))
  add('diff-fence', n('Diff fence', 'Bloco de diff', 'A ```diff fence with + and − in the change colours', 'Um bloco ```diff com + e − nas cores de mudança'), reply('```diff\n--- a/src/limit.ts\n+++ b/src/limit.ts\n@@ -1,3 +1,3 @@\n export function limit(n: number) {\n-  return n < 10\n+  return n <= 10\n }\n```'))

  for (const chart of CHARTS) {
    add(`chart-${chart.id}`, n(`Chart: ${chart.en}`, `Gráfico: ${chart.pt}`, `A \`\`\`mermaid ${chart.body.split(/[\s\n]/)[0]} fence`, `Um bloco \`\`\`mermaid ${chart.body.split(/[\s\n]/)[0]}`), reply(fence(chart.body)))
  }

  add('math-display', n('Math: display formula', 'Matemática: fórmula em destaque', 'A $$…$$ block typeset: fractions, roots, sums with limits', 'Um bloco $$…$$ tipografado: frações, raízes, somas com limites'), reply('$$\n\\sum_{i=1}^{n} \\frac{x_i^2}{\\sqrt{n}}\n$$'))
  add('math-inline', n('Math: inline TeX', 'Matemática: TeX inline', '$…$ inside prose turns into Unicode', '$…$ no meio do texto vira Unicode'), reply('The ratio is $\\alpha \\leq \\frac{1}{2}$ for every $n \\geq 3$.'))

  for (const alert of ALERTS) {
    add(`alert-${alert.toLowerCase()}`, n(`Alert: ${alert}`, `Alerta: ${alert}`, `A > [!${alert}] block as a titled box`, `Um bloco > [!${alert}] como caixa com título`), reply(`> [!${alert}]\n> Keep the cache warm before a long break.`))
  }

  add('task-list', n('Task list', 'Lista de tarefas', '- [ ] items with ticks and a done count', 'Itens - [ ] com marcações e contagem de feitos'), reply('- [x] Parser\n- [x] Cards\n- [ ] Release notes'))
  add('prose-links', n('Prose with links, paths and numbers', 'Texto com links, caminhos e números', 'URLs as links; paths with :line, numbers and versions coloured', 'URLs como links; caminhos com :linha, números e versões coloridos'), reply('See https://fastify.dev and `apps/hub/src/server.ts:42`; v0.8.0 cut the p99 from 120ms to 45ms.'))

  const command = commandSegments('Total cost: $0.42\nTotal duration (API): 1m 12s\nTotal code changes: 18 lines added, 3 lines removed', 'cost')
  add('command-output', n('Command output card', 'Card de saída de comando', '/cost, /context and plugin output: key: value runs as a table', '/cost, /context e saída de plugins: pares chave: valor como tabela'), command === null ? <Text color={palette.muted}>/cost</Text> : replyRows({ ...look, isFirstDraw: () => false }, command, width, svg))

  if (svg === undefined) {
    add('spinner-row', n('Spinner', 'Spinner', "The skin's word with a band of light, and the elapsed time", 'A palavra do skin com uma faixa de luz, e o tempo decorrido'), spinnerRow(look, look.skin.spinner[0] ?? 'Working', 3, 12_000))
  } else {
    for (const [mode, en, pt] of [['thinking', 'Thinking', 'Pensando'], ['tool-use', 'Running pnpm test', 'Rodando pnpm test'], ['responding', 'Writing the reply', 'Escrevendo a resposta'], ['requesting', 'Waiting for the model', 'Esperando o modelo']] as const) {
      add(`spinner-${mode}`, n(`Spinner: ${mode}`, `Spinner: ${mode}`, 'An animated icon per phase of the turn', 'Um ícone animado para cada fase do turno'), desktopSpinnerRow(look, svg, mode, lang === 'pt' ? pt : en))
    }
  }

  const now = 0
  add('usage-band', n('Usage band', 'Faixa de uso', 'Context and plan-limit meters above the prompt, with Compact', 'Medidores de contexto e de limite acima do prompt, com Compactar'), usageBand(look, [{ label: 'context', percent: 42 }, { label: '5h', percent: 18 }, { label: '7d', percent: 7 }], true, () => undefined))
  add('usage-band-countdown', n('Usage band with reset countdowns', 'Faixa de uso com contagem para renovar', 'How long until each limit resets, to the second', 'Quanto falta para cada limite renovar, ao segundo'), usageBand(look, [{ label: 'context', percent: 42 }, { label: '5h', percent: 18, resets: '4h05m09s' }, { label: '7d', percent: 7, resets: '3d 4h05m09s' }], true, () => undefined))
  add('usage-band-nudge', n('Usage band, nudging to compact', 'Faixa de uso, sugerindo compactar', 'From 70% context: a warning and Compact now', 'A partir de 70% de contexto: um aviso e Compactar agora'), usageBand(look, [{ label: 'context', percent: 85 }, { label: '5h', percent: 61 }], true, () => undefined))
  add('usage-band-limits', n('Usage band, limits near the end', 'Faixa de uso, limites perto do fim', 'A meter turns warn from 80% and err from 95%', 'Um medidor fica de aviso a partir de 80% e de erro a partir de 95%'), usageBand(look, [{ label: 'context', percent: 30 }, { label: '5h', percent: 88 }, { label: '7d', percent: 97 }], false, () => undefined))

  for (const [id, state, en, pt] of [
    ['cache-warm', { phase: 'warm', coldAt: now + 42 * 60_000, warmUntil: null }, 'Cache countdown: warm', 'Contagem do cache: aquecido'],
    ['cache-soon', { phase: 'warm', coldAt: now + 6 * 60_000, warmUntil: null }, 'Cache countdown: going cold soon', 'Contagem do cache: esfriando logo'],
    ['cache-kept', { phase: 'warm', coldAt: now + 42 * 60_000, warmUntil: now + 5 * 3600_000 }, 'Cache countdown: kept warm', 'Contagem do cache: mantido aquecido'],
    ['cache-cold', { phase: 'cold', coldAt: null, warmUntil: null }, 'Cache countdown: cold', 'Contagem do cache: frio'],
  ] as const) {
    add(id, n(en, pt, "cache-tax's countdown in the usage band", 'A contagem do cache-tax na faixa de uso'), usageBand(look, [{ label: 'context', percent: 42 }], false, () => undefined, cacheLine(state, now)))
  }

  add('ask-band', n('Band above a question', 'Faixa acima de uma pergunta', 'The questions of an AskUserQuestion dialog, as tabs', 'As perguntas de um diálogo AskUserQuestion, como abas'), askBand(look, ['Approach', 'Store']))
  add('turn-footer', n('Turn footer', 'Rodapé do turno', "The line that closes a turn: the skin's word, time, tools and lines (terminal)", 'A linha que fecha um turno: palavra do skin, tempo, ferramentas e linhas (terminal)'), footerRow(look, look.skin.done[0] ?? 'Done', 41_000, { tools: 6, added: 18, removed: 3 }))
  add('palette', n('The skin’s palette', 'A paleta do skin', 'Every colour slot of the active skin', 'Cada cor do skin ativo'), (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {Object.entries(palette).map(([slot, color]) => (
        <Box key={`palette-${slot}`} flexDirection="row" columnGap={1} width={18}>
          <Text backgroundColor={color}>{'   '}</Text>
          <Text color={palette.muted}>{slot}</Text>
        </Box>
      ))}
    </Box>
  ))

  return entries
}
