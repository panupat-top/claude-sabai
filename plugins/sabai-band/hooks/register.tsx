import { atom, read, update } from 'claude-code'
import type { BuiltinToolResults, EngineInterface, Register } from 'claude-code'

import type { AgentRun, Env, Task, Usage } from '../types'
import { clock, elapsed, finished, groups, modelName, spawned, stepped } from './agents'
import { blocks, chips, countdown, created, fromTodos, meters, progress, tokens, toUsage, updated, value } from './model'
import { agentsSvg, bandSvg, lookOf } from './svg'
import { SKINS, THEMES, pickSkin } from './themes'

const usage = atom({ plugin: 'sabai-band', key: 'usage' } as const, null as Usage | null)
const tasks = atom({ plugin: 'sabai-band', key: 'tasks' } as const, [] as Task[])
const now = atom({ plugin: 'sabai-band', key: 'now' } as const, 0)
const env = atom({ plugin: 'sabai-band', key: 'env' } as const, {} as Env)
const skin = atom({ plugin: 'sabai-band', key: 'skin' } as const, 'auto')
const agents = atom({ plugin: 'sabai-band', key: 'agents' } as const, [] as AgentRun[])

const PANE = 'sabai-agents'

const TICK_MS = 30_000
// The terminal's stand-ins for the desktop's marks.
const GLYPHS = { folder: '▤', git: '◆', branch: '⎇', node: '⬢' } as const

// Module state is fine here: session.start sets it again after a reload.
let cwd = ''
let lastBranch: string | undefined

// One line of a command's output, or nothing when it fails or is missing: a chip without a
// value is simply not drawn.
async function line($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const run = await $.process.run(argv, { cwd })
    return run.exitCode === 0 ? run.stdout.trim() || undefined : undefined
  } catch {
    return undefined
  }
}

