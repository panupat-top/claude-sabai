import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { RESULT_MAX, clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, resultText, spawned, stepped, summary, taskLine, typeStyle, withTasks } from '../hooks/agents'
import { agentsSvg } from '../hooks/svg'

const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id,
  agentId: id,
  type: 'Explore',
  description: `task ${id}`,
  model: 'claude-sonnet-5-5',
  status: 'running',
  startedAt: 1000,
  contextTokens: 0,
  steps: 0,
  ...extra,
})
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 900 }

test('model ids read as family and version', () => {
  expect(['claude-opus-5-5', 'claude-sonnet-4-5-20250929', 'claude-haiku-5', 'gpt-x', 'opus'].map(modelName)).toEqual([
    'opus 5.5', 'sonnet 4.5', 'haiku 5', 'gpt-x', 'opus',
  ])
})

test('a run is added once, steps count up with the latest context, and it ends done or failed', () => {
  let list = spawned([], run('a'))
  list = spawned(list, run('a', { description: 'again' }))
  expect(list.map(a => a.description)).toEqual(['again'])
  list = stepped(list, 'a', 'claude-opus-5-5', USAGE)
  list = stepped(list, 'a', '', USAGE)
  expect([list[0]?.steps, list[0]?.contextTokens, list[0]?.model]).toEqual([2, 42_100, 'claude-opus-5-5'])
  expect(stepped(list, 'nobody', 'x', USAGE)).toEqual(list)
  expect(finished(list, 'a', 'answer', 5000)[0]).toMatchObject({ status: 'done', endedAt: 5000 })
  expect(finished(list, 'a', 'error', 5000)[0]?.status).toBe('failed')
})

test('the pane keeps the newest forty runs', () => {
  let list: AgentRun[] = []
  for (let i = 0; i < 45; i++) list = spawned(list, run(String(i)))
  expect([list.length, list[0]?.id, list.at(-1)?.id]).toEqual([40, '5', '44'])
})

test('elapsed time runs until the end, read as s, m s or h m', () => {
  expect(elapsed(run('a'), 65_000)).toBe(64_000)
  expect(elapsed(run('a', { endedAt: 23_000 }), 99_000)).toBe(22_000)
  expect([4_900, 64_000, 3_720_000].map(clock)).toEqual(['4s', '1m 4s', '1h 2m'])
})

test('running runs come first, each group newest first', () => {
  const g = groups([run('a', { status: 'done' }), run('b'), run('c', { status: 'failed' }), run('d')])
  expect([g.running.map(a => a.id), g.finished.map(a => a.id)]).toEqual([['d', 'b'], ['c', 'a']])
})

test('the pane draws a card per run under its heading; finished runs fade, failed ones are marked', () => {
  const d = agentsSvg([run('r', { steps: 12, contextTokens: 42_100 })], [run('ok', { status: 'done', endedAt: 42_000 }), run('bad', { status: 'failed', endedAt: 2000 })], 600, 65_000)
  expect(d.source).toContain('>RUNNING · 1<')
  expect(d.source).toContain('>DONE · 2<')
  expect(d.source).toContain('sonnet 5.5 · 12 steps · 42.1k ctx')
  expect(d.source).toContain('class="live"')
  expect(d.source.match(/<g opacity="\.6">/g)?.length).toBe(2)
  expect(d.source).toContain('class="c-alert"')
  expect(d.source.match(/class="run"/g)?.length).toBe(1)
  expect(d.height).toBe(16 + 44 + 8 + 16 + 44 + 8 + 44)
  expect(d.alt).toBe('task r: Explore, sonnet 5.5, running, 1m 4s; task ok: Explore, sonnet 5.5, done, 41s; task bad: Explore, sonnet 5.5, failed, 1s')
})

test('with no runs the pane says so; a skin colours its cards, no background', () => {
  expect(agentsSvg([], [], 600, 0).alt).toBe('No subagents yet')
  expect(agentsSvg([], [], 600, 0).source).toContain('No subagents yet. They show here while they work.')
  const nord = agentsSvg([run('a')], [], 600, 0, 'nord').source
  expect(nord).toContain('.p{fill:#3b4252}')
  expect(nord).not.toContain('rx="10" fill=')
})

test('effort and type give a label, a hat and a colour; unknown ones fall back', () => {
  expect(['low', 'medium', 'high', 'xhigh', 'max', '7', undefined].map(effortLabel)).toEqual(['quick', 'steady', 'careful', 'deep', 'deep', undefined, undefined])
  expect(typeStyle('Explore')).toEqual({ hat: 'explorer', accent: 'context' })
  expect(typeStyle('Plan')).toEqual({ hat: 'hardhat', accent: 'session' })
  expect(typeStyle('general-purpose')).toEqual({ hat: 'cap', accent: 'tasks' })
  expect(typeStyle('claude-code-guide')).toEqual({ hat: 'grad', accent: 'week' })
  expect(typeStyle('my-reviewer')).toEqual({ hat: 'beanie' })
})

test('a step records effort; an agent keeps its own task list and line', () => {
  let list = stepped([run('a')], 'a', 'claude-opus-5-5', USAGE, 'high')
  expect(list[0]?.effort).toBe('high')
  list = stepped(list, 'a', '', USAGE)
  expect(list[0]?.effort).toBe('high')
  list = withTasks(list, 'a', () => [
    { id: '1', subject: 'Draft', status: 'completed' },
    { id: '2', subject: 'Hero copy', activeForm: 'Writing hero copy', status: 'in_progress' },
    { id: '3', subject: 'Polish', status: 'pending' },
  ])
  expect(taskLine(list[0]?.tasks)).toEqual({ done: 1, total: 3, title: 'Writing hero copy' })
  expect(taskLine([{ id: '1', subject: 'x', status: 'completed' }])).toEqual({ done: 1, total: 1, title: 'Done' })
  expect(taskLine(undefined)).toBeUndefined()
})

test('a finished run keeps its reason and a cut answer; Result text never comes out empty', () => {
  const long = 'x'.repeat(5000)
  const [done] = finished([run('a')], 'a', 'answer', 9000, long)
  expect([done?.status, done?.reason, done?.result?.length]).toEqual(['done', 'answer', RESULT_MAX])
  expect(done?.result?.endsWith('…')).toBe(true)
  expect(finished([run('b')], 'b', 'refusal', 9000)[0]?.status).toBe('failed')
  expect(resultText(run('c', { status: 'done', reason: 'answer' }))).toBe('No report.')
  expect(resultText(run('d', { status: 'failed', reason: 'aborted' }))).toBe('Stopped before it finished.')
  expect(resultText(run('e', { status: 'failed', reason: 'refusal' }))).toBe('Declined the task.')
  expect(resultText(run('f', { status: 'failed', reason: 'error' }))).toBe('Ended with an error.')
  expect(resultText(run('g', { status: 'done', reason: 'answer', result: 'Found 3.' }))).toBe('Found 3.')
})

test('the summary counts agents, sums context and spans the wall time; Clear keeps running ones', () => {
  const list = [
    run('a', { status: 'done', startedAt: 1000, endedAt: 9000, contextTokens: 40_000 }),
    run('b', { startedAt: 3000, contextTokens: 2_000 }),
  ]
  expect(summary(list, 21_000)).toEqual({ running: 1, done: 1, context: 42_000, ms: 20_000 })
  expect(summary([list[0]!], 21_000).ms).toBe(8000)
  expect(summary([], 21_000)).toEqual({ running: 0, done: 0, context: 0, ms: 0 })
  expect(clearFinished(list).map(a => a.id)).toEqual(['b'])
})
