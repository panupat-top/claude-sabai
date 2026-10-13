import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted as TestMounted } from 'claude-code/testing'

const SURFACES = ['desktop'] as const
type Surface = 'terminal' | 'desktop'
const STOCK: RenderElement = { type: 'Text', props: {}, children: ['stock row'] }
const NOW = Date.parse('2026-10-10T00:00:00Z')

// Answers every noun the band calls, as a session would. `failing` lists commands that are
// missing or fail on this machine (no node, no upstream, not a repository); `hanging` ones never answer.
function engine(on: On, { hasLimits = true, store = {} as Record<string, unknown>, failing = [] as string[], hanging = [] as string[], completeText = '', percents = [12, 7, 3] as (number | undefined)[], contextTokens = 24_500, estimate = undefined as number | undefined, surfaces = ['desktop'] as ('terminal' | 'desktop')[] } = {}) {
  const branch = { name: 'main' }
  const runs: string[] = []
  const clock = mock.clock(on, { now: NOW })
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))
  on('session.surfaces', () => ({ value: surfaces }))
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
    if (hanging.some(h => cmd.startsWith(h))) return new Promise<never>(() => {})
    const fails = failing.some(f => cmd.startsWith(f))
    return { value: { exitCode: fails ? 1 : 0, stdout: fails ? '' : (out()[cmd] ?? ''), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.complete', () => ({ text: completeText }))
  // A test that sets `reads.usage` false finds the engine has no reading to give.
  const reads = { usage: true }
  on('session.usage', ($, e) => {
    if (!reads.usage) throw new Error('no reading')
    return {
    value: {
      startedAt: 0,
      // The engine's local estimate, asked for with a breakdown.
      context: e?.breakdown ? { window: 200000, ...(estimate === undefined ? {} : { breakdown: { totalTokens: estimate } as never }) } : { window: 200000, ...(percents[0] === undefined ? {} : { tokens: contextTokens, percent: percents[0] }) },
      rateLimits: hasLimits
        ? [
            { kind: 'five_hour', percentUsed: percents[1]!, resetsAt: '2026-10-10T02:49:00Z' },
            { kind: 'seven_day', percentUsed: percents[2]!, resetsAt: '2026-10-16T02:00:00Z' },
          ]
        : [],
    },
  }
  })
  const registered: string[] = []
  on('command.register', ($, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  const commands: string[] = []
  on('command.list', () => ({
    value: ['clear', 'review', 'compact', 'resume', 'help'].map(name => ({ name, description: '', source: 'builtin' as const })),
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
  return { runs, clock, branch, store, commands, inits, registered, reads }
}

// git and node are read in the background; tests let that settle before looking.
const later = (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout
const settle = () => new Promise<void>(resolve => later(resolve, 5))
const start = async ($: Engine) => {
  const started = await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' })
  await settle()
  return started
}

const mountBand = ($: Engine, surface: Surface, isWorking = false, bodyColumns = 115) =>
  $.ui.mount({
    plugin: 'sabai',
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    viewport: { columns: 120, rows: 30 },
    props: { hasSurvey: false, isWorking, maxRows: 8, bodyColumns, scroll: { offset: 0, bodyRows: 8 }, view: {} },
  })

// Everything the band shows as words: the desktop's drawings by their alt, and every Text.
async function shown($: Engine, surface: Surface, isWorking = false) {
  const ui = await mountBand($, surface, isWorking)
  const svgs = await ui.findAll({ type: 'Svg' })
  const texts = await ui.findAll({ type: 'Text' })
  const buttons = await ui.findAll({ type: 'Button' })
  const tools = await toolsOf(ui)
  await ui.unmount()
  return {
    words: [...svgs.map(s => String(s.props.alt)), ...tools.map(t => t.alt), ...texts.map(t => t.text)].join(' | '),
    buttons: buttons.length,
    svgs: svgs.length,
    tools: tools.map(t => t.alt),
    sources: svgs.map(s => String(s.props.source)).join(''),
  }
}

// A band mounted on either surface, or one a test mounted on the desktop itself.
type Mounted = Awaited<ReturnType<typeof mountBand>> | TestMounted<'desktop', 'AbovePrompt'>
// The desktop's top row is the info row's own drawing; the band is the other one.
const bandOf = async (ui: Mounted) => (await ui.findAll({ type: 'Svg' })).find(s => !String(s.props.source).includes('<!--info-->'))
// The desktop toolbar: each icon an image link in its own Markdown, named by its alt.
async function toolsOf(ui: Mounted) {
  return (await ui.findAll({ type: 'Markdown' }))
    .filter(m => String(m.props.key).startsWith('tool-'))
    .map(m => {
      const [, alt, data, href] = String(m.props.text).match(/^\[!\[([^\]]*)\]\(data:image\/svg\+xml;base64,([^)]+)\)\]\(([^)]+)\)$/) ?? []
      return { key: String(m.props.key), alt, icon: atob(data ?? ''), href }
    })
}
const pressTool = (ui: Mounted, kind: string) => ui.press({ key: `tool-${kind}`, link: { href: `https://sabai.invalid/${kind}` } })
// The settings' drawn choices (layout, cards, usage style): each a sketch over its Button.
type Pane = Awaited<ReturnType<typeof mountPane>>
// A drawing keeps no key, so a picker's sketches are known by what their alt names.
const PICKED: Record<string, string> = { density: 'layout', skin: 'cards', usage: 'usage' }
async function picksOf(ui: Pane, prefix: string) {
  return ((await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[])
    .filter(d => new RegExp(`^\\w+ ${PICKED[prefix]}(, in use)?$`).test(d.props.alt))
    .map(d => ({ alt: d.props.alt, source: d.props.source }))
}
async function choose(ui: Pane, clock: { advance: (ms: number) => Promise<unknown> }, key: string) {
  await ui.press({ key })
  await clock.advance(1)
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
  // On the desktop it is the top row's own drawing, above the band.
  expect((await shown($, 'desktop')).words).toMatch(/^Folder work, Git user Panupat, Branch main ↑2 ↓1 ±2, Node v24\.1\.0 \| (Clawd: [^;]+; )?Context/)
})

test('a terminal session is left alone: no reads, commands, tool, prompt section, guard or drawing', async ($, on) => {
  const { runs, registered } = engine(on, { surfaces: ['terminal'], store: { prefs: { guard: true } } })
  on('tool.register', ($, e) => {
    registered.push(e.name)
    return { value: undefined } as never
  })
  on('prompt.compose', () => ({ sections: [{ id: 'core', text: 'base', scope: 'shared' as const }] }))
  allowBeneath(on)
  const started = await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await settle()
  expect(started).toEqual({ cwd: '/work' })
  expect([runs, registered]).toEqual([[], []])
  expect((await $.prompt.compose(FACTS)).sections.map(s => s.id)).toEqual(['core'])
  // The guard is on in the saved settings, but this session is not the mod's to guard.
  expect(await bash($, 'rm -rf /')).not.toHaveProperty('deny')
  for (const component of ['AbovePrompt', 'ToolUse', 'AssistantMessage', 'Pane'] as const) {
    const ui = await $.ui.mount({ plugin: 'sabai', surface: 'terminal', component, requestId: 'sabai-skins', viewport: { columns: 120, rows: 30 }, props: { hasSurvey: false, isWorking: false, maxRows: 8, bodyColumns: 115, scroll: { offset: 0, bodyRows: 8 }, view: {}, tool: 'Edit', tool_use_id: 'x', input: { file_path: 'a.ts' }, isRunning: false, isErrored: false, isInterrupted: false, text: '> [!TIP]\n> x', title: 'Settings', isFocused: false, placement: 'dock' } as never })
    expect([component, (await ui.drawn())]).toEqual([component, STOCK])
  }
})

test('the desktop attaching later sets the mod up, once', async ($, on) => {
  const { runs } = engine(on, { surfaces: [] })
  on('session.attach', ($, e) => ({ clientId: e.clientId }))
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  await settle()
  expect(runs).toEqual([])
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:2' })
  await settle()
  expect(runs.filter(r => r === 'node --version')).toHaveLength(1)
  expect((await shown($, 'desktop')).words).toMatch(/^Folder work, Git user Panupat/)
})

test('a desktop that draws before it is seen to attach sets the mod up from its first draw', async ($, on) => {
  const { runs, clock } = engine(on, { surfaces: [] })
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  await (await mountBand($, 'desktop')).unmount()
  await clock.advance(1)
  await settle()
  expect(runs.filter(r => r === 'node --version')).toHaveLength(1)
  expect((await shown($, 'desktop')).words).toMatch(/^Folder work, Git user Panupat/)
  expect(runs.filter(r => r === 'node --version')).toHaveLength(1)
})

test('a first draw then the desktop attaching sets the mod up once, and a terminal attaching not at all', async ($, on) => {
  const { runs, clock } = engine(on, { surfaces: [] })
  on('session.attach', ($, e) => ({ clientId: e.clientId }))
  await $.session.start({ surface: null, isInteractive: false, cwd: '/work' })
  await $.session.attach({ surface: 'terminal', clientId: 'terminal:1' })
  await settle()
  expect(runs).toEqual([])
  await (await mountBand($, 'desktop')).unmount()
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:2' })
  await clock.advance(1)
  await settle()
  expect(runs.filter(r => r === 'node --version')).toHaveLength(1)
})

test('what a machine cannot tell is hidden: no node, no upstream, no repository', async ($, on) => {
  engine(on, { failing: ['node', 'git'] })
  await start($)
  const words = (await shown($, 'desktop')).words
  expect(words).toMatch(/^Folder work \| (Clawd: [^;]+; )?Context/)
  expect(words).not.toContain('Node')
  expect(words).not.toContain('Branch')
})

test('a slow git user or node read holds back only itself: the folder and branch show at once, with no skeleton', async ($, on) => {
  engine(on, { hanging: ['git config', 'node'] })
  await start($)
  const words = (await shown($, 'desktop')).words
  expect(words).toMatch(/^Folder work, Branch main ↑2 ↓1 ±2/)
  expect(words).not.toContain('Reading the project')
  expect(words).not.toContain('Git user')
})

test('the branch follows a turn of the main conversation', async ($, on) => {
  const { branch } = engine(on)
  await start($)
  branch.name = 'feature/band'
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })
  await settle()
  expect((await shown($, 'desktop')).words).toContain('Branch feature/band ↑2 ↓1 ±2, Node')
})

test('Clawd counts the background work the main conversation starts, until it ends or is stopped', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, (_, e) => ({ result: { stdout: '', stderr: '', interrupted: false, ...((e as { run_in_background?: boolean }).run_in_background ? { backgroundTaskId: (e as { command: string }).command } : {}) } }))
  on('tool.call', { tool: 'Monitor' }, () => ({ result: { taskId: 'm1', timeoutMs: 60_000 } }))
  on('tool.call', { tool: 'TaskStop' }, (_, e) => ({ result: { message: 'stopped', task_id: (e as { task_id: string }).task_id, task_type: 'local_bash' } }))
  on('prompt.submit', (_, e) => ({ text: (e as { text: string }).text }))
  engine(on)
  await start($)
  const call = (input: object) => $.tool.call(input as Parameters<typeof $.tool.call>[0])
  await call({ tool: 'Bash', command: 'b1', description: '', run_in_background: true })
  await call({ tool: 'Bash', command: 'b2', description: '', run_in_background: true })
  await call({ tool: 'Bash', command: 'ls', description: '' })
  await call({ tool: 'Bash', command: 'sub', description: '', run_in_background: true, agentId: 'agent-x' })
  await call({ tool: 'Monitor', description: 'watch', timeout_ms: 60_000, command: 'tail -f log' })
  await settle()
  expect((await shown($, 'desktop')).words).toMatch(/Clawd: Ready, 3 background/)
  const notify = (text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'task-notification' } } as never)
  await notify('<task-notification><task-id>m1</task-id><event>line</event></task-notification>')
  await notify('<task-notification><task-id>b1</task-id><status>completed</status></task-notification>')
  await settle()
  expect((await shown($, 'desktop')).words).toMatch(/Clawd: Ready, 2 background/)
  await call({ tool: 'TaskStop', task_id: 'b2' })
  await notify('<task-notification><task-id>m1</task-id><status>killed</status></task-notification>')
  await settle()
  expect((await shown($, 'desktop')).words).toMatch(/Clawd: Ready, Your turn/)
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

