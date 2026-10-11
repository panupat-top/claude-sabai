import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]
const STOCK: RenderElement = { type: 'Text', props: {}, children: ['stock row'] }
const NOW = Date.parse('2026-10-10T00:00:00Z')

// Answers every noun the band calls, as a session would. `failing` lists commands that are
// missing or fail on this machine (no node, no upstream, not a repository).
function engine(on: On, { hasLimits = true, store = {} as Record<string, unknown>, failing = [] as string[], completeText = '' } = {}) {
  const branch = { name: 'main' }
  const runs: string[] = []
  const clock = mock.clock(on, { now: NOW })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))
  const out = (): Record<string, string> => ({
    'git branch --show-current': `${branch.name}\n`,
    'git status --porcelain': ' M a.ts\n?? b.ts\n',
    'git config user.name': 'Panupat\n',
    'node --version': 'v24.1.0\n',
    'git rev-list --left-right --count @{upstream}...HEAD': '1\t2\n',
  })
  const inits: ({ timeoutMs?: number } | undefined)[] = []
  on('process.run', ($, e) => {
    const cmd = e.argv.join(' ')
    runs.push(cmd)
    inits.push(e.init)
    const fails = failing.some(f => cmd.startsWith(f))
    return { value: { exitCode: fails ? 1 : 0, stdout: fails ? '' : (out()[cmd] ?? ''), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.complete', () => ({ text: completeText }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, tokens: 24_500, percent: 12 },
      rateLimits: hasLimits
        ? [
            { kind: 'five_hour', percentUsed: 7, resetsAt: '2026-10-10T02:49:00Z' },
            { kind: 'seven_day', percentUsed: 3, resetsAt: '2026-10-16T02:00:00Z' },
          ]
        : [],
    },
  }))
  on('command.register', () => ({ value: { command: 'sabai-settings' } }))
  const commands: string[] = []
  on('command.list', () => ({
    value: ['clear', 'compact', 'resume', 'help'].map(name => ({ name, description: '', source: 'builtin' as const })),
  }))
  on('command.run', ($, e) => {
    commands.push(e.command)
    return { text: '' }
  })
  on('ui.render', () => STOCK)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', ($, e) => {
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(e.subject.length), subject: e.subject } } }
    if (e.tool === 'TaskUpdate') return { result: { success: true, taskId: e.taskId, updatedFields: [] } }
    return { result: {} }
  })
  return { runs, clock, branch, store, commands, inits }
}

// git and node are read in the background; tests let that settle before looking.
const later = (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout
const settle = () => new Promise<void>(resolve => later(resolve, 5))
const start = async ($: Engine) => {
  const started = await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await settle()
  return started
}

const mountBand = ($: Engine, surface: Surface, isWorking = false) =>
  $.ui.mount({
    plugin: 'sabai',
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    viewport: { columns: 120, rows: 30 },
    props: { hasSurvey: false, isWorking, maxRows: 8, bodyColumns: 115, scroll: { offset: 0, bodyRows: 8 }, view: {} },
  })

// Everything the band shows as words: the desktop's drawings by their alt, and every Text.
async function shown($: Engine, surface: Surface, isWorking = false) {
  const ui = await mountBand($, surface, isWorking)
  const svgs = await ui.findAll({ type: 'Svg' })
  const texts = await ui.findAll({ type: 'Text' })
  const buttons = await ui.findAll({ type: 'Button' })
  await ui.unmount()
  return {
    words: [...svgs.map(s => String(s.props.alt)), ...texts.map(t => t.text)].join(' | '),
    buttons: buttons.length,
    svgs: svgs.length,
  }
}

const measure = ($: Engine, percent: number) =>
  $.session.measure({
    context: { window: 1_000_000, tokens: percent * 10_000 + 4_500, percent },
    rateLimits: [{ kind: 'five_hour', percentUsed: 18, resetsAt: '2026-10-10T01:00:00Z' }],
    changed: ['context', 'rateLimits'],
  })

test('the info row leads with directory, git user and branch, node at the right', async ($, on) => {
  engine(on)
  await start($)
  expect((await shown($, 'desktop')).words).toMatch(/^Directory work, Git user Panupat, Branch main ↑2 ↓1 ±2, Node v24\.1\.0; Context/)
  const terminal = (await shown($, 'terminal')).words
  expect(terminal).toMatch(/^▤ work \|.*◆ Panupat \|.*⎇ main ↑2 ↓1 ±2 \|.*⬢ v24\.1\.0 \|.*CONTEXT/)
})

test('what a machine cannot tell is hidden: no node, no upstream, no repository', async ($, on) => {
  engine(on, { failing: ['node', 'git'] })
  await start($)
  const words = (await shown($, 'desktop')).words
  expect(words).toMatch(/^Directory work; Context/)
  expect(words).not.toContain('Node')
  expect(words).not.toContain('Branch')
})

test('the branch follows a turn of the main conversation', async ($, on) => {
  const { branch } = engine(on)
  await start($)
  branch.name = 'feature/band'
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })
  await settle()
  expect((await shown($, 'desktop')).words).toContain('Branch feature/band ↑2 ↓1 ±2, Node')
})

test('the tick re-reads git status only when the branch has changed', async ($, on) => {
  const { branch, clock, runs } = engine(on)
  await start($)
  const statuses = () => runs.filter(r => r === 'git status --porcelain').length
  expect(statuses()).toBe(1)
  await clock.advance(30_000)
  expect(statuses()).toBe(1)
  branch.name = 'other'
  await clock.advance(30_000)
  expect(statuses()).toBe(2)
  expect((await shown($, 'desktop')).words).toContain('Branch other')
})

test('with nothing to show the band is left to the engine', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toBe('stock row')
})

test('a fresh load shows every meter with its countdown, and the toolbar', async ($, on) => {
  engine(on)
  await start($)
  const desktop = await shown($, 'desktop')
  expect(desktop.svgs).toBe(1)
  expect(desktop.words).toContain(
    'Context 24.5k / 200k (12%); 5H Limit 7%, resets in 2h 49m; 7D All 3%, resets in 6d 2h',
  )
  expect(desktop.words).toContain('stock row')
  expect(desktop.buttons).toBe(4)
  const terminal = await shown($, 'terminal')
  expect(terminal.svgs).toBe(0)
  expect(terminal.words).toMatch(/5H LIMIT .*7%.*↻ 2h 49m/)
  expect(terminal.words).toContain('7D ALL')
  expect(terminal.words).toContain('24.5k / 200k (12%)')
  expect(terminal.buttons).toBe(4)
})

test('before the engine has a plan reading, 5H and 7D stay hidden', async ($, on) => {
  engine(on, { hasLimits: false })
  await start($)
  const words = (await shown($, 'desktop')).words
  expect(words).toContain('Context 24.5k / 200k (12%)')
  expect(words).not.toContain('5H')
  expect(words).not.toContain('7D')
})

test('countdowns tick between responses', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await clock.advance(30 * 60_000)
  expect((await shown($, 'desktop')).words).toContain('5H Limit 7%, resets in 2h 19m')
})

test('measurements update the context as tokens over the window', async ($, on) => {
  engine(on)
  await start($)
  await measure($, 43)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toContain('434.5k / 1M (43%)')
})

