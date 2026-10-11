import { expect, test } from 'claude-code/testing'
import type { AgentRun } from '../types'
import { raceOf } from '../hooks/agents'

import type { Task } from '../types'
import { blocks, chips, countdown, created, fromTodos, level, meters, progress, toUsage, tokens, updated, value, CELEBRATE_MS, SLEEP_AFTER_MS, STARTLE_MS, EMPTY_RACE, accessoryOf, forecastOf, moodOf, raced } from '../hooks/model'

const NOW = Date.parse('2026-10-10T00:00:00Z')

test('tasks follow TaskCreate and TaskUpdate', () => {
  let list: Task[] = []
  list = created(list, '1', 'Write tests', 'Writing tests')
  list = created(list, '2', 'Ship')
  expect(progress(list)).toEqual({ done: 0, total: 2, title: 'Write tests' })
  list = updated(list, { taskId: '1', status: 'in_progress' })
  expect(progress(list)?.title).toBe('Writing tests')
  list = updated(list, { taskId: '1', status: 'completed' })
  expect(progress(list)).toEqual({ done: 1, total: 2, title: 'Ship' })
  list = updated(list, { taskId: '2', subject: 'Ship it' })
  expect(list.map(t => [t.id, t.subject, t.status])).toEqual([
    ['1', 'Write tests', 'completed'],
    ['2', 'Ship it', 'pending'],
  ])
  expect(updated(list, { taskId: '1', status: 'deleted' }).map(t => t.id)).toEqual(['2'])
  expect(updated(list, { taskId: 'nope', status: 'completed' })).toEqual(list)
  expect(progress(updated(list, { taskId: '2', status: 'completed' }))).toBeUndefined()
  expect(progress([])).toBeUndefined()
})

test('TodoWrite replaces the list', () => {
  const list = fromTodos([
    { content: 'a', status: 'completed', activeForm: 'Doing a' },
    { content: 'b', status: 'in_progress', activeForm: 'Doing b' },
  ])
  expect(progress(list)).toEqual({ done: 1, total: 2, title: 'Doing b' })
})

test('meters run context, 5H and 7D from the engine, with reset countdowns', () => {
  const usage = toUsage({
    context: { percent: 42.6, tokens: 434_512, window: 1_000_000 },
    rateLimits: [
      { kind: 'seven_day', percentUsed: 3.5, resetsAt: '2026-10-16T02:00:00Z' },
      { kind: 'five_hour', percentUsed: 104, resetsAt: '2026-10-10T02:49:00Z' },
      { kind: 'spend_limit', percentUsed: 50 },
    ],
  })
  expect(meters(usage, NOW).map(m => [m.label, value(m), m.resetsInMs === undefined ? '-' : countdown(m.resetsInMs)])).toEqual([
    ['Context', '434.5k / 1M (43%)', '-'],
    ['5H Limit', '100%', '2h 49m'],
    ['7D All', '4%', '6d 2h'],
  ])
  expect(meters(null, NOW)).toEqual([])
  // No plan reading yet (a fresh or resumed session, or an API key): the limits are hidden.
  expect(meters({ contextPercent: 5, rateLimits: [] }, NOW).map(m => m.label)).toEqual(['Context'])
  expect(meters({ rateLimits: [{ kind: 'five_hour', percentUsed: 1, resetsAt: '2026-10-09T00:00:00Z' }] }, NOW)[0]?.resetsInMs).toBe(0)
  expect(meters({ rateLimits: [{ kind: 'five_hour', percentUsed: 1, resetsAt: 'soon' }] }, NOW)[0]?.resetsInMs).toBeUndefined()
})

test('countdowns read in minutes, hours or days', () => {
  expect([0, 59_000, 42 * 60_000, 3 * 3600_000 + 5 * 60_000, 50 * 3600_000].map(countdown)).toEqual(['0m', '1m', '42m', '3h 5m', '2d 2h'])
})

test('levels warn at 70 and alert at 90', () => {
  expect([69, 70, 89, 90].map(p => level(p))).toEqual([undefined, 'warn', 'warn', 'alert'])
})

test('blocks fill in proportion and stay in range', () => {
  expect(blocks(0.5, 4, '█', '░')).toBe('██░░')
  expect(blocks(1.7, 4, '█', '░')).toBe('████')
  expect(blocks(-1, 4, '█', '░')).toBe('░░░░')
})

