import { atom, memberOf, read, update } from 'claude-code'
import type { BuiltinToolResults, EngineInterface, Register, RenderNode } from 'claude-code'

import type { AgentRun, BarStyle, CallKind, Env, GuardAction, GuardRule, Prefs, Task, TurnLog, Usage, UsageStyle } from '../types'
import { CALLS_KEPT, CREWS_KEPT, MAIN_TYPE, SUMMARY_SYSTEM, isMain, progressOf, needsLook, dayOf, briefOf, called, calling, clearEarlier, clock, crewOf, crewsOf, factsLine, finished, openCrews, reported, resultText, spawned, stepped, summarized, summaryOf, summaryPrompt, touched, typeStyle, withTasks, raceOf } from './agents'
import { CELEBRATE_MS, EMPTY_RACE, countOf, RACE_LINGER_MS, STARTLE_MS, doingOf, accessoryOf, moodLine, moodOf, trickOf, WAVE_MS, nextTurnRace, raced, chips, countdown, created, fromTodos, level, meters, progress, toUsage, estimated, updated, usageNote } from './model'
import { BAR_STYLES, CALLOUT_KINDS, HERO_MIN_W, RACE_MIN_W, USAGE_STYLES, activitySvg, agentHeadSvg, crewSvg, earlierSvg, emptyDetailSvg, filesSvg, laneSvg, moodLabel, receiptSvg, calloutTitleSvg, stepSvg, stepsSvg, bandSvg, barPreview, densityPreview, emptyAgentsSvg, infoSvg, lookOf, skinPreview, toolIconSvg, toolsSvg, usageSketch } from './svg'
import type { Drawing, ToolIcon } from './svg'
import { GUARD_FAILED, GUARD_RULES, failClosed, risksOf } from './guard'
import { actOf, CALLOUT_HINT, EMPTY_LOG, endedTasks, isGenericWord, isReadOnly, isTestCommand, logged, receiptOf, receiptText, seedOf, spinnerWord, splitCallouts, stepOf, testResult } from './chat'
import type { Logged, Receipt, Step, StepIcon } from './chat'
import { SKINS, SKIN_NAMES } from './themes'
import type { Skin } from './themes'

const usage = atom({ plugin: 'sabai', key: 'usage' } as const, null as Usage | null)
const tasks = atom({ plugin: 'sabai', key: 'tasks' } as const, [] as Task[])
const now = atom({ plugin: 'sabai', key: 'now' } as const, 0)
const env = atom({ plugin: 'sabai', key: 'env' } as const, {} as Env)
const skin = atom({ plugin: 'sabai', key: 'skin' } as const, 'raised')
const agents = atom({ plugin: 'sabai', key: 'agents' } as const, [] as AgentRun[])
const mains = atom({ plugin: 'sabai', key: 'mains' } as const, [] as AgentRun[])
const bar = atom({ plugin: 'sabai', key: 'bar' } as const, 'dither' as BarStyle)
const DEFAULT_GUARD_RULES = Object.fromEntries(Object.entries(GUARD_RULES).map(([k, r]) => [k, r.action])) as Record<GuardRule, GuardAction>
const DEFAULT_PREFS: Prefs = {
  rows: { info: true, tasks: true, crew: true, usage: true, toolbar: true, live: true },
  notify: true,
  limits: true,
  guard: false,
  steps: true,
  chat: { spinner: true, tools: true, tests: true, callouts: true, receipt: true },
  guardRules: DEFAULT_GUARD_RULES,
  show: { folder: true, gitUser: true, branch: true, node: true, context: true, session: true, week: true, clawd: true },
  warnAt: 70,
  alertAt: 90,
  density: 'comfortable',
  extras: { accessories: true, tricks: true },
  usageStyle: 'tiles',
  agentSummary: true,
}
const prefs = atom({ plugin: 'sabai', key: 'prefs' } as const, DEFAULT_PREFS)
// A saved Prefs, filled from the defaults where it predates a field.
const withDefaults = (v: unknown): Prefs => {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<Prefs>
  return {
    ...DEFAULT_PREFS,
    ...p,
    rows: { ...DEFAULT_PREFS.rows, ...(p.rows ?? {}) },
    chat: { ...DEFAULT_PREFS.chat, ...(p.chat ?? {}) },
    guardRules: { ...DEFAULT_GUARD_RULES, ...(p.guardRules ?? {}) },
    show: { ...DEFAULT_PREFS.show, ...(p.show ?? {}) },
    extras: { ...DEFAULT_PREFS.extras, ...(p.extras ?? {}) },
    usageStyle: p.usageStyle && Object.hasOwn(USAGE_STYLES, p.usageStyle) ? p.usageStyle : DEFAULT_PREFS.usageStyle,
  }
}
const STEP_TOOL = 'mcp__sabai__step'
const turnLog = atom({ plugin: 'sabai', key: 'turnLog' } as const, EMPTY_LOG)
// What the guard refused or asked about this session; not stored.
const guardCaught = atom({ plugin: 'sabai', key: 'guardCaught' } as const, 0)
// The ids of the background tasks the main conversation started and no notification has ended yet
// (shells and monitors; the race shows agents).
const background = atom({ plugin: 'sabai', key: 'background' } as const, [] as string[])
// Clock time the main conversation's last turn ended; 0 before any.
const lastTurnAt = atom({ plugin: 'sabai', key: 'lastTurnAt' } as const, 0)
// Recent turns' logs by their final answer, so the reply that answer is drawn as carries its
// receipt card; the engine names no turn on a reply, but its text is the answer's.
const receipts = atom({ plugin: 'sabai', key: 'receipts' } as const, {} as Record<string, TurnLog>)
// A receipt is filed under a short key of its answer, not the answer itself: every reply row reads
// the map while it draws, streaming included, and it holds the last RECEIPTS_KEPT turns.
const receiptKey = (answer: string) => `${seedOf(answer)}:${answer.length}`
const RECEIPTS_KEPT = 40
// The main turn as it runs, for the live strip: when it began, and the step in flight.
const turnStartedAt = atom({ plugin: 'sabai', key: 'turnStartedAt' } as const, 0)
const liveStep = atom({ plugin: 'sabai', key: 'liveStep' } as const, null as { icon: StepIcon; title: string; at?: number } | null)
// Each member's calls for the race: its tiles, its call in flight, its last fall and score.
const race = atom({ plugin: 'sabai', key: 'race' } as const, EMPTY_RACE)
// The tools a row draws as a one-line step.
const STEP_TOOLS = new Set(['Bash', 'Edit', 'Write', 'Read'])
// How long each Bash call ran, one member per tool_use_id (a row reads only its own, so a new
// call redraws no other row); -1 while unknown. The result carries no duration of its own.
const durations = atom({ plugin: 'sabai', key: 'durations' } as const, -1)
// Bash calls in flight, by id, and those that waited on the permission dialog: their time would
// be the person's, not the command's. The auto-mode classifier's ask is quick and keeps it.
const inFlight = new Map<string, string>()
const asked = new Set<string>()
// A reply longer than this is left to the engine: redrawn, it could outgrow the tree limit.
const REPLY_REDRAW_MAX = 90_000
// A main turn this long earns a notification when it ends.
const LONG_TURN_MS = 60_000
// Each plan-limit window warned about already, by kind and reset time; in state, so a reload
// does not warn again.
const warned = atom({ plugin: 'sabai', key: 'warned' } as const, [] as string[])
const resetArmed = atom({ plugin: 'sabai', key: 'resetArmed' } as const, false)
// How long a first press of Reset waits for the second.
const RESET_ARM_MS = 5000
// The agents pane: the run its detail shows (null: the one most worth a look), the detail's open
// folds, and the earlier crews shown in full.
const selectedAgent = atom({ plugin: 'sabai', key: 'selectedAgent' } as const, null as string | null)
const detailOpen = atom({ plugin: 'sabai', key: 'detailOpen' } as const, [] as string[])
const earlierOpen = atom({ plugin: 'sabai', key: 'earlierOpen' } as const, [] as string[])
const earlierFolded = atom({ plugin: 'sabai', key: 'earlierFolded' } as const, null as boolean | null)
// The main loop's model: a subagent on the same model has the same context window.
const mainModel = atom({ plugin: 'sabai', key: 'mainModel' } as const, '')
// How long Haiku may take to sum a report up before the pane stops waiting.
const SUMMARY_TIMEOUT_MS = 20_000
// The card drawings a pane may carry, in characters, newest first: its whole tree, escaping and
// the rest included, must stay under the engine's 100,000.
const PANE_BUDGET = 70_000

const isBarStyle = (v: unknown): v is BarStyle => typeof v === 'string' && Object.hasOwn(BAR_STYLES, v)

const PANE = 'sabai-agents'
const SKIN_PANE = 'sabai-skins'
// The settings' drawn choices: layouts and looks two to a row, the usage styles four.
const PICK_W = 220
const USAGE_PICK_W = 132
// What the settings show of the chat's touches: an edit, a test run and a turn's receipt.
const SAMPLE_EDIT: Step = { icon: 'pen', tone: 'edit', title: 'Edited svg.ts', detail: '…/sabai/hooks/', result: [{ text: '+3', tone: 'ok' }, { text: ' −2', tone: 'bad' }], meter: { good: 3, bad: 2 } }
const SAMPLE_TEST: Step = { icon: 'flask', tone: 'ok', title: 'Run the tests', detail: '$ bun test', result: [{ text: '✓ 159 passed', tone: 'ok' }], meter: { good: 159, bad: 0 }, time: '5.4s' }
const SAMPLE_RECEIPT: Receipt = { tone: 'ok', headline: 'All green', files: { count: 3, added: 40, removed: 12 }, test: { passed: 159, failed: 0 }, commands: { count: 4, failed: 0 } }

// The desktop's toolbar icons are links a press answers (onLinkPress); this address is never opened.
const TOOL_HREF = 'https://sabai.invalid/'
// A drawing's width from the surface's columns (the code font's advance, 8.25 px), within an Svg's limits.
const widthOf = (columns: number | undefined, min: number, fallback: number) => Math.max(min, Math.min(4096, Math.round((columns || fallback) * 8.25)))
// What the desktop adds round each icon's image (its chip), as it looks on screen.
const TOOL_CHIP = 8

