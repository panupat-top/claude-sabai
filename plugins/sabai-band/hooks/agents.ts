import type { AgentRun, Task } from '../types'
import type { Progress } from './model'
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
        },
  )

export const RESULT_MAX = 600

export const finished = (list: AgentRun[], agentId: string, reason: NonNullable<AgentRun['reason']>, at: number, answer?: string): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          status: reason === 'answer' ? 'done' : 'failed',
          reason,
          endedAt: at,
          result: answer && answer.length > RESULT_MAX ? `${answer.slice(0, RESULT_MAX - 1)}…` : answer || undefined,
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

const EFFORT: Record<string, string> = { low: 'quick', medium: 'steady', high: 'careful', xhigh: 'deep', max: 'deep' }
export const effortLabel = (effort?: string): string | undefined => (effort && Object.hasOwn(EFFORT, effort) ? EFFORT[effort] : undefined)

const TYPES: Record<string, { hat: HatKind; accent: 'tasks' | 'context' | 'session' | 'week' }> = {
  Explore: { hat: 'explorer', accent: 'context' },
  Plan: { hat: 'hardhat', accent: 'session' },
  'general-purpose': { hat: 'cap', accent: 'tasks' },
  'claude-code-guide': { hat: 'grad', accent: 'week' },
}
export const typeStyle = (type: string): { hat: HatKind; accent?: 'tasks' | 'context' | 'session' | 'week' } =>
  Object.hasOwn(TYPES, type) ? TYPES[type]! : { hat: 'beanie' }

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