test('tasks fill the progress row and leave once all are done', async ($, on) => {
  engine(on)
  await $.tool.call({ tool: 'TaskCreate', subject: 'a', description: '', activeForm: 'Doing a' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'bb', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  expect((await shown($, 'desktop')).words).toContain('Doing a: 0/2 tasks, 0%')
  expect((await shown($, 'terminal')).words).toMatch(/Doing a.*0\/2.*0%/)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  expect((await shown($, 'desktop')).words).toContain('bb: 1/2 tasks, 50%')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'completed' })
  expect((await shown($, 'desktop')).words).not.toContain('tasks,')
})

test('TodoWrite drives the progress row too', async ($, on) => {
  engine(on)
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'a', status: 'completed', activeForm: 'Doing a' },
      { content: 'b', status: 'in_progress', activeForm: 'Doing b' },
    ],
  })
  expect((await shown($, 'desktop')).words).toContain('Doing b: 1/2 tasks, 50%')
})

const settingsCommand = ($: Engine) =>
  $.command.run({ command: 'sabai-settings', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })

test('Clawd takes the skin colour and walks only while the turn works', async ($, on) => {
  engine(on, { store: { skin: 'dracula' } })
  await start($)
  await $.tool.call({ tool: 'TaskCreate', subject: 'a', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  const source = async (isWorking: boolean) => {
    const ui = await mountBand($, 'desktop', isWorking)
    const svg = (await ui.find({ type: 'Svg' })) as { props: { source: string } } | undefined
    await ui.unmount()
    return svg?.props.source ?? ''
  }
  expect(await source(false)).toContain('shape-rendering="crispEdges" class="idle"')
  expect(await source(true)).toContain('shape-rendering="crispEdges" class="run"')
  expect(await source(true)).toContain('fill="#ffb86c"')
})

test('a saved skin comes back with the next session', async ($, on) => {
  engine(on, { store: { skin: 'dracula' } })
  await start($)
  const ui = await mountBand($, 'desktop')
  const svg = (await ui.find({ type: 'Svg' })) as { props: { source: string } } | undefined
  expect(svg?.props.source).toContain('.p{fill:#282a36}')
})

// The agents pane, opened and closed through the engine's own ui noun.
const opened: { id: string; focus?: true; closeOnEscape?: true }[] = []

function panes(on: On) {
  const open = new Set<string>()
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: 'Agents', isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.open', ($, e) => {
    opened.push(e)
    open.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  on('agent.spawn', ($, e) => ({ model: 'claude-sonnet-5-5', agentId: `agent-${e.description}` }))
  return open
}

const agentsCommand = ($: Engine) =>
  $.command.run({ command: 'sabai-agents', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })

const spawn = ($: Engine, description: string) =>
  $.agent.spawn({
    tool_use_id: `tu-${description}`,
    prompt: 'go',
    description,
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })

const mountPane = ($: Engine, surface: Surface, requestId = 'sabai-agents') =>
  $.ui.mount({
    plugin: 'sabai',
    surface,
    component: 'Pane',
    requestId,
    viewport: { columns: 120, rows: 30 },
    props: { title: 'Agents', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })

test('/sabai-agents opens the panel and closes it again', async ($, on) => {
  engine(on)
  const open = panes(on)
  await start($)
  expect((await agentsCommand($)).text).toBe('Agents panel opened.')
  expect([...open]).toEqual(['sabai-agents'])
  expect((await agentsCommand($)).text).toBe('Agents panel closed.')
  expect([...open]).toEqual([])
})

test('a subagent shows running with its clock, then done when its turn ends', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  await spawn($, 'api routes')
  await clock.advance(64_000)
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    const words = [...(await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)), ...(await ui.findAll({ type: 'Text' })).map(t => t.text)].join(' | ')
    await ui.unmount()
    expect(words).toMatch(/api routes/)
    expect(words).toMatch(/1m 4s/)
    expect(words).toMatch(/sonnet 5\.5/)
  }
  await $.turn.complete({ turnId: 'sub', agentId: 'agent-api routes', answer: '', durationMs: 64_000, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  const alts = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))
  expect(alts).toContain('api routes: Explore, sonnet 5.5, done, 1m 4s')
})

test('/sabai-settings opens the settings panel and closes it again', async ($, on) => {
  engine(on)
  const open = panes(on)
  await start($)
  expect((await settingsCommand($)).text).toBe('Settings panel opened.')
  expect([...open]).toEqual(['sabai-skins'])
  expect(opened.at(-1)).toMatchObject({ id: 'sabai-skins', focus: true, closeOnEscape: true })
  expect((await settingsCommand($)).text).toBe('Settings panel closed.')
  expect([...open]).toEqual([])
})

test('the skins panel previews every skin and a press switches to it', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountPane($, surface, 'sabai-skins')
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.filter(b => b.text === 'Use')).toHaveLength(9)
    expect(await ui.find({ text: '✓ In use' })).toBeDefined()
    // Ten skin swatches and one preview of the chosen bar style.
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(surface === 'desktop' ? 10 + 1 : 0)
    // The engine draws nothing of a tree past 100,000 characters.
    expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
    await ui.unmount()
  }
  const ui = await mountPane($, 'desktop', 'sabai-skins')
  await ui.press({ key: 'use-dracula' })
  expect(store.skin).toBe('dracula')
  expect(await ui.find({ key: 'use-dracula' })).toBeUndefined()
  expect(await ui.find({ key: 'use-auto' })).toBeDefined()
  const previews = (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]
  const dracula = previews.find(p => p.props.alt === 'Dracula skin colours')
  expect(dracula?.props.source).toContain('.p{fill:#282a36}')
  expect(dracula?.props.source).toContain('class="run"')
})

test('the toolbar opens the agents and skins panels and counts running agents', async ($, on) => {
  engine(on)
  const open = panes(on)
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountBand($, surface)
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.every(b => b.props.plain === undefined)).toBe(true)
    expect(buttons.map(b => b.text)).toEqual(['/compact', '/resume', '▐✻▌ Agents', '▐⚙▌ Settings'])
    // What the desktop draws: the label alone, framed like the commands, with no keycap.
    expect(buttons.map(b => b.props.label)).toEqual(['/compact', '/resume', '✻ Agents', '⚙\uFE0E Settings'])
    expect(buttons.slice(2).map(b => [b.props.variant, b.props.hotkey])).toEqual([['secondary', undefined], ['secondary', undefined]])
    await ui.unmount()
  }
  const ui = await mountBand($, 'desktop')
  await ui.press({ key: 'agents' })
  await ui.press({ key: 'skins' })
  expect([...open]).toEqual(['sabai-agents', 'sabai-skins'])
  await ui.press({ key: 'agents' })
  expect([...open]).toEqual(['sabai-skins'])
  await spawn($, 'scan')
  await spawn($, 'read')
  // While agents work the button says how many, and stands out.
  const agents = await ui.find({ key: 'agents' })
  expect([agents?.text, agents?.props.label, agents?.props.variant]).toEqual(['▐✻▌ Agents · 2', '✻ Agents · 2', 'primary'])
})

test('the toolbar runs common commands, only those this surface offers', async ($, on) => {
  const { clock, commands } = engine(on)
  await start($)
  const ui = await mountBand($, 'desktop')
  expect(await ui.find({ key: 'run-rewind' })).toBeUndefined()
  await ui.press({ key: 'run-compact' })
  await clock.advance(1)
  expect(commands).toEqual(['compact'])
})