test('before the session has read anything, the band stands as a still skeleton with no numbers', async ($, on) => {
  engine(on)
  const desktop = (await shown($, 'desktop')).words
  expect(desktop).toContain('Reading the project')
  expect(desktop).toContain('Context loading; Session limit loading; Weekly limit loading')
  expect(desktop).not.toMatch(/\d%/)
})

test('with every row hidden the band is left to the engine', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: false, tasks: false, usage: false, live: false, crew: false, toolbar: false } } } })
  await start($)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toBe('stock row')
})

test('an engine with no usage to give leaves a note where the usage would be', async ($, on) => {
  engine(on, { hasLimits: false, percents: [] })
  await start($)
  for (const surface of SURFACES) {
    const words = (await shown($, surface)).words
    expect(words).toContain('No usage reading yet')
    expect(words).not.toContain('loading')
  }
})

test('a fresh load shows every meter with its countdown, and the toolbar', async ($, on) => {
  engine(on)
  await start($)
  const desktop = await shown($, 'desktop')
  expect(desktop.svgs).toBe(2)
  expect(desktop.words).toContain(
    'Context 24.5k / 200k (12%); Session limit 7%, resets in 2h 49m; Weekly limit 3%, resets in 6d 2h',
  )
  expect(desktop.words).toContain('stock row')
  // The desktop's toolbar is icons, not Buttons: compact (the one command it keeps), agents, settings.
  expect(desktop.buttons).toBe(0)
  expect(desktop.tools).toEqual(['Compact', 'Subagents', 'Settings'])
})

test('before the engine has a plan reading, the session and weekly limits stay hidden', async ($, on) => {
  engine(on, { hasLimits: false })
  await start($)
  const words = (await shown($, 'desktop')).words
  expect(words).toContain('Context 24.5k / 200k (12%)')
  expect(words).not.toContain('Session limit')
  expect(words).not.toContain('Weekly limit')
})

test('countdowns tick between responses', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await clock.advance(30 * 60_000)
  expect((await shown($, 'desktop')).words).toContain('Session limit 7%, resets in 2h 19m')
})

test('measurements update the context as tokens over the window', async ($, on) => {
  engine(on)
  await start($)
  await measure($, 43)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toContain('434.5k / 1M (43%)')
})

test('tasks fill the progress row and leave once all are done', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'TaskCreate', subject: 'a', description: '', activeForm: 'Doing a' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'bb', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  expect((await shown($, 'desktop')).words).toContain('Doing a: 0/2 tasks, 0%')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  expect((await shown($, 'desktop')).words).toContain('bb: 1/2 tasks, 50%')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'completed' })
  expect((await shown($, 'desktop')).words).not.toContain('tasks,')
})

