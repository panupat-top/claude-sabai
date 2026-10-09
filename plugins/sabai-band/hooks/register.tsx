import { atom, read, update } from 'claude-code'
import type { BuiltinToolResults, EngineInterface, Register } from 'claude-code'

import type { Cache, Env, Task, Usage } from '../types'
import { DEMO, blocks, chips, countdown, created, fromTodos, meters, parseCache, progress, toUsage, updated, value } from './model'
import { ICON_COLORS } from './sprites'
import { bandSvg, fillColor } from './svg'

const usage = atom({ plugin: 'sabai-band', key: 'usage' } as const, null as Usage | null)
const cache = atom({ plugin: 'sabai-band', key: 'cache' } as const, {} as Cache)
const tasks = atom({ plugin: 'sabai-band', key: 'tasks' } as const, [] as Task[])
const now = atom({ plugin: 'sabai-band', key: 'now' } as const, 0)
const env = atom({ plugin: 'sabai-band', key: 'env' } as const, {} as Env)

const TICK_MS = 30_000
// The terminal's stand-ins for the desktop's marks.
const GLYPHS = { folder: '▤', git: '◆', branch: '⎇', node: '⬢' } as const

// Module state is fine here: session.start sets it again after a reload.
let cachePath = ''
let cwd = ''

async function refreshCache($: EngineInterface) {
  let found: Cache = {}
  try {
    found = parseCache(await $.fs.read(cachePath))
  } catch {
    // No statusline cache: the model-scoped week stays hidden, 5H and 7D wait for the engine.
  }
  await update($, cache, () => found)
}

// One line of a command's output, or nothing when it fails or is missing.
async function line($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const run = await $.process.run(argv, { cwd })
    return run.exitCode === 0 ? run.stdout.trim() || undefined : undefined
  } catch {
    return undefined
  }
}

// Branch and changes move during a session; the rest only on `isFull`.
async function refreshEnv($: EngineInterface, isFull = false) {
  const [branch, status] = await Promise.all([line($, ['git', 'branch', '--show-current']), line($, ['git', 'status', '--porcelain'])])
  const moving: Env = { branch, changes: status ? status.split('\n').length : 0 }
  if (!isFull) return update($, env, e => ({ ...e, ...moving }))
  const [gitUser, node] = await Promise.all([line($, ['git', 'config', 'user.name']), line($, ['node', '--version'])])
  await update($, env, () => ({ ...moving, dir: cwd.split(/[\\/]/).filter(Boolean).pop(), gitUser, node }))
}

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = started.cwd
    cachePath = `${((await $.env.get('TMPDIR')) || '/tmp').replace(/\/$/, '')}/claude-statusline-usage.json`
    // session.measure fires only on the next response, so a fresh load reads what is known now.
    const known = await $.session.usage()
    await update($, usage, () => toUsage(known))
    await tick($)
    await refreshCache($)
    await refreshEnv($, true)
    // Keeps the reset countdowns, the cached windows and the branch fresh between responses.
    $.clock.every(TICK_MS, () => void Promise.all([tick($), refreshCache($), refreshEnv($)]))
    await $.command.register({ name: 'sabai-demo', description: 'Preview the sabai-band progress bar with sample tasks' })
    return started
  })

  // A cleared, resumed or forked conversation does not carry this one's task list.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, tasks, () => [])
    return next(e)
  })

  // A turn may switch branch or edit files.
  on('turn.complete', async ($, e, next) => {
    const completed = await next(e)
    if (e.agentId === undefined) await refreshEnv($)
    return completed
  })

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    await update($, usage, () => toUsage(e))
    return measured
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const called = await next(e)
    const id = (called.result as BuiltinToolResults['TaskCreate'] | undefined)?.task.id
    if (id !== undefined) await update($, tasks, list => created(list, id, e.subject, e.activeForm))
    return called
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const called = await next(e)
    if ((called.result as BuiltinToolResults['TaskUpdate'] | undefined)?.success) await update($, tasks, list => updated(list, e))
    return called
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const called = await next(e)
    if (!called.isError && !called.deny) await update($, tasks, () => fromTodos(e.todos))
    return called
  })

  on('command.run', { command: 'sabai-demo' }, async $ => {
    await update($, tasks, () => fromTodos(DEMO.map(([content, activeForm]) => ({ content, activeForm, status: 'pending' }))))
    DEMO.forEach((_, i) => {
      $.clock.after(2000 * (2 * i + 1), () => update($, tasks, list => updated(list, { taskId: String(i), status: 'in_progress' })))
      $.clock.after(2000 * (2 * i + 2), () => update($, tasks, list => updated(list, { taskId: String(i), status: 'completed' })))
    })
    return { text: 'Progress bar demo started: four sample tasks, one step every 2s.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const p = progress(await read($, tasks))
    const measured = await read($, usage)
    const list = meters(measured, await read($, cache), await read($, now))
    const info = chips(await read($, env))
    if (!p && info.left.length + info.right.length === 0 && list.length === 0) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // Another mod's drawing in the band keeps its place under ours.
    const theirs = await next(e)

    // The terminal's table names Svg too but cannot draw one, so the surface decides.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      // bodyColumns counts the code font's advance across the band, the collapse mark already
      // left out. Drawn a little wider than that estimate and given no width, the drawing
      // fills the slot: the surface scales a wider markup down to it, never a narrower one up.
      const band = bandSvg(p, info, list, Math.max(200, Math.min(4096, Math.round((e.props.bodyColumns || 100) * 8.25))), e.props.isWorking)
      return (
        <Box flexDirection="column">
          {band && <Svg source={band.source} alt={band.alt} />}
          {theirs}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    return (
      <Box flexDirection="column" rowGap={1}>
        {info.left.length + info.right.length > 0 && (
          <Box flexDirection="row" columnGap={3} paddingRight={5}>
            {[...info.left, null, ...info.right].map(c =>
              c ? (
                <Text key={c.icon}>
                  <Text dimColor>{`${GLYPHS[c.icon]} `}</Text>
                  {c.value}
                </Text>
              ) : (
                <Box key="gap" flexGrow={1} />
              ),
            )}
          </Box>
        )}
        {p && (
          <Box flexDirection="row" columnGap={2}>
            <Text wrap="truncate-end">
              <Text color={ICON_COLORS.tasks}>● </Text>
              {p.title}
            </Text>
            <Text color={ICON_COLORS.tasks}>{blocks(p.done / p.total, Math.max(6, Math.min(30, cols - 40)), '█', '░')}</Text>
            <Text bold>{`${p.done}/${p.total}`}</Text>
            <Text dimColor>{`${Math.round((p.done / p.total) * 100)}%`}</Text>
          </Box>
        )}
        {list.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={4} paddingRight={5}>
            {list.map(m => (
              <Text key={m.kind}>
                <Text dimColor bold>{`${m.label.toUpperCase()} `}</Text>
                <Text color={fillColor(m.percent, ICON_COLORS[m.kind])}>{`${blocks(m.percent / 100, 10, '▰', '▱')} ${value(m)}`}</Text>
                {m.resetsInMs === undefined ? null : <Text dimColor>{` ↻ ${countdown(m.resetsInMs)}`}</Text>}
              </Text>
            ))}
          </Box>
        )}
        {theirs}
      </Box>
    )
  })
}
