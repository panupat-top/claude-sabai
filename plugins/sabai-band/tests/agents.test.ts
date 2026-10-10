import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { RESULT_MAX, clearFinished, clock, effortLabel, elapsed, finished, groups, modelName, resultText, spawned, stepped, summary, taskLine, typeStyle, withTasks } from '../hooks/agents'
import { agentCardSvg, emptyAgentsSvg, summarySvg } from '../hooks/svg'

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

test('a card shows hat, task, clock, effort · type · model, own progress and context', () => {
  const a = run('a', {
    type: 'Plan', effort: 'medium', contextTokens: 39_000, steps: 9,
    tasks: [{ id: '1', subject: 'a', status: 'completed' }, { id: '2', subject: 'Draw', activeForm: 'Drawing', status: 'in_progress' }],
  })
  const d = agentCardSvg(a, 420, 19_000, 'dracula', 'blocks')
  expect(d.height).toBe(64)
  expect(d.source).toContain('>task a<')
  expect(d.source).toContain('>steady<')
  expect(d.source).toContain('Plan · sonnet 5.5')
  expect(d.source).toContain('1/2 · Drawing')
  expect(d.source).toContain('39k ctx')
  expect(d.source).toContain('class="run"')
  expect(d.source).toContain('fill="#bd93f9"')
  expect(d.alt).toBe('task a: Plan, sonnet 5.5, running, 18s')
})

test('without tasks a card counts steps; it hops just after finishing, shuts its eyes on failure', () => {
  const plain = agentCardSvg(run('b', { steps: 14 }), 420, 5000)
  expect(plain.source).toContain('>14 steps<')
  expect(plain.source).not.toContain('steady')
  expect(agentCardSvg(run('c', { status: 'done', endedAt: 4000 }), 420, 5000).source).toContain('class="hop"')
  expect(agentCardSvg(run('c', { status: 'done', endedAt: 4000 }), 420, 60_000).source).toContain('class="idle"')
  expect(agentCardSvg(run('d', { status: 'failed', endedAt: 4000 }), 420, 5000).source).toContain('class="dizzy"')
})

test('the summary reads agents, context and time; the empty drawing invites a first agent', () => {
  const s = summarySvg([run('a', { status: 'done', endedAt: 9000, contextTokens: 40_000 }), run('b', { contextTokens: 2000 })], 420, 21_000)
  expect(s.source).toContain('>1 running · 1 done<')
  expect(s.source).toContain('>42k<')
  expect(s.source).toContain('>20s<')
  expect(emptyAgentsSvg(420).source).toContain('No subagents yet')
})