test('TodoWrite drives the progress row too', async ($, on) => {
  engine(on)
  await start($)
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

test('Clawd keeps his clay on either look and walks only while the turn works', async ($, on) => {
  engine(on, { store: { skin: 'raised' } })
  await start($)
  await $.tool.call({ tool: 'TaskCreate', subject: 'a', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })
  const source = async (isWorking: boolean) => {
    const ui = await mountBand($, 'desktop', isWorking)
    const svg = (await bandOf(ui)) as { props: { source: string } } | undefined
    await ui.unmount()
    return svg?.props.source ?? ''
  }
  expect(await source(false)).toContain('shape-rendering="crispEdges" class="idle"')
  // While working beside the race he also looks at it: the run motion stays.
  expect(await source(true)).toMatch(/shape-rendering="crispEdges" class="run( look-[a-z]+)?"/)
  expect(await source(true)).toContain('fill="#D97757"')
})

// Which look the band's cards wear: flat, raised, or neither.
const cardLook = async ($: Engine) => {
  const ui = await mountBand($, 'desktop')
  const source = String((await bandOf(ui))?.props.source)
  await ui.unmount()
  return source.includes('.p{fill:#f4f4f2}') ? 'flat' : source.includes('.p{fill:#ffffff}') ? 'raised' : '?'
}

test('a saved look comes back with the next session', async ($, on) => {
  engine(on, { store: { skin: 'auto' } })
  await start($)
  expect(await cardLook($)).toBe('flat')
})

test('a skin an older version saved, or none, starts raised', async ($, on) => {
  engine(on, { store: { skin: 'dracula' } })
  await start($)
  expect(await cardLook($)).toBe('raised')
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
  expect((await agentsCommand($)).text).toBe('Subagents pane opened.')
  expect([...open]).toEqual(['sabai-agents'])
  expect((await agentsCommand($)).text).toBe('Subagents pane closed.')
  expect([...open]).toEqual([])
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

test('the look picker offers raised and flat cards, each with its swatch, and a press switches', async ($, on) => {
  const { store, clock } = engine(on)
  panes(on)
  await start($)
  const desk = await mountPane($, 'desktop', 'sabai-skins')
  expect((await picksOf(desk, 'skin')).map(c => c.alt)).toEqual(['Raised cards, in use', 'Flat cards'])
  expect([(await desk.find({ key: 'skin-raised' }))?.props.variant, (await desk.find({ key: 'skin-auto' }))?.props.variant]).toEqual(['primary', 'secondary'])
  // Two layouts, two looks, the bar style's sample, four usage styles, the info row and three chat samples.
  expect(await desk.findAll({ type: 'Svg' })).toHaveLength(2 + 2 + 1 + 4 + 1 + 3)
  expect(JSON.stringify(await desk.drawn()).length).toBeLessThan(100_000)
  await desk.unmount()
  const ui = await mountPane($, 'desktop', 'sabai-skins')
  await choose(ui, clock, 'skin-auto')
  expect(store.skin).toBe('auto')
  const previews = await picksOf(ui, 'skin')
  const flat = previews.find(p => p.alt === 'Flat cards, in use')
  // The look in use carries Clawd, walking.
  expect(flat?.source).toContain('.p{fill:#f4f4f2}')
  expect(flat?.source).toContain('class="run"')
  expect(previews.find(p => p.alt === 'Raised cards')?.source).not.toContain('class="run"')
})

test('the settings pane at its largest keeps room under the tree limit', async ($, on) => {
  engine(on, { store: { bar: 'dither', prefs: { guard: true } } })
  panes(on)
  await start($)
  const ui = await $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'Pane', requestId: 'sabai-skins', viewport: { columns: 500, rows: 30 }, props: { title: 'Settings', isFocused: false, bodyColumns: 496, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } })
  // Headroom for new settings: the engine draws nothing of a tree past 100,000 characters.
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(85_000)
})

test('the toolbar opens the agents and skins panels and counts running agents', async ($, on) => {
  engine(on)
  const open = panes(on)
  await start($)
  // The desktop draws compact and the panels' buttons as Lucide icons at the right of the top row.
  const ui = await mountBand($, 'desktop')
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  const tools = await toolsOf(ui)
  expect(tools.map(t => [t.key, t.href])).toEqual([
    ['tool-compact', 'https://sabai.invalid/compact'],
    ['tool-agents', 'https://sabai.invalid/agents'],
    ['tool-settings', 'https://sabai.invalid/settings'],
  ])
  expect(tools.every(t => t.icon.includes('mask="url(#sabai-tool)"') && t.icon.includes('<rect class="m"'))).toBe(true)
  await pressTool(ui, 'agents')
  await pressTool(ui, 'settings')
  expect([...open]).toEqual(['sabai-agents', 'sabai-skins'])
  await pressTool(ui, 'agents')
  expect([...open]).toEqual(['sabai-skins'])
  await spawn($, 'scan')
  await spawn($, 'read')
  // While agents work the icon counts them in Clawd's clay.
  const agents = (await toolsOf(ui)).find(t => t.key === 'tool-agents')
  expect(agents?.alt).toBe('Subagents, 2 running')
  expect(agents?.icon).toContain('>2</text>')
  expect(agents?.icon).toContain('<rect class="c-tasks"')
})

test('the toolbar lights compact at the amber mark, unless agents are running', async ($, on) => {
  engine(on, { percents: [82, 7, 3], contextTokens: 164_000 })
  panes(on)
  await start($)
  const ui = await mountBand($, 'desktop')
  const compactIcon = async () => (await toolsOf(ui)).find(t => t.key === 'tool-compact')
  expect((await compactIcon())?.alt).toBe('Compact, context at 82%')
  expect((await compactIcon())?.icon).toContain('>82%</text>')
  expect((await compactIcon())?.icon).toContain('<rect class="c-warn"')
  await spawn($, 'scan')
  // One to press at a time: running agents take the colour; compact keeps its figure, muted.
  expect((await compactIcon())?.icon).toContain('>82%</text>')
  expect((await compactIcon())?.icon).toContain('<rect class="m"')
  expect((await toolsOf(ui)).find(t => t.key === 'tool-agents')?.icon).toContain('<rect class="c-tasks"')
})

test('the compact icon runs /compact', async ($, on) => {
  const { clock, commands } = engine(on)
  await start($)
  const ui = await mountBand($, 'desktop')
  await pressTool(ui, 'compact')
  await clock.advance(1)
  expect(commands).toEqual(['compact'])
})

test('the skins panel picks a bar style for the band', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  // The bar style is a choice like the others: the one in use is the primary button.
  expect((await pane.find({ key: 'bar-dither' }))?.props.variant).toBe('primary')
  await pane.press({ key: 'bar-blocks' })
  expect(store.bar).toBe('blocks')
  expect([(await pane.find({ key: 'bar-blocks' }))?.props.variant, (await pane.find({ key: 'bar-blocks' }))?.props.label]).toEqual(['primary', 'Pixel blocks'])
  expect((await pane.find({ key: 'bar-dither' }))?.props.variant).toBe('secondary')
  const band = await mountBand($, 'desktop')
  const svg = (await bandOf(band)) as { props: { source: string } } | undefined
  expect(svg?.props.source).not.toMatch(/class="d[0-3]"/)
  expect(svg?.props.source).toContain('rx="1.5"')
})

test('a saved bar style comes back with the next session', async ($, on) => {
  engine(on, { store: { bar: 'solid' } })
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  expect((await pane.find({ key: 'bar-solid' }))?.props.variant).toBe('primary')
})

test('a skin leaves the band on the surface’s own background, as auto does', async ($, on) => {
  engine(on, { store: { skin: 'raised' } })
  await start($)
  const ui = await mountBand($, 'desktop')
  const tree = (await ui.drawn()) as { props: { backgroundColor?: string; borderStyle?: string } }
  expect([tree.props.backgroundColor, tree.props.borderStyle]).toEqual([undefined, undefined])
})

test('an empty panel invites a first agent', async ($, on) => {
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

test('the crew counts a stopped agent apart from failed and done ones', async ($, on) => {
  engine(on, { store: { prefs: { density: 'compact' } } })
  panes(on)
  await start($)
  await spawn($, 'a')
  await spawn($, 'b')
  await $.turn.complete({ turnId: 'a', agentId: 'agent-a', answer: '', durationMs: 10, isAborted: true, reason: 'aborted' })
  await $.turn.complete({ turnId: 'b', agentId: 'agent-b', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop')).words).toMatch(/1 done, 1 stopped/)
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

// The agents pane as drawn: each drawing's alt and source, and its Texts and Markdowns.
type PaneUi = Awaited<ReturnType<typeof mountPane>> | Awaited<ReturnType<typeof widePane>>
const svgsOf = async (ui: PaneUi) => (await ui.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]
const altsOf = async (ui: PaneUi) => (await svgsOf(ui)).map(s => s.props.alt)
// A lane is 42 px tall, 59 with its row of skills and MCP servers.
const laneOf = async (ui: PaneUi, name: string) => (await svgsOf(ui)).find(s => /height="(42|59)"/.test(s.props.source) && s.props.alt.startsWith(`${name}:`))
// The detail's head: the drawing 128 px tall.
const headOf = async (ui: PaneUi) => (await svgsOf(ui)).find(s => s.props.source.includes('height="128"'))
// The pane's Markdowns.
const markdownsOf = (ui: PaneUi) => ui.findAll({ type: 'Markdown' })
// Opens an agent's detail with its lane's View, unless it is open already.
const viewed = async (ui: PaneUi, name: string) => {
  if ((await ui.find({ key: `view-agent-${name}` }))?.props.label === 'View') await ui.press({ key: `view-agent-${name}` })
  return ui
}
const finish = ($: Engine, name: string, answer = 'ok', reason: 'answer' | 'aborted' = 'answer') =>
  $.turn.complete({ turnId: `t-${name}`, agentId: `agent-${name}`, answer, durationMs: 10, isAborted: reason === 'aborted', reason })
const subCall = ($: Engine, agentId: string, input: Record<string, unknown>) => $.tool.call({ ...input, agentId } as unknown as Parameters<typeof $.tool.call>[0])
const widePane = ($: Engine, bodyColumns: number) =>
  $.ui.mount({
    plugin: 'sabai', surface: 'desktop', component: 'Pane', requestId: 'sabai-agents', viewport: { columns: bodyColumns, rows: 60 },
    props: { title: 'Agents', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 50 }, view: {} },
  })

test('a subagent runs in its lane with its clock and Thai line, then is done when its turn ends', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  await spawn($, 'api routes')
  await clock.advance(64_000)
  let ui = await mountPane($, 'desktop')
  expect((await laneOf(ui, 'api routes'))?.props.alt).toBe('api routes: Quiet 64s, 1m 4s. Quiet 64s')
  expect((await headOf(await viewed(ui, 'api routes')))?.props.alt).toContain('Explore · Sonnet 5.5')
  await ui.unmount()
  await finish($, 'api routes')
  ui = await mountPane($, 'desktop')
  expect((await laneOf(ui, 'api routes'))?.props.alt).toMatch(/^api routes: Done, 1m 4s\./)
})

test('a subagent’s own task list shows in its detail, never the band’s row', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'scan')
  await $.tool.call({ tool: 'TaskCreate', subject: 'main work', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: String('main work'.length), status: 'in_progress' })
  await subCall($, 'agent-scan', { tool: 'TodoWrite', todos: [{ content: 'read', status: 'completed', activeForm: 'Reading' }, { content: 'sum up', status: 'in_progress', activeForm: 'Summing up' }] })
  const band = await shown($, 'desktop')
  expect(band.words).toContain('main work')
  expect(band.words).not.toMatch(/main work: [^;]*Summing up/)
  const ui = await viewed(await mountPane($, 'desktop'), 'scan')
  expect((await headOf(ui))?.props.source).toContain('>1/2<')
  // The Task tools are its progress, not calls in its log.
  expect((await svgsOf(ui)).some(s => s.props.alt.startsWith('Tools:'))).toBe(false)
})

test('every call of a subagent lands in its detail: tools by group, the activity and the files', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'worker')
  const id = 'agent-worker'
  await subCall($, id, { tool: 'Read', file_path: '/work/hooks/svg.ts' })
  await subCall($, id, { tool: 'Grep', pattern: 'on\\(', path: '/work/hooks' })
  await subCall($, id, { tool: 'Skill', skill: 'superpowers:brainstorming' })
  await subCall($, id, { tool: 'mcp__context7__query-docs', query: 'x' })
  await subCall($, id, { tool: 'Edit', file_path: '/work/hooks/agents.ts', old_string: 'a', new_string: 'a\nb\nc' })
  await subCall($, id, { tool: 'Read', file_path: '/private/tmp/scratch/sim/math.ts' })
  const ui = await viewed(await mountPane($, 'desktop'), 'worker')
  const alts = await altsOf(ui)
  expect(alts.find(a => a.startsWith('Tools:'))).toBe('Tools: Read 2×, Grep 1×, Edit 1×, superpowers:brainstorming 1×, context7 · query-docs 1×')
  expect(alts.find(a => a.startsWith('Calls:'))).toContain('Read svg.ts worked; Grep on\\( · hooks worked; Skill superpowers:brainstorming worked; context7 · query-docs worked; Edit agents.ts worked')
  // Paths under the project are shown from its root; an edit counts its lines.
  // Paths outside it keep their last two folders.
  expect(alts.find(a => a.startsWith('Files:'))).toBe('Files: hooks/agents.ts +2 −0; read hooks/svg.ts, …/scratch/sim/math.ts')
  // The detail counts the calls the race's own hooks leave out too.
  expect(await ui.find({ type: 'Text', text: ' · 6' })).toBeDefined()
  // A call of the main loop is not an agent's.
  await ui.unmount()
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as unknown as Parameters<typeof $.tool.call>[0])
  expect((await altsOf(await viewed(await mountPane($, 'desktop'), 'worker'))).find(a => a.startsWith('Tools:'))).toContain('Grep 1×')
})

test('Main’s MCP call runs in its race lane in the pane’s words; after it, the lane says how long Main has thought', async ($, on) => {
  let finishCall = () => {}
  on('tool.call', { tool: 'mcp__Claude_Browser__computer' } as never, () => new Promise(done => (finishCall = () => done({ result: {} } as never))) as never)
  const { clock } = engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'work' } as never)
  await spawn($, 'scout')
  const call = $.tool.call({ tool: 'mcp__Claude_Browser__computer', action: 'screenshot' } as never)
  await settle()
  const during = await shown($, 'desktop', true)
  expect(during.words).toContain('Main running: Using Browser · computer')
  // Its lane leads with the MCP plug, pulsing, not the race's terminal.
  expect(during.sources).toMatch(/<g class="st-pulse"><use href="#sabai-du-plug"/)
  finishCall()
  await call
  await clock.advance(3000)
  expect((await shown($, 'desktop', true)).words).toContain('Main thinking: Thinking 3s, 1 MCP server')
  const lane = await laneOf(await mountPane($, 'desktop'), 'Main')
  expect(lane?.props.alt).toContain('Thinking 3s · last: Browser · computer. Used Browser')
})

test('the race follows the Subagents switch, not Activity', async ($, on) => {
  engine(on, { store: { prefs: { rows: { live: false } } } })
  panes(on)
  await start($)
  await spawn($, 'scout')
  expect((await shown($, 'desktop')).words).toContain('Race: 1 running')
})

test('Settings says what Activity shows: the line of what Main is doing, not the race', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  const ui = await mountPane($, 'desktop', 'sabai-skins')
  expect(await ui.find({ type: 'Text', text: /Activity is the line of what Main is doing; the race follows Subagents/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /race on a wide window/ })).toBeUndefined()
})

test('a workflow agent started from inside a turn’s subagent still counts as its workflow run', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'lead')
  await $.agent.spawn({ tool_use_id: 'tu-wfc', prompt: 'go', description: 'wf child', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false, parentAgentId: 'agent-lead', workflow: { runId: 'wf_7', agentIndex: 1 } } as never)
  expect(await (await mountPane($, 'desktop')).find({ type: 'Text', text: ' · 1 workflow run · 2 running' })).toBeDefined()
})

test('Earlier counts its groups by origin: turns and workflow runs', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'one' } as never)
  await $.agent.spawn({ tool_use_id: 'tu-wfa', prompt: 'go', description: 'wfa', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false, workflow: { runId: 'wf_9', agentIndex: 1 } })
  await finish($, 'wfa')
  await clock.advance(60_000)
  await $.turn.start({ turnId: 'two' } as never)
  await spawn($, 'live')
  expect(await (await mountPane($, 'desktop')).find({ type: 'Text', text: ' · 1 workflow run · ✓ 1' })).toBeDefined()
})

test('a teammate of an agent team says so in its head: it is no subagent', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await $.agent.spawn({ tool_use_id: 'tu-mate', prompt: 'go', description: 'mate', subagentType: 'researcher', isTeammate: true, provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
  expect((await headOf(await viewed(await mountPane($, 'desktop'), 'mate')))?.props.alt).toContain('researcher · teammate')
})

test('a subagent’s test run that fails on stderr fails in its detail too, as the race counts it', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: 'bun test v1\n\n 8 pass\n 1 fail\nRan 9 tests across 1 file. [1s]', interrupted: false } }))
  engine(on)
  panes(on)
  await start($)
  await spawn($, 'tester')
  await subCall($, 'agent-tester', { tool: 'Bash', command: 'bun test', description: '' })
  const alts = await altsOf(await viewed(await mountPane($, 'desktop'), 'tester'))
  expect(alts.find(a => a.startsWith('Calls:'))).toContain('failed')
})

