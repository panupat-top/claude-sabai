import type { Env, Task, Usage } from '../types'
import type { IconKind } from './icons'

export const WARN_AT = 70
export const ALERT_AT = 90

export type MeterKind = 'context' | 'session' | 'week'
// `amount` is the context's fill in tokens (`434.5k / 1M`); the limits have none.
export type Meter = { kind: MeterKind; label: string; percent: number; amount?: string; resetsInMs?: number }

export const toUsage = (u: {
  context: { percent?: number; tokens?: number; window: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
}): Usage => ({
  contextPercent: u.context.percent,
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  rateLimits: u.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
})

// A reading the engine could not give (NaN) counts as nothing used, never "NaN%".
const clamp = (p: number) => (Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : 0)
const resetsIn = (resetsAt: string | undefined, now: number) => {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  return Number.isNaN(at) ? undefined : Math.max(0, at - now)
}

// Context, 5H and 7D, all from the engine, each only once it has a reading.
export function meters(usage: Usage | null, now: number): Meter[] {
  const out: Meter[] = []
  const add = (kind: MeterKind, label: string, window: string) => {
    const l = usage?.rateLimits.find(r => r.kind === window)
    if (l) out.push({ kind, label, percent: clamp(l.percentUsed), resetsInMs: resetsIn(l.resetsAt, now) })
  }
  if (usage?.contextPercent !== undefined) {
    const { contextTokens: used, contextWindow: size } = usage
    const amount = used !== undefined && size ? `${tokens(used)} / ${tokens(size)}` : undefined
    out.push({ kind: 'context', label: 'Context', percent: clamp(usage.contextPercent), amount })
  }
  add('session', '5H Limit', 'five_hour')
  add('week', '7D All', 'seven_day')
  return out
}

// 434512 → 434.5k, 1000000 → 1M, 200000 → 200k.
export function tokens(n: number): string {
  const one = (x: number) => String(Math.round(x * 10) / 10)
  return n >= 1e6 ? `${one(n / 1e6)}M` : n >= 1e3 ? `${one(n / 1e3)}k` : String(n)
}

// What a meter reads as: `434.5k / 1M (43%)` for the context, `43%` for a limit.
export const value = (m: Meter): string => (m.amount ? `${m.amount} (${m.percent}%)` : `${m.percent}%`)

export const level = (percent: number): 'alert' | 'warn' | undefined =>
  percent >= ALERT_AT ? 'alert' : percent >= WARN_AT ? 'warn' : undefined

export function countdown(ms: number): string {
  const m = Math.ceil(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}

export type Chip = { icon: IconKind; label: string; value: string }

// `main ↑2 ↓1 ±3`: each mark only when it is not zero.
const branchLine = ({ branch, ahead, behind, changes }: Env) =>
  [branch, ahead && `↑${ahead}`, behind && `↓${behind}`, changes && `±${changes}`].filter(Boolean).join(' ')

// The info row: directory, git user and branch on the left, node on the right; each only when
// known. The branch carries commits ahead/behind its upstream and uncommitted files.
// `label` is what the drawing says for a reader.
export function chips(env: Env): { left: Chip[]; right: Chip[] } {
  const known = (list: { icon: IconKind; label: string; value?: string }[]) => list.filter((c): c is Chip => Boolean(c.value))
  return {
    left: known([
      { icon: 'folder', label: 'Directory', value: env.dir },
      { icon: 'git', label: 'Git user', value: env.gitUser },
      { icon: 'branch', label: 'Branch', value: env.branch && branchLine(env) },
    ]),
    right: known([{ icon: 'node', label: 'Node', value: env.node }]),
  }
}

export const created = (tasks: Task[], id: string, subject: string, activeForm?: string): Task[] => [
  ...tasks,
  { id, subject, activeForm, status: 'pending' },
]

export function updated(
  tasks: Task[],
  input: { taskId: string; subject?: string; activeForm?: string; status?: Task['status'] | 'deleted' },
): Task[] {
  if (input.status === 'deleted') return tasks.filter(t => t.id !== input.taskId)
  const { status } = input
  return tasks.map(t =>
    t.id !== input.taskId
      ? t
      : { ...t, subject: input.subject || t.subject, activeForm: input.activeForm ?? t.activeForm, status: status ?? t.status },
  )
}

export const fromTodos = (todos: readonly { content: string; status: Task['status']; activeForm: string }[]): Task[] =>
  todos.map((t, i) => ({ id: String(i), subject: t.content, activeForm: t.activeForm, status: t.status }))

export type Progress = { done: number; total: number; title: string }

// What the progress row shows: the running task's present tense, else the next pending one.
export function progress(tasks: Task[]): Progress | undefined {
  const done = tasks.filter(t => t.status === 'completed').length
  if (tasks.length === 0 || done === tasks.length) return undefined
  const running = tasks.find(t => t.status === 'in_progress')
  const next = tasks.find(t => t.status === 'pending')
  return { done, total: tasks.length, title: running ? (running.activeForm ?? running.subject) : (next?.subject ?? 'Tasks') }
}

export const blocks = (ratio: number, width: number, full: string, empty: string): string => {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * width)
  return full.repeat(filled) + empty.repeat(width - filled)
}

// How long Clawd stays startled after the guard catches a call.
export const STARTLE_MS = 3000
// How long Clawd celebrates a test run that passed.
export const CELEBRATE_MS = 4000