test('the skins panel picks a bar style for the band', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  expect((await pane.find({ key: 'bar-dither' }))?.props.label).toBe('✓ Dither')
  await pane.press({ key: 'bar-blocks' })
  expect(store.bar).toBe('blocks')
  expect((await pane.find({ key: 'bar-blocks' }))?.props.label).toBe('✓ Pixel blocks')
  expect((await pane.find({ key: 'bar-dither' }))?.props.label).toBe('Dither')
  const band = await mountBand($, 'desktop')
  const svg = (await band.find({ type: 'Svg' })) as { props: { source: string } } | undefined
  expect(svg?.props.source).not.toMatch(/class="d[0-3]"/)
  expect(svg?.props.source).toContain('rx="1.5"')
})

test('a saved bar style comes back with the next session', async ($, on) => {
  engine(on, { store: { bar: 'solid' } })
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  expect((await pane.find({ key: 'bar-solid' }))?.props.label).toBe('✓ Solid')
})

test('a skin leaves the band on the surface’s own background, as auto does', async ($, on) => {
  engine(on, { store: { skin: 'dracula' } })
  await start($)
  const ui = await mountBand($, 'desktop')
  const tree = (await ui.drawn()) as { props: { backgroundColor?: string; borderStyle?: string } }
  expect([tree.props.backgroundColor, tree.props.borderStyle]).toEqual([undefined, undefined])
})

test('a subagent’s own task list goes to its card, never the band; the band keeps the main list', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'scan')
  await $.tool.call({ tool: 'TaskCreate', subject: 'main work', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: String('main work'.length), status: 'in_progress' })
  // agentId rides along on a hook's event; the typed call input only admits it from a variable
  const sub = {
    tool: 'TodoWrite' as const,
    agentId: 'agent-scan',
    todos: [
      { content: 'read', status: 'completed' as const, activeForm: 'Reading' },
      { content: 'sum up', status: 'in_progress' as const, activeForm: 'Summing up' },
    ],
  }
  await $.tool.call(sub)
  const band = await shown($, 'desktop')
  expect(band.words).toContain('main work')
  expect(band.words).not.toContain('Summing up')
  const ui = await mountPane($, 'desktop')
  const cards = (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string } }[]
  expect(cards.some(c => c.props.source.includes('>Summing up<') && c.props.source.includes('>1/2<'))).toBe(true)
})

test('an empty panel invites a first agent on both surfaces', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await mountPane($, surface)
    const words = [...(await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)), ...(await ui.findAll({ type: 'Text' })).map(t => t.text)].join(' | ')
    await ui.unmount()
    expect(words).toMatch(/No subagents yet/)
  }
})

test('finished agents start folded; Show, Hide and Clear work and running ones stay', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'live')
  await spawn($, 'old')
  await $.turn.complete({ turnId: 't', agentId: 'agent-old', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  const alts = async () => (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(false)
  expect((await ui.find({ key: 'toggle-finished' }))?.props.label).toBe('▸ Show')
  await ui.press({ key: 'toggle-finished' })
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(true)
  expect((await ui.find({ key: 'toggle-finished' }))?.props.label).toBe('▾ Hide')
  await ui.press({ key: 'clear-finished' })
  expect((await alts()).some(a => a.startsWith('old:'))).toBe(false)
  expect((await alts()).some(a => a.startsWith('live:'))).toBe(true)
  expect(await ui.find({ key: 'clear-finished' })).toBeUndefined()
})

test('the terminal lists the same groups as text with buttons', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'live')
  await spawn($, 'old')
  await $.turn.complete({ turnId: 't', agentId: 'agent-old', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'toggle-finished' })
  const text = (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
  expect(text).toMatch(/RUNNING · 1/)
  expect(text).toMatch(/FINISHED · 1/)
  expect(text).toMatch(/live/)
  expect(text).toMatch(/Explore · sonnet 5\.5/)
  expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
})

test('forty agents with results open stay under the engine’s tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 40; i++) {
    await spawn($, `job ${i}`)
    if (i >= 2) await $.turn.complete({ turnId: `t${i}`, agentId: `agent-job ${i}`, answer: 'r'.repeat(5000), durationMs: 10, isAborted: false, reason: 'answer' })
  }
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  for (const b of await ui.findAll({ type: 'Button' })) if (String(b.props.key).startsWith('result-')) await ui.press({ key: String(b.props.key) })
  expect(await ui.find({ type: 'Text', text: /^\+ \d+ more$/ })).toBeDefined()
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
})

test('a subagent’s answer and failure reason are kept for its Result', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'ok')
  await spawn($, 'bad')
  await $.turn.complete({ turnId: 't1', agentId: 'agent-ok', answer: 'Found 3 launches.', durationMs: 10, isAborted: false, reason: 'answer' })
  await $.turn.complete({ turnId: 't2', agentId: 'agent-bad', answer: '', durationMs: 10, isAborted: true, reason: 'aborted' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  await ui.press({ key: 'result-agent-ok' })
  expect(await ui.find({ type: 'Markdown', text: 'Found 3 launches.' })).toBeDefined()
  expect((await ui.find({ key: 'result-agent-ok' }))?.props.label).toBe('▾ Report')
  await ui.press({ key: 'result-agent-bad' })
  expect(await ui.find({ type: 'Markdown', text: 'Stopped before it finished.' })).toBeDefined()
})

test('a wide pane in pixel blocks with eight finished agents open stays under the tree limit', async ($, on) => {
  engine(on, { store: { bar: 'blocks' } })
  panes(on)
  await start($)
  for (let i = 0; i < 12; i++) {
    await spawn($, `job ${i}`)
    if (i >= 2) await $.turn.complete({ turnId: `t${i}`, agentId: `agent-job ${i}`, answer: 'r'.repeat(5000), durationMs: 10, isAborted: false, reason: 'answer' })
  }
  const ui = await $.ui.mount({
    plugin: 'sabai',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'sabai-agents',
    viewport: { columns: 400, rows: 60 },
    props: { title: 'Agents', isFocused: false, bodyColumns: 400, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
  })
  await ui.press({ key: 'toggle-finished' })
  for (const b of await ui.findAll({ type: 'Button' })) if (String(b.props.key).startsWith('result-')) await ui.press({ key: String(b.props.key) })
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
})

test('the band shows the crew while agents work, on both surfaces, and drops it once cleared', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'scan the hooks')
  const desktop = await shown($, 'desktop')
  expect(desktop.words).toContain('Agents: 1 running; scan the hooks')
  const terminal = await shown($, 'terminal')
  expect(terminal.words).toMatch(/1 running/)
  expect(terminal.words).toMatch(/scan the hooks/)
  await $.turn.complete({ turnId: 't', agentId: 'agent-scan the hooks', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop')).words).toContain('Agents: 1 done; All 1 done')
  const pane = await mountPane($, 'desktop')
  await pane.press({ key: 'clear-finished' })
  expect((await shown($, 'desktop')).words).not.toContain('Agents:')
})

test('a finished agent’s Report button opens its report as Markdown; the card sets no colour its text cannot follow', async ($, on) => {
  engine(on, { store: { skin: 'dracula' } })
  panes(on)
  await start($)
  await spawn($, 'ok')
  await $.turn.complete({ turnId: 't', agentId: 'agent-ok', answer: '## Found\n- three launches', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  expect((await ui.find({ key: 'result-agent-ok' }))?.props.label).toBe('Report')
  expect(await ui.find({ type: 'Text', text: '🔍 ok' })).toBeDefined()
  // Native titles and Markdown take the OS theme's ink, so no Box behind them may force a colour.
  expect(JSON.stringify(await ui.drawn())).not.toContain('"backgroundColor"')
  await ui.press({ key: 'result-agent-ok' })
  expect((await ui.find({ type: 'Markdown' }))?.props.text).toBe('## Found\n- three launches')
})

test('one report is open at a time', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (const name of ['a', 'b']) {
    await spawn($, name)
    await $.turn.complete({ turnId: name, agentId: `agent-${name}`, answer: `report ${name}`, durationMs: 10, isAborted: false, reason: 'answer' })
  }
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  await ui.press({ key: 'result-agent-a' })
  await ui.press({ key: 'result-agent-b' })
  expect((await ui.findAll({ type: 'Markdown' })).map(m => m.props.text)).toEqual(['report b'])
})

test('a running agent has its title and no Report button; once it ends, Report appears', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'scan')
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ key: 'result-agent-scan' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '🔍 scan' })).toBeDefined()
  await $.turn.complete({ turnId: 't', agentId: 'agent-scan', answer: 'done.', durationMs: 10, isAborted: false, reason: 'answer' })
  await ui.press({ key: 'toggle-finished' })
  expect((await ui.find({ key: 'result-agent-scan' }))?.props.label).toBe('Report')
})