test('a summary Haiku was writing when the mod reloaded is asked for again, not left pending', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  const answers: ((text: string) => void)[] = []
  on('model.complete', () => new Promise(done => answers.push(text => done({ value: { isAnswered: true, text, usage: {} } } as never))) as never)
  await start($)
  await spawn($, 'slow')
  await finish($, 'slow', 'a report')
  await clock.advance(1)
  // A reload sets the mod up again over the state it left; the first ask went with the old module.
  await start($)
  await clock.advance(1)
  await settle()
  expect(answers.length).toBe(2)
  answers[1]!('- สรุปใหม่')
  await settle()
  const ui = await viewed(await mountPane($, 'desktop'), 'slow')
  expect((await markdownsOf(ui))[0]?.props.text).toBe('- สรุปใหม่')
})

test('at most two Haiku summaries are asked at once; the rest wait their turn', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  const answers: ((text: string) => void)[] = []
  on('model.complete', () => new Promise(done => answers.push(text => done({ value: { isAnswered: true, text, usage: {} } } as never))) as never)
  await start($)
  for (const name of ['one', 'two', 'three']) {
    await spawn($, name)
    await finish($, name, `${name} report`)
  }
  await clock.advance(1)
  await settle()
  expect(answers.length).toBe(2)
  answers[0]!('- เสร็จ')
  await settle()
  expect(answers.length).toBe(3)
})

test('a summary lands on the round it read, though more work ended a round before Haiku answered', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  steps(on)
  const answers: ((text: string) => void)[] = []
  on('model.complete', () => new Promise(done => answers.push(text => done({ value: { isAnswered: true, text, usage: {} } } as never))) as never)
  await start($)
  await spawn($, 'twice')
  await finish($, 'twice', 'first report')
  await clock.advance(1)
  await step($, 'agent-twice')
  await finish($, 'twice', 'second report')
  await clock.advance(1)
  await settle()
  expect(answers.length).toBe(2)
  answers[0]!('- รอบแรก')
  await settle()
  answers[1]!('- รอบสอง')
  await settle()
  const ui = await viewed(await mountPane($, 'desktop'), 'twice')
  expect((await markdownsOf(ui))[0]?.props.text).toBe('- รอบสอง')
})

test('a finished agent’s report is summed up in Thai by Haiku; with the toggle off, or no answer, there is none', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  const asked: { model: string; prompt: string }[] = []
  on('model.complete', ($, e) => {
    asked.push({ model: e.model, prompt: e.prompt })
    return { value: e.prompt.includes('silent') ? { isAnswered: false, reason: 'empty-reply' } : { isAnswered: true, text: '- นับ hook ได้ 30 จุด\n- ไม่ได้แก้ไฟล์', usage: {} } } as never
  })
  await start($)
  await spawn($, 'count')
  await finish($, 'count', 'Found 30 hooks.')
  let ui = await viewed(await mountPane($, 'desktop'), 'count')
  expect(await ui.find({ type: 'Text', text: 'Haiku is summing up…' })).toBeDefined()
  await ui.unmount()
  await clock.advance(5)
  await settle()
  ui = await mountPane($, 'desktop')
  expect(asked[0]?.model).toBe('haiku')
  expect(asked[0]?.prompt).toContain('Found 30 hooks.')
  expect((await markdownsOf(ui))[0]?.props.text).toBe('- นับ hook ได้ 30 จุด\n- ไม่ได้แก้ไฟล์')
  expect(await ui.find({ type: 'Text', text: /^Read 0 files · changed 0 files · 0 calls · / })).toBeDefined()
  await ui.unmount()
  await spawn($, 'quiet')
  await finish($, 'quiet', 'silent')
  await clock.advance(5)
  await settle()
  ui = await mountPane($, 'desktop')
  await viewed(ui, 'quiet')
  expect(await ui.find({ type: 'Text', text: 'Haiku is summing up…' })).toBeUndefined()
  expect(await markdownsOf(ui)).toEqual([])
  await ui.unmount()
  // The toggle off: no call at all.
  await settingsCommand($)
  const settings = await mountPane($, 'desktop', 'sabai-skins')
  await settings.press({ key: 'pref-agentSummary' })
  await clock.advance(1)
  const before = asked.length
  await spawn($, 'third')
  await finish($, 'third', 'r')
  await clock.advance(5)
  await settle()
  expect(asked.length).toBe(before)
})

test('crews: a new turn’s agents are a new crew; the earlier one folds to a line, Show brings it back and Clear drops it', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'one' } as never)
  await spawn($, 'old')
  await finish($, 'old')
  await clock.advance(60_000)
  await $.turn.start({ turnId: 'two' } as never)
  await spawn($, 'live')
  const ui = await mountPane($, 'desktop')
  expect(await laneOf(ui, 'live')).toBeDefined()
  expect(await laneOf(ui, 'old')).toBeUndefined()
  // While a crew works the earlier ones fold to one line in their own box; Show opens it.
  expect(await ui.find({ type: 'Text', text: ' · 1 turn · ✓ 1' })).toBeDefined()
  expect(await ui.find({ key: 'clear-earlier' })).toBeUndefined()
  await ui.press({ key: 'fold-earlier' })
  expect((await ui.find({ key: 'fold-earlier' }))?.props.label).toBe('▾ Hide')
  expect((await altsOf(ui)).find(a => /^\d\d:\d\d · 1 subagent: 1 done/.test(a))).toContain('old')
  // One day's crews carry no day label.
  expect(await ui.find({ type: 'Text', text: 'TODAY' })).toBeUndefined()
  const show = (await ui.findAll({ type: 'Button' })).find(b => String(b.props.key).startsWith('show-'))!
  expect(show.props.label).toBe('▸ Show')
  await ui.press({ key: String(show.props.key) })
  expect(await laneOf(ui, 'old')).toBeDefined()
  await ui.press({ key: 'clear-earlier' })
  await clock.advance(1)
  expect(await laneOf(ui, 'old')).toBeUndefined()
  expect(await laneOf(ui, 'live')).toBeDefined()
  expect(await ui.find({ key: 'fold-earlier' })).toBeUndefined()
})

test('View opens an agent in Viewing and a second press or Close shuts it; with none viewed it invites one and names an agent that needs a look', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  await spawn($, 'a')
  await spawn($, 'b')
  await finish($, 'b')
  const ui = await mountPane($, 'desktop')
  // Nothing viewed: the invitation, and nobody needs a look yet.
  expect((await svgsOf(ui)).some(s => s.props.alt.startsWith('Pick one to view'))).toBe(true)
  expect(await headOf(ui)).toBeUndefined()
  await ui.press({ key: 'view-agent-b' })
  expect((await headOf(ui))?.props.alt).toMatch(/^b:/)
  expect((await ui.find({ key: 'view-agent-b' }))?.props.label).toBe('Viewing')
  expect((await ui.find({ key: 'view-agent-a' }))?.props.label).toBe('View')
  // Pressed again, the view closes.
  await ui.press({ key: 'view-agent-b' })
  expect(await headOf(ui)).toBeUndefined()
  await ui.press({ key: 'view-agent-b' })
  await ui.press({ key: 'close-detail' })
  expect(await headOf(ui)).toBeUndefined()
  // a goes quiet: the empty detail says so, and View it opens it.
  await clock.advance(61_000)
  expect(await ui.find({ type: 'Text', text: /^⚠ a: Quiet \d+s$/ })).toBeDefined()
  await ui.press({ key: 'view-needs-look' })
  expect((await headOf(ui))?.props.alt).toMatch(/^a: Quiet/)
})

test('Main has a lane of its own in the crew at work, with its calls in its detail; a turn with no agents is Claude’s alone', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'solo' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as unknown as Parameters<typeof $.tool.call>[0])
  let ui = await mountPane($, 'desktop')
  expect((await svgsOf(ui)).find(s => s.props.alt.startsWith('Main on the timeline: Main thinking'))).toBeDefined()
  expect(await laneOf(ui, 'Main')).toBeDefined()
  await ui.unmount()
  await $.turn.complete({ turnId: 'solo', answer: 'All done.', durationMs: 10, isAborted: false, reason: 'answer' })
  await clock.advance(60_000)
  // The next turn has agents: the solo turn is not kept, this one's Main heads its crew.
  await $.turn.start({ turnId: 'crew' } as never)
  await spawn($, 'helper')
  ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: /^Earlier/ })).toBeUndefined()
  // The box counts the agents; Main's lane tells its own state.
  expect(await ui.find({ type: 'Text', text: ' · 1 running' })).toBeDefined()
  // Main's lane is named so and wears its captain's cap.
  const mainLane = (await svgsOf(ui)).find(s => s.props.source.includes('height="42"') && s.props.alt.startsWith('Main:'))
  expect(mainLane?.props.source).toContain('>Main<')
  expect(mainLane?.props.source).toContain('#3a5899')
  await $.tool.call({ tool: 'Grep', pattern: 'y' } as unknown as Parameters<typeof $.tool.call>[0])
  const key = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.key)).find(k => k.startsWith('view-main:'))!
  await ui.press({ key })
  expect((await altsOf(ui)).find(a => a.startsWith('Tools:'))).toBe('Tools: Grep 1×')
  // Main's head names what Main is: the main conversation.
  expect((await headOf(ui))?.props.alt).toContain('main conversation')
  await ui.unmount()
  // A turn that ends calling nothing (a notification's) does not push the crew down.
  await $.turn.complete({ turnId: 'crew', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  await clock.advance(60_000)
  await $.turn.start({ turnId: 'ping' } as never)
  await $.turn.complete({ turnId: 'ping', answer: 'noted', durationMs: 10, isAborted: false, reason: 'answer' })
  ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: ' · 1 running' })).toBeDefined()
  expect(await laneOf(ui, 'helper')).toBeDefined()
  // Its turn over while its agent runs, Main waits on it, as the band says; no check yet.
  expect((await laneOf(ui, 'Main'))?.props.alt).toMatch(/^Main: Waiting on 1, .*Waiting on 1 subagent$/)
  await ui.unmount()
  // A turn of Main's alone puts the crew in Earlier, and Clear drops it.
  await finish($, 'helper')
  await $.turn.start({ turnId: 'solo again' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'z' } as unknown as Parameters<typeof $.tool.call>[0])
  ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: /running/ })).toBeUndefined()
  await ui.press({ key: 'fold-earlier' })
  await ui.press({ key: 'clear-earlier' })
  await clock.advance(1)
  expect(await ui.find({ key: 'fold-earlier' })).toBeUndefined()
  expect(await laneOf(ui, 'Main')).toBeDefined()
})
test('the report folds open as Markdown once an agent ends, a stop says so, and no colour is forced on native text', async ($, on) => {
  engine(on, { store: { skin: 'raised' } })
  panes(on)
  await start($)
  await spawn($, 'ok')
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ key: 'fold-report' })).toBeUndefined()
  await finish($, 'ok', '## Found\n- three launches')
  await spawn($, 'bad')
  await finish($, 'bad', '', 'aborted')
  await viewed(ui, 'ok')
  expect((await ui.find({ key: 'fold-report' }))?.props.label).toBe('▸ Show')
  await ui.press({ key: 'fold-report' })
  expect((await markdownsOf(ui)).map(m => m.props.text)).toContain('## Found\n- three launches')
  expect(JSON.stringify(await ui.drawn())).not.toContain('"backgroundColor"')
  await viewed(ui, 'bad')
  expect((await headOf(ui))?.props.alt).toMatch(/^bad: Stopped/)
  expect(await ui.find({ type: 'Text', text: 'Stopped before it finished.' })).toBeDefined()
})

