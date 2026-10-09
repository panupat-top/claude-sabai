import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]
const STOCK: RenderElement = { type: 'Text', props: {}, children: ['stock row'] }
const NOW = Date.parse('2026-10-10T00:00:00Z')
const CACHE = JSON.stringify({
  limits: [
    { kind: 'session', percent: 40, resets_at: '2026-10-10T01:00:00Z' },
    { kind: 'weekly_all', percent: 20, resets_at: '2026-10-15T21:00:00Z' },
    { kind: 'weekly_scoped', percent: 12, resets_at: '2026-10-15T21:00:00Z', scope: { model: { display_name: 'Fable' } } },
  ],
})

function engine(
  on: On,
  { cache = CACHE as string | null, hasLimits = true } = {},
) {
  const branch = { name: 'main' }
  const reads: string[] = []
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { TMPDIR: '/var/tmp/' })
  on('session.start', () => ({ cwd: '/work' }))
  const out = (): Record<string, string> => ({
    'git branch --show-current': `${branch.name}\n`,
    'git status --porcelain': ' M a.ts\n?? b.ts\n',
    'git config user.name': 'Panupat\n',
    'node --version': 'v24.1.0\n',
  })
  on('process.run', ($, e) => ({
    value: { exitCode: 0, stdout: out()[e.argv.join(' ')] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
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
  on('fs.read', ($, e) => {
    reads.push(e.path)
    if (cache === null) throw new Error('ENOENT')
    return { value: cache }
  })
  on('command.register', () => ({ value: { command: 'sabai-demo' } }))
  on('ui.render', () => STOCK)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', ($, e) => {
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(e.subject.length), subject: e.subject } } }
    if (e.tool === 'TaskUpdate') return { result: { success: true, taskId: e.taskId, updatedFields: [] } }
    return { result: {} }
  })
  return { reads, clock, branch }
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
  expect((await shown($, 'desktop')).words).toMatch(/^Directory work, Git user Panupat, Branch main ±2, Node v24\.1\.0; Context/)
  const terminal = (await shown($, 'terminal')).words
  expect(terminal).toMatch(/^▤ work \|.*◆ Panupat \|.*⎇ main ±2 \|.*⬢ v24\.1\.0 \|.*CONTEXT/)
})

test('the branch follows a turn of the main conversation', async ($, on) => {
  const { branch } = engine(on)
  await start($)
  branch.name = 'feature/band'
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })
  expect((await shown($, 'desktop')).words).toContain('Branch feature/band ±2, Node')
})

test('with nothing to show the band is left to the engine', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) expect((await shown($, surface)).words).toBe('stock row')
})

test('a fresh load shows every meter with its countdown, and no buttons', async ($, on) => {
  const { reads } = engine(on)
  await start($)
  expect(reads).toEqual(['/var/tmp/claude-statusline-usage.json'])
  const desktop = await shown($, 'desktop')
  expect(desktop.svgs).toBe(1)
  expect(desktop.words).toContain(
    'Context 24.5k / 200k (12%); 5H Limit 7%, resets in 2h 49m; 7D All 3%, resets in 6d 2h; 7D Fable 12%, resets in 5d 21h',
  )
  expect(desktop.words).toContain('stock row')
  expect(desktop.buttons).toBe(0)
  const terminal = await shown($, 'terminal')
  expect(terminal.svgs).toBe(0)
  expect(terminal.words).toMatch(/5H LIMIT .*7%.*↻ 2h 49m/)
  expect(terminal.words).toContain('7D FABLE')
  expect(terminal.words).toContain('24.5k / 200k (12%)')
  expect(terminal.buttons).toBe(0)
})

test('a resumed session with no engine reading yet takes 5H and 7D from the cache', async ($, on) => {
  engine(on, { hasLimits: false })
  await start($)
  expect((await shown($, 'desktop')).words).toContain(
    'Context 24.5k / 200k (12%); 5H Limit 40%, resets in 1h 0m; 7D All 20%, resets in 5d 21h; 7D Fable 12%, resets in 5d 21h',
  )
})

test('without the statusline cache the scoped week stays out', async ($, on) => {
  engine(on, { cache: null })
  await start($)
  expect((await shown($, 'desktop')).words).not.toContain('Fable')
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

test('/sabai-demo walks four sample tasks through the bar', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await $.command.run({ command: 'sabai-demo', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })
  expect((await shown($, 'desktop')).words).toContain('Read the code: 0/4 tasks')
  await clock.advance(2000)
  expect((await shown($, 'desktop')).words).toContain('Reading the code: 0/4 tasks')
  await clock.advance(2000)
  expect((await shown($, 'desktop')).words).toContain('Write tests: 1/4 tasks')
  await clock.advance(12_000)
  expect((await shown($, 'desktop')).words).not.toContain('tasks,')
})
