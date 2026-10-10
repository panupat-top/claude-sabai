import { atom, read, update } from 'claude-code'
import type { BuiltinToolResults, EngineInterface, Register } from 'claude-code'

import type { AgentRun, BarStyle, Env, Prefs, Task, Usage } from '../types'
import { clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, progressOf, reported, resultText, spawned, stepped, typeEmoji, typeStyle, withTasks } from './agents'
import { blocks, chips, countdown, created, fromTodos, meters, progress, tokens, toUsage, updated, value } from './model'
import { BAR_STYLES, CALLOUT_KINDS, agentCardSvg, calloutTitleSvg, modesSvg, stepSvg, bandSvg, barPreview, emptyAgentsSvg, lookOf, skinPreview, summarySvg } from './svg'
import { riskOf } from './guard'
import { CALLOUT_HINT, isGenericWord, seedOf, spinnerWord, splitCallouts, stepOf } from './chat'
import type { Step, StepIcon, Tone } from './chat'
import { SKINS, THEMES, contrast } from './themes'

// Black or white, whichever reads better on a tile of `bg`.
const inkOn = (bg: string) => (contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111')

const usage = atom({ plugin: 'sabai-band', key: 'usage' } as const, null as Usage | null)
const tasks = atom({ plugin: 'sabai-band', key: 'tasks' } as const, [] as Task[])
const now = atom({ plugin: 'sabai-band', key: 'now' } as const, 0)
const env = atom({ plugin: 'sabai-band', key: 'env' } as const, {} as Env)
const skin = atom({ plugin: 'sabai-band', key: 'skin' } as const, 'auto')
const agents = atom({ plugin: 'sabai-band', key: 'agents' } as const, [] as AgentRun[])
const bar = atom({ plugin: 'sabai-band', key: 'bar' } as const, 'dither' as BarStyle)
const DEFAULT_PREFS: Prefs = {
  rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true },
  notify: true,
  limits: true,
  guard: false,
  steps: true,
  chat: { spinner: true, tools: true, tests: true, callouts: true, label: true },
}
const prefs = atom({ plugin: 'sabai-band', key: 'prefs' } as const, DEFAULT_PREFS)
// A saved Prefs, filled from the defaults where it predates a field.
const withDefaults = (v: unknown): Prefs => {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<Prefs>
  return {
    ...DEFAULT_PREFS,
    ...p,
    rows: { ...DEFAULT_PREFS.rows, ...(p.rows ?? {}) },
    chat: { ...DEFAULT_PREFS.chat, ...(p.chat ?? {}) },
  }
}
const STEP_TOOL = 'mcp__sabai-band__step'
// When each Bash call ran, by tool_use_id: the result carries no duration of its own.
const durations = atom({ plugin: 'sabai-band', key: 'durations' } as const, {} as Record<string, number>)
const DURATIONS_KEPT = 200
// Bash calls that waited on a permission prompt: their time would be the person's, not the command's.
const asked = new Set<string>()
// The desktop draws a chat line as one SVG; false falls back to the terminal's Text line.
const SVG_IN_CHAT = true
// Theme keys for each tone: the conversation follows the person's light or dark theme.
const TONE_KEY: Record<Tone, string | undefined> = { text: undefined, muted: 'subtle', ok: 'success', bad: 'error', warn: 'warning', edit: 'suggestion', read: 'suggestion' }
// A main turn this long earns a notification when it ends.
const LONG_TURN_MS = 60_000
const LIMIT_WARN_AT = 90
// Each plan-limit window warned about already, by kind and reset time.
const warned = new Set<string>()
const finishedOpen = atom({ plugin: 'sabai-band', key: 'finishedOpen' } as const, false)
const openResults = atom({ plugin: 'sabai-band', key: 'openResults' } as const, [] as string[])
// The pane draws the newest finished runs; the rest are counted.
const FINISHED_SHOWN = 8
// Likewise the newest running agents: a wide workflow fan-out would otherwise outgrow the pane.
const RUNNING_SHOWN = 6
// The card drawings a pane may carry, in characters, newest first: its whole tree, escaping and
// the rest included, must stay under the engine's 100,000.
const PANE_BUDGET = 70_000

const isBarStyle = (v: unknown): v is BarStyle => typeof v === 'string' && v in BAR_STYLES
// The terminal's stand-ins for each style's filled and empty cells.
const BAR_GLYPHS: Record<BarStyle, [string, string]> = { dither: ['▓', '░'], blocks: ['▰', '▱'], solid: ['█', '░'] }