test('an agent’s whole life through the hooks: spawn, steps with effort, own tasks, answer', async ($, on) => {
  engine(on)
  panes(on)
  steps(on)
  await start($)
  await spawn($, 'survey')
  const head = async () => {
    const ui = await viewed(await mountPane($, 'desktop'), 'survey')
    const h = await headOf(ui)
    await ui.unmount()
    return h?.props ?? { source: '', alt: '' }
  }
  await step($, 'agent-survey', 'xhigh')
  await step($, 'agent-survey', 'xhigh')
  let h = await head()
  expect(h.alt).toContain('Explore · Haiku 5.5 · xhigh effort')
  // The latest context, and every request's tokens summed.
  expect(h.source).toContain('>32k<')
  await step($, 'agent-survey', 32_000)
  expect((await head()).alt).toContain('Explore · Haiku 5.5 · budget 32k')
  await subCall($, 'agent-survey', { tool: 'TaskCreate', subject: 'Read', description: '' })
  await subCall($, 'agent-survey', { tool: 'TaskCreate', subject: 'Write up', description: '' })
  await subCall($, 'agent-survey', { tool: 'TaskUpdate', taskId: String('Read'.length), status: 'completed' })
  h = await head()
  expect(h.source).toContain('>1/2<')
  expect((await shown($, 'desktop')).words).not.toMatch(/tasks, \d+%/)
  // A step of the main loop is no step of the agent's (only its model's window is learned).
  const before = await head()
  await step($, '')
  expect((await head()).alt).toBe(before.alt)
  await finish($, 'survey', '## Found\n- 154 lines')
  const ui = await viewed(await mountPane($, 'desktop'), 'survey')
  await ui.press({ key: 'fold-report' })
  expect((await markdownsOf(ui)).map(m => m.props.text)).toContain('## Found\n- 154 lines')
})

test('a workflow agent says so in its detail, and its brief shows a line that More folds open', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  await $.agent.spawn({
    tool_use_id: 'tu-wf', prompt: 'Count the hooks.\nThen report.', description: 'fan out', subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5', background: true, fork: false, workflow: { runId: 'wf_1', agentIndex: 1 },
  })
  const ui = await viewed(await mountPane($, 'desktop'), 'fan out')
  expect((await headOf(ui))?.props.alt).toContain('general-purpose · Sonnet 5.5 · background · workflow')
  // The box names the group by its origin: a workflow run, not a turn.
  expect(await ui.find({ type: 'Text', text: ' · 1 workflow run · 1 running' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Count the hooks.…' })).toBeDefined()
  expect((await ui.find({ key: 'fold-brief' }))?.props.label).toBe('▸ More')
  await ui.press({ key: 'fold-brief' })
  expect(await ui.find({ type: 'Text', text: 'Count the hooks.\nThen report.' })).toBeDefined()
})

test('a finished agent sent more work joins the crew at work as its next round, its report kept', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  steps(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'one' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'x' } as unknown as Parameters<typeof $.tool.call>[0])
  await spawn($, 'scout')
  await finish($, 'scout', 'first report')
  await clock.advance(60_000)
  await $.turn.start({ turnId: 'two' } as never)
  await step($, 'agent-scout')
  const ui = await mountPane($, 'desktop')
  expect((await laneOf(ui, 'scout'))?.props.alt).toContain('Round 2 · ')
  // The first turn's Main, its agent gone to the turn at work, is no crew of its own.
  expect((await svgsOf(ui)).filter(s => s.props.source.includes('height="42"') && s.props.alt.startsWith('Main:')).length).toBe(1)
  expect(await ui.find({ type: 'Text', text: ' · 1 running' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^EARLIER/ })).toBeUndefined()
  await finish($, 'scout', 'second report')
  await viewed(ui, 'scout')
  await ui.press({ key: 'fold-report' })
  const md = (await markdownsOf(ui)).map(m => m.props.text)
  expect(md).toContain('second report')
  expect(md).toContain('**Round 1**\n\nfirst report')
})

test('agents report their own steps through the mod’s tool, a checklist in their detail', async ($, on) => {
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
  await subCall($, 'agent-worker', { tool: 'mcp__sabai__step', done: 1, total: 4, note: 'Reading the code' })
  const reply = await subCall($, 'agent-worker', { tool: 'mcp__sabai__step', done: 2, total: 4, note: 'Reading the docs' })
  expect(reply.result).toBe('ok')
  const ui = await viewed(await mountPane($, 'desktop'), 'worker')
  expect((await headOf(ui))?.props.source).toContain('>2/4<')
  expect((await altsOf(ui)).find(a => a.startsWith('Steps:'))).toBe('Steps: Reading the code; Reading the docs; 2 more')
  // The step tool is the agent's report, not a call in its log.
  expect((await altsOf(ui)).some(a => a.startsWith('Tools:'))).toBe(false)
})

test('the pane stays under the tree limit: forty agents, a wide fan-out, a wide pane in blocks with an agent viewed and every fold open', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock } = engine(on, { store: { bar: 'blocks' } })
  panes(on)
  turnStarts(on)
  await start($)
  for (let c = 0; c < 6; c++) {
    await $.turn.start({ turnId: `c${c}` } as never)
    for (let i = 0; i < 7; i++) {
      const name = `job ${c}-${i}`
      await spawn($, name)
      for (let k = 0; k < 12; k++) await subCall($, `agent-${name}`, { tool: 'Read', file_path: `/work/src/file-${k}.ts` })
      await subCall($, `agent-${name}`, { tool: 'Edit', file_path: `/work/src/file-${i}.ts`, old_string: 'a', new_string: 'b' })
      // The agent viewed below: a full log of long commands, whose titles fill its calls' alt.
      if (c === 5 && i === 6) for (let k = 0; k < 60; k++) await subCall($, `agent-${name}`, { tool: 'Bash', command: `echo "${k} ${'x'.repeat(300)}"` })
      if (c < 5 || i > 1) await finish($, name, 'r'.repeat(5000))
    }
    await clock.advance(60_000)
  }
  for (const bodyColumns of [40, 160, 496]) {
    const ui = await widePane($, bodyColumns)
    // The view stays across mounts: pressed only while closed.
    await viewed(ui, 'job 5-6')
    expect(await ui.find({ key: 'close-detail' })).toBeDefined()
    for (const key of ['fold-report', 'fold-brief', 'fold-calls']) if (/^▸|^All calls$/.test(String((await ui.find({ key }))?.props.label ?? ''))) await ui.press({ key })
    if ((await ui.find({ key: 'fold-earlier' }))?.props.label === '▸ Show') await ui.press({ key: 'fold-earlier' })
    const shows = (await ui.findAll({ type: 'Button' })).map(b => String(b.props.key)).filter(k => k.startsWith('show-'))
    // A pane 4,000 px wide spends its budget on the detail viewed; the earlier lines go first.
    if (bodyColumns <= 160) expect(shows.length).toBe(4)
    for (const key of shows) await ui.press({ key })
    const size = JSON.stringify(await ui.drawn()).length
    expect([bodyColumns, size < 100_000]).toEqual([bodyColumns, true])
    await ui.unmount()
  }
  // Twenty at work in one crew: the lanes that do not fit are counted.
  await $.turn.start({ turnId: 'fan' } as never)
  for (let i = 0; i < 20; i++) await spawn($, `fan ${i}`)
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ type: 'Text', text: /^\+\d+ more$/ })).toBeDefined()
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
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
  expect((await shown($, 'desktop')).words).toContain('Folder other-project')
})

test('the crew row leaves the band a minute after the last agent ends', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  await spawn($, 'quick job')
  await $.turn.complete({ turnId: 't', agentId: 'agent-quick job', answer: 'ok', durationMs: 10, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop')).words).toContain('Subagents: 1 done')
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
  // Off, the usage group keeps only its head.
  expect(await pane.find({ key: 'usage-tiles' })).toBeUndefined()
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
  expect(toasts).toEqual(['Session limit at 92% — resets in 5h 0m'])
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

test('a guard that fails after the decision beneath is reached asks no one and denies', async ($, on) => {
  let broken = false
  engine(on)
  // The prefs come back unreadable once the decision beneath was already reached.
  on('state.get', async (_$, e, next) => {
    const got = await next(e)
    // A read answers `{ value: { value, version } }`; the prefs' rules come back unreadable.
    return broken && e.key === 'prefs' && got.value ? ({ value: { ...got.value, value: { guard: true, guardRules: null } } } as typeof got) : got
  })
  panes(on)
  allowBeneath(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  await guardOn($)
  broken = true
  expect(await check($, 'git reset --hard')).toEqual({ decision: 'deny', reason: expect.stringMatching(/could not check/) })
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

test('the guard’s shield counts what the guard caught this session', async ($, on) => {
  engine(on)
  panes(on)
  allowBeneath(on)
  on('ui.toast', () => ({ value: undefined }))
  await start($)
  await guardOn($)
  expect((await shown($, 'desktop')).words).toContain('Guard on. Opens settings')
  await bash($, 'rm -rf /')
  await check($, 'git reset --hard')
  expect((await shown($, 'desktop')).words).toContain('Guard on, 2 caught')
})

test('prefs saved by 2.0.0 load with each guard rule at its default', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true }, notify: true, limits: true, guard: true, steps: true, chat: { tools: true, tests: true, callouts: true } } } })
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
// The receipt under a reply, by its drawing's alt.
async function receiptUnder($: Engine, surface: Surface, text: string) {
  const ui = await mountReply($, surface, text)
  const words = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('')
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

test('settings choose the band’s chips, cards, thresholds and Clawd; old prefs keep everything', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  expect((await shown($, 'desktop')).words).toContain('Git user Panupat')
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await pane.press({ key: 'pref-show-gitUser' })
  await pane.press({ key: 'pref-show-week' })
  await pane.press({ key: 'warn-60' })
  const after = (await shown($, 'desktop')).words
  expect(after).not.toContain('Git user')
  expect(after).not.toContain('Weekly limit')
  for (const key of ['pref-show-folder', 'pref-show-node', 'pref-show-context', 'pref-show-session', 'pref-show-clawd', 'alert-95']) expect([key, await pane.find({ key })]).not.toEqual([key, undefined])
})

test('with every chip and Clawd hidden and nothing else to show, the band is left to the engine', async ($, on) => {
  engine(on, { hasLimits: false, store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: false, toolbar: false }, show: { folder: false, gitUser: false, branch: false, node: false, clawd: false } } } })
  await start($)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toBe('stock row')
})