test('a wide fan-out of running agents shows the newest few and counts the rest, under the tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 20; i++) {
    await spawn($, `job ${i}`)
    await $.tool.call({ tool: 'TodoWrite', agentId: `agent-job ${i}`, todos: [
      { content: 'a', status: 'completed', activeForm: 'A' }, { content: 'b', status: 'in_progress', activeForm: 'B' }, { content: 'c', status: 'pending', activeForm: 'C' },
    ] } as Parameters<typeof $.tool.call>[0])
  }
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: '+ 14 more running' })).toBeDefined()
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
})

test('the terminal crew says 1 step, and counts failed agents apart from done ones', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'a')
  await spawn($, 'b')
  await $.turn.complete({ turnId: 'a', agentId: 'agent-a', answer: '', durationMs: 10, isAborted: true, reason: 'aborted' })
  await $.turn.complete({ turnId: 'b', agentId: 'agent-b', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  expect((await shown($, 'terminal')).words).toMatch(/1 done · 1 failed/)
})

// One model request of a subagent, answered by a stub beneath the plugin as the model would.
function steps(on: On) {
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'claude-haiku-5-5', input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 30_000, cache_creation_input_tokens: 500 },
    }
  })
}
const step = async ($: Engine, agentId: string, effort?: 'low' | 'high' | 'xhigh' | number) => {
  const stream = $.turn.step({ turnId: `t-${agentId}`, index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId, ...(effort === undefined ? {} : { effort }) })
  for await (const _ of stream) void _
  return stream.result
}

test('an agent’s whole life through the hooks: spawn, steps with effort, own tasks, answer', async ($, on) => {
  engine(on)
  panes(on)
  steps(on)
  await start($)
  await spawn($, 'survey')
  const cardOf = async () => {
    const ui = await mountPane($, 'desktop')
    await ui.press({ key: 'toggle-finished' }).catch(() => undefined)
    const svgs = (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]
    const card = svgs.find(s => s.props.alt.startsWith('survey:'))
    await ui.unmount()
    return card?.props.source ?? ''
  }
  // Two model requests: the step count, the latest context, the model and the effort follow.
  await step($, 'agent-survey', 'xhigh')
  await step($, 'agent-survey', 'xhigh')
  let card = await cardOf()
  expect(card).toContain('>2 steps<')
  expect(card).toContain('32k ctx')
  expect(card).toContain('Explore · haiku 5.5')
  expect(card).toContain('>xhigh<')
  // A numeric effort is a thinking budget.
  await step($, 'agent-survey', 32_000)
  expect(await cardOf()).toContain('>budget 32k<')
  // The agent's own task list drives its bar and pill; the band's row stays empty.
  await $.tool.call({ tool: 'TaskCreate', subject: 'Read', description: '', agentId: 'agent-survey' } as Parameters<typeof $.tool.call>[0])
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write up', description: '', agentId: 'agent-survey' } as Parameters<typeof $.tool.call>[0])
  await $.tool.call({ tool: 'TaskUpdate', taskId: String('Read'.length), status: 'completed', agentId: 'agent-survey' } as Parameters<typeof $.tool.call>[0])
  card = await cardOf()
  expect(card).toContain('>1/2<')
  expect((await shown($, 'desktop')).words).not.toMatch(/tasks, \d+%/)
  // A step of the main conversation (no agentId) touches no card.
  const before = await cardOf()
  await step($, '')
  expect(await cardOf()).toBe(before)
  // The answer ends the run: a check, the report behind its title.
  await $.turn.complete({ turnId: 't-agent-survey', agentId: 'agent-survey', answer: '## Found\n- 154 lines', durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  await ui.press({ key: 'result-agent-survey' })
  expect((await ui.find({ type: 'Markdown' }))?.props.text).toBe('## Found\n- 154 lines')
})

test('a workflow agent is marked as one on its card', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await $.agent.spawn({
    tool_use_id: 'tu-wf', prompt: 'go', description: 'fan out', subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5', background: false, fork: false, workflow: { runId: 'wf_1', agentIndex: 1 },
  })
  const ui = await mountPane($, 'desktop')
  const svgs = (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]
  const source = svgs.find(s => s.props.alt.startsWith('fan out:'))?.props.source
  expect(source).toContain('>general-purpose · sonnet 5.5<')
  expect(source).toContain('>workflow · 0 steps<')
})

test('a remote workflow agent with no loop of its own gets no card that would never end', async ($, on) => {
  engine(on)
  // A remote workflow agent: started, but with no agentId, since it has no local loop.
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5' }))
  await start($)
  await spawn($, 'remote')
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Svg', text: /remote/ })).toBeUndefined()
  expect((await shown($, 'desktop')).words).not.toContain('Agents:')
})

test('six running and eight fresh finished agents with a report open still fit the tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 14; i++) {
    await spawn($, `job ${i}`)
    await $.tool.call({ tool: 'TodoWrite', agentId: `agent-job ${i}`, todos: [
      { content: 'a', status: 'completed', activeForm: 'A' }, { content: 'b', status: 'in_progress', activeForm: 'B' },
    ] } as Parameters<typeof $.tool.call>[0])
  }
  for (let i = 6; i < 14; i++) await $.turn.complete({ turnId: `t${i}`, agentId: `agent-job ${i}`, answer: 'r'.repeat(5000), durationMs: 10, isAborted: false, reason: 'answer' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'toggle-finished' })
  await ui.press({ key: 'result-agent-job 13' })
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
})

test('git runs with a timeout, and the band follows the session to a new folder', async ($, on) => {
  const { clock, inits } = engine(on)
  let place = '/work'
  on('session.cwd', () => ({ value: place }))
  await start($)
  expect(inits.length).toBeGreaterThan(0)
  expect(inits.every(i => i?.timeoutMs === 5000)).toBe(true)
  place = '/elsewhere/other-project'
  await clock.advance(30_000)
  await settle()
  expect((await shown($, 'desktop')).words).toContain('Directory other-project')
})

