import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]
const STOCK: RenderElement = { type: 'Text', props: {}, children: ['stock row'] }
const NOW = Date.parse('2026-10-10T00:00:00Z')

// Answers every noun the band calls, as a session would. `failing` lists commands that are
// missing or fail on this machine (no node, no upstream, not a repository).
function engine(on: On, { hasLimits = true, store = {} as Record<string, unknown>, failing = [] as string[] } = {}) {
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
  on('process.run', ($, e) => {
    const cmd = e.argv.join(' ')
    runs.push(cmd)
    const fails = failing.some(f => cmd.startsWith(f))
    return { value: { exitCode: fails ? 1 : 0, stdout: fails ? '' : (out()[cmd] ?? ''), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.complete', () => ({ text: '' }))
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
  on('command.register', () => ({ value: { command: 'sabai-skin' } }))
  on('ui.render', () => STOCK)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', ($, e) => {
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(e.subject.length), subject: e.subject } } }
    if (e.tool === 'TaskUpdate') return { result: { success: true, taskId: e.taskId, updatedFields: [] } }
    return { result: {} }
  })
  return { runs, clock, branch, store }
}

const start = ($: Engine) => $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })

const mountBand = ($: Engine, surface: Surface, isWorking = false) =>
  $.ui.mount({
    plugin: 'sabai-band',
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

test('a fresh load shows every meter with its countdown, and no buttons', async ($, on) => {
  engine(on)
  await start($)
  const desktop = await shown($, 'desktop')
  expect(desktop.svgs).toBe(1)
  expect(desktop.words).toContain(
    'Context 24.5k / 200k (12%); 5H Limit 7%, resets in 2h 49m; 7D All 3%, resets in 6d 2h',
  )
  expect(desktop.words).toContain('stock row')
  expect(desktop.buttons).toBe(0)
  const terminal = await shown($, 'terminal')
  expect(terminal.svgs).toBe(0)
  expect(terminal.words).toMatch(/5H LIMIT .*7%.*↻ 2h 49m/)
  expect(terminal.words).toContain('7D ALL')
  expect(terminal.words).toContain('24.5k / 200k (12%)')
  expect(terminal.buttons).toBe(0)
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

const skinCommand = ($: Engine, args: string) =>
  $.command.run({ command: 'sabai-skin', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })

test('/sabai-skin lists the skins, switches by any spelling, and remembers the choice', async ($, on) => {
  const { store } = engine(on)
  await start($)
  expect((await skinCommand($, '')).text).toMatch(/^Skin: auto\. Available: auto, catppuccin-latte \(Catppuccin Latte\),/)
  expect((await skinCommand($, 'solarized')).text).toMatch(/^No skin called "solarized"/)
  expect((await skinCommand($, 'TokyoNight')).text).toBe('Skin set to Tokyo Night.')
  const ui = await mountBand($, 'desktop')
  const svg = (await ui.find({ type: 'Svg' })) as { props: { source: string } } | undefined
  expect(svg?.props.source).toContain('fill="#1a1b26"')
  expect(store.skin).toBe('tokyo-night')
})

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
  expect(svg?.props.source).toContain('fill="#282a36"')
})

// The agents pane, opened and closed through the engine's own ui noun.
function panes(on: On) {
  const open = new Set<string>()
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: 'Agents', isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.open', ($, e) => {
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

const mountPane = ($: Engine, surface: Surface) =>
  $.ui.mount({
    plugin: 'sabai-band',
    surface,
    component: 'Pane',
    requestId: 'sabai-agents',
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
  const svg = (await ui.find({ type: 'Svg' })) as { props: { alt: string; source: string } } | undefined
  expect(svg?.props.alt).toBe('api routes: Explore, sonnet 5.5, done, 1m 4s')
  expect(svg?.props.source).toContain('>DONE · 1<')
})

test('an empty panel says there is nothing yet', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  const ui = await mountPane($, 'terminal')
  expect(await ui.find({ type: 'Text', text: /No subagents yet/ })).toBeDefined()
})