test('the density setting switches the band to compact', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  const height = async () => {
    const ui = await mountBand($, 'desktop')
    const svg = (await bandOf(ui))
    await ui.unmount()
    return Number(String(svg?.props.source).match(/height="(\d+)"/)?.[1])
  }
  const roomy = await height()
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await choose(pane, clock, 'density-compact')
  expect(await height()).toBeLessThan(roomy)
})

test('a rising session limit shows no forecast on either surface', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  for (let i = 0; i <= 20; i++) {
    await $.session.measure({ context: { window: 1_000_000, tokens: 1000, percent: 1 }, rateLimits: [{ kind: 'five_hour', percentUsed: 20 + i, resetsAt: '2026-10-10T05:00:00Z' }], changed: ['rateLimits'] })
    await clock.advance(60_000)
  }
  await settle()
  expect((await shown($, 'desktop')).words).not.toContain('by reset')
  expect((await shown($, 'terminal')).words).not.toContain('→')
})

test('while the main turn works the band shows the live strip with the step in flight; a subagent’s calls do not', async ($, on) => {
  let release: () => void = () => undefined
  on('tool.call', { tool: 'Bash' }, () => new Promise(r => (release = () => r({ result: { stdout: '', stderr: '', interrupted: false } }))))
  engine(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'live' } as never)
  const running = $.tool.call({ tool: 'Bash', command: 'npm run build', description: 'Build it' } as Parameters<typeof $.tool.call>[0])
  await settle()
  expect((await shown($, 'desktop', true)).words).toContain('Build it')
  release()
  await running
  // Between calls the strip times its thought, as the race does.
  expect((await shown($, 'desktop', true)).words).toMatch(/Thinking \d+s/)
  await $.tool.call({ tool: 'Read', file_path: '/w/a.ts', agentId: 'agent-x' } as Parameters<typeof $.tool.call>[0])
  expect((await shown($, 'desktop', true)).words).not.toContain('Reading a.ts')
  await $.turn.complete({ turnId: 'live', answer: 'ok', durationMs: 1000, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop', false)).words).not.toContain('Working')
})

test('with the live strip off, the turn’s time still stands under Clawd', async ($, on) => {
  const { clock } = engine(on, { store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true, live: false } } } })
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'quiet' } as never)
  await clock.advance(3000)
  expect((await shown($, 'desktop', true)).words).toContain('3s')
})

test('stored styles named after Object’s own keys fall back to the defaults', async ($, on) => {
  engine(on, { store: { bar: 'constructor', prefs: { usageStyle: 'toString' } } })
  await start($)
  const source = String((await bandOf(await mountBand($, 'desktop')))!.props.source)
  expect(source).not.toContain('[object')
})

test('the second clock runs only while work does: an idle session reads no subagents each second', async ($, on) => {
  const { clock } = engine(on)
  turnStarts(on)
  let reads = 0
  on('state.get', async (_$, e, next) => {
    if (e.key === 'agents') reads++
    return next(e)
  })
  await start($)
  // Set up, it looks once for work that outlived a reload, then stops.
  await clock.advance(1000)
  reads = 0
  await clock.advance(10_000)
  expect(reads).toBe(0)
  await $.turn.start({ turnId: 'work' } as never)
  await clock.advance(3000)
  expect(reads).toBeGreaterThan(0)
  await $.turn.complete({ turnId: 'work', answer: 'ok', durationMs: 3000, isAborted: false, reason: 'answer' })
  await clock.advance(2000)
  reads = 0
  await clock.advance(10_000)
  expect(reads).toBe(0)
})

test('a turn that outlived a reload still counts by the second: its state, not the module, says it works', async ($, on) => {
  const { clock } = engine(on)
  // State survives a hot reload; the module starts over and never saw this turn start.
  on('state.get', async (_$, e, next) => {
    const got = await next(e)
    return e.key === 'turnStartedAt' && got.value ? ({ value: { ...got.value, value: NOW } } as typeof got) : got
  })
  await start($)
  await clock.advance(3000)
  // With no agents the live strip carries the turn's time.
  expect((await shown($, 'desktop', true)).words).toContain('Clawd: Working, 3s; Working: Thinking 3s;')
})

test('the band’s Clawd wears the hour’s accessory', async ($, on) => {
  const { clock } = engine(on)
  await clock.set(new Date('2026-10-31T12:00:00').getTime())
  await start($)
  await clock.advance(30_000)
  const ui = await mountBand($, 'desktop')
  expect(String((await bandOf(ui))?.props.source)).toContain('#f28c28')
  await ui.unmount()
})

test('every row on, nine agents, the race with 60 calls and a hat stay under the tree limit', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  turnStarts(on)
  await clock.set(new Date('2026-12-24T12:00:00').getTime())
  await start($)
  for (let i = 0; i < 9; i++) await spawn($, `job ${i}`)
  await $.turn.start({ turnId: 'big' } as never)
  for (let i = 0; i < 60; i++) await bash($, `npm run step-${i}`)
  const ui = await mountBand($, 'desktop', true)
  // The race is in it.
  const svg = String((await bandOf(ui))?.props.source)
  expect(svg).toMatch(/>\d+ running</)
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
  expect(String((await bandOf(ui))?.props.source).length).toBeLessThanOrEqual(131_072)
  await ui.unmount()
})

test('a wide band with every limit near full, tasks, agents and the race stays under the tree limit in every usage style', async ($, on) => {
  const { clock } = engine(on, { percents: [100, 100, 100], contextTokens: 200_000 })
  panes(on)
  turnStarts(on)
  await start($)
  // Ids are the subjects' lengths: 5 to 16; half are done, so the tasks bar is half full.
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'TaskCreate', subject: `task ${'x'.repeat(i)}`, description: '' })
  for (let i = 5; i < 11; i++) await $.tool.call({ tool: 'TaskUpdate', taskId: String(i), status: 'completed' })
  for (let i = 0; i < 9; i++) await spawn($, `job ${i}`)
  await $.turn.start({ turnId: 'wide' } as never)
  for (let i = 0; i < 20; i++) await bash($, `npm run step-${i}`)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  for (const style of ['tiles', 'rings', 'columns', 'rows']) {
    await choose(pane, clock, `usage-${style}`)
    for (const columns of [194, 300, 496]) {
      const ui = await mountBand($, 'desktop', true, columns)
      expect([style, columns, JSON.stringify(await ui.drawn()).length < 100_000]).toEqual([style, columns, true])
      await ui.unmount()
    }
  }
})

test('the comfortable band draws the Clawd panel; compact keeps the stacked band', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  const source = async () => {
    const ui = await mountBand($, 'desktop')
    const s = String((await bandOf(ui))?.props.source)
    await ui.unmount()
    return s
  }
  expect(await source()).toMatch(/scale\(3\)/)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await choose(pane, clock, 'density-compact')
  expect(await source()).not.toMatch(/scale\(3\)/)
})

test('each member’s calls land in its own lane; the header counts the turn’s failures', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, (_, e) =>
    (e as { command: string }).command === 'bun test'
      ? { result: { stdout: 'bun test v1\n\n 9 pass\n 0 fail\nRan 9 tests across 1 file. [1s]', stderr: '', interrupted: false } }
      : (e as { command: string }).command === 'false'
        ? ({ result: 'Exit code 1', isError: true } as never)
        : { result: { stdout: '', stderr: '', interrupted: false } },
  )
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await spawn($, 'x')
  await $.turn.start({ turnId: 'r' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/w/a.ts', agentId: 'agent-x' } as Parameters<typeof $.tool.call>[0])
  await bash($, 'bun test')
  await bash($, 'false')
  const words = (await shown($, 'desktop', true)).words
  expect(words).toMatch(/Race: 1 running, 1 failed call/)
  expect(words).toMatch(/Main (tripped|running|thinking)/)
  // The agent's lane names its latest call; Main's counts its failure.
  // Between calls its lane says how long it has thought since.
  expect(words).toContain('x running: Thinking 0s |')
  expect(words).toMatch(/Main \w+: [^;]*, 1 failed/)
})

test('the race shows only with agents, and leaves when the turn ends and no agent runs', async ($, on) => {
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'x' } as never)
  // Main alone: the live strip tells the turn.
  expect((await shown($, 'desktop', true)).words).not.toContain('Race:')
  await spawn($, 'x')
  await finish($, 'x')
  expect((await shown($, 'desktop', true)).words).toContain('Race:')
  await $.turn.complete({ turnId: 'x', answer: 'ok', durationMs: 1000, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop', false)).words).not.toContain('Race:')
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
  expect((await shown($, 'desktop')).words).toContain('Clawd: Tests failing')
  await guardOn($)
  await bash($, 'rm -rf /')
  expect((await shown($, 'desktop')).words).toContain('Clawd: Blocked, Guard stopped 1')
})

test('the band with every row, a full crew and Clawd in the info row stays under the tree limit', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  for (let i = 0; i < 6; i++) await spawn($, `job ${i}`)
  const ui = await mountBand($, 'desktop', true)
  expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
  const svg = (await bandOf(ui))
  expect(String(svg?.props.source)).toContain('class="run"')
  expect(String(svg?.props.source).length).toBeLessThanOrEqual(131_072)
  await ui.unmount()
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

// The words of a chat line: its drawings by their alt.
const lineWords = async (ui: Awaited<ReturnType<typeof mountTool>>) => (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('')

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
    expect([surface, await lineWords(ui)]).toEqual([surface, expect.stringMatching(/npm run build.*Done.*4\.2s/)])
  }
})

