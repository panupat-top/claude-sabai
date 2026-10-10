import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { clock, elapsed, finished, groups, modelName, spawned, stepped } from '../hooks/agents'
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
  expect(finished(list, 'a', true, 5000)[0]).toMatchObject({ status: 'done', endedAt: 5000 })
  expect(finished(list, 'a', false, 5000)[0]?.status).toBe('failed')
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

test('with no runs the pane says so; a skin frames it', () => {
  expect(agentsSvg([], [], 600, 0).alt).toBe('No subagents yet')
  expect(agentsSvg([], [], 600, 0).source).toContain('No subagents yet. They show here while they work.')
  expect(agentsSvg([run('a')], [], 600, 0, 'nord').source).toContain('rx="10" fill="#2e3440"')
})
