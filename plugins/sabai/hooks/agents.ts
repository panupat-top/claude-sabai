import type { ActKind, AgentCall, AgentFile, AgentRound, AgentRun, CallKind, RaceLog, Task } from '../types'
import type { Progress } from './model'
import { RACE_LANES, RACE_LINGER_MS, RACE_TILES, SCORE_MS, TRIP_MS, countOf, doingOf, failsOf, tokens } from './model'
import type { HatKind } from './sprites'

// The pane keeps the newest runs; older ones fall off.
const KEEP = 40

// `claude-opus-5-5` → `opus 5.5`, `claude-sonnet-4-5-20250929` → `sonnet 4.5`; anything else as is.
export function modelName(id: string): string {
  const m = id.replace(/^claude-/, '').replace(/-\d{8}$/, '').match(/^([a-z]+)-(\d+)(?:-(\d+))?$/)
  return m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : id
}

// A run's key in the reducers: a subagent's id from the engine, or a main turn's own id.
export const runKey = (a: AgentRun): string => a.agentId ?? a.id
// The main loop's turn, drawn in the pane as a member of its crew; it is never a subagent.
export const MAIN_TYPE = 'main'
export const isMain = (a: AgentRun): boolean => a.type === MAIN_TYPE

// A run's crew: the main turn (or workflow run) that started it; runs from before crews are one.
export const crewOf = (a: AgentRun): string => a.crew ?? 'before'
// The pane keeps the newest crews, and any crew with an agent still at work.
export const CREWS_KEPT = 5

// The crews' keys, newest first: a crew is as new as its latest member in the list, which keeps
// runs in the order they started (a run sent more work moves to the end).
export function crewOrder(list: readonly AgentRun[]): string[] {
  const seen = new Set<string>()
  for (let i = list.length - 1; i >= 0; i--) seen.add(crewOf(list[i]!))
  return [...seen]
}

const kept = (list: AgentRun[]): AgentRun[] => {
  const keep = new Set(crewOrder(list).slice(0, CREWS_KEPT))
  return list.filter(a => keep.has(crewOf(a)) || a.status === 'running').slice(-KEEP)
}

export const spawned = (list: AgentRun[], run: AgentRun): AgentRun[] => kept([...list.filter(a => a.id !== run.id), run])

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One model request of a subagent: its context is everything that request read and wrote, and
// its tokens add to what the run spent. A finished agent sent more work runs again in the crew at
// work now (`crew`), its report kept as an earlier round.
export function stepped(list: AgentRun[], agentId: string, model: string, u: Usage, effort?: string | number, at?: number, crew?: string): AgentRun[] {
  const run = list.find(a => runKey(a) === agentId)
  if (!run) return list
  const total = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  // What it spent is what was new: a cache read is the same context read again.
  const again = run.status !== 'running'
  const next: AgentRun = {
    ...run,
    model: model || run.model,
    steps: run.steps + 1,
    contextTokens: total,
    spent: (run.spent ?? 0) + total - u.cache_read_input_tokens,
    effort: effort === undefined ? run.effort : String(effort),
    ...(at === undefined ? {} : { lastActiveAt: at }),
  }
  if (!again) return list.map(a => (a === run ? next : a))
  const round: AgentRound = { ...(run.result ? { result: run.result } : {}), ...(run.reason ? { reason: run.reason } : {}), ...(Array.isArray(run.summary) ? { summary: run.summary } : {}) }
  const { endedAt: _e, reason: _r, result: _s, summary: _m, ...rest } = next
  const resumed: AgentRun = { ...rest, status: 'running', rounds: [...(run.rounds ?? []), round].slice(-ROUNDS_KEPT), ...(crew ? { crew } : {}) }
  return [...list.filter(a => a !== run), resumed]
}
// The earlier rounds a run sent more work keeps.
export const ROUNDS_KEPT = 3

export const RESULT_MAX = 1500
// The first `n` characters, cut between code points: half an emoji would leave a lone surrogate,
// which makes a drawing that carries it invalid.
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('')

