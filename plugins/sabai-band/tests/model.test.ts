import { expect, test } from 'claude-code/testing'

import type { Task } from '../types'
import { blocks, chips, countdown, created, fromTodos, level, meters, parseCache, progress, toUsage, tokens, updated, value } from '../hooks/model'

const NOW = Date.parse('2026-10-10T00:00:00Z')

test('tasks follow TaskCreate and TaskUpdate', () => {
  let list: Task[] = []
  list = created(list, '1', 'Write tests', 'Writing tests')
  list = created(list, '2', 'Ship')
  expect(progress(list)).toEqual({ done: 0, total: 2, title: 'Write tests', isRunning: false })
  list = updated(list, { taskId: '1', status: 'in_progress' })
  expect(progress(list)).toEqual({ done: 0, total: 2, title: 'Writing tests', isRunning: true })
  list = updated(list, { taskId: '1', status: 'completed' })
  expect(progress(list)).toEqual({ done: 1, total: 2, title: 'Ship', isRunning: false })
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
  expect(progress(list)).toEqual({ done: 1, total: 2, title: 'Doing b', isRunning: true })
})

test('meters run context, 5H, 7D All, then the scoped week, with reset countdowns', () => {
  const usage = toUsage({
    context: { percent: 42.6, tokens: 434_512, window: 1_000_000 },
    rateLimits: [
      { kind: 'seven_day', percentUsed: 3.5, resetsAt: '2026-10-16T02:00:00Z' },
      { kind: 'five_hour', percentUsed: 104, resetsAt: '2026-10-10T02:49:00Z' },
      { kind: 'spend_limit', percentUsed: 50 },
    ],
  })
  const cache = { session: { percent: 99 }, week: { percent: 99 }, scoped: { name: 'Fable', percent: 0, resetsAt: 'not a date' } }
  const list = meters(usage, cache, NOW)
  expect(list.map(m => [m.label, value(m), m.resetsInMs === undefined ? '-' : countdown(m.resetsInMs)])).toEqual([
    ['Context', '434.5k / 1M (43%)', '-'],
    ['5H Limit', '100%', '2h 49m'],
    ['7D All', '4%', '6d 2h'],
    ['7D Fable', '0%', '-'],
  ])
  expect(meters(null, {}, NOW)).toEqual([])
  expect(meters({ rateLimits: [{ kind: 'five_hour', percentUsed: 1, resetsAt: '2026-10-09T00:00:00Z' }] }, {}, NOW)[0]?.resetsInMs).toBe(0)
  // Before the engine's first reading, the cache stands in for 5H and 7D.
  expect(meters({ contextPercent: 5, rateLimits: [] }, cache, NOW).map(m => [m.label, m.percent])).toEqual([
    ['Context', 5],
    ['5H Limit', 99],
    ['7D All', 99],
    ['7D Fable', 0],
  ])
})

test('the statusline cache gives 5H, 7D All and the scoped week, or nothing', () => {
  const text = JSON.stringify({
    limits: [
      { kind: 'session', percent: 7, resets_at: '2026-10-09T23:10:00Z' },
      { kind: 'weekly_all', percent: 3 },
      { kind: 'weekly_scoped', percent: 12, resets_at: '2026-10-15T21:00:00+00:00', scope: { model: { display_name: 'Fable' } } },
    ],
  })
  expect(parseCache(text)).toEqual({
    session: { percent: 7, resetsAt: '2026-10-09T23:10:00Z' },
    week: { percent: 3, resetsAt: undefined },
    scoped: { name: 'Fable', percent: 12, resetsAt: '2026-10-15T21:00:00+00:00' },
  })
  expect(parseCache(JSON.stringify({ limits: [{ kind: 'weekly_scoped', percent: 1 }] })).scoped?.name).toBe('Model')
  expect(parseCache('{"limits":[]}')).toEqual({ session: undefined, week: undefined, scoped: undefined })
  expect(parseCache('not json')).toEqual({})
})

test('token counts read as k and M', () => {
  expect([0, 999, 1000, 24_500, 200_000, 434_512, 1_000_000, 1_250_000].map(tokens)).toEqual([
    '0', '999', '1k', '24.5k', '200k', '434.5k', '1M', '1.3M',
  ])
  expect(value({ kind: 'context', label: 'Context', percent: 43 })).toBe('43%')
})

test('countdowns read in minutes, hours or days', () => {
  expect([0, 59_000, 42 * 60_000, 3 * 3600_000 + 5 * 60_000, 50 * 3600_000].map(countdown)).toEqual(['0m', '1m', '42m', '3h 5m', '2d 2h'])
})

test('levels warn at 70 and alert at 90', () => {
  expect([69, 70, 89, 90].map(level)).toEqual([undefined, 'warn', 'warn', 'alert'])
})

test('blocks fill in proportion and stay in range', () => {
  expect(blocks(0.5, 4, '█', '░')).toBe('██░░')
  expect(blocks(1.7, 4, '█', '░')).toBe('████')
  expect(blocks(-1, 4, '█', '░')).toBe('░░░░')
})

test('info chips: directory, git user and branch on the left, node on the right', () => {
  expect(chips({ dir: 'claude-skins', gitUser: 'Panupat', branch: 'main', changes: 3, node: 'v24.1.0' })).toEqual({
    left: [
      { icon: 'folder', label: 'Directory', value: 'claude-skins' },
      { icon: 'git', label: 'Git user', value: 'Panupat' },
      { icon: 'branch', label: 'Branch', value: 'main ±3' },
    ],
    right: [{ icon: 'node', label: 'Node', value: 'v24.1.0' }],
  })
  expect(chips({ branch: 'main', changes: 0 })).toEqual({ left: [{ icon: 'branch', label: 'Branch', value: 'main' }], right: [] })
  expect(chips({})).toEqual({ left: [], right: [] })
})