test('info chips: directory, git user and branch on the left, node on the right', () => {
  expect(chips({ dir: 'claude-skins', gitUser: 'Panupat', branch: 'main', ahead: 2, behind: 1, changes: 3, node: 'v24.1.0' })).toEqual({
    left: [
      { icon: 'folder', label: 'Directory', value: 'claude-skins' },
      { icon: 'git', label: 'Git user', value: 'Panupat' },
      { icon: 'branch', label: 'Branch', value: 'main ↑2 ↓1 ±3' },
    ],
    right: [{ icon: 'node', label: 'Node', value: 'v24.1.0' }],
  })
  expect(chips({ branch: 'main', ahead: 0, behind: 0, changes: 0 })).toEqual({ left: [{ icon: 'branch', label: 'Branch', value: 'main' }], right: [] })
  expect(chips({})).toEqual({ left: [], right: [] })
})

test('Clawd’s mood follows the session, the most pressing first', () => {
  const log = { files: {}, commands: 0, failed: 0 }
  const base = { log, now: 1_000_000, isWorking: false, lastTurnAt: 1_000_000 - 1000 }
  expect(moodOf(base)).toBe('idle')
  expect(moodOf({ ...base, isWorking: true })).toBe('working')
  expect(moodOf({ ...base, lastTurnAt: base.now - SLEEP_AFTER_MS })).toBe('sleeping')
  expect(moodOf({ ...base, lastTurnAt: 0 })).toBe('idle')
  expect(moodOf({ ...base, lastTurnAt: base.now - SLEEP_AFTER_MS, isWorking: true })).toBe('working')
  expect(moodOf({ ...base, contextPercent: 90, isWorking: true })).toBe('sweating')
  expect(moodOf({ ...base, contextPercent: 89.9 })).toBe('idle')
  const passed = { ...log, test: { passed: 9, failed: 0, at: base.now - 1000 } }
  expect(moodOf({ ...base, log: passed, contextPercent: 95 })).toBe('celebrating')
  expect(moodOf({ ...base, log: { ...passed, test: { ...passed.test, at: base.now - CELEBRATE_MS } } })).toBe('idle')
  const failed = { ...log, test: { passed: 7, failed: 2, at: base.now - 60_000 } }
  expect(moodOf({ ...base, log: failed, contextPercent: 95 })).toBe('sad')
  expect(moodOf({ ...base, log: { ...failed, caught: base.now - 100 } })).toBe('startled')
  expect(moodOf({ ...base, log: { ...log, caught: base.now - STARTLE_MS } })).toBe('idle')
})

test('chips and meters follow what the person chose to show, and thresholds set the levels', () => {
  const env = { dir: 'work', gitUser: 'P', branch: 'main', node: 'v24' }
  const show = { folder: true, gitUser: false, branch: true, node: false, context: true, session: false, week: true, clawd: true }
  expect(chips(env, show).left.map(c => c.icon)).toEqual(['folder', 'branch'])
  expect(chips(env, show).right).toEqual([])
  const usage = { contextPercent: 65, contextTokens: 650, contextWindow: 1000, rateLimits: [{ kind: 'five_hour', percentUsed: 50 }, { kind: 'seven_day', percentUsed: 86 }] }
  const list = meters(usage, 0, { show, warnAt: 60, alertAt: 85 })
  expect(list.map(m => [m.kind, m.level])).toEqual([['context', 'warn'], ['week', 'alert']])
  expect(meters(usage, 0).map(m => m.level)).toEqual([undefined, undefined, 'warn'])
  expect(level(84, 60, 85)).toBe('warn')
})

test('the forecast extends the recent rate to the reset, and stays quiet without enough to go on', () => {
  const min = 60_000
  const now = 100 * min
  expect(forecastOf([], 60 * min, now)).toBeUndefined()
  expect(forecastOf([{ at: now, percent: 10 }], 60 * min, now)).toBeUndefined()
  // Under five minutes of readings.
  expect(forecastOf([{ at: now - 4 * min, percent: 10 }, { at: now, percent: 12 }], 60 * min, now)).toBeUndefined()
  // Flat.
  expect(forecastOf([{ at: now - 10 * min, percent: 20 }, { at: now, percent: 20 }], 60 * min, now)).toBeUndefined()
  // 1% a minute for 60 more minutes: 30 → 90.
  expect(forecastOf([{ at: now - 10 * min, percent: 20 }, { at: now - 5 * min, percent: 25 }, { at: now, percent: 30 }], 60 * min, now)).toBe(90)
  expect(forecastOf([{ at: now - 10 * min, percent: 20 }, { at: now, percent: 30 }], 200 * min, now)).toBe(100)
  // Only the last 30 minutes count: an old steep climb is ignored.
  expect(forecastOf([{ at: now - 90 * min, percent: 0 }, { at: now - 60 * min, percent: 20 }, { at: now - 20 * min, percent: 20 }, { at: now, percent: 21 }], 20 * min, now)).toBe(22)
  expect(forecastOf([{ at: now - 10 * min, percent: 20 }, { at: now, percent: 30 }], undefined, now)).toBeUndefined()
})