export const finished = (list: AgentRun[], agentId: string, reason: NonNullable<AgentRun['reason']>, at: number, answer?: string): AgentRun[] =>
  list.map(a =>
    runKey(a) !== agentId
      ? a
      : {
          ...a,
          status: reason === 'answer' ? 'done' : 'failed',
          reason,
          endedAt: at,
          result: answer && Array.from(answer).length > RESULT_MAX ? `${cut(answer, RESULT_MAX - 1)}…` : answer || undefined,
        },
  )

export const withTasks = (list: AgentRun[], agentId: string, fn: (tasks: Task[]) => Task[]): AgentRun[] =>
  list.map(a => (a.agentId !== agentId ? a : { ...a, tasks: fn(a.tasks ?? []) }))

// An agent's own progress, the finished case included (unlike the band's row, which leaves).
export function taskLine(tasks: Task[] | undefined): Progress | undefined {
  if (!tasks?.length) return undefined
  const done = tasks.filter(t => t.status === 'completed').length
  const running = tasks.find(t => t.status === 'in_progress')
  const next = tasks.find(t => t.status === 'pending')
  return { done, total: tasks.length, title: running ? (running.activeForm ?? running.subject) : (next?.subject ?? 'Done') }
}

// Claude's effort levels as the engine names them; a number is a thinking budget in tokens.
// An agent's progress: what it reported through the mod's step tool, else its own task list.
export function progressOf(a: Pick<AgentRun, 'progress' | 'tasks'>): Progress | undefined {
  const p = a.progress
  if (p && p.total > 0) return { done: Math.min(p.done, p.total), total: p.total, title: p.note || (p.done >= p.total ? 'Done' : 'Working') }
  return taskLine(a.tasks)
}

// A step report from the agent itself, clamped to sense.
export const reported = (list: AgentRun[], agentId: string, input: { done?: unknown; total?: unknown; note?: unknown }): AgentRun[] =>
  list.map(a => {
    if (runKey(a) !== agentId) return a
    const num = (v: unknown, prev: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : prev)
    const total = num(input.total, a.progress?.total ?? 0)
    const done = num(input.done, a.progress?.done ?? 0)
    const note = typeof input.note === 'string' && input.note.trim() ? cut(input.note.trim(), 80) : undefined
    const notes = note && a.notes?.at(-1) !== note ? [...(a.notes ?? []), note].slice(-NOTES_KEPT) : a.notes
    return { ...a, progress: { done: total ? Math.min(done, total) : done, total, note }, ...(notes ? { notes } : {}) }
  })

const NOTES_KEPT = 12

const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
export const effortLabel = (effort?: string): string | undefined =>
  effort === undefined ? undefined : EFFORT_LEVELS.includes(effort) ? effort : /^\d+$/.test(effort) ? `budget ${tokens(Number(effort))}` : undefined

const TYPES: Record<string, { hat: HatKind; accent: 'tasks' | 'context' | 'session' | 'week' }> = {
  Explore: { hat: 'explorer', accent: 'context' },
  Plan: { hat: 'hardhat', accent: 'session' },
  'general-purpose': { hat: 'cap', accent: 'tasks' },
  'claude-code-guide': { hat: 'grad', accent: 'week' },
  'statusline-setup': { hat: 'beret', accent: 'week' },
  // A fork of the conversation, and a teammate with no type of its own.
  fork: { hat: 'bandana', accent: 'tasks' },
  teammate: { hat: 'headset', accent: 'context' },
}
const PLUGIN_AGENT = { hat: 'tophat', accent: 'session' } as const
// A mark for each type's title, matching its hat and tool.
const EMOJI: Record<string, string> = {
  main: '✻',
  Explore: '🔍',
  Plan: '📐',
  'general-purpose': '🔧',
  'claude-code-guide': '🎓',
  'statusline-setup': '🎨',
  fork: '🍴',
  teammate: '🎧',
}
export const typeEmoji = (type: string): string => (Object.hasOwn(EMOJI, type) ? EMOJI[type]! : type.includes(':') ? '🎩' : '☕')