test('an untimed quick Bash row, another tool, or the toggle off pass straight through', async ($, on) => {
  engine(on, { store: { prefs: { chat: { tools: false, tests: true, callouts: true, label: true } } } })
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

test('Edit, Write and Read rows gain their summary', async ($, on) => {
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
  engine(on, { store: { prefs: { chat: { tools: true, tests: false, callouts: true, label: true } } } })
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
  engine(on, { store: { prefs: { chat: { tools: true, tests: true, callouts: false, label: true } } } })
  on('prompt.compose', () => ({ sections: [{ id: 'core', text: 'base', scope: 'shared' as const }] }))
  await start($)
  expect((await $.prompt.compose(FACTS)).sections.map(s => s.id)).toEqual(['core'])
  expect(await isStock(await mountReply($, 'desktop', '> [!TIP]\n> x'))).toBe(true)
})

test('settings: each chat feature has its own toggle, kept for new sessions', async ($, on) => {
  const { store } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  for (const k of ['tools', 'tests', 'callouts']) expect([k, (await pane.find({ key: `pref-chat-${k}` }))?.props.label]).toEqual([k, '● On'])
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
  expect(await alt('auto1', 'make')).toEqual(['make, Done, 6.0s'])
  expect(await alt('ask1', 'rm x')).toEqual(['rm x, Done'])
})

test('a quick command the mod did not time still gets its line', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountTool($, 'desktop', { tool_use_id: 'q', tool: 'Bash', input: { command: 'ls' }, output: { stdout: '', stderr: '', interrupted: false } })
  expect((await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt))).toEqual(['ls, Done'])
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

test('the guard stands at the right of the top row as a green shield', async ($, on) => {
  engine(on, { store: { prefs: { guard: true } } })
  const open = panes(on)
  await start($)
  const ui = await mountBand($, 'desktop')
  // The info row leaves it out; the shield leads the toolbar's icons, and opens the settings.
  expect(String((await ui.findAll({ type: 'Svg' }))[0]?.props.alt)).toBe('Folder work, Git user Panupat, Branch main ↑2 ↓1 ±2, Node v24.1.0')
  const [guard, ...rest] = await toolsOf(ui)
  expect([guard?.key, guard?.alt, rest.map(t => t.key)]).toEqual(['tool-guard', 'Guard on. Opens settings', ['tool-compact', 'tool-agents', 'tool-settings']])
  // Nothing caught yet: the shield alone.
  expect(guard?.icon).not.toContain('<text')
  expect(guard?.icon).toContain('<rect class="c-ok"')
  await pressTool(ui, 'guard')
  expect([...open]).toEqual(['sabai-skins'])
})

test('the guard chip follows the guard alone: off, no chip; an old Guard label setting is ignored', async ($, on) => {
  engine(on, { store: { prefs: { guard: false } } })
  await start($)
  expect((await shown($, 'desktop')).words).not.toContain('guard')
})

test('a guard turned on shows its chip even where an older version saved Guard label off', async ($, on) => {
  engine(on, { store: { prefs: { guard: true, chat: { tools: true, tests: true, callouts: true, label: false } } } })
  await start($)
  expect((await shown($, 'desktop')).words).toContain('Guard on')
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
  expect(await alt('own1')).toEqual(['make, Done, 1.5s'])
  expect(await alt('other')).toEqual(['make, Done'])
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

test('settings are eight bordered groups in order: look, usage, info row, Clawd, agents, conversation, guard, notifications', async ($, on) => {
  engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  const cards = (await pane.findAll({ type: 'Box' })).filter(b => b.props.borderStyle === 'round')
  const titles = ['Look', 'Usage', 'Info row', 'Clawd', 'Subagents', 'Conversation', 'Guard', 'Notifications']
  expect(cards.length).toBe(titles.length)
  const words = (await pane.findAll({ type: 'Text' })).map(t => t.text).join(' | ')
  const order = titles.map(t => words.indexOf(`  ${t}`))
  expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true)
  for (const k of ['pref-chat-tools', 'pref-steps', 'pref-guard', 'pref-notify', 'bar-dither', 'skin-auto', 'density-compact', 'usage-rows']) expect([k, await pane.find({ key: k })]).not.toEqual([k, undefined])
})

test('settings preview what they change: the layout in use, the usage in its style, the info row, the chat; a part off keeps only its head', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  const svgs = async () => (await pane.findAll({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } }[]
  const alts = async () => (await svgs()).map(s => s.props.alt)
  const chosen = async (prefix: string) => (await picksOf(pane, prefix)).map(c => c.alt)
  expect(await chosen('density')).toEqual(['Comfortable layout, in use', 'Compact layout'])
  await choose(pane, clock, 'density-compact')
  expect(await chosen('density')).toEqual(['Comfortable layout', 'Compact layout, in use'])
  expect(await chosen('usage')).toEqual(['Tiles usage, in use', 'Rings usage', 'Columns usage', 'Rows usage'])
  await choose(pane, clock, 'usage-rings')
  expect(await chosen('usage')).toEqual(['Tiles usage', 'Rings usage, in use', 'Columns usage', 'Rows usage'])
  // Each style's sketch is its own: the rings' alone draws a ring.
  expect((await picksOf(pane, 'usage')).map(c => c.source.includes('stroke-dasharray'))).toEqual([false, true, false, false])
  expect((await alts()).some(a => a.startsWith('Folder work'))).toBe(true)
  await pane.press({ key: 'pref-show-folder' })
  expect((await alts()).some(a => a.includes('Folder'))).toBe(false)
  // The chat's samples follow its toggles.
  expect((await alts()).filter(a => /Edited svg\.ts|Run the tests|Turn receipt/.test(a))).toHaveLength(3)
  await pane.press({ key: 'pref-chat-tools' })
  expect((await alts()).filter(a => /Edited svg\.ts|Run the tests|Turn receipt/.test(a))).toHaveLength(1)
  for (const [power, inside] of [['pref-info', 'pref-show-node'], ['pref-show-clawd', 'pref-extras-tricks']] as const) {
    await pane.press({ key: power })
    expect([power, await pane.find({ key: inside })]).toEqual([power, undefined])
  }
  // Agents off still lets step reports be set: they feed the agents pane too.
  await pane.press({ key: 'pref-crew' })
  expect(await pane.find({ key: 'pref-steps' })).toBeDefined()
  // Every preview drawn, on the widest pane, the tree stays under the limit.
  await pane.unmount()
  for (const bodyColumns of [40, 160, 496]) {
    const wide = await $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'Pane', requestId: 'sabai-skins', viewport: { columns: 500, rows: 30 }, props: { title: 'Settings', isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } })
    for (const key of ['pref-info', 'pref-show-clawd', 'pref-chat-tools', 'pref-guard']) await wide.press({ key })
    const size = JSON.stringify(await wide.drawn()).length
    expect([bodyColumns, size < 100_000]).toEqual([bodyColumns, true])
    await wide.unmount()
  }
})

for (const bar of ['dither', 'blocks', 'solid'] as const)
  for (const usageStyle of ['tiles', 'rings', 'columns', 'rows'] as const)
    test(`the widest band, every row on, stays under the limits with ${bar} bars and ${usageStyle}`, async ($, on) => {
      const { clock } = engine(on, { store: { bar, prefs: { usageStyle } } })
      panes(on)
      turnStarts(on)
      await clock.set(new Date('2026-12-24T12:00:00').getTime())
      await start($)
      for (let i = 0; i < 5; i++) await spawn($, `job ${i}`)
      await $.turn.start({ turnId: 'wide' } as never)
      for (let i = 0; i < 20; i++) await bash($, `npm run step-${i}`)
      await clock.advance(1000)
      const ui = await $.ui.mount({
        plugin: 'sabai', surface: 'desktop', component: 'AbovePrompt', requestId: 'band', viewport: { columns: 500, rows: 30 },
        props: { hasSurvey: false, isWorking: true, maxRows: 8, bodyColumns: 496, scroll: { offset: 0, bodyRows: 8 }, view: {} },
      })
      const source = String((await bandOf(ui))?.props.source)
      expect(source).toContain('class="usage"')
      expect(source).toMatch(/×\d/)
      expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(100_000)
      expect(source.length).toBeLessThanOrEqual(131_072)
      await ui.unmount()
    })

test('an Edit that throws leaves Main’s lane holding nothing', async ($, on) => {
  on('tool.call', { tool: 'Edit' }, () => Promise.reject(new Error('interrupted')))
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'cut' } as never)
  await spawn($, 'x')
  await $.tool.call({ tool: 'Edit', file_path: '/w/a.ts', old_string: 'a', new_string: 'b', replace_all: false } as Parameters<typeof $.tool.call>[0]).catch(() => undefined)
  const words = (await shown($, 'desktop', true)).words
  expect(words).toContain('Main thinking')
})

test('Clawd waves when a turn ends and stops after the wave', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  const source = async () => {
    const ui = await mountBand($, 'desktop')
    const s = String((await bandOf(ui))?.props.source)
    await ui.unmount()
    return s
  }
  await $.turn.complete({ turnId: 't', answer: 'ok', durationMs: 1000, isAborted: false, reason: 'answer' })
  await clock.advance(100)
  expect(await source()).toContain('class="wave"')
  await clock.advance(3100)
  expect(await source()).not.toContain('class="wave"')
})

test('with tricks off Clawd does not wave', async ($, on) => {
  const { clock } = engine(on, { store: { prefs: { extras: { accessories: true, tricks: false } } } })
  panes(on)
  await start($)
  await $.turn.complete({ turnId: 't', answer: 'ok', durationMs: 1000, isAborted: false, reason: 'answer' })
  await clock.advance(100)
  const ui = await mountBand($, 'desktop')
  expect(String((await bandOf(ui))?.props.source)).not.toContain('class="wave"')
  await ui.unmount()
})

test('a race computed under 760 px is not drawn, so Clawd does not look right', async ($, on) => {
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'n' } as never)
  const ui = await $.ui.mount({ plugin: 'sabai', surface: 'desktop', component: 'AbovePrompt', requestId: 'band', viewport: { columns: 80, rows: 30 }, props: { hasSurvey: false, isWorking: true, maxRows: 8, bodyColumns: 80, scroll: { offset: 0, bodyRows: 8 }, view: {} } })
  expect(String((await bandOf(ui))?.props.source)).not.toContain('look-right')
  await ui.unmount()
})

test('settings: groups in order, pill toggles, the usage style, extras and reset', async ($, on) => {
  const { clock } = engine(on)
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  const labels = async () => (await pane.findAll({ type: 'Button' })).map(b => String(b.props.label))
  const all = await labels()
  for (const l of ['● Tasks', '● Activity', '● Toolbar', '● Folder', '● Context', '● Hats and props', '● Tricks', 'Dither', 'Reset to defaults']) expect([l, all.includes(l)]).toEqual([l, true])
  const text = JSON.stringify(await pane.drawn())
  const order = ['Look', 'Usage', 'Info row', 'Clawd', 'Subagents', 'Conversation', 'Guard', 'Notifications'].map(g => text.indexOf(`  ${g}`))
  expect(order.every(i => i >= 0)).toBe(true)
  expect(order).toEqual([...order].sort((a, b) => a - b))
  await pane.press({ key: 'pref-show-folder' })
  expect(await labels()).toContain('○ Folder')
  await choose(pane, clock, 'usage-rings')
  const svg = async () => {
    const band = await mountBand($, 'desktop')
    const s = String((await bandOf(band))?.props.source)
    await band.unmount()
    return s
  }
  expect(await svg()).toContain('stroke-dasharray')
  await pane.press({ key: 'pref-extras-tricks' })
  expect(await labels()).toContain('○ Tricks')
  await choose(pane, clock, 'skin-auto')
  expect(await svg()).toContain('.p{fill:#f4f4f2}')
  // The first press only asks; the second, within five seconds, resets.
  await pane.press({ key: 'reset-defaults' })
  await clock.advance(1)
  expect((await pane.find({ key: 'reset-defaults' }))?.props.label).toBe('Press again to reset')
  expect(await labels()).toContain('○ Folder')
  await pane.press({ key: 'reset-defaults' })
  await clock.advance(1)
  const after = await labels()
  expect(after).toContain('● Folder')
  expect(after).toContain('● Tricks')
  const reset = await svg()
  expect(reset).not.toContain('.p{fill:#f4f4f2}')
  expect(reset).not.toContain('stroke-dasharray')
  await pane.unmount()
})

