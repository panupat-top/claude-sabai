import { expect, test } from 'claude-code/testing'

import type { Task } from '../types'
import { blocks, chips, countdown, created, fromTodos, level, meters, progress, toUsage, tokens, updated, value } from '../hooks/model'

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
  expect([69, 70, 89, 90].map(level)).toEqual([undefined, 'warn', 'warn', 'alert'])
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