test('the crew row leaves the band a minute after the last agent ends', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  await spawn($, 'quick job')
  await $.turn.complete({ turnId: 't', agentId: 'agent-quick job', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop')).words).toContain('Agents: 1 done')
  await clock.advance(90_000)
  expect((await shown($, 'desktop')).words).not.toContain('Agents:')
  expect((await shown($, 'terminal')).words).not.toMatch(/All 1 done/)
})

test('settings: each band row can be hidden, and the choice is kept', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  for (const key of ['info', 'tasks', 'crew', 'usage', 'toolbar', 'notify', 'limits', 'guard', 'steps']) expect([key, await pane.find({ key: `pref-${key}` })]).not.toEqual([key, undefined])
  expect((await pane.find({ key: 'pref-usage' }))?.props.label).toBe('● On')
  await pane.press({ key: 'pref-usage' })
  await pane.press({ key: 'pref-toolbar' })
  expect((await pane.find({ key: 'pref-usage' }))?.props.label).toBe('○ Off')
  const band = await shown($, 'desktop')
  expect(band.words).not.toContain('Context 24.5k')
  expect(band.buttons).toBe(0)
  expect((store.prefs as { rows: { usage: boolean } }).rows.usage).toBe(false)
})

test('a long turn and a failed agent send a notification; a plan limit past 90% warns once per window', async ($, on) => {
  engine(on)
  panes(on)
  const notes: string[] = []
  const toasts: string[] = []
  on('ui.notify', ($, e) => {
    notes.push(e.text)
    return { value: { isSent: true, channel: 'terminal' } } as never
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await start($)
  await $.turn.complete({ turnId: 'short', answer: '', durationMs: 5_000, isAborted: false, reason: 'answer' })
  await $.turn.complete({ turnId: 'long', answer: '', durationMs: 125_000, isAborted: false, reason: 'answer' })
  await spawn($, 'risky')
  await $.turn.complete({ turnId: 'r', agentId: 'agent-risky', answer: '', durationMs: 10, isAborted: false, reason: 'error' })
  await settle()
  expect(notes).toEqual(['Finished in 2m 5s', 'risky failed: Ended with an error.'])
  const at = (percentUsed: number) =>
    $.session.measure({ context: { window: 1_000_000, tokens: 1000, percent: 1 }, rateLimits: [{ kind: 'five_hour', percentUsed, resetsAt: '2026-10-10T05:00:00Z' }], changed: ['rateLimits'] })
  await at(85)
  await at(92)
  await at(95)
  await settle()
  expect(toasts).toEqual(['5H limit at 92% — resets in 5h 0m'])
})

test('the guard, once turned on, refuses a risky command and says why', async ($, on) => {
  engine(on)
  panes(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  const run = (command: string) => $.tool.call({ tool: 'Bash', command, description: '' } as Parameters<typeof $.tool.call>[0])
  expect((await run('rm -rf /')).deny).toBeUndefined()
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await pane.press({ key: 'pref-guard' })
  expect((await run('rm -rf /')).deny).toMatch(/deletes the whole disk/)
  expect((await run('ls')).deny).toBeUndefined()
})

const guardOn = async ($: Engine) => {
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await pane.press({ key: 'pref-guard' })
  return pane
}
const bash = ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command, description: '' } as Parameters<typeof $.tool.call>[0])
// The permission decision for a real Bash call: the guard's Ask answers here.
let checks = 0
const check = async ($: Engine, command: string) =>
  (await $.tool.check({ tool: 'Bash', input: { command }, tool_use_id: `c${++checks}` } as never)) as { decision: string; reason?: string }
const allowBeneath = (on: On) => on('tool.check', () => ({ decision: 'allow' as const }))

test('each guard rule blocks, asks or passes as Settings say', async ($, on) => {
  engine(on)
  panes(on)
  allowBeneath(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  const pane = await guardOn($)
  // Defaults: wipe and env block; force and discard ask.
  expect((await bash($, 'rm -rf /')).deny).toMatch(/deletes the whole disk/)
  expect((await bash($, 'git reset --hard')).deny).toBeUndefined()
  expect(await check($, 'git reset --hard')).toEqual({ decision: 'ask', reason: expect.stringMatching(/throws away uncommitted work/) })
  expect((await check($, 'rm -rf /')).decision).toBe('allow')
  expect((await check($, 'ls')).decision).toBe('allow')
  // Discard set to Block, wipe set to Off.
  await pane.press({ key: 'guard-discard-block' })
  await pane.press({ key: 'guard-wipe-off' })
  expect((await bash($, 'git reset --hard')).deny).toMatch(/throws away uncommitted work/)
  expect((await check($, 'git reset --hard')).decision).toBe('allow')
  expect((await bash($, 'rm -rf /')).deny).toBeUndefined()
})

test('a deny decided beneath stands over the guard’s ask; a compound command takes its strictest rule', async ($, on) => {
  engine(on)
  panes(on)
  on('tool.check', () => ({ decision: 'deny' as const, reason: 'a settings rule' }))
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  await guardOn($)
  expect(await check($, 'git reset --hard')).toEqual({ decision: 'deny', reason: 'a settings rule' })
  // Discard asks and .env blocks by default: together, the block wins.
  expect((await bash($, 'git reset --hard && cat .env')).deny).toMatch(/reads a .env file/)
})

test('the band’s guard chip counts what the guard caught this session', async ($, on) => {
  engine(on)
  panes(on)
  allowBeneath(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  await guardOn($)
  for (const surface of SURFACES) expect([surface, (await shown($, surface)).words]).toEqual([surface, expect.stringMatching(/guard(?! ·)/)])
  await bash($, 'rm -rf /')
  await check($, 'git reset --hard')
  for (const surface of SURFACES) expect([surface, (await shown($, surface)).words]).toEqual([surface, expect.stringContaining('guard · 2')])
})

test('prefs saved by 2.0.0 load with each guard rule at its default', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true }, notify: true, limits: true, guard: true, steps: true, chat: { spinner: true, tools: true, tests: true, callouts: true } } } })
  panes(on)
  allowBeneath(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  expect((await bash($, 'cat .env')).deny).toMatch(/reads a .env file/)
  expect((await check($, 'git push -f origin main')).reason).toMatch(/force-pushes to main/)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  for (const rule of ['wipe', 'force', 'env', 'discard']) expect([rule, await pane.find({ key: `guard-${rule}-ask` })]).not.toEqual([rule, undefined])
})

// A main turn: start, the calls, end; what turn.complete answered.
let turns = 0
async function turn($: Engine, calls: () => Promise<unknown>, answer = 'ok') {
  const turnId = `main-${++turns}`
  await $.turn.start({ turnId } as never)
  await calls()
  return (await $.turn.complete({ turnId, answer, durationMs: 1000, isAborted: false, reason: 'answer' })) as { text: string }
}
// The receipt under a reply: the desktop's drawing by its alt, the terminal's line.
async function receiptUnder($: Engine, surface: Surface, text: string) {
  const ui = await mountReply($, surface, text)
  const words = surface === 'desktop' ? (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('') : (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  await ui.unmount()
  return words
}
const turnStarts = (on: On) => on('turn.start', ($, e) => ({ turnId: (e as { turnId: string }).turnId }))

test('a working turn’s last reply carries its receipt card; other replies, plain answers and reads none', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, (_, e) =>
    (e as { command: string }).command === 'bun test'
      ? { result: { stdout: 'bun test v1\n\n 9 pass\n 0 fail\nRan 9 tests across 1 file. [1s]', stderr: '', interrupted: false } }
      : { result: { stdout: '', stderr: '', interrupted: false } },
  )
  engine(on)
  turnStarts(on)
  await start($)
  const done = await turn(
    $,
    async () => {
      await $.tool.call({ tool: 'Edit', file_path: '/w/a.ts', old_string: 'a', new_string: 'b\nc', replace_all: false } as Parameters<typeof $.tool.call>[0])
      await bash($, 'bun test')
      await bash($, 'ls')
    },
    'All done.',
  )
  // The answer itself is left alone: the card is drawn under the reply instead.
  expect(done.text).toBe('')
  expect(await receiptUnder($, 'desktop', 'All done.')).toBe('Turn receipt: All green; 1 file +2 −1; 9 passed; 2 commands')
  expect(await receiptUnder($, 'terminal', 'All done.')).toContain('All green · ✎ 1 file +2 −1 · ✓ 9 passed · › 2 commands')
  expect(await receiptUnder($, 'desktop', 'An earlier reply.')).not.toContain('Turn receipt')
  await turn($, async () => undefined, 'Just talk.')
  expect(await receiptUnder($, 'desktop', 'Just talk.')).not.toContain('Turn receipt')
  await turn($, () => $.tool.call({ tool: 'Read', file_path: '/w/a.ts' } as Parameters<typeof $.tool.call>[0]), 'Read it.')
  expect(await receiptUnder($, 'desktop', 'Read it.')).not.toContain('Turn receipt')
  // A turn that ends with no words of its own falls back to the notice under it.
  expect((await turn($, () => bash($, 'npm run build'), '')).text).toBe('› 1 command')
  // Reads alone are no work to receipt.
  expect((await turn($, () => bash($, 'ls'), '')).text).toBe('')
})