// A plugin's agents are named `plugin:name`; anything else unknown gets the beanie.
export const typeStyle = (type: string): { hat: HatKind; accent?: 'tasks' | 'context' | 'session' | 'week' } =>
  Object.hasOwn(TYPES, type) ? TYPES[type]! : type.includes(':') ? PLUGIN_AGENT : { hat: 'beanie' }

export function summary(list: AgentRun[], now: number): { running: number; done: number; failed: number; context: number; ms: number } {
  if (list.length === 0) return { running: 0, done: 0, failed: 0, context: 0, ms: 0 }
  const running = list.filter(a => a.status === 'running').length
  const failed = list.filter(a => a.status === 'failed').length
  const start = Math.min(...list.map(a => a.startedAt))
  const end = running > 0 ? now : Math.max(...list.map(a => a.endedAt ?? a.startedAt))
  return { running, done: list.length - running - failed, failed, context: list.reduce((n, a) => n + a.contextTokens, 0), ms: Math.max(0, end - start) }
}

const FAILURE: Record<string, string> = { aborted: 'Stopped before it finished.', refusal: 'Declined the task.', error: 'Ended with an error.' }
export const resultText = (a: AgentRun): string => a.result ?? (a.status === 'failed' ? (FAILURE[a.reason ?? 'error'] ?? 'Ended with an error.') : 'No report.')

export const elapsed = (a: AgentRun, now: number): number => Math.max(0, (a.endedAt ?? now) - a.startedAt)

// 4s, 1m 4s, 1h 2m.
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export type LaneState = 'out' | 'finished' | 'tripped' | 'scored' | 'running' | 'thinking' | 'waiting'
export type Lane = { id: string; who: string; type?: string; many?: number; step: string; timeMs?: number; progress?: number; count: number; fails: number; calls: { kind: CallKind; ok: boolean }[]; doing?: CallKind; state: LaneState }
export type Race = { running: number; done: number; ok: number; fails: number; elapsedMs?: number; more: number; lanes: Lane[] }

const laneName = (type: string) => (type === 'general-purpose' ? 'General' : type.includes(':') ? type.split(':').pop()! : type)