const PANE = 'sabai-agents'
const SKIN_PANE = 'sabai-skins'

// The toolbar's shortcuts, those of them this surface offers (the Code tab has no /rewind, say).
// The band's own cards already show context and usage, and /clear is one click from losing the
// conversation, so the toolbar keeps the commands that act: review and compact, then rewind
// and resume to move through the conversation.
const QUICK = ['review', 'compact', 'rewind', 'resume']

const TICK_MS = 30_000
const CREW_LINGER_MS = 60_000
// A hung git (a network drive, a stale lock) gives up rather than hold the band.
const GIT_TIMEOUT_MS = 5000
// The terminal's stand-ins for the desktop's marks.
const GLYPHS = { folder: '▤', git: '◆', branch: '⎇', node: '⬢' } as const
// The terminal's stand-ins for a step's icon.
const STEP_GLYPH: Record<StepIcon, string> = { terminal: '▶', flask: '⚗', pen: '✎', file: '✚', read: '◉', stop: '⏹' }

// Module state is fine here: session.start sets it again after a reload.
let cwd = ''
// The spinner's word is picked once per turn, so it does not change on every redraw.
let turnSeed = 0
let lastBranch: string | undefined
let reading: Promise<void> | undefined
let quick: string[] = []

// One line of a command's output, or nothing when it fails or is missing: a chip without a
// value is simply not drawn.
async function line($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const run = await $.process.run(argv, { cwd, timeoutMs: GIT_TIMEOUT_MS })
    return run.exitCode === 0 ? run.stdout.trim() || undefined : undefined
  } catch {
    return undefined
  }
}

// The branch's state: uncommitted files and commits ahead/behind its upstream. Run when a
// session starts, when a turn ends and when the branch changes, since `git status` can be slow
// on a large repository.
// One read at a time: a slower older read must not land over a newer one.
function readRepo($: EngineInterface): Promise<void> {
  reading ??= readRepoNow($).finally(() => {
    reading = undefined
  })
  return reading
}