const TICK_MS = 30_000
const CREW_LINGER_MS = 60_000
// A hung git (a network drive, a stale lock) gives up rather than hold the band.
const GIT_TIMEOUT_MS = 5000

// Module state is fine here: session.start sets it again after a reload.
let cwd = ''
let lastBranch: string | undefined
let reading: Promise<void> | undefined
// Whether this surface offers /compact (the toolbar's one command).
let canCompact = false
// The mod works only in a session the desktop draws on; a terminal or -p session is left alone:
// no band, panes, chat rows, commands, tool, prompt section, guard or notifications.
let desktop = false

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
  // The branch read ends the info row's skeleton, which stands where the folder and branch will be.
  await update($, env, e => ({ ...e, branch, ahead, behind, changes: status ? status.split('\n').length : 0, read: true }))
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
  return togglePane($, PANE, 'Subagents')
}

async function setBar($: EngineInterface, style: string) {
  if (!isBarStyle(style)) return
  await update($, bar, () => style)
  await $.store.set('bar', style)
}

// Settings, skin and bar style back to their defaults.
async function resetAll($: EngineInterface) {
  await setPrefs($, () => DEFAULT_PREFS)
  await setSkin($, 'raised')
  await setBar($, 'dither')
}

async function setPrefs($: EngineInterface, fn: (p: Prefs) => Prefs) {
  const next = await update($, prefs, fn)
  await $.store.set('prefs', next)
}

// The guard's catch for a call under one action: of the call's risks, the one whose rule is set
// strictest (block, then ask), when that setting is `action` and the guard is on; or nothing.
const STRICTNESS: Record<GuardAction, number> = { block: 2, ask: 1, off: 0 }
async function riskFor($: EngineInterface, tool: string, input: { command?: unknown; file_path?: unknown }, action: GuardAction) {
  const p = await read($, prefs)
  if (!p.guard) return undefined
  const strictest = risksOf(tool, input).sort((a, b) => STRICTNESS[p.guardRules[b.rule]] - STRICTNESS[p.guardRules[a.rule]])[0]
  return strictest && p.guardRules[strictest.rule] === action ? strictest : undefined
}

// One more catch this session, stamped on the turn so Clawd startles.
async function caught($: EngineInterface) {
  const at = await $.clock.now()
  await update($, guardCaught, n => n + 1)
  await update($, turnLog, l => ({ ...l, caught: at }))
  await update($, now, () => at)
  $.clock.after(STARTLE_MS + 100, () => void tick($))
}

// The guard's refusal for a call, told to the person too, or nothing when it passes, asks or is off.
async function guarded($: EngineInterface, tool: string, input: { command?: unknown; file_path?: unknown }): Promise<string | undefined> {
  const risk = await riskFor($, tool, input, 'block')
  if (!risk) return undefined
  await caught($)
  $.ui.toast(`Blocked: this ${risk.reason}`)
  return `sabai's guard refused this: it ${risk.reason}. The person can turn the guard off in /sabai-settings.`
}

// The main turn's work, for its receipt and Clawd's mood; a refused call did nothing.
async function logCall($: EngineInterface, agentId: string | undefined, called: { deny?: string }, call: Logged) {
  if (agentId !== undefined || called.deny !== undefined) return
  await update($, turnLog, l => logged(l, call))
}

// The main turn's step in flight, for the live strip: the step's running title; a subagent's
// calls leave it alone. Every member's race lane keeps the call's name as it reads once done.
async function stepping($: EngineInterface, agentId: string | undefined, tool: string, input: unknown) {
  const said = stepOf({ tool, input, isRunning: false, isErrored: false, isInterrupted: false })?.title
  if (said) await update($, race, r => ({ ...r, said: { ...r.said, [agentId ?? 'main']: said } }))
  if (agentId !== undefined) return
  const s = stepOf({ tool, input, isRunning: true, isErrored: false, isInterrupted: false })
  const at = await $.clock.now()
  await update($, liveStep, () => (s ? { icon: s.icon, title: s.title, at } : null))
}

// A call that never came back (it threw): only its in-flight mark is cleared.
const UNFINISHED = { deny: 'unfinished' }

// A member's call for the race: in flight before it runs, then its tile once it finished; a
// refused or unfinished call leaves only the in-flight mark cleared.
async function racing($: EngineInterface, agentId: string | undefined, kind: CallKind, called?: { deny?: string; isError?: boolean }, ok?: boolean) {
  const member = agentId ?? 'main'
  if (called === undefined && ok === undefined) {
    await update($, race, r => ({ ...r, doing: { ...r.doing, [member]: [...doingOf(r, member), kind] } }))
    return
  }
  const at = await $.clock.now()
  await update($, race, r => {
    // This call leaves the member's calls in flight; a parallel one still running stays.
    const left = doingOf(r, member)
    const i = left.indexOf(kind)
    const doing = { ...r.doing, [member]: i === -1 ? left : [...left.slice(0, i), ...left.slice(i + 1)] }
    return !called || called.deny !== undefined ? { ...r, doing } : raced({ ...r, doing }, member, { kind, ok: ok ?? !called.isError }, at)
  })
}

// The Task tools are an agent's own bookkeeping, shown as its progress: not calls in its log.
const UNLOGGED = new Set(['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList', 'TodoWrite'])
// The tools whose own hooks run the race; any other a subagent calls runs in its lane from here,
// so the lane and the pane count the same calls.
const RACED = new Set(['Read', 'Edit', 'Write', 'Bash'])
// The id of the main turn's run that started at `at`.
const mainKey = (at: number) => `main:${at}`
// A path under the project, as the pane shows it, from the project's root; one outside it, by its
// last two folders.
const inProject = (path: string) => {
  if (cwd && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1)
  const parts = path.split('/').filter(Boolean)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : path
}

// A subagent's call for the agents pane: in flight while it runs, then in its log with its time
// and whether it worked (a refused call, or one that never came back, is not logged), its tool
// counted and the file it read or changed. A test run works only when no test failed.
// The runs a call belongs to: the main turns' or the subagents' (each atom named where it is
// updated, as the engine reads a module's state).
const updateRuns = ($: EngineInterface, main: boolean, fn: (l: AgentRun[]) => AgentRun[]) => (main ? update($, mains, fn) : update($, agents, fn))

async function logAgentCall<R extends { deny?: string; isError?: boolean; result?: unknown }>($: EngineInterface, main: boolean, agentId: string, tool: string, input: unknown, run: () => Promise<R>): Promise<R> {
  if (UNLOGGED.has(tool)) return run()
  const act = actOf(tool, input)
  // Main's own calls run in its lane through the race's hooks alone, as before.
  const raced = RACED.has(tool) || main
  const kind: CallKind = act.kind === 'read' || act.kind === 'edit' || act.kind === 'command' || act.kind === 'test' ? act.kind : act.kind === 'search' || act.kind === 'web' ? 'read' : 'command'
  const start = await $.clock.now()
  await updateRuns($, main, l => calling(l, agentId, act, start))
  if (!raced) await racing($, agentId, kind)
  let result: R | undefined
  try {
    result = await run()
    return result
  } finally {
    const end = await $.clock.now()
    const i = (input ?? {}) as { command?: string; file_path?: string; old_string?: string; new_string?: string; content?: string }
    // Both streams, as the race reads them: some runners print their failures to stderr.
    const out = result?.result as { stdout?: string; stderr?: string } | undefined
    const output = typeof result?.result === 'string' ? result.result : `${out?.stdout ?? ''}\n${out?.stderr ?? ''}`
    const ok = result === undefined || result.deny !== undefined ? undefined : !result.isError && (act.kind !== 'test' || (testResult(output)?.failed ?? 0) === 0)
    await updateRuns($, main, l => called(l, agentId, act, end, end - start, ok))
    if (ok && typeof i.file_path === 'string') {
      const path = inProject(i.file_path)
      if (tool === 'Read') await updateRuns($, main, l => touched(l, agentId, path, { read: true }))
      else if (tool === 'Edit' || tool === 'Write') {
        const r = result!.result as { structuredPatch?: BuiltinToolResults['Edit']['structuredPatch']; type?: string } | undefined
        const c: Logged = tool === 'Edit' ? { tool, path, oldText: i.old_string ?? '', newText: i.new_string ?? '', ...(r?.structuredPatch ? { patch: r.structuredPatch } : {}) } : { tool, path, content: i.content ?? '', ...(r?.type === 'update' && r.structuredPatch ? { patch: r.structuredPatch } : {}) }
        const delta = logged(EMPTY_LOG, c).files[path] ?? { added: 0, removed: 0 }
        await updateRuns($, main, l => touched(l, agentId, path, { ...delta, ...(r?.type === 'create' ? { created: true } : {}) }))
      }
    }
    if (!raced) await racing($, agentId, kind, result ?? UNFINISHED, ok)
  }
}

// A finished run's report summed up in Thai by Haiku, while it still waits for it (more work sent
// meanwhile drops the wait). No answer in time, or none to read, leaves no summary.
async function summarize($: EngineInterface, agentId: string) {
  const run = (await read($, agents)).find(a => a.agentId === agentId)
  if (!run || run.summary !== 'pending') return
  const r = await $.model.complete({ model: 'haiku', system: SUMMARY_SYSTEM, prompt: summaryPrompt(run), maxTokens: 600, effort: 'low', timeoutMs: SUMMARY_TIMEOUT_MS }).catch(() => undefined)
  const bullets = r?.isAnswered ? summaryOf(r.text) : undefined
  // Only on the round it read: more work and a quicker end meanwhile wait for their own. An answer
  // that comes after a reload has no module left to write to; the new one asks again.
  await update($, agents, l => {
    const now = l.find(a => a.agentId === agentId)
    return now?.summary === 'pending' && now.endedAt === run.endedAt ? summarized(l, agentId, bullets) : l
  }).catch(() => undefined)
}

async function unstep($: EngineInterface, agentId: string | undefined) {
  if (agentId === undefined) await update($, liveStep, () => null)
}