// The race as drawn: Main and the newest agents, each in its state, with the header's counts;
// nothing while neither the main turn nor any agent is at work.
export function raceOf(log: RaceLog, agents: AgentRun[], tasks: Progress | undefined, now: number, mainWorking: boolean, turnStartedAt: number, mainStep?: string): Race | undefined {
  // Agents are kept oldest first; the race runs the newest.
  const running = agents.filter(a => a.status === 'running').reverse()
  if (!mainWorking && running.length === 0) return undefined
  // The call a lane's runner holds: the latest in flight among its members.
  const doingFor = (ids: string[]): { doing?: CallKind } => {
    const kind = ids.flatMap(id => doingOf(log, id)).at(-1)
    return kind ? { doing: kind } : {}
  }
  const timed = (id: string): LaneState | undefined =>
    now - (log.fellAt[id] ?? -Infinity) < TRIP_MS ? 'tripped' : now - (log.scoredAt[id] ?? -Infinity) < SCORE_MS ? 'scored' : undefined
  const main: Lane = {
    id: 'main',
    who: 'Main',
    // Between calls, the latest one; a log kept from before calls were named has none.
    step: mainStep ?? (mainWorking ? (log.said?.main ?? 'Working') : 'Waiting'),
    // A start of 0 is a turn that began before the mod loaded: its time is unknown, so none is shown.
    ...(mainWorking && turnStartedAt !== 0 ? { timeMs: Math.max(0, now - turnStartedAt) } : {}),
    ...(tasks ? { progress: tasks.done / tasks.total } : {}),
    calls: log.calls.main ?? [],
    count: countOf(log, 'main'),
    fails: failsOf(log, 'main'),
    ...doingFor(['main']),
    // Working between calls is thinking; waiting is Main not working while agents run.
    state: timed('main') ?? (!mainWorking ? 'waiting' : doingOf(log, 'main').length ? 'running' : 'thinking'),
  }
  const ended = agents.filter(a => a.status !== 'running' && now - (a.endedAt ?? 0) < RACE_LINGER_MS).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  // More running than lanes: agents of one type share a lane, the most numerous type first.
  let units: AgentRun[][] = running.map(a => [a])
  const counts = new Map<string, number>()
  for (const a of running) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  for (const [type] of [...counts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])) {
    if (units.length <= RACE_LANES) break
    const group = units.filter(u => u[0]!.type === type).flat()
    const first = units.findIndex(u => u[0]!.type === type)
    units = units.filter(u => u[0]!.type !== type)
    units.splice(first, 0, group)
  }
  const shown = [...units, ...ended.map(a => [a])]
  const time = (r: AgentRun) => Math.max(0, (r.endedAt ?? now) - r.startedAt)
  const lane = (u: AgentRun[]): Lane => {
    const a = u[0]!
    const id = a.agentId ?? a.id
    if (u.length > 1) {
      const ids = u.map(r => r.agentId ?? r.id)
      return {
        id,
        who: laneName(a.type),
        type: a.type,
        many: u.length,
        step: `${u.length} running`,
        timeMs: Math.max(...u.map(time)),
        // Every member's tiles, agent by agent: no call carries its time to interleave them by.
        calls: ids.flatMap(i => log.calls[i] ?? []).slice(-RACE_TILES),
        count: ids.reduce((n, i) => n + countOf(log, i), 0),
        fails: ids.reduce((n, i) => n + failsOf(log, i), 0),
        ...doingFor(ids),
        state: ids.some(i => timed(i) === 'tripped') ? 'tripped' : 'running',
      }
    }
    const p = progressOf(a)
    const state: LaneState = a.status === 'failed' ? 'out' : a.status === 'done' ? 'finished' : (timed(id) ?? 'running')
    return {
      id,
      who: a.description || laneName(a.type),
      type: a.type,
      step: state === 'out' ? 'Failed' : state === 'finished' ? 'Done' : p ? `${p.done}/${p.total} · ${p.title}` : (log.said?.[id] ?? 'Working'),
      timeMs: time(a),
      ...(state === 'finished' ? { progress: 1 } : p ? { progress: p.done / p.total } : {}),
      calls: log.calls[id] ?? [],
      count: countOf(log, id),
      fails: failsOf(log, id),
      ...doingFor([id]),
      state,
    }
  }
  const since = mainWorking ? turnStartedAt : Math.min(...running.map(a => a.startedAt))
  return {
    running: (mainWorking ? 1 : 0) + running.length,
    done: ended.length,
    ok: log.total - log.fails,
    fails: log.fails,
    ...(since !== 0 ? { elapsedMs: Math.max(0, now - since) } : {}),
    more: shown.slice(RACE_LANES).reduce((n, u) => n + u.length, 0),
    lanes: [main, ...shown.slice(0, RACE_LANES).map(lane)],
  }
}

// ---- What the agents pane's detail shows of a run: its calls, tools and files.

// The latest calls a run keeps; every call and failure is counted past them.
export const CALLS_KEPT = 60
const FILES_KEPT = 40
const BRIEF_MAX = 600

export const briefOf = (prompt: string): string => (Array.from(prompt).length > BRIEF_MAX ? `${cut(prompt, BRIEF_MAX - 1)}…` : prompt)

const withRun = (list: AgentRun[], agentId: string, fn: (a: AgentRun) => AgentRun): AgentRun[] => list.map(a => (runKey(a) === agentId ? fn(a) : a))

// A call starts: it is in flight, and its tool is counted.
export const calling = (list: AgentRun[], agentId: string, act: { kind: ActKind; title: string; target: string; key: string }, at: number): AgentRun[] =>
  withRun(list, agentId, a => ({
    ...a,
    doing: [...(a.doing ?? []), { kind: act.kind, title: act.title, target: act.target }],
    tools: { ...a.tools, [act.key]: (a.tools?.[act.key] ?? 0) + 1 },
    lastActiveAt: at,
  }))

