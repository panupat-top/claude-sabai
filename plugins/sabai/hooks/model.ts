import type { CallKind, Env, RaceLog, Show, Task, TurnLog, Usage } from '../types'
import type { IconKind } from './icons'

export const WARN_AT = 70
export const ALERT_AT = 90

export type MeterKind = 'context' | 'session' | 'week'
// `amount` is the context's fill in tokens (`434.5k / 1M`); the limits have none.
// `left` is what is left of the context window (`256.5k left`).
export type Meter = { kind: MeterKind; label: string; percent: number; amount?: string; left?: string; resetsInMs?: number; level?: 'warn' | 'alert' }

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
export function meters(usage: Usage | null, now: number, opts: { show?: Partial<Show>; warnAt?: number; alertAt?: number } = {}): Meter[] {
  const out: Meter[] = []
  const shown = (kind: MeterKind) => opts.show?.[kind] !== false
  const leveled = (m: Meter): Meter => ({ ...m, level: level(m.percent, opts.warnAt, opts.alertAt) })
  const add = (kind: MeterKind, label: string, window: string) => {
    const l = usage?.rateLimits.find(r => r.kind === window)
    if (!l || !shown(kind)) return
    const resetsInMs = resetsIn(l.resetsAt, now)
    out.push(leveled({ kind, label, percent: clamp(l.percentUsed), resetsInMs }))
  }
  if (usage?.contextPercent !== undefined && shown('context')) {
    const { contextTokens: used, contextWindow: size } = usage
    const amount = used !== undefined && size ? `${tokens(used)} / ${tokens(size)}` : undefined
    const left = used !== undefined && size ? `${tokens(Math.max(0, size - used))} left` : undefined
    out.push(leveled({ kind: 'context', label: 'Context', percent: clamp(usage.contextPercent), amount, ...(left ? { left } : {}) }))
  }
  add('session', '5H Limit', 'five_hour')
  add('week', '7D All', 'seven_day')
  return out
}

