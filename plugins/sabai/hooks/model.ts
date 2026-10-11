import type { Env, Show, Task, TurnLog, Usage } from '../types'
import type { IconKind } from './icons'

export const WARN_AT = 70
export const ALERT_AT = 90

export type MeterKind = 'context' | 'session' | 'week'
// `amount` is the context's fill in tokens (`434.5k / 1M`); the limits have none.
// `forecast` is where a limit is heading by its reset, with `forecastLevel` its warning level.
export type Meter = { kind: MeterKind; label: string; percent: number; amount?: string; resetsInMs?: number; level?: 'warn' | 'alert'; forecast?: number; forecastLevel?: 'warn' | 'alert' }

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

// Context, 5H and 7D, all from the engine, each only once it has a reading and when shown, with
// its warning level at the person's thresholds.
export function meters(usage: Usage | null, now: number, opts: { show?: Partial<Show>; warnAt?: number; alertAt?: number; samples?: Partial<Record<string, readonly Point[]>> } = {}): Meter[] {
  const out: Meter[] = []
  const shown = (kind: MeterKind) => opts.show?.[kind] !== false
  const leveled = (m: Meter): Meter => ({ ...m, level: level(m.percent, opts.warnAt, opts.alertAt) })
  const add = (kind: MeterKind, label: string, window: string) => {
    const l = usage?.rateLimits.find(r => r.kind === window)
    if (!l || !shown(kind)) return
    const resetsInMs = resetsIn(l.resetsAt, now)
    const forecast = forecastOf([...(opts.samples?.[window] ?? [])], resetsInMs, now)
    out.push({
      ...leveled({ kind, label, percent: clamp(l.percentUsed), resetsInMs }),
      ...(forecast === undefined ? {} : { forecast, forecastLevel: level(forecast, opts.warnAt, opts.alertAt) }),
    })
  }
  if (usage?.contextPercent !== undefined && shown('context')) {
    const { contextTokens: used, contextWindow: size } = usage
    const amount = used !== undefined && size ? `${tokens(used)} / ${tokens(size)}` : undefined
    out.push(leveled({ kind: 'context', label: 'Context', percent: clamp(usage.contextPercent), amount }))
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

export const level = (percent: number, warnAt = WARN_AT, alertAt = ALERT_AT): 'alert' | 'warn' | undefined =>
  percent >= alertAt ? 'alert' : percent >= warnAt ? 'warn' : undefined

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
export function chips(env: Env, show: Partial<Show> = {}): { left: Chip[]; right: Chip[] } {
  const known = (list: { icon: IconKind; label: string; value?: string | false }[]) => list.filter((c): c is Chip => Boolean(c.value))
  const on = (key: keyof Show) => show[key] !== false
  return {
    left: known([
      { icon: 'folder', label: 'Directory', value: on('folder') && env.dir },
      { icon: 'git', label: 'Git user', value: on('gitUser') && env.gitUser },
      { icon: 'branch', label: 'Branch', value: on('branch') && env.branch && branchLine(env) },
    ]),
    right: known([{ icon: 'node', label: 'Node', value: on('node') && env.node }]),
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

export type Mood = 'startled' | 'sad' | 'celebrating' | 'sweating' | 'working' | 'sleeping' | 'idle'
// How long Clawd stays startled after the guard catches a call, and celebrates a passing run.
export const STARTLE_MS = 3000
export const CELEBRATE_MS = 4000
export const SLEEP_AFTER_MS = 5 * 60_000
export const SWEAT_AT = 90

// How Clawd feels, the most pressing first: the guard just caught something, the turn's tests
// failed or just passed, the context is nearly full, work is under way, or nothing has happened
// for a while.
export function moodOf(s: { log: TurnLog; contextPercent?: number; now: number; isWorking: boolean; lastTurnAt: number }): Mood {
  const { log, now } = s
  if (log.caught !== undefined && now - log.caught < STARTLE_MS) return 'startled'
  if (log.test && log.test.failed > 0) return 'sad'
  if (log.test && now - log.test.at < CELEBRATE_MS) return 'celebrating'
  if ((s.contextPercent ?? 0) >= SWEAT_AT) return 'sweating'
  if (s.isWorking) return 'working'
  if (s.lastTurnAt > 0 && now - s.lastTurnAt >= SLEEP_AFTER_MS) return 'sleeping'
  return 'idle'
}

export type Point = { at: number; percent: number }
const RECENT_MS = 30 * 60_000
// Where a limit is heading by its reset at the recent rate (a least-squares slope over the last
// half hour), or nothing without two readings five minutes apart and a rising rate.
export function forecastOf(points: readonly Point[], resetsInMs: number | undefined, now: number): number | undefined {
  if (resetsInMs === undefined) return undefined
  const recent = points.filter(p => now - p.at <= RECENT_MS)
  if (recent.length < 2 || recent.at(-1)!.at - recent[0]!.at < 5 * 60_000) return undefined
  const mx = recent.reduce((s, p) => s + p.at, 0) / recent.length
  const my = recent.reduce((s, p) => s + p.percent, 0) / recent.length
  const den = recent.reduce((s, p) => s + (p.at - mx) ** 2, 0)
  const rate = den ? recent.reduce((s, p) => s + (p.at - mx) * (p.percent - my), 0) / den : 0
  if (rate <= 0) return undefined
  const last = recent.at(-1)!.percent
  const ahead = Math.min(100, Math.round(last + rate * resetsInMs))
  return ahead >= last + 1 ? ahead : undefined
}

export type Accessory = 'newyear' | 'xmas' | 'halloween' | 'songkran' | 'coffee' | 'nightcap'
// What Clawd wears for the local date and hour: a holiday first, else the time of day.
export function accessoryOf(d: Date): Accessory | undefined {
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  if ((m === 12 && day === 31) || (m === 1 && day === 1)) return 'newyear'
  if (m === 12 && (day === 24 || day === 25)) return 'xmas'
  if (m === 10 && day === 31) return 'halloween'
  if (m === 4 && day >= 13 && day <= 15) return 'songkran'
  if (h >= 6 && h < 11) return 'coffee'
  if (h >= 22 || h < 5) return 'nightcap'
  return undefined
}