// A call ends: it leaves the calls in flight and, unless it was refused or never came back
// (`ok` undefined), joins the run's calls.
export const called = (list: AgentRun[], agentId: string, act: { kind: ActKind; title: string }, at: number, ms: number, ok?: boolean): AgentRun[] =>
  withRun(list, agentId, a => {
    const doing = a.doing ?? []
    const i = doing.findIndex(d => d.kind === act.kind && d.title === act.title)
    const left = i === -1 ? doing : [...doing.slice(0, i), ...doing.slice(i + 1)]
    if (ok === undefined) return { ...a, doing: left, lastActiveAt: at }
    const call: AgentCall = { kind: act.kind, title: act.title, ok, ms }
    return {
      ...a,
      doing: left,
      calls: [...(a.calls ?? []), call].slice(-CALLS_KEPT),
      callCount: (a.callCount ?? 0) + 1,
      callFails: (a.callFails ?? 0) + (ok ? 0 : 1),
      lastActiveAt: at,
    }
  })

// A file the run read or changed: reads counted, changes as lines added and removed.
export const touched = (list: AgentRun[], agentId: string, path: string, change: { read: true } | { added: number; removed: number; created?: boolean }): AgentRun[] =>
  withRun(list, agentId, a => {
    const was: AgentFile = a.files?.[path] ?? { reads: 0, edits: 0, added: 0, removed: 0 }
    const now: AgentFile =
      'read' in change
        ? { ...was, reads: was.reads + 1 }
        : { ...was, edits: was.edits + 1, added: was.added + change.added, removed: was.removed + change.removed, ...(change.created || was.created ? { created: true } : {}) }
    const files = Object.entries({ ...a.files, [path]: now })
    // Over the cap the oldest file only read goes first: a change is what the detail is for.
    while (files.length > FILES_KEPT) files.splice(Math.max(0, files.findIndex(([, f]) => f.edits === 0)), 1)
    return { ...a, files: Object.fromEntries(files) }
  })

// The run's files: those it changed first (most lines first), then those it only read.
export function filesOf(a: AgentRun): { path: string; file: AgentFile }[] {
  const all = Object.entries(a.files ?? {}).map(([path, file]) => ({ path, file }))
  const changed = all.filter(f => f.file.edits > 0).sort((x, y) => y.file.added + y.file.removed - (x.file.added + x.file.removed))
  const read = all.filter(f => f.file.edits === 0).sort((x, y) => y.file.reads - x.file.reads)
  return [...changed, ...read]
}

// The run's tools in three groups, each most used first: built-in ones, skills and MCP tools.
export function toolsOf(a: AgentRun): { builtin: [string, number][]; skills: [string, number][]; mcp: [string, number][] } {
  const all = Object.entries(a.tools ?? {}).sort((x, y) => y[1] - x[1])
  return {
    builtin: all.filter(([k]) => !k.startsWith('skill:') && !k.startsWith('mcp__')),
    skills: all.filter(([k]) => k.startsWith('skill:')).map(([k, n]) => [k.slice(6), n]),
    mcp: all.filter(([k]) => k.startsWith('mcp__')).map(([k, n]) => [k.replace(/^mcp__(.+?)__/, '$1 · '), n]),
  }
}

// ---- Crews: the agents one main turn (or workflow run) started.

export type Crew = { id: string; runs: AgentRun[]; running: number; startedAt: number; endedAt?: number }

// The crews, newest first, each with its runs in the order they started.
export function crewsOf(list: readonly AgentRun[]): Crew[] {
  return crewOrder(list).map(id => {
    const runs = list.filter(a => crewOf(a) === id)
    const running = runs.filter(a => a.status === 'running').length
    return { id, runs, running, startedAt: Math.min(...runs.map(a => a.startedAt)), ...(running ? {} : { endedAt: Math.max(...runs.map(a => a.endedAt ?? a.startedAt)) }) }
  })
}

// The crews the pane shows in full: the newest, and any still at work; the rest are earlier.
export function openCrews(crews: readonly Crew[]): { now: Crew[]; earlier: Crew[] } {
  const now = crews.filter((c, i) => i === 0 || c.running > 0)
  return { now, earlier: crews.filter(c => !now.includes(c)).slice(0, Math.max(0, CREWS_KEPT - now.length)) }
}

// Every earlier crew dropped: what is left is the crews shown in full, and any run at work.
export const clearEarlier = (list: AgentRun[], shown: ReadonlySet<string>): AgentRun[] => list.filter(a => shown.has(crewOf(a)) || a.status === 'running')

