import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { RESULT_MAX, reported, typeEmoji, clock, effortLabel, elapsed, finished, modelName, resultText, spawned, stepped, summary, taskLine, typeStyle, withTasks } from '../hooks/agents'
import { emptyAgentsSvg } from '../hooks/svg'

const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id,
  agentId: id,
  type: 'Explore',
  description: `task ${id}`,
  model: 'claude-sonnet-5-5',
  status: 'running',
  startedAt: 1000,
  contextTokens: 0,
  requests: 0,
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
  expect([list[0]?.requests, list[0]?.contextTokens, list[0]?.model]).toEqual([2, 42_100, 'claude-opus-5-5'])
  expect(stepped(list, 'nobody', 'x', USAGE)).toEqual(list)
  expect(finished(list, 'a', 'answer', 5000)[0]).toMatchObject({ status: 'done', endedAt: 5000 })
  expect(finished(list, 'a', 'error', 5000)[0]?.status).toBe('failed')
  // A call still in flight when the agent ends is over too: nothing shows it running.
  const busy = list.map(a => ({ ...a, doing: [{ kind: 'read' as const, title: 'Read', target: 'a.ts' }] }))
  expect(finished(busy, 'a', 'answer', 5000)[0]?.doing).toBeUndefined()
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

test('effort and type give a label, a hat and a colour; unknown ones fall back', () => {
  // Claude's own effort levels as written; a number is a thinking budget in tokens.
  expect(['low', 'medium', 'high', 'xhigh', 'max', '32000', 'ultracode', undefined].map(effortLabel)).toEqual([
    'low', 'medium', 'high', 'xhigh', 'max', 'budget 32k', undefined, undefined,
  ])
  expect(typeStyle('Explore')).toEqual({ hat: 'explorer', accent: 'context' })
  expect(typeStyle('Plan')).toEqual({ hat: 'hardhat', accent: 'session' })
  expect(typeStyle('general-purpose')).toEqual({ hat: 'cap', accent: 'tasks' })
  expect(typeStyle('claude-code-guide')).toEqual({ hat: 'grad', accent: 'week' })
  expect(typeStyle('statusline-setup')).toEqual({ hat: 'beret', accent: 'week' })
  expect(typeStyle('fork')).toEqual({ hat: 'bandana', accent: 'tasks' })
  expect(typeStyle('teammate')).toEqual({ hat: 'headset', accent: 'context' })
  // A colon names a plugin's agent.
  expect(typeStyle('lab:runner')).toEqual({ hat: 'tophat', accent: 'session' })
  expect(typeStyle('my-reviewer')).toEqual({ hat: 'beanie' })
  // Type names are user-defined: inherited object keys are not types.
  expect(typeStyle('constructor')).toEqual({ hat: 'beanie' })
  // Each type's title mark matches its hat; plugins get the top hat, the rest a cup.
  expect(['Explore', 'Plan', 'general-purpose', 'claude-code-guide', 'statusline-setup', 'fork', 'teammate', 'lab:runner', 'my-reviewer', 'constructor'].map(typeEmoji)).toEqual([
    '🔍', '📐', '🔧', '🎓', '🎨', '🍴', '🎧', '🎩', '☕', '☕',
  ])
  expect(effortLabel('toString')).toBeUndefined()
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
  expect(resultText(run('e', { status: 'failed', reason: 'refusal' }))).toBe('Declined the work.')
  expect(resultText(run('f', { status: 'failed', reason: 'error' }))).toBe('Ended with an error.')
  expect(resultText(run('g', { status: 'done', reason: 'answer', result: 'Found 3.' }))).toBe('Found 3.')
})

test('the summary counts agents, sums context and spans the wall time; Clear keeps running ones', () => {
  const list = [
    run('a', { status: 'done', startedAt: 1000, endedAt: 9000, contextTokens: 40_000 }),
    run('b', { startedAt: 3000, contextTokens: 2_000 }),
  ]
  expect(summary(list, 21_000)).toEqual({ running: 1, done: 1, failed: 0, context: 42_000, ms: 20_000 })
  // A failed run is counted as failed, not done, as the band counts it.
  expect(summary([...list, { ...list[0]!, id: 'f', status: 'failed', endedAt: 9000 }], 21_000)).toMatchObject({ running: 1, done: 1, failed: 1 })
  expect(summary([list[0]!], 21_000).ms).toBe(8000)
  expect(summary([], 21_000)).toEqual({ running: 0, done: 0, failed: 0, context: 0, ms: 0 })
})

test('a finished agent sent more work runs again, its report kept as an earlier round', () => {
  const [done] = finished([run('a')], 'a', 'answer', 9000, 'first report')
  const [again] = stepped([{ ...done!, summary: ['สรุป'] }], 'a', 'claude-opus-5-5', USAGE)
  expect([again?.status, again?.endedAt, again?.result, again?.reason, again?.summary]).toEqual(['running', undefined, undefined, undefined, undefined])
  expect(again?.rounds).toEqual([{ result: 'first report', reason: 'answer', summary: ['สรุป'] }])
  // It joins the crew at work, unless it belongs to a workflow, which wakes its own agents.
  expect(stepped([done!], 'a', '', USAGE, undefined, 9500, 'turn:2')[0]?.crew).toBe('turn:2')
  const [woken] = finished([run('w', { crew: 'wf:r1' })], 'w', 'answer', 9000, 'report')
  expect(stepped([woken!], 'w', '', USAGE, undefined, 9500, 'turn:2')[0]?.crew).toBe('wf:r1')
})

test('the empty drawing invites a first agent', () => {
  expect(emptyAgentsSvg(420).source).toContain('No subagents yet')
})

test('a step note and a report are cut between code points, never inside an emoji', () => {
  const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
  const run: AgentRun = { id: 'a', agentId: 'a', type: 'Plan', description: 'a', model: 'm', status: 'running', startedAt: 0, contextTokens: 0, requests: 0 }
  const note = reported([run], 'a', { done: 1, total: 2, note: `${'x'.repeat(79)}🐢🐢` })[0]!.progress!.note!
  expect([lone.test(note), Array.from(note).length, note.endsWith('🐢')]).toEqual([false, 80, true])
  const result = finished([run], 'a', 'answer', 1, `${'x'.repeat(RESULT_MAX - 2)}🐢🐢🐢`)[0]!.result!
  expect([lone.test(result), result.endsWith('🐢…')]).toEqual([false, true])
})