async function setSkin($: EngineInterface, name: string) {
  await update($, skin, () => name)
  await $.store.set('skin', name)
}

// What the engine knows now. Its context reading is the last response's, so before a first response,
// or once a compaction or /clear has made it stale, the window is the engine's local estimate
// (`summary` sends no request) until the next response measures it. No answer is an answer too:
// the band leaves its skeleton for the note, and keeps a reading that outlived a reload.
async function readUsage($: EngineInterface, stale = false) {
  const known = await $.session.usage().catch(() => undefined)
  if (!known) return update($, usage, u => (u && stale ? estimated(u, undefined) : (u ?? { rateLimits: [] })))
  if (!stale && known.context.percent !== undefined) return update($, usage, () => toUsage(known))
  const breakdown = (await $.session.usage({ breakdown: 'summary' }).catch(() => undefined))?.context.breakdown
  await update($, usage, () => estimated(toUsage(known), breakdown?.totalTokens))
}

// Everything the mod needs once the desktop draws on the session: saved choices, commands, the
// step tool, the clocks and the info row's reads.
async function setUp($: EngineInterface) {
  desktop = true
  // What the person sees first: their saved choices and the commands, before any slow read.
  const saved = await $.store.get('skin').catch(() => undefined)
  if (typeof saved === 'string' && (SKINS as readonly string[]).includes(saved)) await update($, skin, () => saved)
  const savedBar = await $.store.get('bar').catch(() => undefined)
  if (isBarStyle(savedBar)) await update($, bar, () => savedBar)
  const savedPrefs = withDefaults(await $.store.get('prefs').catch(() => undefined))
  await update($, prefs, () => savedPrefs)
  await $.command.register({ name: 'sabai-settings', description: 'Open the sabai settings' })
  // Agents can report their own steps: a subagent rarely has a task list of its own.
  if (savedPrefs.steps)
    await $.tool
      .register({
        name: 'step',
        description:
          'For subagents: report progress on your own work to the Subagents pane. Right after reading your brief, call it with `total` ' +
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
  await $.command.register({ name: 'sabai-agents', description: 'Show or hide the Subagents pane' })
  canCompact = (await $.command.list().catch(() => [])).some(c => c.name === 'compact')
  // The clock first, so no countdown is ever measured from zero.
  await tick($)
  // session.measure fires only on the next response, so a fresh load reads what is known now.
  await readUsage($)
  // A summary the module was waiting for when it reloaded went with it: ask again.
  for (const { agentId, summary } of await read($, agents)) if (agentId && summary === 'pending') $.clock.after(1, () => void summarize($, agentId))
  // Keeps the reset countdowns and the branch fresh between responses.
  $.clock.every(TICK_MS, () => void Promise.all([tick($), checkBranch($)]))
  // Running subagents' clocks count by the second; quiet when none runs.
  $.clock.every(1000, () => {
    void (async () => {
      // Read from state, which outlives a reload mid-turn: the turn started after the last one ended.
      const mainWorking = (await read($, turnStartedAt)) > (await read($, lastTurnAt))
      if (mainWorking || (await read($, agents)).some(a => a.status === 'running')) await tick($)
    })()
  })
  // git and node last, and not waited on: a slow repository must not hold the session. Each read
  // lands on its own, so a slow one (a version manager's `node` shim) holds back only itself. One
  // that ends after a reload has no module left to write to.
  void (async () => {
    // A draw that set the mod up before session.start told the folder has no cwd yet: keep the folder.
    if (cwd) await update($, env, e => ({ ...e, dir: cwd.split(/[\\/]/).filter(Boolean).pop() }))
    void line($, ['git', 'config', 'user.name']).then(gitUser => update($, env, e => ({ ...e, gitUser }))).catch(() => undefined)
    void line($, ['node', '--version']).then(node => update($, env, e => ({ ...e, node }))).catch(() => undefined)
    await readRepo($)
  })().catch(() => undefined)
}

export const register: Register = on => {
  // The SDK's sessions (the desktop's) start drawing nowhere; the desktop attaches when it first
  // asks to draw. A reload starts the module over, with the desktop attached already.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = started.cwd
    if ((await $.session.surfaces()).includes('desktop')) await setUp($)
    return started
  })
  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    if (e.surface === 'desktop' && !desktop) await setUp($)
    return attached
  })

  // A compacted conversation is smaller at once, though no response has measured it yet.
  on('session.compact', async ($, e, next) => {
    if (!desktop) return next(e)
    const compacted = await next(e)
    if (compacted.messages && e.agentId === undefined && e.trigger !== 'precompute') await readUsage($, true)
    return compacted
  })

  // A cleared or resumed conversation does not carry this one's task list, turn, race, receipts,
  // the guard's count or its context. session.end is how the desktop tells: it raises no classic.*.
  on('session.end', async ($, e, next) => {
    if (!desktop || (e.reason !== 'clear' && e.reason !== 'resume')) return next(e)
    await update($, tasks, () => [])
    await update($, agents, () => [])
    await update($, mains, () => [])
    await update($, selectedAgent, () => null)
    await update($, detailOpen, () => [])
    await update($, earlierOpen, () => [])
    await update($, earlierFolded, () => null)
    await update($, turnLog, () => EMPTY_LOG)
    await update($, race, () => EMPTY_RACE)
    await update($, guardCaught, () => 0)
    await update($, receipts, () => ({}))
    await update($, liveStep, () => null)
    const ended = await next(e)
    // The new conversation is read once this one has gone.
    $.clock.after(0, () => void readUsage($, true))
    return ended
  })

  on('agent.spawn', async ($, e, next) => {
    if (!desktop) return next(e)
    const started = await next(e)
    // A remote workflow agent has no local loop: nothing would ever step or end its run.
    if (started.deny !== undefined || started.agentId === undefined) return started
    const at = await $.clock.now()
    // Its crew: its parent agent's, else its workflow run, else the main turn that started it.
    const parent = e.parentAgentId === undefined ? undefined : (await read($, agents)).find(a => a.agentId === e.parentAgentId)
    const crew = parent ? crewOf(parent) : e.workflow?.runId ? `wf:${e.workflow.runId}` : `turn:${await read($, turnStartedAt)}`
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
      crew,
      brief: briefOf(e.prompt),
      ...(e.background ? { background: true } : {}),
      ...(e.isTeammate ? { teammate: true } : {}),
      lastActiveAt: at,
    }
    await update($, agents, list => spawned(list, run))
    await update($, now, () => at)
    return started
  })

  // Each model request of a subagent: its model, its step count and its context.
  on('turn.step', async function* ($, e, next) {
    if (!desktop) return yield* next(e)
    const result = yield* next(e)
    const { agentId } = e
    const { usage: used } = result
    if (!agentId) {
      if (used?.model || e.model) await update($, mainModel, () => used?.model || e.model)
      if (used) {
        const key = mainKey(await read($, turnStartedAt))
        const at = await $.clock.now()
        await update($, mains, l => stepped(l, key, used.model || e.model, used, e.effort, at))
      }
      return result
    }
    if (used) {
      const at = await $.clock.now()
      const crew = `turn:${await read($, turnStartedAt)}`
      await update($, agents, list => stepped(list, agentId, used.model || e.model, used, e.effort, at, crew))
    }
    return result
  })

  // A subagent's turn ends its run; the main conversation's may have switched branch or edited files.
  on('turn.complete', async ($, e, next) => {
    if (!desktop) return next(e)
    const completed = await next(e)
    const { agentId } = e
    const { notify } = await read($, prefs)
    if (agentId === undefined) {
      const key = mainKey(await read($, turnStartedAt))
      const endedAt = await $.clock.now()
      await update($, mains, l => finished(l, key, e.reason, endedAt, e.answer))
      // Not waited on: a large repository's status must not delay the turn's end.
      void readRepo($).catch(() => undefined)
      if (notify && e.durationMs >= LONG_TURN_MS) void $.ui.notify(`Finished in ${clock(e.durationMs)}`, { title: 'Claude' }).catch(() => undefined)
      const ended = await $.clock.now()
      await update($, lastTurnAt, () => ended)
      // Clawd waves for WAVE_MS; redraw when the wave ends.
      $.clock.after(WAVE_MS + 100, () => void tick($))
      await update($, liveStep, () => null)
      // The receipt: a card under the reply that holds the answer; a turn with no words of its own
      // gets it as the notice under it instead.
      const log = await read($, turnLog)
      if ((await read($, prefs)).chat.receipt && receiptOf(log)) {
        const answer = e.answer.trim()
        // An answer an earlier turn gave word for word ("Done.") would draw this receipt under that
        // turn's reply too, so it goes in the notice; the earlier reply keeps its own.
        if (!answer || Object.hasOwn(await read($, receipts), receiptKey(answer)))
          return { ...completed, text: completed.text ? `${completed.text}\n${receiptText(log)!}` : receiptText(log)! }
        await update($, receipts, all => Object.fromEntries([...Object.entries(all), [receiptKey(answer), log]].slice(-RECEIPTS_KEPT)))
      }
    } else {
      const at = await $.clock.now()
      const list = await update($, agents, l => finished(l, agentId, e.reason, at, e.answer))
      const run = list.find(a => a.agentId === agentId)
      if (run?.status === 'done' && run.result && (await read($, prefs)).agentSummary) {
        await update($, agents, l => summarized(l, agentId, 'pending'))
        $.clock.after(1, () => void summarize($, agentId))
      }
      if (notify && run?.status === 'failed') void $.ui.notify(`${run.description || run.type} failed: ${resultText(run)}`, { title: 'Subagent' }).catch(() => undefined)
      // The hop and confetti last a few seconds; with nothing left running, nothing else would
      // tick the clock to end them.
      $.clock.after(3100, () => void tick($))
      await update($, now, () => at)
    }
    return completed
  })

  on('command.run', { command: 'sabai-agents' }, async $ => ({
    text: (await toggleAgents($)) ? 'Subagents pane opened.' : 'Subagents pane closed.',
  }))

  // The agents pane in three boxes: Now (the crews at work: a timeline, then a lane for Main and
  // each agent), Viewing (the run viewed, or how to view one) and Earlier (the crews before, a
  // line each). View on a lane opens its run in Viewing; pressing it again, or Close, closes it.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const subagents = await read($, agents)
    // A turn is a crew with its agents. Without any, only the latest is (Claude's alone), and not
    // once it ends calling nothing (a notification's, a quick reply): the work before stays on top.
    const allMains = await read($, mains)
    // A turn that ended while its crew's agents run waits on them, as the band's race says: a
    // background agent's end wakes Main again. Drawn so, never stored.
    const mainWorks = allMains.some(m => m.status === 'running')
    const waitOn = (m: AgentRun): AgentRun => {
      const n = mainWorks || m.status !== 'done' ? 0 : subagents.filter(a => crewOf(a) === crewOf(m) && a.status === 'running').length
      if (!n) return m
      const { endedAt: _e, ...rest } = m
      return { ...rest, status: 'running', waitingOn: n }
    }
    const turns = allMains.filter(m => subagents.some(a => crewOf(a) === crewOf(m)) || (m === allMains.at(-1) && (m.status === 'running' || (m.callCount ?? 0) > 0))).map(waitOn)
    const mainTasks = await read($, tasks)
    const at = await read($, now)
    const skinName = await read($, skin)
    const style = await read($, bar)
    const picked = await read($, selectedAgent)
    const folds = await read($, detailOpen)
    const shownEarlier = await read($, earlierOpen)
    const folded = await read($, earlierFolded)
    const main = await read($, mainModel)
    const window = (await read($, usage))?.contextWindow
    const { Box, Button, Markdown, Svg, Text } = $.ui.resolve(e)
    const W = widthOf(e.props.bodyColumns, 240, 40)
    const look = lookOf(skinName)

    // Each main turn just before its crew's first agent; one with no agents (the turn at work)
    // last. The turn at work carries the main task list as its progress.
    const list: AgentRun[] = []
    for (const a of subagents) {
      const turn = turns.find(m => crewOf(m) === crewOf(a) && !list.includes(m))
      if (turn) list.push(turn)
      list.push(a)
    }
    for (const m of turns) if (!list.includes(m)) list.push(m)
    const latest = turns.at(-1)
    const withTasks = (a: AgentRun) => (a === latest && mainTasks.length ? { ...a, tasks: mainTasks } : a)

    if (list.length === 0) {
      const empty = emptyAgentsSvg(W, skinName)
      return <Svg source={empty.source} alt={empty.alt} width={empty.width} height={empty.height} />
    }

    // A run on the main loop's model has its context window; on another model it is unknown.
    const windowOf = (a: AgentRun) => (main && a.model === main ? window : undefined)
    const { atWork: current, earlier } = openCrews(crewsOf(list))
    const currentIds = new Set(current.map(c => c.id))
    const runs = list.filter(a => currentIds.has(crewOf(a))).map(withTasks)
    const selected = list.map(withTasks).find(a => a.id === picked)
    // Each drawing spends from the pane's budget, the overview and the detail first; what does
    // not fit is counted instead.
    let spent = 0
    // A drawing costs what it takes in the serialized tree: its source escaped, and its alt.
    const fits = (d: Drawing | undefined): d is Drawing => {
      const cost = d ? JSON.stringify(d.source).length + d.alt.length : 0
      if (!d || spent + cost > PANE_BUDGET) return false
      spent += cost
      return true
    }
    const image = (key: string, d: Drawing) => <Svg key={key} source={d.source} alt={d.alt} width={d.width} height={d.height} />
    // A box's title row: its name in bold, what it holds, and its buttons.
    const boxHead = (title: string, note: string, ...buttons: (RenderNode | false | undefined)[]) => (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        <Box flexGrow={1} flexDirection="row">
          <Text bold>{title}</Text>
          {note ? <Text dimColor>{` · ${note}`}</Text> : null}
        </Box>
        {buttons.filter(b => b !== false && b !== undefined)}
      </Box>
    )
    // One part of the detail: its title, its count and its button over its body, unboxed.
    const part = (key: string, title: string, note: string, body: RenderNode | null, button?: RenderNode) => (
      <Box key={`part-${key}`} flexDirection="column" rowGap={1}>
        {boxHead(title, note, button)}
        {body}
      </Box>
    )
    const fold = (key: string, open: string, closed: string) => (
      <Button key={`fold-${key}`} label={folds.includes(key) ? open : closed} onPress={() => update($, detailOpen, ks => (ks.includes(key) ? ks.filter(k => k !== key) : [...ks, key]))} />
    )
    // What a box's round border and padding take from a drawing's width, as measured on the desktop.
    const BOX_INSET = 20
    const inner = W - BOX_INSET
    // A lane and its View button; the lane viewed is ringed and its button reads Viewing, and a
    // press there closes the view. (A Lucide eye as an image link took no presses in the pane.)
    const LANE_BUTTON = 78
    const view = (id: string) => update($, selectedAgent, cur => (cur === id ? null : id))
    const laneOf = (a: AgentRun, inset: number) => {
      const viewed = a.id === selected?.id
      const d = laneSvg(a, W - LANE_BUTTON - inset, at, skinName, windowOf(a), viewed, style)
      return fits(d) ? (
        <Box key={`lane-${a.id}`} flexDirection="row" alignItems="center" columnGap={1}>
          {image(`lane-svg-${a.id}`, d)}
          <Button key={`view-${a.id}`} label={viewed ? 'Viewing' : 'View'} variant={viewed ? 'primary' : 'secondary'} onPress={() => view(a.id)} />
        </Box>
      ) : undefined
    }
    const lanes = (key: string, of: readonly AgentRun[], inset: number) => {
      // Lanes are drawn alike, so after the first that does not fit the rest are only counted.
      const drawn: RenderNode[] = []
      for (const a of of) {
        const lane = laneOf(a, inset)
        if (!lane) break
        drawn.push(lane)
      }
      const left = of.length - drawn.length
      return (
        <Box key={`lanes-${key}`} flexDirection="column" rowGap={1}>
          {drawn}
          {left > 0 && <Text dimColor>{`+${left} more`}</Text>}
        </Box>
      )
    }

    const overview = crewSvg(runs, inner, at, skinName, windowOf)
    // Keyed by its crews: the desktop keeps a drawing's old image while its key stays the same.
    const top = fits(overview) ? image(`crew-${current.map(c => c.id).join('+')}`, overview) : undefined

    // The detail: its head, then its parts, each a title with its count over its body: what it
    // was asked (a line, unfolded on More), Summary, Plan, Tools, Calls, Files, then its Report
    // (Claude's answer for Main), folded. Haiku sums up agents only.
    const deep = inner - BOX_INSET
    const detail = (a: AgentRun) => {
      const w = windowOf(a)
      const head = agentHeadSvg(a, inner, at, skinName, w)
      const tools = toolsSvg(a, deep, skinName)
      const steps = stepsSvg(a, deep, skinName)
      const allCalls = folds.includes('calls')
      const calls = activitySvg(a, deep, skinName, allCalls ? CALLS_KEPT : 8)
      const files = filesSvg(a, deep, skinName)
      const summary = a.status === 'running' ? undefined : a.summary
      const p = progressOf(a)
      const kept = Object.values(a.files ?? {})
      const changed = kept.filter(f => f.edits > 0).length
      const n = a.callCount ?? 0
      const shownCalls = Math.min(allCalls ? CALLS_KEPT : 8, a.calls?.length ?? 0)
      const kinds = Object.keys(a.tools ?? {}).length
      const showHide = (key: string) => fold(key, '▾ Hide', '▸ Show')
      // The brief's first line, cut to about what a line of the pane holds.
      const firstLine = a.brief?.split('\n')[0] ?? ''
      const room = Math.floor(inner / 7)
      const briefLine = firstLine.length > room || firstLine !== a.brief ? `${Array.from(firstLine).slice(0, room).join('').trimEnd()}…` : firstLine
      return (
        <Box key={`detail-${a.id}`} flexDirection="column" rowGap={1}>
          {fits(head) && image(`detail-head-${a.id}`, head)}
          {a.brief && part('brief', 'Asked to', '', <Text dimColor wrap={folds.includes('brief') ? 'wrap' : 'truncate-end'}>{folds.includes('brief') ? a.brief : briefLine}</Text>, briefLine !== a.brief ? fold('brief', '▾ Less', '▸ More') : undefined)}
          {a.status !== 'running' &&
            part(
              'summary',
              'Summary',
              summary === undefined ? '' : 'by Haiku',
              <Box flexDirection="column">
                <Text dimColor>{factsLine(a, at)}</Text>
                {summary === 'pending' && <Text dimColor>Haiku กำลังสรุป…</Text>}
                {Array.isArray(summary) && <Markdown text={summary.map(l => `- ${l}`).join('\n')} />}
                {a.status === 'failed' && <Text>{resultText(a)}</Text>}
              </Box>,
            )}
          {steps && fits(steps) && part('plan', 'Progress', p ? `${Math.min(p.done, p.total)} of ${p.total} done` : '', image(`detail-steps-${a.id}`, steps))}
          {tools && fits(tools) && part('tools', 'Tools', `${kinds} ${kinds === 1 ? 'kind' : 'kinds'}`, image(`detail-tools-${a.id}`, tools))}
          {calls && fits(calls) && part('calls', 'Calls', shownCalls >= n ? String(n) : `latest ${shownCalls} of ${n}`, image(`detail-calls-${a.id}`, calls), n > 8 ? fold('calls', 'Latest calls', 'All calls') : undefined)}
          {files && fits(files) && part('files', 'Files', `${changed} changed · ${kept.length - changed} read`, image(`detail-files-${a.id}`, files))}
          {a.status !== 'running' &&
            part(
              'report',
              isMain(a) ? 'Answer' : 'Report',
              a.rounds?.length ? `round ${a.rounds.length + 1}` : '',
              folds.includes('report') ? (
                // Reports are markdown, so they are drawn as such; earlier rounds after.
                <Box flexDirection="column" rowGap={1}>
                  <Markdown text={resultText(a)} />
                  {(a.rounds ?? [])
                    .map((r, i) => <Markdown key={`round-${i}`} text={`**Round ${i + 1}**\n\n${r.summary ? r.summary.map(l => `- ${l}`).join('\n') : (r.result ?? 'No report.')}`} />)
                    .reverse()}
                </Box>
              ) : null,
              showHide('report'),
            )}
        </Box>
      )
    }
    const shown = selected ? detail(selected) : undefined
    // With none viewed: how to view one, and the agent that needs a look, if any.
    const empty = emptyDetailSvg(inner, skinName)
    const stuck = selected ? undefined : needsLook(runs, at, windowOf)
    // The earlier crews in a box of their own, folded to one line at first while a crew is at work.
    // Open, their lines are drawn before any lane, so each keeps its Show however many lanes fill
    // the pane.
    const isFolded = folded ?? runs.some(a => a.status === 'running')
    const rows = isFolded ? [] : earlier.map(c => ({ crew: c, row: earlierSvg(c.runs, W - LANE_BUTTON - BOX_INSET * 2, skinName) })).filter(r => fits(r.row))
    const laneList = lanes('now', runs, BOX_INSET)
    const past = earlier.flatMap(c => c.runs).filter(a => !isMain(a))
    const stopped = past.filter(a => a.reason === 'aborted').length
    const failed = past.filter(a => a.status === 'failed').length - stopped
    // Crews under their day's label, shown only when the earlier crews span more than one day.
    const dayFor = (c: (typeof earlier)[number]) => dayOf(c.startedAt, at)
    const manyDays = new Set(rows.map(r => dayFor(r.crew))).size > 1
    const tally = [`✓ ${past.filter(a => a.status === 'done').length}`, failed ? `✗ ${failed}` : '', stopped ? `✋ ${stopped}` : ''].filter(Boolean).join(' · ')
    // How the crew at work's agents stand, for its box's title, as the race counts them; Main's
    // lane tells its own.
    const crewAgents = runs.filter(a => !isMain(a))
    const standing = [
      ['running', crewAgents.filter(a => a.status === 'running').length],
      ['done', crewAgents.filter(a => a.status === 'done').length],
      ['failed', crewAgents.filter(a => a.status === 'failed' && a.reason !== 'aborted').length],
      ['stopped', crewAgents.filter(a => a.reason === 'aborted').length],
    ] as const

    return (
      <Box flexDirection="column" rowGap={1}>
        <Box key="now" borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" rowGap={1}>
          {boxHead('Now', [current.some(c => c.id.startsWith('wf:')) ? 'workflow run' : '', ...standing.filter(([, n]) => n > 0).map(([word, n]) => `${n} ${word}`)].filter(Boolean).join(' · '))}
          {top}
          {laneList}
        </Box>
        <Box key="detail" borderStyle="round" borderColor={selected ? look.clawd : 'subtle'} paddingX={1} flexDirection="column" rowGap={1}>
          {boxHead('Viewing', selected ? (isMain(selected) ? 'Main' : selected.description || selected.type) : '', selected && <Button key="close-detail" label="✕ Close" onPress={() => update($, selectedAgent, () => null)} />)}
          {shown ?? image('detail-empty', empty)}
          {stuck && (
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              <Box flexGrow={1}>
                <Text>{`⚠ ${stuck.description || stuck.type}: ${moodLabel(stuck, at, windowOf(stuck))}`}</Text>
              </Box>
              <Button key="view-needs-look" label="View it" onPress={() => update($, selectedAgent, () => stuck.id)} />
            </Box>
          )}
        </Box>
        {earlier.length > 0 && (
          <Box key="earlier" borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" rowGap={1}>
            {boxHead(
              'Earlier',
              `${earlier.length} ${earlier.length === 1 ? 'crew' : 'crews'} · ${tally}`,
              !isFolded && (
                <Button
                  key="clear-earlier"
                  label="Clear"
                  // The crews shown in full are the pane's, Main's and the agents' together.
                  onPress={() =>
                    void $.clock.after(0, async () => {
                      await update($, agents, l => clearEarlier(l, currentIds))
                      await update($, mains, l => clearEarlier(l, currentIds))
                      await update($, earlierOpen, () => [])
                      await update($, earlierFolded, () => null)
                      await update($, selectedAgent, id => (id && runs.some(a => a.id === id) ? id : null))
                    })
                  }
                />
              ),
              <Button key="fold-earlier" label={isFolded ? '▸ Show' : '▾ Hide'} onPress={() => update($, earlierFolded, () => !isFolded)} />,
            )}
            {rows.map(({ crew: c, row }, i) => {
              const open = shownEarlier.includes(c.id)
              const day = dayFor(c)
              return (
                <Box key={`crew-${c.id}`} flexDirection="column" rowGap={1}>
                  {manyDays && (i === 0 || dayFor(rows[i - 1]!.crew) !== day) && (
                    <Text dimColor bold>
                      {day}
                    </Text>
                  )}
                  <Box flexDirection="row" alignItems="center" columnGap={1}>
                    {image(`crew-svg-${c.id}`, row)}
                    <Button key={`show-${c.id}`} label={open ? '▾ Hide' : '▸ Show'} onPress={() => update($, earlierOpen, ids => (ids.includes(c.id) ? ids.filter(i => i !== c.id) : [...ids, c.id]))} />
                  </Box>
                  {open && lanes(c.id, c.runs, BOX_INSET * 2)}
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  })

  on('session.measure', async ($, e, next) => {
    if (!desktop) return next(e)
    const measured = await next(e)
    await update($, usage, () => toUsage(e))
    const p = await read($, prefs)
    if (p.limits) {
      const at = await read($, now)
      for (const l of e.rateLimits) {
        const label = l.kind === 'five_hour' ? '5H' : l.kind === 'seven_day' ? '7D' : undefined
        const key = `${l.kind}:${l.resetsAt ?? ''}`
        if (!label || l.percentUsed < p.alertAt || (await read($, warned)).includes(key)) continue
        await update($, warned, keys => [...keys, key].slice(-20))
        const left = l.resetsAt ? Date.parse(l.resetsAt) - at : NaN
        $.ui.toast(`${label} limit at ${Math.round(l.percentUsed)}%${Number.isFinite(left) && left > 0 ? ` — resets in ${countdown(left)}` : ''}`)
      }
    }
    return measured
  })

  // The guard, when turned on: refuse the few commands that are almost never meant.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const risk = await guarded($, 'Bash', e)
    return risk ? { deny: risk } : next(e)
  }).catch(($, e, next) => failClosed(next, () => next(e)))
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const risk = await guarded($, 'Read', e)
    return risk ? { deny: risk } : next(e)
  }).catch(($, e, next) => failClosed(next, () => next(e)))
  // The guard's Ask: the permission decision becomes an ask with the guard's reason, which opens
  // the dialog in default mode and goes to the classifier in auto mode. A query asks no one.
  // A deny decided beneath (a settings rule, a classic hook) stands: the guard only tightens.
  on('tool.check', { tool: ['Bash', 'Read'] }, async ($, e, next) => {
    if (!desktop) return next(e)
    const decided = await next(e)
    const risk = e.tool_use_id === undefined || decided.decision === 'deny' ? undefined : await riskFor($, e.tool, (e.input ?? {}) as { command?: unknown; file_path?: unknown }, 'ask')
    if (!risk) return decided
    await caught($)
    return { decision: 'ask' as const, reason: `sabai's guard: this ${risk.reason}` }
  // Nothing has run at a permission decision, so any failure, before or after the decision
  // beneath, denies.
  }).catch(() => ({ decision: 'deny' as const, reason: GUARD_FAILED }))
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    if (!desktop) return next(e)
    await stepping($, e.agentId, 'Read', e)
    await racing($, e.agentId, 'read')
    let called: { deny?: string; isError?: boolean } | undefined
    try {
      called = await next(e)
      return called as never
    } finally {
      await unstep($, e.agentId)
      await racing($, e.agentId, 'read', called ?? UNFINISHED)
    }
  })
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    if (!desktop) return next(e)
    await stepping($, e.agentId, 'Edit', e)
    await racing($, e.agentId, 'edit')
    let called: Awaited<ReturnType<typeof next>> | undefined
    try {
      called = await next(e)
    } finally {
      await unstep($, e.agentId)
      await racing($, e.agentId, 'edit', called ?? UNFINISHED)
    }
    if (!called.isError) await logCall($, e.agentId, called, { tool: 'Edit', path: e.file_path, oldText: e.old_string, newText: e.new_string, patch: (called.result as BuiltinToolResults['Edit'] | undefined)?.structuredPatch })
    return called
  })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    if (!desktop) return next(e)
    await stepping($, e.agentId, 'Write', e)
    await racing($, e.agentId, 'edit')
    let called: Awaited<ReturnType<typeof next>> | undefined
    try {
      called = await next(e)
    } finally {
      await unstep($, e.agentId)
      await racing($, e.agentId, 'edit', called ?? UNFINISHED)
    }
    const written = called.result as BuiltinToolResults['Write'] | undefined
    if (!called.isError) await logCall($, e.agentId, called, { tool: 'Write', path: e.file_path, content: e.content, ...(written?.type === 'update' && written.originalFile !== null ? { patch: written.structuredPatch } : {}) })
    return called
  })
  // Timed here, as the result carries no duration of its own; no .catch, so a failure here never
  // refuses a command.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const id = (e as { tool_use_id?: string }).tool_use_id
    const startedAt = await $.clock.now()
    if (id) inFlight.set(id, e.command)
    await stepping($, e.agentId, 'Bash', e)
    const kind: CallKind = isTestCommand(e.command) ? 'test' : 'command'
    await racing($, e.agentId, kind)
    let raceDone = false
    try {
      const called = await next(e)
      if (id && !asked.has(id)) {
        const ms = (await $.clock.now()) - startedAt
        await update($, memberOf(durations, { requestId: id }), () => ms)
      }
      // A command run in the background, asked for or moved there, runs on past its call.
      const task = (called.result as BuiltinToolResults['Bash'] | undefined)?.backgroundTaskId
      if (task && e.agentId === undefined) await update($, background, ids => [...ids, task])
      const r = called.result as { stdout?: string; stderr?: string } | string | undefined
      const output = typeof r === 'string' ? r : `${r?.stdout ?? ''}\n${r?.stderr ?? ''}`
      const at = await $.clock.now()
      await logCall($, e.agentId, called, { tool: 'Bash', command: e.command, output, isError: Boolean(called.isError), at, readOnly: isReadOnly(e.command) })
      // A test run scores only when no test failed.
      await racing($, e.agentId, kind, called, !called.isError && (kind !== 'test' || (testResult(output)?.failed ?? 0) === 0))
      raceDone = true
      // This call just set the turn's test result: redraw now, and again when the celebration ends.
      if (e.agentId === undefined && (await read($, turnLog)).test?.at === at) {
        await update($, now, () => at)
        $.clock.after(CELEBRATE_MS + 100, () => void tick($))
      }
      return called
    } finally {
      if (id) {
        inFlight.delete(id)
        asked.delete(id)
      }
      await unstep($, e.agentId)
      if (!raceDone) await racing($, e.agentId, kind, UNFINISHED)
    }
  })

  // A monitor runs on in the background until it ends or is stopped.
  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const called = await next(e)
    const task = (called.result as BuiltinToolResults['Monitor'] | undefined)?.taskId
    if (desktop && task && e.agentId === undefined) await update($, background, ids => [...ids, task])
    return called
  })
  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const called = await next(e)
    const task = (called.result as BuiltinToolResults['TaskStop'] | undefined)?.task_id
    if (desktop && task) await update($, background, ids => ids.filter(id => id !== task))
    return called
  })
  // A background task's notification says it ended.
  on('prompt.submit', async ($, e, next) => {
    if (desktop && e.origin.kind === 'task-notification') {
      const ended = endedTasks(e.text)
      if (ended.length > 0) await update($, background, ids => ids.filter(id => !ended.includes(id)))
    }
    return next(e)
  })

  // A subagent reporting its own steps through the mod's tool.
  // (Matched by hand: the mod's own tool is not in the engine's typed list of tool names.)
  on('tool.call', async ($, e, next) => {
    if ((e.tool as string) === STEP_TOOL) {
      const { agentId } = e
      if (!agentId) return { result: 'ignored: only subagents report steps' } as never
      await update($, agents, list => reported(list, agentId, e as unknown as { done?: unknown; total?: unknown; note?: unknown }))
      return { result: 'ok' } as never
    }
    if (!desktop) return next(e)
    if (e.agentId !== undefined) return logAgentCall($, false, e.agentId, e.tool, e, () => next(e))
    return logAgentCall($, true, mainKey(await read($, turnStartedAt)), e.tool, e, () => next(e))
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const called = await next(e)
    const id = (called.result as BuiltinToolResults['TaskCreate'] | undefined)?.task.id
    if (id !== undefined) await updateTasks($, e.agentId, list => created(list, id, e.subject, e.activeForm))
    return called
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const called = await next(e)
    if ((called.result as BuiltinToolResults['TaskUpdate'] | undefined)?.success) await updateTasks($, e.agentId, list => updated(list, e))
    return called
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    if (!desktop) return next(e)
    const called = await next(e)
    if (!called.isError && !called.deny) await updateTasks($, e.agentId, () => fromTodos(e.todos))
    return called
  })

  on('command.run', { command: 'sabai-settings' }, async $ => ({
    text: (await togglePane($, SKIN_PANE, 'Settings', true)) ? 'Settings panel opened.' : 'Settings panel closed.',
  }))

  // The settings, most seen first: the look, the usage, the info row, Clawd, agents, the chat, the
  // guard, notifications. A part of the band with choices of its own is a group with its On/Off in
  // the group's head; each choice is a name and a note on the left with its control on the right,
  // and a choice that changes a drawing shows it.
  on('ui.render', { component: 'Pane', requestId: SKIN_PANE }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const current = await read($, skin)
    const style = await read($, bar)
    const p = await read($, prefs)
    const armed = await read($, resetArmed)
    const known = await read($, env)
    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const W = widthOf(e.props.bodyColumns, 240, 40)
    // One group: a bordered card with its mark, title and what it is about, its On/Off at the right
    // when the part can be hidden, then its rows (left out while the part is off, unless they reach
    // past it).
    const group = (key: string, mark: string, title: string, note: string, rows: RenderNode, power?: { key: string; on: boolean; flip: (p: Prefs) => Prefs }, keep = false) => (
      <Box key={`group-${key}`} borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" rowGap={1}>
        <Box flexDirection="row" alignItems="center" columnGap={2}>
          <Box flexGrow={1}>
            <Text wrap="truncate-end">
              <Text bold>{`${mark}  ${title}`}</Text>
              <Text dimColor>{`  ${note}`}</Text>
            </Text>
          </Box>
          {power ? <Button key={`pref-${power.key}`} label={power.on ? '● On' : '○ Off'} onPress={() => setPrefs($, power.flip)} /> : null}
        </Box>
        {!power || power.on || keep ? rows : null}
      </Box>
    )
    const subheading = (title: string, note: string) => (
      <Text>
        <Text bold dimColor>
          {title}
        </Text>
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
    // Several on/off choices on one row; the desktop draws a Button from its label alone, so the
    // dot carries the state there.
    const pills = (items: { key: string; label: string; on: boolean; flip: (p: Prefs) => Prefs }[]) => (
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        {items.map(i => (
          <Button key={`pref-${i.key}`} label={`${i.on ? '●' : '○'} ${i.label}`} variant={i.on ? 'primary' : 'secondary'} onPress={() => setPrefs($, i.flip)} />
        ))}
      </Box>
    )
    const rowPill = (key: keyof Prefs['rows'], label: string) => ({ key, label, on: p.rows[key], flip: (x: Prefs) => ({ ...x, rows: { ...x.rows, [key]: !x.rows[key] } }) })
    const showPill = (key: keyof Prefs['show'], label: string) => ({ key: `show-${key}`, label, on: p.show[key], flip: (x: Prefs) => ({ ...x, show: { ...x.show, [key]: !x.show[key] } }) })
    const extraPill = (key: keyof Prefs['extras'], label: string) => ({ key: `extras-${key}`, label, on: p.extras[key], flip: (x: Prefs) => ({ ...x, extras: { ...x.extras, [key]: !x.extras[key] } }) })
    // One of a few values, the current one standing out.
    const choice = <T extends string>(prefix: string, values: readonly T[], label: (v: T) => string, current: T, pick: (v: T) => void) => (
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        {values.map(v => (
          <Button key={`${prefix}-${v}`} label={label(v)} variant={v === current ? 'primary' : 'secondary'} onPress={() => pick(v)} />
        ))}
      </Box>
    )
    const flag = (key: 'notify' | 'limits' | 'steps' | 'agentSummary', name: string, note: string) => toggle(key, name, note, p[key], x => ({ ...x, [key]: !x[key] }))
    const rowPower = (key: keyof Prefs['rows']) => ({ key, on: p.rows[key], flip: (x: Prefs) => ({ ...x, rows: { ...x.rows, [key]: !x.rows[key] } }) })
    const thresholdRow = (key: 'warn' | 'alert', name: string, values: number[], current: number) => (
      <Box key={`row-${key}`} flexDirection="row" alignItems="center" columnGap={2}>
        {named(name, '')}
        <Box flexDirection="row" columnGap={1}>
          {values.map(v => (
            <Button key={`${key}-${v}`} label={`${v}%`} variant={v === current ? 'primary' : 'secondary'} onPress={() => setPrefs($, x => ({ ...x, [key === 'warn' ? 'warnAt' : 'alertAt']: v }))} />
          ))}
        </Box>
      </Box>
    )
    const chatToggle = (key: keyof Prefs['chat'], name: string, note: string) =>
      toggle(`chat-${key}`, name, note, p.chat[key], x => ({ ...x, chat: { ...x.chat, [key]: !x.chat[key] } }))
    const preview = barPreview(style, current, W)
    // A row of drawn choices, each its sketch over a Button with its name. The sketch is not the
    // control: on the desktop a press on a large image link often lands as a drag of the image.
    const picks = <T extends string>(prefix: string, values: readonly T[], name: (v: T) => string, current: T, draw: (v: T) => Drawing, pick: (v: T) => Promise<void>) => (
      <Box flexDirection="row" columnGap={1} rowGap={1} flexWrap="wrap">
        {values.map(v => {
          const d = draw(v)
          return (
            <Box key={`pick-${prefix}-${v}`} flexDirection="column" rowGap={1} alignItems="flex-start">
              <Svg key={`${prefix}-${v}-sketch`} source={d.source} alt={d.alt} width={d.width} height={d.height} />
              <Button key={`${prefix}-${v}`} label={name(v)} variant={v === current ? 'primary' : 'secondary'} onPress={() => pick(v)} />
            </Box>
          )
        })}
      </Box>
    )
    // One part of a group: its heading, then what it holds, a row apart.
    const part = (key: string, title: string, note: string, ...rows: RenderNode[]) => (
      <Box key={`part-${key}`} flexDirection="column" rowGap={1}>
        {subheading(title, note)}
        {rows}
      </Box>
    )
    const skinInUse = (SKINS as readonly string[]).includes(current) ? (current as Skin) : 'raised'
    // The info row as it reads.
    const infoNow = infoSvg({ ...chips(known, p.show), pending: !known.read }, W, { skin: current })
    // A sample of each chat touch that is on.
    const chatSamples = [
      ...(p.chat.tools ? [stepSvg(SAMPLE_EDIT), ...(p.chat.tests ? [stepSvg(SAMPLE_TEST)] : [])] : []),
      ...(p.chat.receipt ? [receiptSvg(SAMPLE_RECEIPT)] : []),
    ]
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text dimColor>Changes apply at once and stay for new sessions. Esc closes.</Text>
        {group(
          'look',
          '◐',
          'Look',
          'How the band is laid out and drawn',
          <Box flexDirection="column" rowGap={2}>
            {part('layout', 'Layout', 'Side by side, or stacked and shorter', picks('density', ['comfortable', 'compact'] as const, d => (d === 'comfortable' ? 'Comfortable' : 'Compact'), p.density, d => densityPreview(d, current, PICK_W, d === p.density), d => setPrefs($, x => ({ ...x, density: d }))))}
            {part('cards', 'Cards', 'Raised or flat; both follow light and dark', picks('skin', SKINS, k => SKIN_NAMES[k]!, skinInUse, k => skinPreview(k, PICK_W, k === skinInUse), k => setSkin($, k)))}
            {part(
              'bars',
              'Bars',
              'Tasks and usage (Rings draw their own)',
              <Svg key="bar-sample" source={preview.source} alt={preview.alt} width={preview.width} height={preview.height} />,
              choice('bar', Object.keys(BAR_STYLES) as BarStyle[], b => BAR_STYLES[b], style, b => void setBar($, b)),
            )}
            {part(
              'rows',
              'Also show',
              'Tap to show or hide',
              pills([rowPill('tasks', 'Tasks'), rowPill('live', 'Activity'), rowPill('toolbar', 'Toolbar')]),
              <Text key="rows-note" dimColor>Activity is the race on a wide window, else a one-line strip of what Claude is doing. With the toolbar hidden, /sabai-settings brings you back here.</Text>,
            )}
          </Box>,
        )}
        {group(
          'usage',
          '◔',
          'Usage',
          'Context, 5H and 7D',
          <Box flexDirection="column" rowGap={2}>
            {part('style', 'Style', '', picks('usage', Object.keys(USAGE_STYLES) as UsageStyle[], u => USAGE_STYLES[u], p.usageStyle, u => usageSketch(u, current, USAGE_PICK_W, u === p.usageStyle), u => setPrefs($, x => ({ ...x, usageStyle: u }))))}
            {part('limits', 'Limits', 'Which ones show', pills([showPill('context', 'Context'), showPill('session', '5H'), showPill('week', '7D')]), thresholdRow('warn', 'Amber at', [60, 70, 80], p.warnAt), thresholdRow('alert', 'Red at', [85, 90, 95], p.alertAt))}
          </Box>,
          rowPower('usage'),
        )}
        {group(
          'info',
          '▣',
          'Info row',
          'Above the band',
          <Box flexDirection="column" rowGap={1}>
            {pills([showPill('folder', 'Folder'), showPill('branch', 'Branch'), showPill('gitUser', 'Git user'), showPill('node', 'Node')])}
            {infoNow ? <Svg source={infoNow.source} alt={infoNow.alt} width={infoNow.width} height={infoNow.height} /> : null}
          </Box>,
          rowPower('info'),
        )}
        {group(
          'clawd',
          '☻',
          'Clawd',
          'His mood, beside the usage',
          <>
            {pills([extraPill('accessories', 'Hats and props'), extraPill('tricks', 'Tricks')])}
            <Text dimColor>Coffee in the morning, a hat on holidays; waves, yawns and looks.</Text>
          </>,
          { key: 'show-clawd', on: p.show.clawd, flip: x => ({ ...x, show: { ...x.show, clawd: !x.show.clawd } }) },
        )}
        {group(
          'agents',
          '✻',
          'Subagents',
          'Race lanes, or a row of small Clawds',
          <Box flexDirection="column" rowGap={1}>
            {flag('steps', 'Step reports', 'Subagents report their progress to their lane and the Subagents pane; from the next session')}
            {flag('agentSummary', 'Thai summary', 'Haiku sums up each finished subagent’s report in Thai, in the Subagents pane')}
          </Box>,
          rowPower('crew'),
          true,
        )}
        {group(
          'chat',
          '❯',
          'Conversation',
          'How Claude’s work shows in the chat',
          <Box flexDirection="column" rowGap={1}>
            {chatSamples.map((d, i) => (
              <Svg key={`chat-sample-${i}`} source={d.source} alt={d.alt} width={d.width} height={d.height} />
            ))}
            {chatToggle('tools', 'Tool summaries', 'Each call as one line; off, the native rows that expand to output')}
            {chatToggle('tests', 'Test results', 'Pass and fail counts on test runs (with Tool summaries)')}
            {chatToggle('callouts', 'Callouts', 'Notes and warnings as coloured boxes; Claude is told it may use them')}
            {chatToggle('receipt', 'Turn receipt', 'A line under each working turn: files, tests, commands')}
            {chatToggle('spinner', 'Spinner words', 'Thai words while Claude works')}
          </Box>,
        )}
        {group(
          'guard',
          '◈',
          'Guard',
          'Stops risky commands before they run',
          <Box flexDirection="column" rowGap={1}>
            <Text dimColor>A shield in the info row counts what it caught. In auto mode, Ask goes to the classifier.</Text>
            {(Object.keys(GUARD_RULES) as GuardRule[]).map(rule => (
              <Box key={`row-guard-${rule}`} flexDirection="row" alignItems="center" columnGap={2}>
                {named(GUARD_RULES[rule].name, GUARD_RULES[rule].note)}
                <Box flexDirection="row" columnGap={1}>
                  {(['block', 'ask', 'off'] as GuardAction[]).map(action => (
                    <Button
                      key={`guard-${rule}-${action}`}
                      label={action === 'block' ? 'Block' : action === 'ask' ? 'Ask' : 'Off'}
                      variant={p.guardRules[rule] === action ? 'primary' : 'secondary'}
                      onPress={() => setPrefs($, x => ({ ...x, guardRules: { ...x.guardRules, [rule]: action } }))}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>,
          { key: 'guard', on: p.guard, flip: x => ({ ...x, guard: !x.guard }) },
        )}
        {group(
          'alerts',
          '◉',
          'Notifications',
          'Outside the band',
          <>
            {flag('notify', 'Turn ended', 'A turn of a minute or more ends, or a subagent fails')}
            {flag('limits', 'Limit warnings', 'Once per window, when 5H or 7D passes red')}
          </>,
        )}
        <Box flexDirection="row" alignItems="center" columnGap={2}>
          {named('Reset', 'Every setting, the look and the bars; the guard off')}
          {/* It undoes every choice and turns the guard off, so the first press only asks for a second. */}
          <Button
            key="reset-defaults"
            label={armed ? 'Press again to reset' : 'Reset to defaults'}
            variant={armed ? 'primary' : 'secondary'}
            onPress={() =>
              void $.clock.after(0, async () => {
                if (!(await read($, resetArmed))) {
                  await update($, resetArmed, () => true)
                  await $.clock.after(RESET_ARM_MS, () => void update($, resetArmed, () => false))
                  return
                }
                await update($, resetArmed, () => false)
                await resetAll($)
              })
            }
          />
        </Box>
      </Box>
    )
  })

  // A tool call drawn as a step in place of its row: what it was about, what it did, how it ended.
  // One fixed-size drawing per step.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const { chat } = await read($, prefs)
    const p = e.props
    if (!chat.tools) return next(e)
    const measured = p.tool === 'Bash' ? await read($, memberOf(durations, e)) : -1
    const step = stepOf({ ...p, ...(measured >= 0 ? { durationMs: measured } : {}), tests: chat.tests })
    if (!step) return next(e)
    const { Svg } = $.ui.resolve(e)
    const d = stepSvg(step)
    return <Svg source={d.source} alt={d.alt} width={d.width} height={d.height} />
  })

  // The permission dialog opened for a Bash call: mark the calls in flight that it is for.
  on('classic.PermissionRequest', async ($, e, next) => {
    if (!desktop) return next(e)
    const input = e.tool_input as { command?: unknown } | undefined
    if (e.tool_name === 'Bash') for (const [id, command] of inFlight) if (command === input?.command) asked.add(id)
    return next(e)
  })

  // With Tool summaries on, a folded run of calls drawn as one-line steps unfolds into them; a run
  // with searches or listings stays folded, as those would unfold into their full results.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) =>
    e.surface === 'desktop' && (await read($, prefs)).chat.tools && e.props.calls.length > 0 && e.props.calls.every(c => STEP_TOOLS.has(c.tool))
      ? next({ ...e, props: { ...e.props, isExpanded: true } })
      : next(e),
  )

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const p = await read($, prefs)
    const { Box, Markdown, Svg } = $.ui.resolve(e)
    // The turn's receipt, when this reply holds a working turn's final answer.
    const log = p.chat.receipt && !e.props.isSummary ? (await read($, receipts))[receiptKey(e.props.text.trim())] : undefined
    const receipt = log && receiptOf(log)
    const parts = e.props.isSummary || e.props.text.length > REPLY_REDRAW_MAX || !p.chat.callouts ? [] : splitCallouts(e.props.text)
    const body = !parts.some(s => s.kind === 'callout') ? (
      await next(e)
    ) : (
      <Box flexDirection="column" rowGap={1}>
        {parts.map((s, i) => {
          if (s.kind === 'md') return s.text.trim() ? <Markdown key={`md${i}`} text={s.text} /> : null
          const title = calloutTitleSvg(s.type)
          return (
            <Box key={`co${i}`} borderStyle="round" borderColor={CALLOUT_KINDS[s.type].key} paddingX={1} flexDirection="column">
              <Svg source={title.source} alt={title.alt} width={title.width} height={title.height} />
              <Markdown text={s.body} />
            </Box>
          )
        })}
      </Box>
    )
    if (!receipt) return body
    const card = receiptSvg(receipt)
    return (
      <Box flexDirection="column" rowGap={1}>
        {body}
        <Svg source={card.source} alt={card.alt} width={card.width} height={card.height} />
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    if (!desktop) return next(e)
    // Only the main conversation's turns start here: a subagent's run has no turn.start.
    await update($, turnLog, () => EMPTY_LOG)
    const began = await $.clock.now()
    const shown = (await read($, agents)).filter(a => a.status === 'running' || began - (a.endedAt ?? 0) < RACE_LINGER_MS)
    await update($, race, r => nextTurnRace(r, new Set(shown.map(a => a.agentId ?? a.id))))
    await update($, turnStartedAt, () => began)
    // The turn's own run for the pane; earlier turns stay only where their crew had agents.
    const withAgents = new Set((await read($, agents)).map(crewOf))
    const main: AgentRun = { id: mainKey(began), type: MAIN_TYPE, description: 'Main', model: await read($, mainModel), status: 'running', startedAt: began, contextTokens: 0, steps: 0, crew: `turn:${began}`, lastActiveAt: began }
    // A turn starting means the one before has ended, whether or not its end was seen.
    const ended = (m: AgentRun): AgentRun => (m.status === 'running' ? { ...m, status: 'done', reason: 'answer', endedAt: began } : m)
    await update($, mains, l => [...l.filter(m => withAgents.has(crewOf(m))).slice(1 - CREWS_KEPT).map(ended), main])
    return next(e)
  })

  // Thai words in the spinner, in place of the desktop's generic word; one that names the step stays.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || !isGenericWord(e.props.word) || !(await read($, prefs)).chat.spinner) return next(e)
    // The spinner's word is picked once per turn, from its start, so redraws and reloads keep it.
    return next({ ...e, props: { ...e.props, word: spinnerWord(e.props.mode, seedOf(String(await read($, turnStartedAt)))) } })
  })

  on('prompt.compose', async ($, e, next) => {
    if (!desktop) return next(e)
    const composed = await next(e)
    if (!(await read($, prefs)).chat.callouts) return composed
    return { sections: [...composed.sections, { id: 'sabai:callouts', text: CALLOUT_HINT, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    // Should the desktop draw before it is seen to attach, its first draw sets the mod up; the work
    // runs from a timer, not inside the draw.
    if (!desktop) {
      desktop = true
      $.clock.after(0, () => void setUp($))
    }

    const shownPrefs = await read($, prefs)
    const { rows } = shownPrefs
    const p = rows.tasks ? progress(await read($, tasks)) : undefined
    const measured = await read($, usage)
    // Drawn before session.start's first tick, the clock still reads 0 (1 January 1970).
    const at = (await read($, now)) || (await $.clock.now())
    const list = rows.usage ? meters(measured, at, { show: shownPrefs.show, warnAt: shownPrefs.warnAt, alertAt: shownPrefs.alertAt }) : []
    const known = await read($, env)
    const info = rows.info ? { ...chips(known, shownPrefs.show), pending: !known.read } : { left: [], right: [], pending: false }
    const note = rows.usage ? usageNote(measured, list, shownPrefs.show) : undefined
    const caughtCount = await read($, guardCaught)
    const everyone = await read($, agents)
    const all = rows.crew ? everyone : []
    // The crew shows while agents work and for a minute after the last ends; the pane keeps the rest.
    const lastEnd = Math.max(0, ...all.map(a => a.endedAt ?? 0))
    const runs = all.some(a => a.status === 'running') || at - lastEnd < CREW_LINGER_MS ? all : []
    // The live strip: the main turn's time, the step in flight and how long it has run, its calls,
    // the lines its edits changed and its tests, while it works.
    const turn = await read($, turnLog)
    // The contract types the icon as a string; the hooks only ever write a StepIcon.
    const stepped = (await read($, liveStep)) as { icon: StepIcon; title: string; at?: number } | null
    const step = stepped ? { icon: stepped.icon, title: stepped.title } : null
    const began = await read($, turnStartedAt)
    const raceLog = await read($, race)
    const edits = Object.values(turn.files)
    const live = rows.live && e.props.isWorking
      ? {
          ...(began !== 0 ? { elapsedMs: Math.max(0, at - began) } : {}),
          ...(step ? { step } : {}),
          ...(stepped?.at !== undefined ? { stepMs: Math.max(0, at - stepped.at) } : {}),
          trail: raceLog.calls.main ?? [],
          calls: countOf(raceLog, 'main'),
          lines: { added: edits.reduce((n, f) => n + f.added, 0), removed: edits.reduce((n, f) => n + f.removed, 0) },
          files: edits.length,
          commands: turn.commands,
          ...(turn.test ? { test: turn.test } : {}),
        }
      : undefined
    // The race: Main and the agents at work, while any work runs.
    // It is the Subagents switch's: Activity is the line of what Main is doing.
    const raceNow = rows.crew ? raceOf(raceLog, everyone, p, at, e.props.isWorking, began, step?.title) : undefined
    // The toolbar and the guard's shield keep the band even with nothing else to show.
    if (!p && !live && !raceNow && !info.pending && info.left.length + info.right.length === 0 && list.length === 0 && !note && runs.length === 0 && !rows.toolbar && !shownPrefs.guard) return next(e)
    const last = await read($, lastTurnAt)
    const mood = moodOf({ log: turn, contextPercent: measured?.contextPercent, now: at, isWorking: e.props.isWorking, lastTurnAt: last })
    const W = widthOf(e.props.bodyColumns, 200, 100)
    // The race shows beside Clawd only in the comfortable band from 760 px (heroBand's rule).
    const raceShown = Boolean(raceNow) && shownPrefs.density !== 'compact' && W >= RACE_MIN_W
    // While the turn works its time stands under Clawd's word, unless the race beside him shows it.
    const clawdLine = mood === 'working' && began !== 0 && !raceShown ? clock(Math.max(0, at - began)) : moodLine(mood, {
      caught: caughtCount,
      passed: turn.test?.passed,
      failed: turn.test?.failed,
      contextPercent: measured?.contextPercent,
      idleMs: last > 0 ? at - last : undefined,
    })
    const running = (await read($, background)).length
    const trick = shownPrefs.extras.tricks ? trickOf({ mood, now: at, lastTurnAt: last, isWorking: e.props.isWorking, raceShown, limitHigh: list.some(m => m.level) }) : undefined

    const skinName = await read($, skin)
    const style = await read($, bar)
    // The toolbar's count holds whether or not the crew row shows.
    const working = everyone.filter(a => a.status === 'running').length
    const ctx = measured?.contextPercent
    const lvl = ctx === undefined ? undefined : level(ctx, shownPrefs.warnAt, shownPrefs.alertAt)
    const { Box, Markdown, Svg } = $.ui.resolve(e)
    // Another mod's drawing in the band keeps its place under ours.
    const theirs = await next(e)
    const accessory = shownPrefs.extras.accessories ? accessoryOf(new Date(at)) : undefined
    // The toolbar as icons at the right of the top row. A Button draws its text label alone and
    // holds no Svg, so each icon is an image link in a Markdown whose press runs it. Each says
    // when it is worth a press: compact the context once it reaches the amber mark (in colour
    // while no agents run, one call to press at a time), agents how many are working. The guard,
    // while on, leads them: a green shield with what it caught, that opens the settings. On a
    // narrow band the counts go, so the row still fits.
    const roomy = W >= HERO_MIN_W
    const openSettings = () => void togglePane($, SKIN_PANE, 'Settings', true)
    const tools: { kind: ToolIcon; label: string; count: string | undefined; tone: 'm' | 'warn' | 'alert' | 'tasks' | 'ok'; press: () => void }[] = []
    if (shownPrefs.guard)
      tools.push({ kind: 'guard', label: caughtCount ? `Guard on, ${caughtCount} caught. Opens settings` : 'Guard on. Opens settings', count: caughtCount && roomy ? String(caughtCount) : undefined, tone: 'ok', press: openSettings })
    if (rows.toolbar) {
      // A press's own work ends with the press, so the command is queued from a timer.
      if (canCompact)
        tools.push({ kind: 'compact', label: lvl ? `Compact, context at ${Math.round(ctx!)}%` : 'Compact', count: lvl && roomy ? `${Math.round(ctx!)}%` : undefined, tone: lvl && working === 0 ? lvl : 'm', press: () => void $.clock.after(0, () => void $.command.run({ command: 'compact' })) })
      tools.push(
        { kind: 'agents', label: working > 0 ? `Subagents, ${working} running` : 'Subagents', count: working > 0 && roomy ? String(working) : undefined, tone: working > 0 ? 'tasks' : 'm', press: () => void toggleAgents($) },
        { kind: 'settings', label: 'Settings', count: undefined, tone: 'm', press: openSettings },
      )
    }
    const icons = tools.map(t => ({ ...t, drawn: toolIconSvg(t.kind, t.count, t.tone, skinName) }))
    // Room the icons take with the chip the desktop draws round each image, so the info row's
    // card runs up to the first: the row reads as one strip of the band's card.
    const iconsW = icons.reduce((n, t) => n + t.drawn.width + TOOL_CHIP, 0)
    // The info row leads the top row; in the stacked band Clawd stands in it when no tasks
    // row or live strip holds him, as he did in the band's own info row.
    const stacked = shownPrefs.density === 'compact' || W < HERO_MIN_W
    const clawdTop = stacked && !p && !live && rows.info && shownPrefs.show.clawd
    const top = infoSvg(info, Math.max(96, W - iconsW), { skin: skinName, ...(clawdTop ? { clawd: { mood, ...(accessory ? { accessory } : {}), ...(trick ? { trick } : {}) } } : {}) })
    // bodyColumns counts the code font's advance across the band, the collapse mark already
    // left out. Drawn a little wider than that estimate and given no width, the drawing
    // fills the slot: the surface scales a wider markup down to it, never a narrower one up.
    const band = bandSvg(p, list, W, { mood: mood, skin: skinName, style: style, crew: { runs, now: at }, clawd: shownPrefs.show.clawd, density: shownPrefs.density, hero: shownPrefs.density !== 'compact', ...(live ? { live } : {}), ...(raceNow ? { race: raceNow } : {}), ...(clawdLine ? { clawdLine } : {}), ...(running ? { running } : {}), ...(trick ? { trick } : {}), usageStyle: shownPrefs.usageStyle, ...(note ? { usageNote: note } : {}), now: at, ...(accessory ? { accessory } : {}) })
    return (
      <Box flexDirection="column">
        {(top || icons.length > 0) && (
          <Box flexDirection="row" alignItems="center" columnGap={0} marginBottom={1}>
            {top && <Svg source={top.source} alt={top.alt} />}
            <Box flexGrow={1} />
            {icons.map(t => (
              <Markdown key={`tool-${t.kind}`} text={`[![${t.label}](data:image/svg+xml;base64,${btoa(t.drawn.source)})](${TOOL_HREF}${t.kind})`} onLinkPress={t.press} />
            ))}
          </Box>
        )}
        {band && <Svg source={band.source} alt={band.alt} />}
        {theirs}
      </Box>
    )
  })
}
