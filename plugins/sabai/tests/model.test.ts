import { expect, test } from 'claude-code/testing'
import type { AgentRun } from '../types'
import { raceOf } from '../hooks/agents'

import type { Task } from '../types'
import { blocks, chips, countdown, created, fromTodos, level, meters, progress, toUsage, tokens, updated, value, CELEBRATE_MS, SLEEP_AFTER_MS, STARTLE_MS, EMPTY_RACE, accessoryOf, moodLine, moodOf, raced, resetClock, trickOf, WAVE_MS, YAWN_AFTER_MS } from '../hooks/model'

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

test('raced keeps each member’s last tiles and counts the turn’s calls and failures', () => {
  let log = EMPTY_RACE
  for (let i = 0; i < 20; i++) log = raced(log, 'main', { kind: 'read', ok: true }, i)
  expect(log.calls.main).toHaveLength(16)
  log = raced(log, 'agent-a', { kind: 'command', ok: false }, 30)
  expect([log.total, log.fails, log.fellAt['agent-a']]).toEqual([21, 1, 30])
  log = raced(log, 'main', { kind: 'test', ok: true }, 32)
  expect([log.total, log.fails, log.scoredAt.main]).toEqual([22, 1, 32])
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
  expect(r.lanes.map(l => [l.who, l.state])).toEqual([['Main', 'running'], ['c', 'scored'], ['b', 'tripped'], ['a', 'running']])
  expect(r.more).toBe(2)
  expect(r.lanes[0]).toMatchObject({ progress: 0.5, doing: 'edit', step: 'Editing svg.ts' })
  expect(r.lanes[3]!.progress).toBe(0.6)
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
  expect([ends.running, ends.done]).toEqual([1, 2])
})

test('a finished agent stays in the race for the crew’s linger minute, then leaves it', () => {
  const now = 1_000_000
  const done = (endedAt: number): AgentRun => ({ id: 'd', agentId: 'd', type: 'Plan', description: 'd', model: 'm', status: 'done', startedAt: 0, endedAt, contextTokens: 0, steps: 1 })
  expect(raceOf(EMPTY_RACE, [done(now - 30_000)], undefined, now, true, now - 1)!.lanes.map(l => l.who)).toEqual(['Main', 'd'])
  expect(raceOf(EMPTY_RACE, [done(now - 61_000)], undefined, now, true, now - 1)!.lanes.map(l => l.who)).toEqual(['Main'])
})

test('raceOf runs the newest running agents first, the oldest over the cap', () => {
  // Four types, so nothing merges and the order shows.
  const types = ['Plan', 'Explore', 'general-purpose', 'x:y']
  const run = (id: string, i: number): AgentRun => ({ id, agentId: id, type: types[i]!, description: id, model: 'm', status: 'running', startedAt: 0, contextTokens: 0, steps: 1 })
  const r = raceOf(EMPTY_RACE, ['a1', 'a2', 'a3', 'a4'].map(run), undefined, 1000, true, 0)!
  expect(r.lanes.map(l => l.id)).toEqual(['main', 'a4', 'a3', 'a2'])
  expect(r.more).toBe(1)
})

test('moodLine says why Clawd feels as he does, and nothing when the fact is missing', () => {
  expect(moodLine('idle', {})).toBe('your turn')
  expect(moodLine('startled', { caught: 1 })).toBe('guard stopped 1')
  expect(moodLine('sad', { failed: 2 })).toBe('2 failed')
  expect(moodLine('celebrating', { passed: 12 })).toBe('12 passed')
  expect(moodLine('sweating', { contextPercent: 84 })).toBe('84% · compact?')
  expect(moodLine('sleeping', { idleMs: 20 * 60_000 })).toBe('idle 20m')
  expect(moodLine('sleeping', { idleMs: 135 * 60_000 })).toBe('idle 2h')
  // Review Focus 1: a missing fact leaves the line out.
  for (const mood of ['startled', 'sad', 'celebrating', 'sweating', 'sleeping'] as const) expect([mood, moodLine(mood, {})]).toEqual([mood, undefined])
  expect(moodLine('sleeping', { idleMs: Number.NaN })).toBeUndefined()
  expect(moodLine('working', { idleMs: 1 })).toBeUndefined()
})