test('prefs saved by 2.2 load with extras and the usage style filled in', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true, live: true } } } })
  panes(on)
  await start($)
  const band = await mountBand($, 'desktop')
  expect(String((await bandOf(band))?.props.source)).toContain('class="usage"')
  await band.unmount()
})

test('two turns that answer word for word alike keep their own receipts', async ($, on) => {
  engine(on)
  turnStarts(on)
  await start($)
  expect((await turn($, () => bash($, 'npm run build'), 'Done.')).text).toBe('')
  // The second turn's receipt goes in its notice, so the first reply's card still tells its own turn.
  const second = await turn($, async () => {
    await bash($, 'npm run build')
    await bash($, 'npm run lint')
  }, 'Done.')
  expect(second.text).toBe('› 2 commands')
  expect(await receiptUnder($, 'desktop', 'Done.')).toBe('Turn receipt: Done; 1 command')
})

test('/clear starts over: no receipt, turn or guard count carried into the new conversation', async ($, on) => {
  engine(on)
  panes(on)
  allowBeneath(on)
  turnStarts(on)
  on('ui.toast', () => ({ value: undefined }))
  on('session.end', () => ({ sessionId: 's' }))
  await start($)
  await guardOn($)
  await turn($, async () => {
    await bash($, 'rm -rf /')
    await bash($, 'npm run build')
  }, 'Built.')
  expect(await receiptUnder($, 'desktop', 'Built.')).toContain('Turn receipt')
  expect((await shown($, 'desktop')).words).toContain('Guard on, 1 caught')
  await $.session.end({ reason: 'clear', sessionId: 's' } as never)
  expect(await receiptUnder($, 'desktop', 'Built.')).not.toContain('Turn receipt')
  expect((await shown($, 'desktop')).words).not.toContain('caught')
})

test('a new session shows the engine\'s estimate of its context until a response measures it', async ($, on) => {
  engine(on, { percents: [undefined, 7, 3], estimate: 18_000 })
  await start($)
  expect((await shown($, 'desktop')).words).toContain('Context ~18k / 200k (9%); Session limit 7%')
  await $.session.measure({ context: { window: 200000, tokens: 24_500, percent: 12 }, rateLimits: [], changed: ['context'] })
  expect((await shown($, 'desktop')).words).toContain('Context 24.5k / 200k (12%)')
})

test('a compaction shows the smaller context at once; a subagent\'s or a precompute changes nothing', async ($, on) => {
  engine(on, { percents: [82, 7, 3], contextTokens: 164_000, estimate: 30_000 })
  const summary = [{ role: 'user', text: 'Summary', toolUses: [] }] as never
  on('session.compact', () => ({ messages: summary }))
  await start($)
  expect((await shown($, 'desktop')).words).toContain('Context 164k / 200k (82%)')
  await $.session.compact({ trigger: 'precompute', messages: summary } as never)
  await $.session.compact({ trigger: 'auto', agentId: 'a1', messages: summary } as never)
  expect((await shown($, 'desktop')).words).toContain('Context 164k / 200k (82%)')
  await $.session.compact({ trigger: 'manual', messages: summary } as never)
  expect((await shown($, 'desktop')).words).toContain('Context ~30k / 200k (15%)')
})

test('/clear drops the old context reading; with no estimate the context waits for a response', async ($, on) => {
  const { clock } = engine(on, { percents: [82, 7, 3], contextTokens: 164_000 })
  on('session.end', () => ({ sessionId: 's' }))
  await start($)
  await $.session.end({ reason: 'clear', sessionId: 's' } as never)
  await clock.advance(1)
  const words = (await shown($, 'desktop')).words
  expect(words).not.toContain('Context')
  expect(words).toContain('Session limit 7%')
})

test('/clear with no reading to give drops the old context too, rather than keep its percent', async ($, on) => {
  const { clock, reads } = engine(on, { percents: [82, 7, 3], contextTokens: 164_000 })
  on('session.end', () => ({ sessionId: 's' }))
  await start($)
  reads.usage = false
  await $.session.end({ reason: 'clear', sessionId: 's' } as never)
  await clock.advance(1)
  const words = (await shown($, 'desktop')).words
  expect(words).not.toContain('82%')
  expect(words).toContain('Session limit 7%')
})

test('a band drawn before the first tick reads the clock, not 1970: no New Year hat', async ($, on) => {
  engine(on)
  const ui = await mountBand($, 'desktop')
  const source = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source)).join('')
  await ui.unmount()
  expect(source).toContain('crispEdges')
  // The New Year hat's gold; nothing else Clawd wears on an idle band in October has it.
  expect(source).not.toContain('#f5c542')
})

test('parallel calls of one member each hold their place in the race until they end', async ($, on) => {
  let release: () => void = () => undefined
  const held = new Promise<void>(r => (release = r))
  on('tool.call', { tool: 'Read' }, async (_, e) => {
    if ((e as { file_path: string }).file_path === '/w/slow.ts') await held
    return { result: {} }
  })
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'p' } as never)
  await spawn($, 'x')
  const slow = $.tool.call({ tool: 'Read', file_path: '/w/slow.ts' } as Parameters<typeof $.tool.call>[0])
  await settle()
  await $.tool.call({ tool: 'Read', file_path: '/w/fast.ts' } as Parameters<typeof $.tool.call>[0])
  const ui = await mountBand($, 'desktop', true, 115)
  const alt = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('')
  await ui.unmount()
  expect(alt).toContain('Main running')
  release()
  await slow
})

test('a Write over an existing file counts its diff in the receipt, a new file every line', async ($, on) => {
  on('tool.call', { tool: 'Write' }, (_, e) =>
    (e as { file_path: string }).file_path === '/w/old.ts'
      ? { result: { type: 'update', filePath: '/w/old.ts', content: 'a\nB\nc\n', originalFile: 'a\nb\nc\n', structuredPatch: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [' a', '-b', '+B', ' c'] }] } }
      : { result: { type: 'create', filePath: '/w/new.ts', content: 'x\ny\n', originalFile: null, structuredPatch: [] } },
  )
  engine(on)
  turnStarts(on)
  await start($)
  await turn($, async () => {
    await $.tool.call({ tool: 'Write', file_path: '/w/old.ts', content: 'a\nB\nc\n' } as Parameters<typeof $.tool.call>[0])
    await $.tool.call({ tool: 'Write', file_path: '/w/new.ts', content: 'x\ny\n' } as Parameters<typeof $.tool.call>[0])
  }, 'Wrote both.')
  expect(await receiptUnder($, 'desktop', 'Wrote both.')).toBe('Turn receipt: Done; 2 files +3 −1')
})

test('with every row but the toolbar hidden, the toolbar stays', async ($, on) => {
  engine(on, { store: { prefs: { rows: { info: false, tasks: false, usage: false, live: false, crew: false, toolbar: true } } } })
  await start($)
  expect((await shown($, 'desktop')).tools).toEqual(['Compact', 'Subagents', 'Settings'])
})

test('the desktop shows the guard while it is on, with the info row hidden too', async ($, on) => {
  engine(on, { store: { prefs: { guard: true, rows: { info: false, tasks: true, usage: true, live: true, crew: true, toolbar: true } } } })
  await start($)
  expect((await shown($, 'desktop')).tools[0]).toMatch(/^Guard on/)
})

test('a limit notification fires at the red mark the person set', async ($, on) => {
  engine(on, { store: { prefs: { alertAt: 85 } } })
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await start($)
  await $.session.measure({ context: { window: 1_000_000, tokens: 1000, percent: 1 }, rateLimits: [{ kind: 'five_hour', percentUsed: 87, resetsAt: '2026-10-10T05:00:00Z' }], changed: ['rateLimits'] })
  await settle()
  expect(toasts).toEqual(['Session limit at 87% — resets in 5h 0m'])
})

test('beside the race, Clawd says his mood rather than the turn time the race already shows', async ($, on) => {
  engine(on)
  panes(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'w' } as never)
  await spawn($, 'x')
  const words = (await shown($, 'desktop', true)).words
  expect(words).toContain('Race:')
  expect(words).not.toMatch(/Clawd: [^;]*\d+s/)
})

test('a narrow desktop top row drops the icons’ counts and fits its width', async ($, on) => {
  engine(on, { percents: [82, 7, 3], contextTokens: 164_000, store: { prefs: { guard: true } } })
  await start($)
  const ui = await mountBand($, 'desktop', false, 30)
  const tools = await toolsOf(ui)
  expect(tools.every(t => !t.icon.includes('<text'))).toBe(true)
  const top = (await ui.findAll({ type: 'Svg' })).find(s => String(s.props.source).includes('<!--info-->'))
  const width = (s: string) => Number(s.match(/width="(\d+(?:\.\d+)?)"/)?.[1])
  const row = width(String(top?.props.source)) + tools.reduce((n, t) => n + width(t.icon) + 8, 0)
  expect(row).toBeLessThanOrEqual(Math.round(30 * 8.25))
})

test('a first press of Reset that is not followed within five seconds lapses, and nothing is reset', async ($, on) => {
  const { clock, store } = engine(on, { store: { prefs: { guard: true } } })
  panes(on)
  await start($)
  const pane = await mountPane($, 'desktop', 'sabai-skins')
  await pane.press({ key: 'reset-defaults' })
  await clock.advance(1)
  expect((await pane.find({ key: 'reset-defaults' }))?.props.label).toBe('Press again to reset')
  await clock.advance(6000)
  expect((await pane.find({ key: 'reset-defaults' }))?.props.label).toBe('Reset to defaults')
  expect((store.prefs as { guard: boolean }).guard).toBe(true)
})

test('Main alone on an MCP call: the live strip leads with the plug, and a skill with its bulb', async ($, on) => {
  let finish = () => {}
  for (const tool of ['mcp__Claude_Browser__computer', 'Skill'])
    on('tool.call', { tool } as never, () => new Promise(done => (finish = () => done({ result: {} } as never))) as never)
  engine(on)
  turnStarts(on)
  await start($)
  await $.turn.start({ turnId: 'solo' } as never)
  const mcp = $.tool.call({ tool: 'mcp__Claude_Browser__computer', action: 'screenshot' } as never)
  await settle()
  expect((await shown($, 'desktop', true)).sources).toMatch(/<g class="st-pulse"><use href="#sabai-du-plug"/)
  finish()
  await mcp
  const skill = $.tool.call({ tool: 'Skill', skill: 'pdf' } as never)
  await settle()
  expect((await shown($, 'desktop', true)).sources).toMatch(/<g class="st-pulse"><use href="#sabai-du-lightbulb"/)
  finish()
  await skill
})