// ---- Moods: how each agent's Clawd stands, and his line in Thai.

export type AgentMood = 'working' | 'thinking' | 'quiet' | 'context' | 'failed' | 'stopped' | 'done'
// Running with no call in flight and nothing heard this long: quiet, maybe stuck.
export const QUIET_MS = 30_000
// The context share past which an agent sweats.
export const FULL_AT = 80

// Its context as a share of the window, when the window is known.
export const contextPercent = (a: AgentRun, window?: number): number | undefined => (window ? Math.min(100, Math.round((a.contextTokens / window) * 100)) : undefined)

export function agentMood(a: AgentRun, now: number, window?: number): AgentMood {
  if (a.status === 'failed') return a.reason === 'aborted' ? 'stopped' : 'failed'
  if (a.status === 'done') return 'done'
  if ((contextPercent(a, window) ?? 0) >= FULL_AT) return 'context'
  if (a.doing?.length) return 'working'
  // Claude writing a long answer is quiet too, and no sign of a stuck main turn.
  return !isMain(a) && now - (a.lastActiveAt ?? a.startedAt) >= QUIET_MS ? 'quiet' : 'thinking'
}

// m:ss, for the Thai lines.
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
// Under this a finished run was quick.
const FAST_MS = 30_000

// Each mood's lines; one is picked by the run's id, so a run keeps its line between redraws.
const LINES: Record<'thinking' | 'quiet' | 'context' | 'failed' | 'stopped' | 'done' | 'fast', ((f: Record<string, string>) => string)[]> = {
  thinking: [() => 'ขอคิดแป๊บ… 🤔', () => 'กำลังเรียบเรียงความคิด 💭', () => 'คิดก่อนลงมือ 🤔'],
  quiet: [f => `เงียบไป ${f.quiet} วิ… หลับอยู่หรือเปล่า 😴`, f => `${f.quiet} วิแล้วยังเงียบ ลองเข้าไปดูหน่อย 👀`],
  context: [f => `หัวจะระเบิดแล้ว 🤯 ctx ${f.ctx}%`, f => `ความจำใกล้เต็ม ctx ${f.ctx}% 🧠`],
  failed: [f => `งานนี้พัง 🩹 ดู report ก่อนนะ`, f => `สะดุดล้ม ${f.fails} ครั้ง 🩹`],
  stopped: [f => `หยุดตามที่สั่ง ✋${f.steps ? ` ทำไป ${f.steps} ขั้น` : ''}`],
  done: [f => `เสร็จใน ${f.time} เรียบร้อย ✨`, f => `งานเสร็จ ส่งรายงานแล้ว 📬 (${f.time})`],
  fast: [f => `เสร็จใน ${f.time} ไวเหมือนโกหก ⚡`, f => `${f.time} เสร็จแล้ว ไวมาก ⚡`],
}
// What the working Clawd says he is doing, by his call's kind.
const DOING: Record<ActKind, (target: string) => string> = {
  read: t => `กำลังอ่าน ${t} 📖`,
  edit: t => `กำลังแก้ ${t} ✍️`,
  command: t => `กำลังรัน ${t} ⚙️`,
  test: () => 'กำลังรัน test 🧪',
  search: t => `กำลังค้น ${t} 🔍`,
  web: t => `กำลังเปิดเว็บ ${t} 🌐`,
  skill: t => `กำลังใช้ skill ${t} 🧠`,
  mcp: t => `กำลังเรียก ${t} 🔌`,
  other: () => 'กำลังลุย 💪',
}
const pick = <T>(id: string, list: readonly T[]): T => list[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % list.length]!