async function readRepoNow($: EngineInterface) {
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
// The tick's cheap check: only a switched branch, or a session moved to another folder (a
// worktree, say), costs a full read.
async function checkBranch($: EngineInterface) {
  const here = await $.session.cwd().catch(() => cwd)
  if (here !== cwd) {
    cwd = here
    await update($, env, e => ({ ...e, dir: cwd.split(/[\\/]/).filter(Boolean).pop() }))
    await readRepo($)
    return
  }
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

async function setPrefs($: EngineInterface, fn: (p: Prefs) => Prefs) {
  const next = await update($, prefs, fn)
  await $.store.set('prefs', next)
}

// The guard's refusal for a call, told to the person too, or nothing when it passes or is off.
async function guarded($: EngineInterface, tool: string, input: { command?: unknown; file_path?: unknown }): Promise<string | undefined> {
  const risk = (await read($, prefs)).guard ? riskOf(tool, input) : undefined
  if (!risk) return undefined
  $.ui.toast(`Blocked: this ${risk}`)
  return `sabai-band's guard refused this: it ${risk}. The person can turn the guard off in /sabai-settings.`
}

async function setSkin($: EngineInterface, name: string) {
  await update($, skin, () => name)
  await $.store.set('skin', name)
}

// A tool call as a step: one fixed-size SVG on the desktop, two Text rows in theme keys elsewhere.
function stepView($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0], step: Step) {
  const ui = $.ui.resolve(e)
  const { Box, Text } = ui
  if (SVG_IN_CHAT && e.surface !== 'terminal' && 'Svg' in ui) {
    const d = stepSvg(step)
    return <ui.Svg source={d.source} alt={d.alt} width={d.width} height={d.height} />
  }
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={TONE_KEY[step.tone]}>{`${STEP_GLYPH[step.icon]} `}</Text>
        <Text bold>{step.title}</Text>
        {'  '}
        {step.result.map((p, i) => (
          <Text key={`r${i}`} color={TONE_KEY[p.tone]} dimColor={p.tone === 'muted'}>
            {p.text}
          </Text>
        ))}
        {step.time ? <Text dimColor>{` · ${step.time}`}</Text> : null}
      </Text>
      <Text dimColor wrap="truncate-end">{`  ${step.detail}`}</Text>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = started.cwd
    // What the person sees first: their saved choices and the commands, before any slow read.
    const saved = await $.store.get('skin').catch(() => undefined)
    if (typeof saved === 'string' && SKINS.includes(saved)) await update($, skin, () => saved)
    const savedBar = await $.store.get('bar').catch(() => undefined)
    if (isBarStyle(savedBar)) await update($, bar, () => savedBar)
    const savedPrefs = withDefaults(await $.store.get('prefs').catch(() => undefined))
    await update($, prefs, () => savedPrefs)
    await $.command.register({ name: 'sabai-settings', description: 'Open the sabai-band settings' })
    // Agents can report their own steps: a subagent rarely has a task list of its own.
    if (savedPrefs.steps)
      await $.tool
        .register({
          name: 'step',
          description:
            'For subagents: report progress on your own task to the agents panel. Right after reading your brief, call it with `total` ' +
            '(your plan in 3-8 steps) and `done: 0`; call it again as each step finishes, with `note` naming the step in progress. Silent and cheap.',
          inputSchema: {
            type: 'object',
            properties: {
              done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
              total: { type: 'integer', minimum: 1, description: 'Steps planned; may change.' },
              note: { type: 'string', description: 'The step in progress, a few words.' },
            },
            required: ['done'],
          },
          isDeferred: false,
        })
        .catch(() => undefined)
    await $.command.register({ name: 'sabai-agents', description: 'Show or hide the panel of subagents' })
    const offered = new Set((await $.command.list().catch(() => [])).map(c => c.name))
    quick = QUICK.filter(c => offered.has(c))
    // The clock first, so no countdown is ever measured from zero.
    await tick($)
    // session.measure fires only on the next response, so a fresh load reads what is known now.
    const known = await $.session.usage().catch(() => undefined)
    if (known) await update($, usage, () => toUsage(known))
    // Keeps the reset countdowns and the branch fresh between responses.
    $.clock.every(TICK_MS, () => void Promise.all([tick($), checkBranch($)]))
    // Running subagents' clocks count by the second; quiet when none runs.
    $.clock.every(1000, () => {
      void (async () => {
        if ((await read($, agents)).some(a => a.status === 'running')) await tick($)
      })()
    })
    // git and node last, and not waited on: a slow repository must not hold the session.
    void (async () => {
      const [gitUser, node] = await Promise.all([line($, ['git', 'config', 'user.name']), line($, ['node', '--version'])])
      await update($, env, () => ({ dir: cwd.split(/[\\/]/).filter(Boolean).pop(), gitUser, node }))
      await readRepo($)
    })()
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
    // A remote workflow agent has no local loop: nothing would ever step or end its run.
    if (started.deny !== undefined || started.agentId === undefined) return started
    const at = await $.clock.now()
    const run: AgentRun = {
      id: started.agentId,
      agentId: started.agentId,
      type: e.subagentType,
      description: e.description,
      model: started.model,
      status: 'running',
      startedAt: at,
      contextTokens: 0,
      steps: 0,
      tasks: [],
      ...(e.workflow ? { workflow: true } : {}),
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
    const { notify } = await read($, prefs)
    if (agentId === undefined) {
      // Not waited on: a large repository's status must not delay the turn's end.
      void readRepo($)
      if (notify && e.durationMs >= LONG_TURN_MS) void $.ui.notify(`Finished in ${clock(e.durationMs)}`, { title: 'Claude' }).catch(() => undefined)
    } else {
      const at = await $.clock.now()
      const list = await update($, agents, l => finished(l, agentId, e.reason, at, e.answer))
      const run = list.find(a => a.agentId === agentId)
      if (notify && run?.status === 'failed') void $.ui.notify(`${run.description || run.type} failed: ${resultText(run)}`, { title: 'Agent' }).catch(() => undefined)
      // The hop and confetti last a few seconds; with nothing left running, nothing else would
      // tick the clock to end them.
      $.clock.after(3100, () => void tick($))
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
    const { Box, Button, Markdown, Text } = ui
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

    // A card is one Box: the title row (the task, marked by its type, and for a finished agent a
    // Report button at the right), the drawing (text rows on the terminal) and, once opened, the
    // report. The Box takes no colour: the title and the report are the surface's own text, whose
    // ink follows the OS theme, which a fixed skin colour behind them could not.
    const reportColor = (a: AgentRun) => {
      const { accent } = typeStyle(a.type)
      return a.status === 'failed' ? look.bar('tasks', 100) : look.bar(accent ?? 'session', 0)
    }
    const drawings = new Map<string, ReturnType<typeof agentCardSvg>>()
    const drawnOf = (a: AgentRun) => {
      const d = drawings.get(a.id) ?? agentCardSvg(a, W, at, skinName, style)
      drawings.set(a.id, d)
      return d
    }
    const card = (a: AgentRun) => {
      const title = a.description || a.type
      const reportOpen = opened.includes(a.id)
      const line = progressOf(a)
      const effort = effortLabel(a.effort)
      const head = (
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          <Box flexGrow={1}>
            <Text bold wrap="truncate-end">{`${typeEmoji(a.type)} ${title}`}</Text>
          </Box>
          {a.status !== 'running' && (
            <Button key={`result-${a.id}`} label={reportOpen ? '▾ Report' : 'Report'} onPress={() => toggleResult(a.id)} />
          )}
        </Box>
      )
      const drawn = Svg && drawnOf(a)
      const body = Svg && drawn ? (
        <Svg source={drawn.source} alt={drawn.alt} />
      ) : (
        <Box flexDirection="column" paddingLeft={2}>
          <Text wrap="truncate-end" dimColor={a.status !== 'running'}>
            <Text color={look.clawd}>{a.status === 'running' ? '● ' : a.status === 'done' ? '✓ ' : '✗ '}</Text>
            {`${effort ? `${effort} · ` : ''}${a.type} · ${modelName(a.model)}${a.workflow ? ' · workflow' : ''}`}
            <Text dimColor>{`  ${clock(elapsed(a, at))}`}</Text>
          </Text>
          <Text dimColor wrap="truncate-end">{`${line ? `${line.done}/${line.total} · ${line.title}` : `${a.steps} ${a.steps === 1 ? 'step' : 'steps'}`} · ${tokens(a.contextTokens)} ctx`}</Text>
        </Box>
      )
      return (
        <Box key={`card-${a.id}`} flexDirection="column">
          {head}
          {body}
          {reportOpen && a.status !== 'running' && (
            // Agents write their reports in markdown, so they are drawn as such, framed in the
            // agent's colour (red when it failed).
            <Box paddingX={1}>
              <Box flexGrow={1} borderStyle="round" borderColor={reportColor(a)} paddingX={1}>
                <Markdown text={resultText(a)} />
              </Box>
            </Box>
          )}
        </Box>
      )
    }

    const sum = Svg && summarySvg(list, W, at, skinName)
    // Newest cards first while their drawings fit the budget; the rest are counted.
    let spent = sum ? sum.source.length : 0
    const fitting = (runs: AgentRun[], cap: number) => {
      const out: AgentRun[] = []
      for (const a of runs.slice(0, cap)) {
        const size = Svg ? drawnOf(a).source.length : 0
        if (spent + size > PANE_BUDGET) break
        spent += size
        out.push(a)
      }
      return out
    }
    const liveShown = fitting(running, RUNNING_SHOWN)
    const shown = isOpen ? fitting(done, FINISHED_SHOWN) : []
    // One report open at a time: opening another closes the first, keeping the pane short.
    const toggleResult = (id: string) => update($, openResults, ids => (ids.includes(id) ? [] : [id]))

    return (
      <Box flexDirection="column" rowGap={1}>
        {Svg && sum && <Svg source={sum.source} alt={sum.alt} />}
        {running.length > 0 && (
          <Box flexDirection="column" rowGap={1}>
            <Text dimColor bold>{`RUNNING · ${running.length}`}</Text>
            {liveShown.map(card)}
            {running.length > liveShown.length && <Text dimColor>{`+ ${running.length - liveShown.length} more running`}</Text>}
          </Box>
        )}
        {done.length > 0 && (
          <Box flexDirection="column" rowGap={1}>
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
            {isOpen && shown.map(card)}
            {isOpen && done.length > shown.length && <Text dimColor>{`+ ${done.length - shown.length} more`}</Text>}
          </Box>
        )}
      </Box>
    )
  })

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    await update($, usage, () => toUsage(e))
    if ((await read($, prefs)).limits) {
      const at = await read($, now)
      for (const l of e.rateLimits) {
        const label = l.kind === 'five_hour' ? '5H' : l.kind === 'seven_day' ? '7D' : undefined
        const key = `${l.kind}:${l.resetsAt ?? ''}`
        if (!label || l.percentUsed < LIMIT_WARN_AT || warned.has(key)) continue
        warned.add(key)
        const left = l.resetsAt ? Date.parse(l.resetsAt) - at : NaN
        $.ui.toast(`${label} limit at ${Math.round(l.percentUsed)}%${Number.isFinite(left) && left > 0 ? ` — resets in ${countdown(left)}` : ''}`)
      }
    }
    return measured
  })

  // The guard, when turned on: refuse the few commands that are almost never meant.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const risk = await guarded($, 'Bash', e)
    if (risk) return { deny: risk }
    // Timed here, as the result carries no duration of its own.
    const id = (e as { tool_use_id?: string }).tool_use_id
    const startedAt = await $.clock.now()
    const called = await next(e)
    if (id && !asked.delete(id)) {
      const ms = (await $.clock.now()) - startedAt
      await update($, durations, d => Object.fromEntries([...Object.entries(d), [id, ms] as const].slice(-DURATIONS_KEPT)))
    }
    return called
  })
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const risk = await guarded($, 'Read', e)
    return risk ? { deny: risk } : next(e)
  })

  // A subagent reporting its own steps through the mod's tool.
  // (Matched by hand: the mod's own tool is not in the engine's typed list of tool names.)
  on('tool.call', async ($, e, next) => {
    if ((e.tool as string) !== STEP_TOOL) return next(e)
    const { agentId } = e
    if (!agentId) return { result: 'ignored: only subagents report steps' } as never
    await update($, agents, list => reported(list, agentId, e as unknown as { done?: unknown; total?: unknown; note?: unknown }))
    return { result: 'ok' } as never
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

  on('command.run', { command: 'sabai-settings' }, async $ => ({
    text: (await togglePane($, SKIN_PANE, 'Settings', true)) ? 'Settings panel opened.' : 'Settings panel closed.',
  }))

  // The settings: the band's rows, the bar style, alerts, agents and safety, then the colour
  // themes (the longest list last). Each choice is a name and a note on the left with its
  // control on the right; themes and the bar style carry a sample (coloured text on the terminal).
  on('ui.render', { component: 'Pane', requestId: SKIN_PANE }, async ($, e) => {
    const current = await read($, skin)
    const style = await read($, bar)
    const p = await read($, prefs)
    const look = lookOf(current)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    const W = Math.max(240, Math.min(4096, Math.round((e.props.bodyColumns || 40) * 8.25)))
    const heading = (title: string, note: string) => (
      <Text>
        <Text bold>{title}</Text>
        <Text dimColor>{`  ${note}`}</Text>
      </Text>
    )
    const named = (name: string, note: string) => (
      <Box flexGrow={1}>
        <Text wrap="truncate-end">
          <Text bold>{name}</Text>
          <Text dimColor>{`  ${note}`}</Text>
        </Text>
      </Box>
    )
    const toggle = (key: string, name: string, note: string, isOn: boolean, flip: (p: Prefs) => Prefs) => (
      <Box key={`row-pref-${key}`} flexDirection="row" alignItems="center" columnGap={2}>
        {named(name, note)}
        <Button key={`pref-${key}`} label={isOn ? '● On' : '○ Off'} onPress={() => setPrefs($, flip)} />
      </Box>
    )
    const rowToggle = (key: keyof Prefs['rows'], name: string, note: string) =>
      toggle(key, name, note, p.rows[key], x => ({ ...x, rows: { ...x.rows, [key]: !x.rows[key] } }))
    const flag = (key: 'notify' | 'limits' | 'guard' | 'steps', name: string, note: string) => toggle(key, name, note, p[key], x => ({ ...x, [key]: !x[key] }))
    const chatToggle = (key: keyof Prefs['chat'], name: string, note: string) =>
      toggle(`chat-${key}`, name, note, p.chat[key], x => ({ ...x, chat: { ...x.chat, [key]: !x.chat[key] } }))
    const preview = Svg && barPreview(style, current, W)
    return (
      <Box flexDirection="column" rowGap={2}>
        <Text dimColor>Settings apply at once and are kept for new sessions. Esc closes.</Text>
        <Box flexDirection="column" rowGap={1}>
          {heading('Band', 'Rows above the prompt')}
          {rowToggle('info', 'Info', 'Folder, git user, branch and Node')}
          {rowToggle('tasks', 'Tasks', "Claude's own task list")}
          {rowToggle('crew', 'Crew', 'Subagents at work')}
          {rowToggle('usage', 'Usage', 'Context and plan limits')}
          {rowToggle('toolbar', 'Toolbar', 'Command and panel buttons')}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Progress bar', 'Tasks and usage cards')}
          <Box flexDirection="row" columnGap={1}>
            {(Object.keys(BAR_STYLES) as BarStyle[]).map(b => (
              <Button key={`bar-${b}`} label={b === style ? `✓ ${BAR_STYLES[b]}` : BAR_STYLES[b]} onPress={() => setBar($, b)} />
            ))}
          </Box>
          {Svg && preview ? <Svg source={preview.source} alt={preview.alt} /> : <Text color={look.bar('tasks', 0)}>{blocks(0.62, 16, ...BAR_GLYPHS[style])}</Text>}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Alerts', 'Outside the band')}
          {flag('notify', 'Turn notifications', 'When a turn of a minute or more ends, or an agent fails')}
          {flag('limits', 'Limit warnings', 'Once per window when 5H or 7D passes 90%')}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Chat', 'In the conversation')}
          {chatToggle('spinner', 'Spinner words', 'Thai words while Claude works')}
          {chatToggle('tools', 'Tool summaries', 'A line under edits, reads and commands')}
          {chatToggle('tests', 'Test results', 'Passed and failed counts as a bar')}
          {chatToggle('callouts', 'Callouts', 'Boxes for notes and warnings; Claude is told it may use them')}
          {chatToggle('label', 'Guard label', 'Shows 🛡 guard under the prompt while the guard is on')}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Agents and safety', '')}
          {flag('steps', 'Step reports', 'Agents may report their steps (a small tool); from the next session')}
          {flag('guard', 'Guard', 'Refuse rm -rf / or ~, force-pushing to main, reading .env files')}
        </Box>
        <Box flexDirection="column" rowGap={1}>
          {heading('Color theme', 'The band and panels')}
          {SKINS.map(k => {
            const t = THEMES[k]
            const tone = t ? (contrast(t.base, '#ffffff') > contrast(t.base, '#000000') ? 'Dark' : 'Light') : 'Matches your system'
            const kLook = lookOf(k)
            const swatch = Svg && skinPreview(k, W, k === current)
            return (
              <Box key={`row-${k}`} flexDirection="column">
                <Box flexDirection="row" alignItems="center" columnGap={2}>
                  {named(t?.name ?? 'Auto', tone)}
                  {k === current ? (
                    <Text color={kLook.clawd} bold>
                      ✓ In use
                    </Text>
                  ) : (
                    <Button key={`use-${k}`} label="Use" variant="primary" onPress={() => setSkin($, k)} />
                  )}
                </Box>
                {Svg && swatch ? (
                  <Svg source={swatch.source} alt={swatch.alt} />
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
      </Box>
    )
  })

  // A tool call drawn as a step in place of its row: what it was about, what it did, how it ended.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { chat } = await read($, prefs)
    const p = e.props
    if (!chat.tools) return next(e)
    const durationMs = p.tool === 'Bash' ? (await read($, durations))[p.tool_use_id] : undefined
    const step = stepOf({ ...p, ...(durationMs === undefined ? {} : { durationMs }), tests: chat.tests })
    return step ? stepView($, e, step) : next(e)
  })

  on('tool.check', { tool: 'Bash' }, async ($, e, next) => {
    const checked = await next(e)
    if (checked.decision === 'ask' && e.tool_use_id) asked.add(e.tool_use_id)
    return checked
  })

  // With Tool summaries on, a folded run of reads and searches unfolds into its own steps.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) =>
    (await read($, prefs)).chat.tools ? next({ ...e, props: { ...e.props, isExpanded: true } }) : next(e),
  )

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary || !(await read($, prefs)).chat.callouts) return next(e)
    const parts = splitCallouts(e.props.text)
    if (!parts.some(s => s.kind === 'callout')) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Markdown, Text } = ui
    const Svg = SVG_IN_CHAT && e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
    return (
      <Box flexDirection="column" rowGap={1}>
        {parts.map((s, i) => {
          if (s.kind === 'md') return s.text.trim() ? <Markdown key={`md${i}`} text={s.text} /> : null
          const k = CALLOUT_KINDS[s.type]
          const title = Svg ? calloutTitleSvg(s.type) : undefined
          return (
            <Box key={`co${i}`} borderStyle="round" borderColor={k.key} paddingX={1} flexDirection="column">
              {Svg && title ? (
                <Svg source={title.source} alt={title.alt} width={title.width} height={title.height} />
              ) : (
                <Text color={k.key} bold>
                  {`${k.glyph} ${k.title}`}
                </Text>
              )}
              <Markdown text={s.body} />
            </Box>
          )
        })}
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    turnSeed = seedOf(e.turnId)
    return next(e)
  })

  // Thai words in the spinner; the desktop keeps a word that names the step.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!(await read($, prefs)).chat.spinner) return next(e)
    if (e.surface !== 'terminal' && !isGenericWord(e.props.word)) return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode, turnSeed) } })
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const p = await read($, prefs)
    if (!p.chat.label || !p.guard) return next(e)
    const ui = $.ui.resolve(e)
    if (SVG_IN_CHAT && e.surface !== 'terminal' && 'Svg' in ui) {
      const d = modesSvg(e.props.modes)
      return <ui.Svg source={d.source} alt={d.alt} width={d.width} height={d.height} />
    }
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, '⛨ guard'] } })
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!(await read($, prefs)).chat.callouts) return composed
    return { sections: [...composed.sections, { id: 'sabai-band:callouts', text: CALLOUT_HINT, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { rows } = await read($, prefs)
    const p = rows.tasks ? progress(await read($, tasks)) : undefined
    const measured = await read($, usage)
    const at = await read($, now)
    const list = rows.usage ? meters(measured, at) : []
    const info = rows.info ? chips(await read($, env)) : { left: [], right: [] }
    const everyone = await read($, agents)
    const all = rows.crew ? everyone : []
    // The crew shows while agents work and for a minute after the last ends; the pane keeps the rest.
    const lastEnd = Math.max(0, ...all.map(a => a.endedAt ?? 0))
    const runs = all.some(a => a.status === 'running') || at - lastEnd < CREW_LINGER_MS ? all : []
    if (!p && info.left.length + info.right.length === 0 && list.length === 0 && runs.length === 0) return next(e)

    const skinName = await read($, skin)
    const style = await read($, bar)
    const look = lookOf(skinName)
    const { running: active, finished: ended } = groups(runs)
    const running = active.length
    // The toolbar's count holds whether or not the crew row shows.
    const working = everyone.filter(a => a.status === 'running').length
    const lead = active[0]
    const leadLine = lead && progressOf(lead)
    const leadDetail = lead ? (leadLine ? `${leadLine.done}/${leadLine.total} · ${leadLine.title}` : `${lead.steps} ${lead.steps === 1 ? 'step' : 'steps'}`) : ''
    const failedCount = ended.filter(a => a.status === 'failed').length
    const endedText = failedCount ? `${ended.length - failedCount} done · ${failedCount} failed` : `${ended.length} done`
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
        <Button key="agents" label={working > 0 ? `✻ ${working}` : '✻'} hotkey="a" plain onPress={() => toggleAgents($)}>
          {tile('✻', look.clawd)}
          {working > 0 ? <Text bold>{` ${working}`}</Text> : null}
        </Button>
        <Button key="skins" label="⚙" hotkey="s" plain onPress={() => togglePane($, SKIN_PANE, 'Settings', true)}>
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
      const band = bandSvg(p, info, list, Math.max(200, Math.min(4096, Math.round((e.props.bodyColumns || 100) * 8.25))), e.props.isWorking, skinName, style, { runs, now: at })
      return (
        <Box flexDirection="column">
          {band && <Svg source={band.source} alt={band.alt} />}
          {rows.toolbar && toolbar}
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
        {runs.length > 0 && (
          <Text wrap="truncate-end">
            <Text color={look.clawd}>{'✻ '}</Text>
            {running > 0 ? <Text bold>{`${running} running`}</Text> : <Text bold>{failedCount ? endedText : `All ${endedText}`}</Text>}
            {running > 0 && ended.length > 0 ? <Text dimColor>{` · ${endedText}`}</Text> : null}
            {lead ? <Text>{`  ${lead.description || lead.type}`}</Text> : null}
            {lead ? <Text dimColor>{`  ${leadDetail}`}</Text> : null}
          </Text>
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
        {rows.toolbar && toolbar}
        {theirs}
      </Box>
    )
  })
}
