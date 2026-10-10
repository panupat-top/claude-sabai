import { atom, read, update } from 'claude-code'
import type { BuiltinToolResults, EngineInterface, Register } from 'claude-code'

import type { AgentRun, BarStyle, Env, Task, Usage } from '../types'
import { clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, resultText, spawned, stepped, taskLine, withTasks } from './agents'
import { blocks, chips, countdown, created, fromTodos, meters, progress, tokens, toUsage, updated, value } from './model'
import { BAR_STYLES, agentCardSvg, bandSvg, barPreview, emptyAgentsSvg, lookOf, skinPreview, summarySvg } from './svg'
import { SKINS, THEMES, contrast, pickSkin } from './themes'

// Black or white, whichever reads better on a tile of `bg`.
const inkOn = (bg: string) => (contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111')

const usage = atom({ plugin: 'sabai-band', key: 'usage' } as const, null as Usage | null)
const tasks = atom({ plugin: 'sabai-band', key: 'tasks' } as const, [] as Task[])
const now = atom({ plugin: 'sabai-band', key: 'now' } as const, 0)
const env = atom({ plugin: 'sabai-band', key: 'env' } as const, {} as Env)
const skin = atom({ plugin: 'sabai-band', key: 'skin' } as const, 'auto')
const agents = atom({ plugin: 'sabai-band', key: 'agents' } as const, [] as AgentRun[])
const bar = atom({ plugin: 'sabai-band', key: 'bar' } as const, 'dither' as BarStyle)
const finishedOpen = atom({ plugin: 'sabai-band', key: 'finishedOpen' } as const, false)
const openResults = atom({ plugin: 'sabai-band', key: 'openResults' } as const, [] as string[])
// The pane draws the newest finished runs; the rest are counted.
const FINISHED_SHOWN = 6

const isBarStyle = (v: unknown): v is BarStyle => typeof v === 'string' && v in BAR_STYLES
const BAR_NOTES: Record<BarStyle, string> = { dither: 'Twinkling dots', blocks: 'Square cells', solid: 'One smooth fill' }
// The terminal's stand-ins for each style's filled and empty cells.
const BAR_GLYPHS: Record<BarStyle, [string, string]> = { dither: ['▓', '░'], blocks: ['▰', '▱'], solid: ['█', '░'] }

const PANE = 'sabai-agents'
const SKIN_PANE = 'sabai-skins'

// The toolbar's shortcuts, those of them this surface offers (the Code tab has no /rewind, say).
// Ordered by how far each reaches: looking first, then acting on the work, then moving through the
// conversation, and /clear last, away from the buttons pressed often.
const QUICK = ['context', 'usage', 'review', 'compact', 'rewind', 'resume', 'clear']

const TICK_MS = 30_000
// The terminal's stand-ins for the desktop's marks.
const GLYPHS = { folder: '▤', git: '◆', branch: '⎇', node: '⬢' } as const

// Module state is fine here: session.start sets it again after a reload.
let cwd = ''
let lastBranch: string | undefined
let quick: string[] = []

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

// A subagent's task calls build its own list on its card; the main conversation's drive the band.
async function updateTasks($: EngineInterface, agentId: string | undefined, fn: (list: Task[]) => Task[]) {
  if (agentId === undefined) await update($, tasks, fn)
  else await update($, agents, list => withTasks(list, agentId, fn))
}

// The tick's cheap check: only a switched branch costs a full read.
async function checkBranch($: EngineInterface) {
  if ((await line($, ['git', 'branch', '--show-current'])) !== lastBranch) await readRepo($)
}

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

// Opens a pane, or closes it when it is open already; true when it opened.
// `focus` lets the pane take the keyboard, so the first click on one of its buttons presses it
// rather than only focusing the pane; Escape then closes it.
async function togglePane($: EngineInterface, id: string, title: string, focus = false): Promise<boolean> {
  if ((await $.ui.panes()).some(p => p.id === id)) {
    await $.ui.close({ id })
    return false
  }
  await $.ui.open(focus ? { id, title, focus: true, closeOnEscape: true } : { id, title })
  return true
}

async function toggleAgents($: EngineInterface): Promise<boolean> {
  await tick($)
  return togglePane($, PANE, 'Agents')
}

async function setBar($: EngineInterface, style: string) {
  if (!isBarStyle(style)) return
  await update($, bar, () => style)
  await $.store.set('bar', style)
}

async function setSkin($: EngineInterface, name: string) {
  await update($, skin, () => name)
  await $.store.set('skin', name)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = started.cwd
    const offered = new Set((await $.command.list()).map(c => c.name))
    quick = QUICK.filter(c => offered.has(c))
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
    const savedBar = await $.store.get('bar')
    if (isBarStyle(savedBar)) await update($, bar, () => savedBar)
    await $.command.register({ name: 'sabai-skin', description: 'Change the sabai-band skin', argumentHint: '[name]' })
    await $.command.register({ name: 'sabai-agents', description: 'Show or hide the panel of subagents' })
    return started
  })

  // A cleared, resumed or forked conversation does not carry this one's task list.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, tasks, () => [])
    await update($, agents, () => [])
    await update($, openResults, () => [])
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
      tasks: [],
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
    if (agentId && used) await update($, agents, list => stepped(list, agentId, used.model || e.model, used, e.effort))
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
      await update($, agents, list => finished(list, agentId, e.reason, at, e.answer))
      await update($, now, () => at)
    }
    return completed
  })

  on('command.run', { command: 'sabai-agents' }, async $ => ({
    text: (await toggleAgents($)) ? 'Agents panel opened.' : 'Agents panel closed.',
  }))

  // The agents pane: a summary, running agents, then finished ones (folded at first) with Clear
  // and a Result under each. The desktop draws each card as an image with its Button beneath;
  // the terminal draws the same as text rows.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, agents)
    const at = await read($, now)
    const skinName = await read($, skin)
    const style = await read($, bar)
    const isOpen = await read($, finishedOpen)
    const opened = await read($, openResults)
    const { running, finished: done } = groups(list)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    const W = Math.max(240, Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25)))
    const look = lookOf(skinName)

    if (list.length === 0) {
      const empty = emptyAgentsSvg(W, skinName)
      return Svg ? (
        <Svg source={empty.source} alt={empty.alt} />
      ) : (
        <Box flexDirection="column">
          <Text bold>No subagents yet</Text>
          <Text dimColor>They show here when Claude hands work off — try “explore hooks/ and tests/ in parallel”.</Text>
        </Box>
      )
    }

    const card = (a: AgentRun) => {
      if (Svg) {
        const d = agentCardSvg(a, W, at, skinName, style)
        return <Svg key={`card-${a.id}`} source={d.source} alt={d.alt} />
      }
      const line = taskLine(a.tasks)
      const effort = effortLabel(a.effort)
      return (
        <Box key={`card-${a.id}`} flexDirection="column">
          <Text wrap="truncate-end" dimColor={a.status !== 'running'}>
            <Text color={look.clawd}>{a.status === 'running' ? '● ' : a.status === 'done' ? '✓ ' : '✗ '}</Text>
            <Text bold>{a.description || a.type}</Text>
            <Text dimColor>{`  ${clock(elapsed(a, at))}`}</Text>
          </Text>
          <Text dimColor wrap="truncate-end">{`  ${effort ? `${effort} · ` : ''}${a.type} · ${modelName(a.model)}`}</Text>
          <Text dimColor wrap="truncate-end">{`  ${line ? `${line.done}/${line.total} · ${line.title}` : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`} · ${tokens(a.contextTokens)} ctx`}</Text>
        </Box>
      )
    }
    const sum = Svg && summarySvg(list, W, at, skinName)
    const shown = done.slice(0, FINISHED_SHOWN)
    const toggleResult = (id: string) => update($, openResults, ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))

    return (
      <Box flexDirection="column" rowGap={1}>
        {Svg && sum && <Svg source={sum.source} alt={sum.alt} />}
        {running.length > 0 && (
          <Box flexDirection="column" rowGap={Svg ? 0 : 1}>
            <Text dimColor bold>{`RUNNING · ${running.length}`}</Text>
            {running.map(card)}
          </Box>
        )}
        {done.length > 0 && (
          <Box flexDirection="column" rowGap={Svg ? 0 : 1}>
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Box flexGrow={1}>
                <Text dimColor bold>{`FINISHED · ${done.length}`}</Text>
              </Box>
              <Button
                key="clear-finished"
                label="Clear"
                onPress={async () => {
                  await update($, agents, clearFinished)
                  await update($, openResults, () => [])
                }}
              />
              <Button key="toggle-finished" label={isOpen ? '▾ Hide' : '▸ Show'} onPress={() => update($, finishedOpen, v => !v)} />
            </Box>
            {isOpen &&
              shown.map(a => (
                <Box key={`row-${a.id}`} flexDirection="column">
                  {card(a)}
                  <Button key={`result-${a.id}`} label={opened.includes(a.id) ? '▾ Result' : 'Result ›'} onPress={() => toggleResult(a.id)} />
                  {opened.includes(a.id) && <Text wrap="wrap">{resultText(a)}</Text>}
                </Box>
              ))}
            {isOpen && done.length > shown.length && <Text dimColor>{`+ ${done.length - shown.length} more`}</Text>}
          </Box>
        )}
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
    if (id !== undefined) await updateTasks($, e.agentId, list => created(list, id, e.subject, e.activeForm))
    return called
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const called = await next(e)
    if ((called.result as BuiltinToolResults['TaskUpdate'] | undefined)?.success) await updateTasks($, e.agentId, list => updated(list, e))
    return called
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const called = await next(e)
    if (!called.isError && !called.deny) await updateTasks($, e.agentId, () => fromTodos(e.todos))
    return called
  })

  on('command.run', { command: 'sabai-skin' }, async ($, e) => {
    if (!e.args.trim()) return { text: (await togglePane($, SKIN_PANE, 'Skins', true)) ? 'Skins panel opened.' : 'Skins panel closed.' }
    const picked = pickSkin(e.args)
    if (!picked) {
      const names = SKINS.map(k => `${k}${THEMES[k] ? ` (${THEMES[k].name})` : ''}`).join(', ')
      return { text: `No skin called "${e.args.trim()}". Available: ${names}.` }
    }
    await setSkin($, picked)
    return { text: `Skin set to ${THEMES[picked]?.name ?? 'auto'}.` }
  })

  // Two groups, each a list of choices drawn alike: a name and a note on the left, Use or
  // "In use" on the right, and a sample underneath (a swatch on the desktop, coloured text on
  // the terminal).
  on('ui.render', { component: 'Pane', requestId: SKIN_PANE }, async ($, e) => {
    const current = await read($, skin)
    const style = await read($, bar)
    const look = lookOf(current)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    const W = Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25))
    const heading = (title: string, note: string) => (
      <Text>
        <Text bold>{title}</Text>
        <Text dimColor>{`  ${note}`}</Text>
      </Text>
    )
    const head = (key: string, name: string, note: string, inUse: boolean, accent: string, pick: () => Promise<void>) => (
      <Box flexDirection="row" alignItems="center" columnGap={2}>
        <Box flexGrow={1}>
          <Text wrap="truncate-end">
            <Text bold>{name}</Text>
            <Text dimColor>{`  ${note}`}</Text>
          </Text>
        </Box>
        {inUse ? (
          <Text color={accent} bold>
            ✓ In use
          </Text>
        ) : (
          <Button key={key} label="Use" variant="primary" onPress={pick} />
        )}
      </Box>
    )
    return (
      <Box flexDirection="column" rowGap={2}>
        <Text dimColor>Choices apply at once and are kept for new sessions. Esc closes.</Text>
        <Box flexDirection="column" rowGap={1}>
          {heading('Color theme', 'The band and panels')}
          {SKINS.map(k => {
            const t = THEMES[k]
            const tone = t ? (contrast(t.base, '#ffffff') > contrast(t.base, '#000000') ? 'Dark' : 'Light') : 'Matches your system'
            const kLook = lookOf(k)
            const preview = Svg && skinPreview(k, W, k === current)
            return (
              <Box key={`row-${k}`} flexDirection="column">
                {head(`use-${k}`, t?.name ?? 'Auto', tone, k === current, kLook.clawd, () => setSkin($, k))}
                {Svg && preview ? (
                  <Svg source={preview.source} alt={preview.alt} />
                ) : (
                  <Text>
                    {(['tasks', 'context', 'session', 'week'] as const).map(kind => (
                      <Text key={kind} color={kLook.bar(kind, 0)}>{'▰▰▰ '}</Text>
                    ))}
                  </Text>
                )}
              </Box>
            )
          })}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Progress bar', 'Tasks and usage cards')}
          {(Object.keys(BAR_STYLES) as BarStyle[]).map(b => {
            const preview = Svg && barPreview(b, current, W)
            return (
              <Box key={`row-bar-${b}`} flexDirection="column">
                {head(`bar-${b}`, BAR_STYLES[b], BAR_NOTES[b], b === style, look.clawd, () => setBar($, b))}
                {Svg && preview ? (
                  <Svg source={preview.source} alt={preview.alt} />
                ) : (
                  <Text color={look.bar('tasks', 0)}>{blocks(0.62, 16, ...BAR_GLYPHS[b])}</Text>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const p = progress(await read($, tasks))
    const measured = await read($, usage)
    const list = meters(measured, await read($, now))
    const info = chips(await read($, env))
    if (!p && info.left.length + info.right.length === 0 && list.length === 0) return next(e)

    const skinName = await read($, skin)
    const style = await read($, bar)
    const look = lookOf(skinName)
    const running = groups(await read($, agents)).running.length
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    // Another mod's drawing in the band keeps its place under ours.
    const theirs = await next(e)

    // Common commands on the left as framed buttons, the mod's panels on the right as icons. The
    // desktop draws a Button's `label` alone, its hotkey as a keycap, so the icon is the label; the
    // terminal draws the children: a pixel tile of half blocks round the glyph on the skin's
    // colour. Hotkeys work while the band holds the focus.
    const tile = (glyph: string, color: string) => (
      <Text>
        <Text color={color}>▐</Text>
        <Text backgroundColor={color} color={inkOn(color)} bold>
          {glyph}
        </Text>
        <Text color={color}>▌</Text>
      </Text>
    )
    const toolbar = (
      // The terminal's rows are already a row apart; the desktop's band image sits flush on it.
      // Native buttons carry their own padding, so on the desktop they sit with no gap between.
      <Box flexDirection="row" columnGap={e.surface === 'terminal' ? 2 : 0} marginTop={e.surface === 'terminal' ? 0 : 1}>
        <Box flexDirection="row" columnGap={e.surface === 'terminal' ? 2 : 1}>
          {quick.map(c => (
            // A press's own work ends with the press, so the command is queued from a timer.
            <Button key={`run-${c}`} label={`/${c}`} variant="secondary" onPress={() => void $.clock.after(0, () => void $.command.run({ command: c }))} />
          ))}
        </Box>
        <Box flexGrow={1} />
        <Button key="agents" label={running > 0 ? `✻ ${running}` : '✻'} hotkey="a" plain onPress={() => toggleAgents($)}>
          {tile('✻', look.clawd)}
          {running > 0 ? <Text bold>{` ${running}`}</Text> : null}
        </Button>
        <Button key="skins" label="⚙" hotkey="s" plain onPress={() => togglePane($, SKIN_PANE, 'Skins', true)}>
          {tile('⚙', look.bar('session', 0))}
        </Button>
      </Box>
    )

    // The terminal's table names Svg too but cannot draw one, so the surface decides.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      // bodyColumns counts the code font's advance across the band, the collapse mark already
      // left out. Drawn a little wider than that estimate and given no width, the drawing
      // fills the slot: the surface scales a wider markup down to it, never a narrower one up.
      const band = bandSvg(p, info, list, Math.max(200, Math.min(4096, Math.round((e.props.bodyColumns || 100) * 8.25))), e.props.isWorking, skinName, style)
      return (
        <Box flexDirection="column">
          {band && <Svg source={band.source} alt={band.alt} />}
          {toolbar}
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
        {toolbar}
        {theirs}
      </Box>
    )
  })
}