// The run's line in Thai for its mood, with its real numbers in it. A run in its second round
// says so first; a finished run whose summary is being written says that.
export function thaiLine(a: AgentRun, now: number, window?: number): string {
  const mood = agentMood(a, now, window)
  const round = a.rounds?.length && a.status === 'running' ? `รอบ ${a.rounds.length + 1} · ` : ''
  const p = progressOf(a)
  const f: Record<string, string> = {
    quiet: String(Math.floor((now - (a.lastActiveAt ?? a.startedAt)) / 1000)),
    ctx: String(contextPercent(a, window) ?? ''),
    fails: String(a.callFails ?? 0),
    steps: p ? `${p.done}/${p.total}` : '',
    time: mmss(elapsed(a, now)),
  }
  if (mood === 'working') {
    const d = a.doing!.at(-1)!
    return round + (d.title.startsWith('Agent') ? `รอ agent "${d.target}" อยู่ 🤝` : DOING[d.kind](d.target))
  }
  if (mood === 'done') {
    if (a.summary === 'pending') return 'เสร็จแล้ว! กำลังสรุปให้อ่าน… 📝'
    return pick(a.id, elapsed(a, now) < FAST_MS ? LINES.fast : LINES.done)(f)
  }
  return round + pick(a.id, LINES[mood])(f)
}

// An agent at work that needs a look, quiet ones first, then those with their context nearly
// full: the detail names it while no agent is viewed.
export function needsLook(list: readonly AgentRun[], now: number, windowOf: (a: AgentRun) => number | undefined = () => undefined): AgentRun | undefined {
  const newest = [...list].reverse()
  const mood = (a: AgentRun) => agentMood(a, now, windowOf(a))
  return newest.find(a => mood(a) === 'quiet') ?? newest.find(a => mood(a) === 'context')
}

// ---- The Thai summary Haiku writes of a finished run.

export const SUMMARY_SYSTEM =
  'You sum up what a coding subagent did, in Thai, for the developer who sent it. Write every line in Thai, even when the report is in English. Reply with 2 to 4 lines, each starting with "- ": ' +
  'what it found or changed, and anything that needs their attention. Keep each line under 25 words. Keep file names, code and ' +
  'technical terms in English. No heading, no preamble.'

export function summaryPrompt(a: AgentRun): string {
  const files = filesOf(a).slice(0, 12).map(({ path, file }) => (file.edits ? `${path} (+${file.added} −${file.removed}${file.created ? ', new' : ''})` : `${path} (read)`))
  const failed = (a.calls ?? []).filter(c => !c.ok).slice(-5).map(c => c.title)
  return [
    `Task: ${a.description}`,
    a.brief ? `Brief: ${a.brief}` : '',
    `Calls: ${a.callCount ?? 0}, failed: ${a.callFails ?? 0}${failed.length ? ` (${failed.join('; ')})` : ''}`,
    files.length ? `Files: ${files.join(', ')}` : 'Files: none',
    `Report:\n${a.result ?? '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// Haiku's reply as bullets: its `- ` lines, cut short; nothing when it gave none.
export function summaryOf(text: string): string[] | undefined {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[-•*]\s+/.test(l))
    .map(l => cut(l.replace(/^[-•*]\s+/, ''), 200))
    .slice(0, 4)
  return lines.length ? lines : undefined
}

export const summarized = (list: AgentRun[], agentId: string, summary: string[] | 'pending' | undefined): AgentRun[] =>
  withRun(list, agentId, a => {
    const { summary: _, ...rest } = a
    return summary === undefined ? rest : { ...a, summary }
  })

// The facts the mod counted itself, in Thai: files read and changed, calls, time and tokens.
export function factsLine(a: AgentRun, now: number): string {
  const files = Object.values(a.files ?? {})
  const fails = a.callFails ?? 0
  return [
    `อ่าน ${files.filter(f => f.edits === 0).length} ไฟล์`,
    `แก้ ${files.filter(f => f.edits > 0).length} ไฟล์`,
    `${a.callCount ?? 0} calls${fails ? ` (พลาด ${fails})` : ''}`,
    clock(elapsed(a, now)),
    `${tokens(a.spent ?? a.contextTokens)} tokens`,
  ].join(' · ')
}

// The day a crew started, as the earlier crews are grouped: TODAY, YESTERDAY, else its date.
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export function dayOf(at: number, now: number): string {
  const d = new Date(at)
  const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const ago = Math.round((midnight(now) - midnight(at)) / 86_400_000)
  return ago <= 0 ? 'TODAY' : ago === 1 ? 'YESTERDAY' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