test('a subagent’s calls stay out of the main turn’s receipt, and the toggle turns it off', async ($, on) => {
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await turn($, () => $.tool.call({ tool: 'Bash', command: 'ls', description: '', agentId: 'agent-x' } as Parameters<typeof $.tool.call>[0]), 'Sub ran.')
  expect(await receiptUnder($, 'desktop', 'Sub ran.')).not.toContain('Turn receipt')
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await pane.press({ key: 'pref-chat-receipt' })
  await turn($, () => bash($, 'ls'), 'Ran ls.')
  expect(await receiptUnder($, 'desktop', 'Ran ls.')).not.toContain('Turn receipt')
  expect((await turn($, () => bash($, 'ls'), '')).text).toBe('')
})

test('a receipt that falls back to the notice keeps text another plugin left there', async ($, on) => {
  engine(on, { completeText: 'from beneath' })
  turnStarts(on)
  await start($)
  expect((await turn($, () => bash($, 'npm run build'), '')).text).toBe('from beneath\n› 1 command')
})

test('Clawd’s mood shows in the band: sad after failing tests, startled by the guard', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, (_, e) =>
    (e as { command: string }).command === 'bun test'
      ? { result: { stdout: 'bun test v1\n\n 7 pass\n 2 fail\nRan 9 tests across 1 file. [1s]', stderr: '', interrupted: false } }
      : { result: { stdout: '', stderr: '', interrupted: false } },
  )
  engine(on)
  panes(on)
  turnStarts(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  await turn($, () => bash($, 'bun test'))
  expect((await shown($, 'desktop')).words).toContain('Clawd is sad')
  expect((await shown($, 'terminal')).words).toContain('✗')
  await guardOn($)
  await bash($, 'rm -rf /')
  expect((await shown($, 'desktop')).words).toContain('Clawd is startled')
})

test('the band with every row, a full crew and Clawd in the info row stays under the tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 6; i++) await spawn($, `job ${i}`)
  const ui = await mountBand($, 'desktop', true)
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
  const svg = (await ui.findAll({ type: 'Svg' }))[0]
  expect(String(svg?.props.source)).toContain('class="run"')
  expect(String(svg?.props.source).length).toBeLessThanOrEqual(131_072)
  await ui.unmount()
})

test('agents report their own steps through the mod’s tool, filling their card', async ($, on) => {
  engine(on)
  panes(on)
  const tools: string[] = []
  on('tool.register', ($, e) => {
    tools.push(e.name)
    return { value: { tool: `mcp__sabai__${e.name}` } }
  })
  await start($)
  expect(tools).toEqual(['step'])
  await spawn($, 'worker')
  const reply = await $.tool.call({ tool: 'mcp__sabai__step', agentId: 'agent-worker', done: 2, total: 4, note: 'Reading the docs' } as unknown as Parameters<typeof $.tool.call>[0])
  expect(reply.result).toBe('ok')
  const ui = await mountPane($, 'desktop')
  const card = ((await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]).find(c => c.props.alt.startsWith('worker:'))
  expect(card?.props.source).toContain('>2/4<')
  expect(card?.props.source).toContain('>Reading the docs<')
})

const mountTool = ($: Engine, surface: Surface, props: Record<string, unknown>) =>
  $.ui.mount({
    plugin: 'sabai',
    surface,
    component: 'ToolUse',
    requestId: String(props.tool_use_id),
    viewport: { columns: 120, rows: 30 },
    props: { isRunning: false, isErrored: false, isInterrupted: false, ...props } as never,
  })

// The words of a chat line: the desktop's drawings by their alt, the terminal's Text.
async function lineWords(ui: Awaited<ReturnType<typeof mountTool>>, surface: Surface) {
  if (surface === 'desktop') return (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('')
  return (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
}

test('a Bash row is drawn as a step in place of the engine’s row, with its measured time', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, async () => {
    await clock.advance(4200)
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  const { clock } = engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'npm run build', description: '', tool_use_id: 'tu1' } as Parameters<typeof $.tool.call>[0])
  for (const surface of SURFACES) {
    const ui = await mountTool($, surface, { tool_use_id: 'tu1', tool: 'Bash', input: { command: 'npm run build' }, output: { stdout: '', stderr: '', interrupted: false } })
    expect([surface, (await ui.findAll({ type: 'Text' })).some(t => t.text === 'stock row')]).toEqual([surface, false])
    expect([surface, await lineWords(ui, surface)]).toEqual([surface, expect.stringMatching(/npm run build.*done.*4\.2s/)])
  }
})

test('an untimed quick Bash row, another tool, or the toggle off pass straight through', async ($, on) => {
  engine(on, { store: { prefs: { chat: { spinner: true, tools: false, tests: true, callouts: true, label: true } } } })
  await start($)
  const off = await mountTool($, 'desktop', { tool_use_id: 'x', tool: 'Bash', input: { command: 'ls' }, isErrored: true, output: {} })
  expect(await off.findAll({ type: 'Svg' })).toEqual([])
  const other = await mountTool($, 'desktop', { tool_use_id: 'y', tool: 'Glob', input: {}, output: {} })
  expect(await other.findAll({ type: 'Svg' })).toEqual([])
})

test('settings saved before the Chat group load with every chat toggle on', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: false, toolbar: true }, notify: true, limits: true, guard: true, steps: true } } })
  await start($)
  const ui = await mountTool($, 'desktop', { tool_use_id: 'f', tool: 'Bash', input: { command: 'false' }, isErrored: true, output: {} })
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['false, failed'])
})

test('Edit, Write and Read rows gain their summary on both surfaces', async ($, on) => {
  engine(on)
  await start($)
  const rows = [
    { tool_use_id: 'e', tool: 'Edit', input: { file_path: 'src/a.ts' }, output: { structuredPatch: [{ lines: ['-a', '+b', '+c'] }] }, want: ['Edited a.ts', 'src/', '+2 −1'] },
    { tool_use_id: 'w', tool: 'Write', input: { file_path: 'docs/new.md' }, output: { type: 'create', content: 'x\n', structuredPatch: [] }, want: ['Created new.md', 'docs/', '1 line'] },
    { tool_use_id: 'r', tool: 'Read', input: { file_path: 'r.md' }, output: { type: 'text', file: { startLine: 5, numLines: 10, totalLines: 40 } }, want: ['Read r.md', 'lines 5–14 of 40'] },
  ]
  for (const { want, ...props } of rows) {
    const desk = await mountTool($, 'desktop', props)
    const svg = (await desk.findAll({ type: 'Svg' }))[0]
    expect([svg?.props.alt, svg?.props.width, svg?.props.height]).toEqual([want.join(', '), 560, 24])
    const term = await mountTool($, 'terminal', props)
    for (const w of want) expect(await lineWords(term, 'terminal')).toContain(w)
  }
})