// 434512 → 434.5k, 1000000 → 1M, 200000 → 200k; 999950 rounds up to 1M, not 1000k.
export function tokens(n: number): string {
  const one = (x: number) => String(Math.round(x * 10) / 10)
  return n >= 999_950 ? `${one(n / 1e6)}M` : n >= 1e3 ? `${one(n / 1e3)}k` : String(n)
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

// The branch chip also carries its parts, so a drawing can lay them out apart; `value` stays the
// one-line form the terminal and the alt read.
export type Chip = { icon: IconKind; label: string; value: string; branch?: string; ahead?: number; behind?: number; changes?: number }

// `main ↑2 ↓1 ±3`: each mark only when it is not zero.
const branchLine = ({ branch, ahead, behind, changes }: Env) =>
  [branch, ahead && `↑${ahead}`, behind && `↓${behind}`, changes && `±${changes}`].filter(Boolean).join(' ')

// The info row: directory, git user and branch on the left, node on the right; each only when
// known. The branch carries commits ahead/behind its upstream and uncommitted files.
// `label` is what the drawing says for a reader.
export function chips(env: Env, show: Partial<Show> = {}): { left: Chip[]; right: Chip[] } {
  const known = (list: { icon: IconKind; label: string; value?: string | false; branch?: string; ahead?: number; behind?: number; changes?: number }[]) =>
    list.filter(c => Boolean(c.value)) as Chip[]
  const on = (key: keyof Show) => show[key] !== false
  return {
    left: known([
      { icon: 'folder', label: 'Directory', value: on('folder') && env.dir },
      { icon: 'git', label: 'Git user', value: on('gitUser') && env.gitUser },
      { icon: 'branch', label: 'Branch', value: on('branch') && env.branch && branchLine(env), branch: env.branch, ahead: env.ahead, behind: env.behind, changes: env.changes },
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

// The facts Clawd's second line is made of; any may be missing.
export type MoodFacts = { caught?: number; passed?: number; failed?: number; contextPercent?: number; idleMs?: number }
const known = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n)
// Why Clawd feels as he does, in a few words, or nothing when the fact behind it is missing.
// Working says nothing here: the panel shows the turn's time.
export function moodLine(mood: Mood, f: MoodFacts): string | undefined {
  switch (mood) {
    case 'idle':
      return 'your turn'
    case 'startled':
      return known(f.caught) && f.caught > 0 ? `guard stopped ${f.caught}` : undefined
    case 'sad':
      return known(f.failed) && f.failed > 0 ? `${f.failed} failed` : undefined
    case 'celebrating':
      return known(f.passed) ? `${f.passed} passed` : undefined
    case 'sweating':
      return known(f.contextPercent) ? `${Math.round(f.contextPercent)}% · compact?` : undefined
    case 'sleeping': {
      if (!known(f.idleMs)) return undefined
      const m = Math.floor(f.idleMs / 60_000)
      return m >= 60 ? `idle ${Math.floor(m / 60)}h` : `idle ${m}m`
    }
    default:
      return undefined
  }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// A limit's reset as a local clock time: `resets 14:30` today, `resets Thu 09:00` past it.
export function resetClock(resetsInMs: number | undefined, now: number): string | undefined {
  if (resetsInMs === undefined || !Number.isFinite(resetsInMs)) return undefined
  const at = new Date(now + resetsInMs)
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return at.toDateString() === new Date(now).toDateString() ? `resets ${hm}` : `resets ${DAYS[at.getDay()]} ${hm}`
}

export type Trick = 'wave' | 'yawn' | 'look-right' | 'look-up'
export const WAVE_MS = 3000
export const YAWN_AFTER_MS = 2 * 60_000
// A trick for Clawd when his mood has no look of its own (idle or working): a wave as a turn
// ends, a look at the race beside him or at a limit running high, a yawn after a quiet while.
export function trickOf(s: { mood: Mood; now: number; lastTurnAt: number; isWorking: boolean; raceShown: boolean; limitHigh: boolean }): Trick | undefined {
  if (s.mood !== 'idle' && s.mood !== 'working') return undefined
  const since = s.lastTurnAt > 0 ? s.now - s.lastTurnAt : undefined
  if (!s.isWorking && since !== undefined && since < WAVE_MS) return 'wave'
  if (s.raceShown) return 'look-right'
  if (s.limitHigh) return 'look-up'
  if (!s.isWorking && since !== undefined && since >= YAWN_AFTER_MS) return 'yawn'
  return undefined
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

export const EMPTY_RACE: RaceLog = { calls: {}, count: {}, doing: {}, fellAt: {}, scoredAt: {}, fails: 0, total: 0 }
// A member's calls in flight, oldest first; a log kept from before they were a list reads as none.
export const doingOf = (log: RaceLog, member: string): CallKind[] => {
  const d = log.doing[member]
  return Array.isArray(d) ? d : []
}
// A member's finished calls; a log kept from before they were counted reads as none.
export const countOf = (log: RaceLog, member: string): number => log.count?.[member] ?? 0
export const TRIP_MS = 4000
export const SCORE_MS = 3000
export const RACE_TILES = 16
export const RACE_LANES = 3
// How long a finished agent keeps its lane, as the crew row keeps it.
export const RACE_LINGER_MS = 60_000
// Where a runner with no known progress stands: quick at first, slower as calls add up, never at the flag.
export const paceOf = (count: number): number => Math.max(0.1, Math.min(0.85, 1 - 0.5 ** (count / 8)))

// A new main turn's race: Main and the counts start over, and only agents the race can still show keep their lanes.
export function nextTurnRace(log: RaceLog, kept: Set<string>): RaceLog {
  const keep = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => kept.has(k)))
  return { ...EMPTY_RACE, calls: keep(log.calls), count: keep(log.count ?? {}), doing: keep(log.doing), fellAt: keep(log.fellAt), scoredAt: keep(log.scoredAt) }
}

// One finished call of a member folded into the race: its tile, its fall or score, the turn's counts.
export function raced(log: RaceLog, member: string, call: { kind: CallKind; ok: boolean }, at: number): RaceLog {
  return {
    ...log,
    calls: { ...log.calls, [member]: [...(log.calls[member] ?? []), call].slice(-RACE_TILES) },
    count: { ...log.count, [member]: countOf(log, member) + 1 },
    fails: log.fails + (call.ok ? 0 : 1),
    fellAt: call.ok ? log.fellAt : { ...log.fellAt, [member]: at },
    scoredAt: call.kind === 'test' && call.ok ? { ...log.scoredAt, [member]: at } : log.scoredAt,
    total: log.total + 1,
  }
}