test('Clawd’s accessory follows the local date and hour, holidays first', () => {
  const at = (iso: string) => accessoryOf(new Date(iso))
  expect(at('2026-12-31T23:30:00')).toBe('newyear')
  expect(at('2027-01-01T08:00:00')).toBe('newyear')
  expect(at('2026-12-24T07:00:00')).toBe('xmas')
  expect(at('2026-10-31T12:00:00')).toBe('halloween')
  expect(at('2026-10-30T12:00:00')).toBeUndefined()
  expect(at('2027-04-13T07:00:00')).toBe('songkran')
  expect(at('2027-04-16T12:00:00')).toBeUndefined()
  expect(at('2026-10-12T06:00:00')).toBe('coffee')
  expect(at('2026-10-12T10:59:00')).toBe('coffee')
  expect(at('2026-10-12T11:00:00')).toBeUndefined()
  expect(at('2026-10-12T21:59:00')).toBeUndefined()
  expect(at('2026-10-12T22:00:00')).toBe('nightcap')
  expect(at('2026-10-13T04:59:00')).toBe('nightcap')
  expect(at('2026-10-13T05:00:00')).toBeUndefined()
})

test('raced keeps each member’s last tiles, the combo, coins and Main’s fails', () => {
  let log = EMPTY_RACE
  for (let i = 0; i < 20; i++) log = raced(log, 'main', { kind: 'read', ok: true }, i)
  expect(log.calls.main!.length).toBe(16)
  expect(log.combo).toBe(20)
  log = raced(log, 'agent-a', { kind: 'command', ok: false }, 30)
  expect(log.combo).toBe(0)
  expect(log.mainFails).toBe(0)
  expect(log.fellAt['agent-a']).toBe(30)
  log = raced(log, 'main', { kind: 'command', ok: false }, 31)
  expect(log.mainFails).toBe(1)
  log = raced(log, 'main', { kind: 'test', ok: true }, 32)
  expect([log.coins, log.scoredAt.main]).toEqual([1, 32])
  expect(log.total).toBe(23)
})

test('raceOf lays out Main and up to three agents, each in its state, and stays away when idle', () => {
  const run = (id: string, over: Partial<AgentRun> = {}): AgentRun => ({ id, agentId: id, type: 'Explore', description: id, model: 'm', status: 'running', startedAt: 0, contextTokens: 0, steps: 1, ...over })
  const now = 100_000
  expect(raceOf(EMPTY_RACE, [], undefined, now, false, 0)).toBeUndefined()
  let log = raced(EMPTY_RACE, 'b', { kind: 'command', ok: false }, now - 1000)
  log = raced(log, 'c', { kind: 'test', ok: true }, now - 1000)
  const agents = [
    run('a', { progress: { done: 3, total: 5 } }),
    run('b', { type: 'general-purpose' }),
    run('c', { type: 'Plan' }),
    run('d', { type: 'plugin:helper', status: 'done', endedAt: now - 2000 }),
    run('e', { status: 'failed', endedAt: now - 2000 }),
  ]
  const r = raceOf({ ...log, doing: { main: 'edit' } }, agents, { done: 2, total: 4, title: 't' }, now, true, now - 102_000, 'Editing svg.ts')!
  expect(r.lanes.map(l => [l.who, l.state])).toEqual([['Main', 'running'], ['Explore', 'running'], ['General', 'tripped'], ['Plan', 'scored']])
  expect(r.more).toBe(2)
  expect(r.lanes[0]).toMatchObject({ progress: 0.5, doing: 'edit', note: 'Editing svg.ts' })
  expect(r.lanes[1]!.progress).toBe(0.6)
  // No step reports and no task list: no progress, so the runner holds the middle.
  expect(r.lanes[2]!.progress).toBeUndefined()
  expect(r.elapsedMs).toBe(102_000)
  // A trip ends after 4 s.
  expect(raceOf(log, [run('b', { type: 'general-purpose' })], undefined, now + 4000, true, now - 1)!.lanes[1]!.state).toBe('running')
  // Main idle, an agent still running: the race stays, Main waits; time counts from the agent.
  const solo = raceOf(EMPTY_RACE, [run('a', { startedAt: now - 5000 })], undefined, now, false, 0)!
  expect([solo.lanes[0]!.state, solo.elapsedMs]).toEqual(['waiting', 5000])
  // Finished and out agents show their states while the race runs.
  const ends = raceOf(EMPTY_RACE, [run('d', { status: 'done', endedAt: now - 2000 }), run('e', { status: 'failed', endedAt: now - 2000 })], undefined, now, true, now - 10)!
  expect(ends.lanes.slice(1).map(l => l.state)).toEqual(['finished', 'out'])
  expect(ends.hearts).toBe(3)
})