test('trickOf: a wave after a turn, a look at the race or a high limit, a yawn when idle; moods first', () => {
  const base = { mood: 'idle' as const, now: 1_000_000, lastTurnAt: 1_000_000 - 1000, isWorking: false, raceShown: false, limitHigh: false }
  expect(trickOf(base)).toBe('wave')
  expect(trickOf({ ...base, lastTurnAt: base.now - WAVE_MS })).toBeUndefined()
  expect(trickOf({ ...base, lastTurnAt: 0 })).toBeUndefined()
  expect(trickOf({ ...base, mood: 'working', isWorking: true, raceShown: true })).toBe('look-right')
  expect(trickOf({ ...base, mood: 'working', isWorking: true, limitHigh: true })).toBe('look-up')
  expect(trickOf({ ...base, mood: 'working', isWorking: true, raceShown: true, limitHigh: true })).toBe('look-right')
  expect(trickOf({ ...base, lastTurnAt: base.now - YAWN_AFTER_MS })).toBe('yawn')
  expect(trickOf({ ...base, lastTurnAt: base.now - YAWN_AFTER_MS + 1 })).toBeUndefined()
  // A mood with its own look keeps it.
  for (const mood of ['startled', 'sad', 'celebrating', 'sweating', 'sleeping'] as const) expect([mood, trickOf({ ...base, mood })]).toEqual([mood, undefined])
})

test('raceOf merges agents of one type when more run than lanes hold, and names lanes by their task', () => {
  const run = (id: string, type: string, over: Partial<AgentRun> = {}): AgentRun => ({ id, agentId: id, type, description: `task ${id}`, model: 'm', status: 'running', startedAt: 1000, contextTokens: 0, steps: 1, ...over })
  const now = 61_000
  let log = raced(EMPTY_RACE, 'e2', { kind: 'command', ok: false }, now - 1000)
  log = raced(log, 'e3', { kind: 'read', ok: true }, now - 2000)
  const agents = [run('p1', 'Plan'), run('e1', 'Explore'), run('e2', 'Explore'), run('g1', 'general-purpose'), run('e3', 'Explore', { startedAt: 500 })]
  const r = raceOf(log, agents, undefined, now, true, now - 10_000)!
  expect(r.lanes.map(l => [l.who, l.many ?? 1])).toEqual([['Main', 1], ['Explore', 3], ['task g1', 1], ['task p1', 1]])
  const merged = r.lanes[1]!
  expect(merged).toMatchObject({ step: '3 running', state: 'tripped', calls: [{ kind: 'read', ok: true }] })
  expect(merged.progress).toBeUndefined()
  expect(merged.timeMs).toBe(now - 500)
  expect(r.more).toBe(0)
  expect(r.lanes[0]!.timeMs).toBe(10_000)
  expect([r.running, r.ok, r.fails]).toEqual([6, 1, 1])
  // Review Focus 4: four different types do not merge; the oldest goes to +1, ended lanes after.
  const four = raceOf(EMPTY_RACE, [run('a', 'Plan'), run('b', 'Explore'), run('c', 'general-purpose'), run('d', 'x:y')], undefined, now, true, now)!
  expect([four.lanes.length, four.more, four.lanes.some(l => l.many)]).toEqual([4, 1, false])
  const ended = raceOf(EMPTY_RACE, [run('a', 'Plan', { status: 'done', endedAt: now - 1000 }), run('b', 'Explore')], undefined, now, true, now)!
  expect(ended.lanes.map(l => l.who)).toEqual(['Main', 'task b', 'task a'])
  // No description: the type names the lane.
  expect(raceOf(EMPTY_RACE, [run('z', 'Explore', { description: '' })], undefined, now, true, now)!.lanes[1]!.who).toBe('Explore')
})

test('resetClock names the reset as a local time, with the weekday past today, and nothing without one', () => {
  const now = new Date('2026-10-11T13:00:00').getTime()
  expect(resetClock(90 * 60_000, now)).toBe('resets 14:30')
  // Review Focus 3: past midnight the weekday shows; none without a reset.
  expect(resetClock(12 * 3_600_000, now)).toBe('resets Mon 01:00')
  expect(resetClock(undefined, now)).toBeUndefined()
})

test('the context meter says what is left', () => {
  const [ctx] = meters({ contextPercent: 74, contextTokens: 743_500, contextWindow: 1_000_000, rateLimits: [] }, 0)
  expect(ctx!.left).toBe('256.5k left')
})