// An errored call's output is the text the model read, not the result record.
const TEST_ROW = { tool_use_id: 't', tool: 'Bash', input: { command: 'bun test' }, isErrored: true, output: 'Exit code 1\n 9 pass\n 1 fail\nRan 10 tests across 2 files.' }

test('a Bash row whose output is a test summary becomes a test line', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountTool($, 'desktop', TEST_ROW)
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['bun test, 1 of 10 failed'])
})

test('with Test results off, a test run is a plain failed Bash line', async ($, on) => {
  engine(on, { store: { prefs: { chat: { spinner: true, tools: true, tests: false, callouts: true, label: true } } } })
  await start($)
  const ui = await mountTool($, 'desktop', TEST_ROW)
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['bun test, 9 pass, failed, exit 1'])
})

const FACTS = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] } as never
let replies = 0
const mountReply = ($: Engine, surface: Surface, text: string, extra: Record<string, unknown> = {}) =>
  $.ui.mount({ plugin: 'sabai', surface, component: 'AssistantMessage', requestId: `m${++replies}`, viewport: { columns: 120, rows: 30 }, props: { text, isFirstOfReply: true, ...extra } as never })
const isStock = async (ui: Awaited<ReturnType<typeof mountReply>>) => (await ui.findAll({ type: 'Text' })).some(t => t.text === 'stock row')

test('a reply with a callout draws it as a bordered box between its Markdown; others pass through', async ($, on) => {
  engine(on)
  await start($)
  for (const surface of SURFACES) {
    const ui = await mountReply($, surface, 'Before.\n\n> [!TIP]\n> Use bun.\n\nAfter.')
    const md = (await ui.findAll({ type: 'Markdown' })).map(m => String(m.props.text).trim())
    expect([surface, md]).toEqual([surface, ['Before.', 'Use bun.', 'After.']])
    const box = (await ui.findAll({ type: 'Box' })).find(b => b.props.borderStyle === 'round')
    expect([surface, box?.props.borderColor]).toEqual([surface, 'success'])
  }
  expect(await isStock(await mountReply($, 'desktop', 'No callout here.'))).toBe(true)
  expect(await isStock(await mountReply($, 'desktop', '> [!NOTE]\n> x', { isSummary: true }))).toBe(true)
})

test('Claude is told about callouts only while Callouts is on', async ($, on) => {
  engine(on)
  on('prompt.compose', () => ({ sections: [{ id: 'core', text: 'base', scope: 'shared' as const }] }))
  await start($)
  expect((await $.prompt.compose(FACTS)).sections.map(s => s.id)).toEqual(['core', 'sabai:callouts'])
})

test('with Callouts off, replies and the prompt are left alone', async ($, on) => {
  engine(on, { store: { prefs: { chat: { spinner: true, tools: true, tests: true, callouts: false, label: true } } } })
  on('prompt.compose', () => ({ sections: [{ id: 'core', text: 'base', scope: 'shared' as const }] }))
  await start($)
  expect((await $.prompt.compose(FACTS)).sections.map(s => s.id)).toEqual(['core'])
  expect(await isStock(await mountReply($, 'desktop', '> [!TIP]\n> x'))).toBe(true)
})

test('the spinner speaks Thai on the terminal, and on the desktop only in place of Working', async ($, on) => {
  const seen: string[] = []
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    seen.push((e.props as { word: string }).word)
    return STOCK
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  engine(on)
  await start($)
  await $.turn.start({ text: 'hi', turnId: 'turn-1' })
  const spin = (surface: Surface, word: string, n: number) =>
    $.ui.mount({ plugin: 'sabai', surface, component: 'Spinner', requestId: `s${n}`, viewport: { columns: 120, rows: 30 }, props: { word, message: null, suffix: '…', mode: 'thinking' } })
  await spin('terminal', 'Sauteing', 1)
  await spin('desktop', 'Creating notes.md', 2)
  await spin('desktop', 'Working', 3)
  expect(seen[0]).toMatch(/[฀-๿]/)
  expect(seen.slice(1)).toEqual(['Creating notes.md', seen[0]])
})

test('settings: each chat feature has its own toggle, kept for new sessions', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  for (const k of ['spinner', 'tools', 'tests', 'callouts']) expect([k, (await pane.find({ key: `pref-chat-${k}` }))?.props.label]).toEqual([k, '● On'])
  expect(await pane.find({ key: 'pref-chat-label' })).toBeUndefined()
  await pane.press({ key: 'pref-chat-tools' })
  expect((await pane.find({ key: 'pref-chat-tools' }))?.props.label).toBe('○ Off')
  expect((store.prefs as { chat: { tools: boolean } }).chat.tools).toBe(false)
  const ui = await mountTool($, 'desktop', { tool_use_id: 'z', tool: 'Bash', input: { command: 'false' }, isErrored: true, output: {} })
  expect(await ui.findAll({ type: 'Svg' })).toEqual([])
})

test('a run whose tests all passed but whose command failed says it failed', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountTool($, 'desktop', { tool_use_id: 'bt', tool: 'Bash', input: { command: 'bun test && tsc' }, isErrored: true, output: 'Exit code 2\n 3 pass\n 0 fail\nRan 3 tests across 1 files.\nerror TS2304' })
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['bun test && tsc, 3 pass, failed, exit 2'])
})

test('a backgrounded Bash call says so, with no time and no output, though its tool.call resolved', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, async () => {
    await clock.advance(120_000)
    return { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } }
  })
  const { clock } = engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'npm run dev', description: '', tool_use_id: 'bg' } as Parameters<typeof $.tool.call>[0])
  const ui = await mountTool($, 'desktop', { tool_use_id: 'bg', tool: 'Bash', input: { command: 'npm run dev' }, output: { stdout: 'ready', stderr: '', interrupted: false, backgroundTaskId: 'b1' } })
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['npm run dev, in the background, 2m 0s'])
  expect(await ui.findAll({ type: 'Code' })).toEqual([])
})

test('a Bash call that waited on the permission dialog shows no time; a classifier’s ask keeps it', async ($, on) => {
  let dialog = false
  on('tool.check', () => ({ decision: 'ask' as const }))
  on('tool.call', { tool: 'Bash' }, async (_, e) => {
    if (dialog) await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: (e as { command: string }).command } } as never)
    await clock.advance(6000)
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  on('classic.PermissionRequest', () => ({}) as never)
  const { clock } = engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'make', description: '', tool_use_id: 'auto1' } as Parameters<typeof $.tool.call>[0])
  dialog = true
  await $.tool.call({ tool: 'Bash', command: 'rm x', description: '', tool_use_id: 'ask1' } as Parameters<typeof $.tool.call>[0])
  const alt = async (id: string, command: string) => (await (await mountTool($, 'desktop', { tool_use_id: id, tool: 'Bash', input: { command }, output: { stdout: '', stderr: '' } })).findAll({ type: 'Svg' })).map(s => String(s.props.alt))
  expect(await alt('auto1', 'make')).toEqual(['make, done, 6.0s'])
  expect(await alt('ask1', 'rm x')).toEqual(['rm x, done'])
})