// The branch's state: uncommitted files and commits ahead/behind its upstream. Run when a
// session starts, when a turn ends and when the branch changes, since `git status` can be slow
// on a large repository.
async function readRepo($: EngineInterface) {
  const [branch, status, counts] = await Promise.all([
    line($, ['git', 'branch', '--show-current']),
    line($, ['git', 'status', '--porcelain']),
    line($, ['git', 'rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
  ])
  const [behind, ahead] = counts ? counts.split(/\s+/).map(Number) : []
  lastBranch = branch
  await update($, env, e => ({ ...e, branch, ahead, behind, changes: status ? status.split('\n').length : 0 }))
}

// The tick's cheap check: only a switched branch costs a full read.
async function checkBranch($: EngineInterface) {
  if ((await line($, ['git', 'branch', '--show-current'])) !== lastBranch) await readRepo($)
}

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = started.cwd
    // session.measure fires only on the next response, so a fresh load reads what is known now.
    const known = await $.session.usage()
    await update($, usage, () => toUsage(known))
    await tick($)
    const [gitUser, node] = await Promise.all([line($, ['git', 'config', 'user.name']), line($, ['node', '--version'])])
    await update($, env, () => ({ dir: cwd.split(/[\\/]/).filter(Boolean).pop(), gitUser, node }))
    await readRepo($)
    // Keeps the reset countdowns and the branch fresh between responses.
    $.clock.every(TICK_MS, () => void Promise.all([tick($), checkBranch($)]))
    // Running subagents' clocks count by the second; quiet when none runs.
    $.clock.every(1000, () => {
      void (async () => {
        if ((await read($, agents)).some(a => a.status === 'running')) await tick($)
      })()
    })
    const saved = await $.store.get('skin')
    if (typeof saved === 'string' && SKINS.includes(saved)) await update($, skin, () => saved)
    await $.command.register({ name: 'sabai-skin', description: 'Change the sabai-band skin', argumentHint: '[name]' })
    await $.command.register({ name: 'sabai-agents', description: 'Show or hide the panel of subagents' })
    return started
  })

  // A cleared, resumed or forked conversation does not carry this one's task list.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, tasks, () => [])
    await update($, agents, () => [])
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = await $.clock.now()
    const run: AgentRun = {
      id: started.agentId ?? e.tool_use_id,
      agentId: started.agentId,
      type: e.subagentType,
      description: e.description,
      model: started.model,
      status: 'running',
      startedAt: at,
      contextTokens: 0,
      steps: 0,
    }
    await update($, agents, list => spawned(list, run))
    await update($, now, () => at)
    return started
  })

  // Each model request of a subagent: its model, its step count and its context.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const { agentId } = e
    const { usage: used } = result
    if (agentId && used) await update($, agents, list => stepped(list, agentId, used.model || e.model, used))
    return result
  })

  // A subagent's turn ends its run; the main conversation's may have switched branch or edited files.
  on('turn.complete', async ($, e, next) => {
    const completed = await next(e)
    const { agentId } = e
    if (agentId === undefined) {
      await readRepo($)
    } else {
      const at = await $.clock.now()
      await update($, agents, list => finished(list, agentId, e.reason === 'answer', at))
      await update($, now, () => at)
    }
    return completed
  })

  on('command.run', { command: 'sabai-agents' }, async $ => {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'Agents panel closed.' }
    }
    await tick($)
    await $.ui.open({ id: PANE, title: 'Agents' })
    return { text: 'Agents panel opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { running, finished: done } = groups(await read($, agents))
    const at = await read($, now)
    const skinName = await read($, skin)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const pane = agentsSvg(running, done, Math.max(240, Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25))), at, skinName)
      return <Svg source={pane.source} alt={pane.alt} />
    }
    const look = lookOf(skinName)
    const row = (a: AgentRun) => (
      <Box key={a.id} flexDirection="column" marginBottom={1}>
        <Text wrap="truncate-end" dimColor={a.status !== 'running'}>
          <Text color={look.clawd}>{a.status === 'running' ? '● ' : a.status === 'done' ? '✓ ' : '✗ '}</Text>
          <Text bold>{a.description || a.type}</Text>
          <Text dimColor>{`  ${clock(elapsed(a, at))}`}</Text>
        </Text>
        <Text dimColor wrap="truncate-end">{`  ${a.type} · ${modelName(a.model)} · ${a.steps} steps · ${tokens(a.contextTokens)} ctx`}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column">
        {running.length + done.length === 0 && <Text dimColor>No subagents yet. They show here while they work.</Text>}
        {running.length > 0 && <Text dimColor bold>{`RUNNING · ${running.length}`}</Text>}
        {running.map(row)}
        {done.length > 0 && <Text dimColor bold>{`DONE · ${done.length}`}</Text>}
        {done.map(row)}
      </Box>
    )
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

  on('command.run', { command: 'sabai-skin' }, async ($, e) => {
    const names = SKINS.map(k => `${k}${THEMES[k] ? ` (${THEMES[k].name})` : ''}`).join(', ')
    if (!e.args.trim()) return { text: `Skin: ${await read($, skin)}. Available: ${names}. Use /sabai-skin <name>.` }
    const picked = pickSkin(e.args)
    if (!picked) return { text: `No skin called "${e.args.trim()}". Available: ${names}.` }
    await update($, skin, () => picked)
    await $.store.set('skin', picked)
    return { text: `Skin set to ${THEMES[picked]?.name ?? 'auto'}.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const p = progress(await read($, tasks))
    const measured = await read($, usage)
    const list = meters(measured, await read($, now))
    const info = chips(await read($, env))
    if (!p && info.left.length + info.right.length === 0 && list.length === 0) return next(e)

    const skinName = await read($, skin)
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
      const band = bandSvg(p, info, list, Math.max(200, Math.min(4096, Math.round((e.props.bodyColumns || 100) * 8.25))), e.props.isWorking, skinName)
      return (
        <Box flexDirection="column">
          {band && <Svg source={band.source} alt={band.alt} />}
          {theirs}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const look = lookOf(skinName)
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
              <Text color={look.bar('tasks', 0)}>● </Text>
              {p.title}
            </Text>
            <Text color={look.bar('tasks', 0)}>{blocks(p.done / p.total, Math.max(6, Math.min(30, cols - 40)), '█', '░')}</Text>
            <Text bold>{`${p.done}/${p.total}`}</Text>
            <Text dimColor>{`${Math.round((p.done / p.total) * 100)}%`}</Text>
          </Box>
        )}
        {list.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" columnGap={4} paddingRight={5}>
            {list.map(m => (
              <Text key={m.kind}>
                <Text dimColor bold>{`${m.label.toUpperCase()} `}</Text>
                <Text color={look.bar(m.kind, m.percent)}>{`${blocks(m.percent / 100, 10, '▰', '▱')} ${value(m)}`}</Text>
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
