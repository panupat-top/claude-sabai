import type { AgentRun, CallKind, RaceLog, Task } from '../types'
import type { Progress } from './model'
import { RACE_LANES, RACE_LINGER_MS, RACE_TILES, SCORE_MS, TRIP_MS, doingOf, tokens } from './model'
import type { HatKind } from './sprites'

// The pane keeps the newest runs; older ones fall off.
const KEEP = 40

// `claude-opus-5-5` → `opus 5.5`, `claude-sonnet-4-5-20250929` → `sonnet 4.5`; anything else as is.
export function modelName(id: string): string {
  const m = id.replace(/^claude-/, '').replace(/-\d{8}$/, '').match(/^([a-z]+)-(\d+)(?:-(\d+))?$/)
  return m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : id
}

export const spawned = (list: AgentRun[], run: AgentRun): AgentRun[] => [...list.filter(a => a.id !== run.id), run].slice(-KEEP)

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One model request of a subagent: its context is everything that request read and wrote.
export const stepped = (list: AgentRun[], agentId: string, model: string, u: Usage, effort?: string | number): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          model: model || a.model,
          steps: a.steps + 1,
          contextTokens: u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
          effort: effort === undefined ? a.effort : String(effort),
          // A finished agent sent more work runs again: its old end and report no longer stand.
          ...(a.status === 'running' ? {} : { status: 'running' as const, endedAt: undefined, reason: undefined, result: undefined }),
        },
  )

export const RESULT_MAX = 1500
// The first `n` characters, cut between code points: half an emoji would leave a lone surrogate,
// which makes a drawing that carries it invalid.
const cut = (s: string, n: number) => Array.from(s).slice(0, n).join('')

export const finished = (list: AgentRun[], agentId: string, reason: NonNullable<AgentRun['reason']>, at: number, answer?: string): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
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
    if (a.agentId !== agentId) return a
    const num = (v: unknown, prev: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : prev)
    const total = num(input.total, a.progress?.total ?? 0)
    const done = num(input.done, a.progress?.done ?? 0)
    const note = typeof input.note === 'string' && input.note.trim() ? cut(input.note.trim(), 80) : undefined
    return { ...a, progress: { done: total ? Math.min(done, total) : done, total, note } }
  })

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

export function summary(list: AgentRun[], now: number): { running: number; done: number; context: number; ms: number } {
  if (list.length === 0) return { running: 0, done: 0, context: 0, ms: 0 }
  const running = list.filter(a => a.status === 'running').length
  const start = Math.min(...list.map(a => a.startedAt))
  const end = running > 0 ? now : Math.max(...list.map(a => a.endedAt ?? a.startedAt))
  return { running, done: list.length - running, context: list.reduce((n, a) => n + a.contextTokens, 0), ms: Math.max(0, end - start) }
}

export const clearFinished = (list: AgentRun[]): AgentRun[] => list.filter(a => a.status === 'running')

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

// Running first, newest first within each group.
export function groups(list: AgentRun[]): { running: AgentRun[]; finished: AgentRun[] } {
  const newest = [...list].reverse()
  return { running: newest.filter(a => a.status === 'running'), finished: newest.filter(a => a.status !== 'running') }
}

export type LaneState = 'out' | 'finished' | 'tripped' | 'scored' | 'running' | 'waiting'
export type Lane = { id: string; who: string; type?: string; many?: number; step: string; timeMs?: number; progress?: number; calls: { kind: CallKind; ok: boolean }[]; doing?: CallKind; state: LaneState }
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
    step: mainStep ?? (mainWorking ? 'Working' : 'Waiting'),
    // A start of 0 is a turn that began before the mod loaded: its time is unknown, so none is shown.
    ...(mainWorking && turnStartedAt !== 0 ? { timeMs: Math.max(0, now - turnStartedAt) } : {}),
    ...(tasks ? { progress: tasks.done / tasks.total } : {}),
    calls: log.calls.main ?? [],
    ...doingFor(['main']),
    state: timed('main') ?? (mainWorking && doingOf(log, 'main').length ? 'running' : 'waiting'),
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
      step: state === 'out' ? 'Failed' : state === 'finished' ? 'Done' : p ? `${p.done}/${p.total} · ${p.title}` : 'Working',
      timeMs: time(a),
      ...(state === 'finished' ? { progress: 1 } : p ? { progress: p.done / p.total } : {}),
      calls: log.calls[id] ?? [],
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