test('a quick command the mod did not time still gets its line', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountTool($, 'desktop', { tool_use_id: 'q', tool: 'Bash', input: { command: 'ls' }, output: { stdout: '', stderr: '', interrupted: false } })
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['ls, done'])
})

test('an edit or a write whose row carries no result is read from what was asked of it', async ($, on) => {
  engine(on)
  await start($)
  const edit = await mountTool($, 'desktop', { tool_use_id: 'ni', tool: 'Edit', input: { file_path: 'a.ts', old_string: 'old', new_string: 'new\nmore' } })
  expect((await edit.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['Edited a.ts, +2 −1'])
  expect(await edit.findAll({ type: 'Code' })).toEqual([])
  const write = await mountTool($, 'desktop', { tool_use_id: 'nw', tool: 'Write', input: { file_path: 'n.md', content: 'a\nb\n' } })
  expect((await write.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['Wrote n.md, 2 lines'])
  const read = await mountTool($, 'desktop', { tool_use_id: 'nr', tool: 'Read', input: { file_path: 'r.md', offset: 10, limit: 5 } })
  expect((await read.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['Read r.md, lines 10–14'])
})

test('a step stands alone: no output under it, and with Tool summaries off the engine’s row is left as it is', async ($, on) => {
  engine(on)
  await start($)
  const bash = await mountTool($, 'desktop', { tool_use_id: 'no', tool: 'Bash', input: { command: 'make' }, output: { stdout: 'built\nok', stderr: '' } })
  expect(await bash.findAll({ type: 'Code' })).toEqual([])
  expect((await bash.findAll({ type: 'Svg' })).length).toBe(1)
})

test('with Tool summaries on, grouped reads unfold into their own steps', async ($, on) => {
  const seen: boolean[] = []
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    seen.push((e.props as { isExpanded: boolean }).isExpanded)
    return STOCK
  })
  engine(on)
  await start($)
  await $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'ToolGroup', requestId: 'g', viewport: { columns: 120, rows: 30 }, props: { calls: [{ tool: 'Read' }], isActive: false, isExpanded: false } as never })
  expect(seen.at(-1)).toBe(true)
})

test('the guard label sits in the band’s info row, a shield chip before Node, on both surfaces', async ($, on) => {
  engine(on, { store: { prefs: { guard: true } } })
  await start($)
  expect((await shown($, 'desktop')).words).toMatch(/Turned on: guard, Node v24\.1\.0/)
  expect((await shown($, 'terminal')).words).toMatch(/◈ guard \|.*⬢ v24\.1\.0/)
})

test('the guard chip follows the guard alone: off, no chip; an old Guard label setting is ignored', async ($, on) => {
  engine(on, { store: { prefs: { guard: false } } })
  await start($)
  expect((await shown($, 'desktop')).words).not.toContain('guard')
})

test('a guard turned on shows its chip even where an older version saved Guard label off', async ($, on) => {
  engine(on, { store: { prefs: { guard: true, chat: { spinner: true, tools: true, tests: true, callouts: true, label: false } } } })
  await start($)
  expect((await shown($, 'desktop')).words).toContain('Turned on: guard')
})

test('the footer’s modes are left to the engine on the desktop; the terminal adds the guard there too', async ($, on) => {
  const seen: string[][] = []
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    seen.push([...(e.props as { modes: string[] }).modes])
    return STOCK
  })
  engine(on, { store: { prefs: { guard: true } } })
  await start($)
  const mount = (surface: Surface, n: number) => $.ui.mount({ plugin: 'sabai', surface, component: 'SessionMode', requestId: `sm${n}`, viewport: { columns: 120, rows: 30 }, props: { modes: ['focus'] } })
  await mount('desktop', 1)
  expect(seen.at(-1)).toEqual(['focus'])
  await mount('terminal', 2)
  expect(seen.at(-1)).toEqual(['focus', '◈ guard'])
})

test('each Bash duration is kept under its own id, so one call does not redraw every row', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, async () => {
    await clock.advance(1500)
    return { result: { stdout: '', stderr: '', interrupted: false } }
  })
  const { clock } = engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'make', description: '', tool_use_id: 'own1' } as Parameters<typeof $.tool.call>[0])
  const alt = async (id: string) => (await (await mountTool($, 'desktop', { tool_use_id: id, tool: 'Bash', input: { command: 'make' }, output: {} })).findAll({ type: 'Svg' })).map(s => String(s.props.alt))
  expect(await alt('own1')).toEqual(['make, done, 1.5s'])
  expect(await alt('other')).toEqual(['make, done'])
})

test('a group of calls drawn as steps unfolds; one with searches stays folded', async ($, on) => {
  const seen: boolean[] = []
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    seen.push((e.props as { isExpanded: boolean }).isExpanded)
    return STOCK
  })
  engine(on)
  await start($)
  const group = (n: number, tools: string[]) => $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'ToolGroup', requestId: `mg${n}`, viewport: { columns: 120, rows: 30 }, props: { calls: tools.map(tool => ({ tool })), isActive: false, isExpanded: false } as never })
  await group(1, ['Bash', 'Read', 'Edit', 'Write'])
  expect(seen.at(-1)).toBe(true)
  await group(2, ['Bash', 'Glob'])
  expect(seen.at(-1)).toBe(false)
})

test('only a run of reads unfolds into steps; a group with searches stays folded', async ($, on) => {
  const seen: boolean[] = []
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    seen.push((e.props as { isExpanded: boolean }).isExpanded)
    return STOCK
  })
  engine(on)
  await start($)
  const group = (n: number, tools: string[]) => $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'ToolGroup', requestId: `rg${n}`, viewport: { columns: 120, rows: 30 }, props: { calls: tools.map(tool => ({ tool })), isActive: false, isExpanded: false } as never })
  await group(1, ['Read', 'Read'])
  expect(seen.at(-1)).toBe(true)
  await group(2, ['Read', 'Grep'])
  expect(seen.at(-1)).toBe(false)
})

test('a reply too long to redraw within the tree limit is left to the engine, callout or not', async ($, on) => {
  engine(on)
  await start($)
  expect(await isStock(await mountReply($, 'desktop', `> [!NOTE]\n> x\n\n${'word '.repeat(19_000)}`))).toBe(true)
})

test('on the terminal a step is one line: its glyph, title, what it did, result and time', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountTool($, 'terminal', { tool_use_id: 't1', tool: 'Edit', input: { file_path: 'src/a.ts', new_string: 'x' } })
  expect(await ui.findAll({ type: 'Box' })).toEqual([])
  expect(await lineWords(ui, 'terminal')).toMatch(/^✎ Edited a\.ts.*src\/.*\+1 −0/)
})

test('settings are six bordered groups in order: band, conversation, agents, safety, alerts, appearance', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (const surface of SURFACES) {
    const pane = await mountPane($, surface, 'sabai-skins')
    const cards = (await pane.findAll({ type: 'Box' })).filter(b => b.props.borderStyle === 'round')
    expect([surface, cards.length]).toEqual([surface, 6])
    const words = (await pane.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
    const order = ['Band', 'Conversation', 'Agents', 'Safety', 'Alerts', 'Appearance'].map(t => words.indexOf(`${t}`))
    expect([surface, order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))]).toEqual([surface, true])
    for (const k of ['pref-chat-tools', 'pref-steps', 'pref-guard', 'pref-notify', 'bar-dither', 'use-nord']) expect([k, await pane.find({ key: k })]).not.toEqual([k, undefined])
    await pane.unmount()
  }
})
