import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import {
  CALLS_KEPT, CREWS_KEPT, QUIET_MS, agentMood, dayOf, needsLook, called, calling, clearEarlier, crewsOf, factsLine, filesOf, openCrews, reported, spawned, stepped,
  summaryOf, summaryPrompt, thaiLine, toolsOf, touched,
} from '../hooks/agents'
import { actOf } from '../hooks/chat'
import { activitySvg, agentHeadSvg, crewSvg, earlierSvg, filesSvg, laneSvg, stepsSvg, toolsSvg } from '../hooks/svg'

const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id, agentId: id, type: 'Explore', description: `task ${id}`, model: 'claude-haiku-4-5', status: 'running', startedAt: 1000, contextTokens: 0, steps: 0, lastActiveAt: 1000, ...extra,
})
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 900 }
const READ = actOf('Read', { file_path: '/p/hooks/svg.ts' })
const GREP = actOf('Grep', { pattern: 'on\\(', path: '/p/hooks' })

test('a call is named for the pane by its tool: files, commands, patterns, skills and MCP tools', () => {
  expect(READ).toEqual({ kind: 'read', title: 'Read svg.ts', target: 'svg.ts', key: 'Read' })
  expect(GREP).toMatchObject({ kind: 'search', title: 'Grep on\\( · hooks', key: 'Grep' })
  expect(actOf('Bash', { command: 'cd /p && bun test' })).toMatchObject({ kind: 'test', title: '$ bun test' })
  expect(actOf('Bash', { command: 'ls -la' })).toMatchObject({ kind: 'command', target: 'ls -la' })
  expect(actOf('Skill', { skill: 'superpowers:brainstorming' })).toMatchObject({ kind: 'skill', key: 'skill:superpowers:brainstorming' })
  expect(actOf('mcp__context7__query-docs', {})).toMatchObject({ kind: 'mcp', title: 'context7 · query-docs', key: 'mcp__context7__query-docs' })
  expect(actOf('WebFetch', { url: 'https://example.com/a/b' })).toMatchObject({ kind: 'web', title: 'Fetch example.com' })
  expect(actOf('ToolSearch', {})).toMatchObject({ kind: 'other', title: 'ToolSearch' })
})

test('a call is in flight until it ends; a refused or lost one is not logged, a failed one is counted', () => {
  let list = calling([run('a')], 'a', READ, 2000)
  list = calling(list, 'a', GREP, 2100)
  expect(list[0]!.doing!.map(d => d.kind)).toEqual(['read', 'search'])
  expect(list[0]!.tools).toEqual({ Read: 1, Grep: 1 })
  list = called(list, 'a', READ, 2500, 500, true)
  list = called(list, 'a', GREP, 2600, 500, undefined)
  expect([list[0]!.doing, list[0]!.callCount, list[0]!.callFails, list[0]!.lastActiveAt]).toEqual([[], 1, 0, 2600])
  list = called(calling(list, 'a', READ, 3000), 'a', READ, 3100, 100, false)
  expect([list[0]!.callCount, list[0]!.callFails, list[0]!.calls!.map(c => c.ok)]).toEqual([2, 1, [true, false]])
  for (let i = 0; i < 70; i++) list = called(calling(list, 'a', READ, 4000), 'a', READ, 4000, 1, true)
  expect([list[0]!.calls!.length, list[0]!.callCount]).toEqual([CALLS_KEPT, 72])
})

test('files: changed ones first by lines, a new file marked, read-only ones by reads; tools in three groups', () => {
  let list = touched([run('a')], 'a', 'hooks/svg.ts', { read: true })
  list = touched(list, 'a', 'hooks/svg.ts', { read: true })
  list = touched(list, 'a', 'docs/PLAN.md', { read: true })
  list = touched(list, 'a', 'hooks/agents.ts', { added: 12, removed: 3 })
  list = touched(list, 'a', 'tests/new.test.ts', { added: 38, removed: 0, created: true })
  expect(filesOf(list[0]!).map(f => f.path)).toEqual(['tests/new.test.ts', 'hooks/agents.ts', 'hooks/svg.ts', 'docs/PLAN.md'])
  expect(list[0]!.files!['tests/new.test.ts']).toEqual({ reads: 0, edits: 1, added: 38, removed: 0, created: true })
  // Past the cap, the files only read go first; the changed ones stay.
  for (let i = 0; i < 45; i++) list = touched(list, 'a', `src/read-${i}.ts`, { read: true })
  expect(Object.keys(list[0]!.files!)).toHaveLength(40)
  expect(['hooks/agents.ts', 'tests/new.test.ts', 'src/read-44.ts'].every(k => k in list[0]!.files!)).toBe(true)
  const tools = toolsOf(run('t', { tools: { Read: 2, 'skill:superpowers:brainstorming': 1, mcp__sabai__step: 4, Grep: 3 } }))
  expect(tools).toEqual({ builtin: [['Grep', 3], ['Read', 2]], skills: [['superpowers:brainstorming', 1]], mcp: [['sabai · step', 4]] })
})

test('a request adds its new tokens, not its cache reads, to what the run spent; a resumed run moves to the end in the crew at work', () => {
  let list = stepped([run('a', { crew: 'turn:1' }), run('b', { crew: 'turn:1' })], 'a', '', USAGE, undefined, 5000)
  list = stepped(list, 'a', '', USAGE)
  expect([list[0]!.spent, list[0]!.contextTokens, list[0]!.lastActiveAt]).toEqual([4200, 42_100, 5000])
  list = [{ ...list[0]!, status: 'done', endedAt: 6000, result: 'r' }, list[1]!]
  list = stepped(list, 'a', '', USAGE, undefined, 9000, 'turn:8000')
  expect(list.map(a => [a.id, a.crew, a.status])).toEqual([['b', 'turn:1', 'running'], ['a', 'turn:8000', 'running']])
})

test('step notes are kept in order, a repeat once', () => {
  let list = reported([run('a')], 'a', { done: 0, total: 3, note: 'reading' })
  list = reported(list, 'a', { done: 0, total: 3, note: 'reading' })
  list = reported(list, 'a', { done: 1, total: 3, note: 'writing' })
  expect(list[0]!.notes).toEqual(['reading', 'writing'])
})

test('crews: the newest five are kept with any still at work, the newest and those at work shown in full', () => {
  let list: AgentRun[] = []
  for (let i = 0; i < 7; i++) list = spawned(list, run(`a${i}`, { crew: `turn:${i}`, status: i === 0 ? 'running' : 'done', endedAt: 2000 }))
  // turn:0 still runs, so it stays though older than the five newest.
  expect(crewsOf(list).map(c => c.id)).toEqual(['turn:6', 'turn:5', 'turn:4', 'turn:3', 'turn:2', 'turn:0'])
  expect(crewsOf(list).length).toBe(CREWS_KEPT + 1)
  const { now, earlier } = openCrews(crewsOf(list))
  expect([now.map(c => c.id), earlier.length]).toEqual([['turn:6', 'turn:0'], CREWS_KEPT - 2])
  expect(clearEarlier(list, new Set(now.map(c => c.id))).map(a => a.id)).toEqual(['a0', 'a6'])
})

test('moods: at work, thinking, quiet, context nearly full, failed, stopped and done', () => {
  const at = 100_000
  expect(agentMood(run('a', { doing: [{ kind: 'read', title: 'Read x', target: 'x' }] }), at)).toBe('working')
  expect(agentMood(run('a', { lastActiveAt: at - 5000 }), at)).toBe('thinking')
  expect(agentMood(run('a', { lastActiveAt: at - QUIET_MS }), at)).toBe('quiet')
  expect(agentMood(run('a', { contextTokens: 170_000, lastActiveAt: at }), at, 200_000)).toBe('context')
  // The window unknown, nothing is said of the context.
  expect(agentMood(run('a', { contextTokens: 170_000, lastActiveAt: at }), at)).toBe('thinking')
  expect(agentMood(run('a', { status: 'failed', reason: 'error' }), at)).toBe('failed')
  expect(agentMood(run('a', { status: 'failed', reason: 'aborted' }), at)).toBe('stopped')
  expect(agentMood(run('a', { status: 'done' }), at)).toBe('done')
})

test('Thai lines carry the real numbers, stay put between redraws, and name a round', () => {
  const at = 100_000
  expect(thaiLine(run('a', { doing: [{ kind: 'read', title: 'Read svg.ts', target: 'svg.ts' }] }), at)).toBe('กำลังอ่าน svg.ts 📖')
  expect(thaiLine(run('a', { lastActiveAt: at - 45_000 }), at)).toContain('45 วิ')
  expect(thaiLine(run('a', { contextTokens: 172_000, lastActiveAt: at }), at, 200_000)).toContain('86%')
  expect(thaiLine(run('a', { status: 'failed', reason: 'aborted', progress: { done: 2, total: 3 } }), at)).toBe('หยุดตามที่สั่ง ✋ ทำไป 2/3 ขั้น')
  expect(thaiLine(run('a', { status: 'done', startedAt: 0, endedAt: 16_000 }), at)).toContain('0:16')
  expect(thaiLine(run('a', { status: 'done', summary: 'pending', endedAt: 9000 }), at)).toContain('กำลังสรุป')
  expect(thaiLine(run('a', { rounds: [{}], doing: [{ kind: 'edit', title: 'Edit x', target: 'x' }] }), at)).toBe('รอบ 2 · กำลังแก้ x ✍️')
  const quiet = run('q', { lastActiveAt: at - 40_000 })
  expect(thaiLine(quiet, at)).toBe(thaiLine(quiet, at + 1000).replace('41', '40'))
})

test('an agent needs a look when quiet, then when its context is nearly full; Main is never quiet', () => {
  const at = 200_000
  const list = [run('quiet', { lastActiveAt: at - 60_000 }), run('full', { contextTokens: 170_000, lastActiveAt: at }), run('ok', { lastActiveAt: at })]
  expect(needsLook(list, at, () => 200_000)?.id).toBe('quiet')
  expect(needsLook(list.slice(1), at, () => 200_000)?.id).toBe('full')
  expect(needsLook(list.slice(2), at)).toBeUndefined()
  expect(agentMood(run('m', { type: 'main', lastActiveAt: at - 60_000 }), at)).toBe('thinking')
})

test('the summary asks Haiku with the report and files, and reads its bullets back', () => {
  const a = run('a', { status: 'done', result: 'Found 30 hooks.', files: { 'hooks/x.ts': { reads: 0, edits: 1, added: 3, removed: 1 } }, callCount: 4, callFails: 1 })
  const prompt = summaryPrompt(a)
  expect(prompt).toContain('Found 30 hooks.')
  expect(prompt).toContain('hooks/x.ts (+3 −1)')
  expect(summaryOf('Here:\n- นับ hook ได้ 30 จุด\n• แก้ `x.ts`\nend')).toEqual(['นับ hook ได้ 30 จุด', 'แก้ `x.ts`'])
  expect(summaryOf('no bullets')).toBeUndefined()
  expect(factsLine({ ...a, startedAt: 0, endedAt: 27_000, spent: 49_400 }, 0)).toBe('อ่าน 0 ไฟล์ · แก้ 1 ไฟล์ · 4 calls (พลาด 1) · 27s · 49.4k tokens')
})

const busy = (id: string, extra: Partial<AgentRun> = {}) =>
  run(id, {
    callCount: 9, callFails: 1, spent: 51_000, contextTokens: 31_000, progress: { done: 2, total: 3, note: 'reading bandSvg' }, notes: ['scanning', 'reading bandSvg'],
    calls: [{ kind: 'search', title: 'Grep x', ok: true, ms: 300 }, { kind: 'command', title: '$ ls /nope', ok: false, ms: 20 }],
    doing: [{ kind: 'read', title: 'Read svg.ts', target: 'svg.ts' }],
    tools: { Grep: 1, Bash: 1, Read: 1, 'skill:superpowers:brainstorming': 1, mcp__sabai__step: 3 },
    files: { 'hooks/svg.ts': { reads: 2, edits: 0, added: 0, removed: 0 }, 'tests/n.test.ts': { reads: 0, edits: 1, added: 38, removed: 0, created: true } },
    ...extra,
  })

test('the overview heads the crew, a Clawd per agent in his mood, and four tiles', () => {
  const list = [busy('a'), busy('b', { status: 'done', endedAt: 20_000 }), busy('c', { status: 'failed', reason: 'aborted', endedAt: 20_000 })]
  const d = crewSvg(list, 530, 30_000)
  expect(d.source).toContain('>3 agents<')
  expect(d.source).toContain('>1 running · 1 done · 1 stopped<')
  expect(d.source).toContain('>27<')
  expect(d.source).toContain('>153k<')
  expect(d.source).not.toContain('>FILES<')
  expect(d.source).toContain('class="run"')
  expect(d.source).toContain('.run g.la{')
  const all = crewSvg(list.slice(1), 530, 90_000)
  expect(all.source).toContain('>Crew finished · 19s<')
  // Nothing moves once the crew has settled.
  expect(all.source).not.toContain('@keyframes')
  // A very narrow pane stacks the tiles.
  expect(crewSvg(list, 260, 30_000).height).toBeGreaterThan(d.height)
})

test('a lane says its Thai line, is marked by a bar and a bold title when viewed, and is still once settled', () => {
  const lane = laneSvg(busy('a'), 454, 30_000, 'raised', undefined, true)
  expect(lane.source).toContain('กำลังอ่าน svg.ts')
  expect(lane.source).toContain('<rect width="4" height="42" rx="2"')
  expect(lane.source).toContain('font-weight="800"')
  expect(lane.source).toContain('>2/3<')
  const quiet = laneSvg(busy('q', { doing: [], lastActiveAt: 0 }), 454, 60_000)
  expect(quiet.source).toMatch(/class="c-warn"[^>]*>เงียบไป 60 วิ/)
  expect(laneSvg(busy('d', { status: 'done', endedAt: 1000 }), 454, 60_000).source).not.toContain('@keyframes')
})

test('the detail draws its head, tools, steps, calls and files', () => {
  const a = busy('a')
  const head = agentHeadSvg(a, 530, 30_000, 'raised', 200_000)
  expect(head.source).toContain('>working<')
  expect(head.source).toContain('▶ Read svg.ts')
  expect(head.source).toContain('31k / 200k')
  expect(head.source).toContain('✓8 ✗1')
  const tools = toolsSvg(a, 530)!.source
  expect([tools.includes('>BUILT-IN<'), tools.includes('>SKILLS<'), tools.includes('sabai · step'), tools.includes('>×3<')]).toEqual([true, true, true, true])
  expect(toolsSvg(run('none'), 530)).toBeUndefined()
  const steps = stepsSvg(a, 530)!.source
  expect([steps.includes('>scanning<'), steps.includes('>1 more step planned<')]).toEqual([true, true])
  const calls = activitySvg(a, 530)!.source
  expect([calls.includes('7 earlier calls'), calls.includes('$ ls /nope'), calls.includes('running…')]).toEqual([true, true, true])
  const files = filesSvg(a, 530)!.source
  expect([files.includes('Changed · 1'), files.includes('>NEW<'), files.includes('Read · 1'), files.includes('>2×<')]).toEqual([true, true, true, true])
  expect(earlierSvg([busy('x', { status: 'done', endedAt: 28_000, startedAt: 1000 })], 454).source).toContain('✓ 1 · 27s · 51k')
})

test('every pane drawing keeps its words inside a narrow pane and is small', () => {
  const a = busy('a')
  for (const W of [240, 330, 530, 1200]) {
    for (const d of [crewSvg([a, busy('b')], W, 30_000), laneSvg(a, W - 76, 30_000), agentHeadSvg(a, W, 30_000), toolsSvg(a, W)!, activitySvg(a, W)!, filesSvg(a, W)!]) {
      expect(d.source).not.toContain('NaN')
      expect(d.source.length).toBeLessThan(16_000)
    }
  }
})

test('runs from before crews are one crew, and the pane shows no more than five crews', () => {
  const old = [run('x', { status: 'done' }), run('y', { status: 'done' })]
  expect(crewsOf(old).map(c => c.runs.length)).toEqual([2])
  const many = Array.from({ length: 8 }, (_, i) => run(`c${i}`, { crew: `turn:${i}`, status: 'done' }))
  const { now, earlier } = openCrews(crewsOf(many))
  expect([now.length, earlier.length]).toEqual([1, CREWS_KEPT - 1])
})

test('an earlier crew’s day reads today, yesterday, else its date', () => {
  const now = new Date(2026, 9, 13, 1, 30).getTime()
  expect(dayOf(new Date(2026, 9, 13, 0, 5).getTime(), now)).toBe('TODAY')
  expect(dayOf(new Date(2026, 9, 12, 23, 50).getTime(), now)).toBe('YESTERDAY')
  expect(dayOf(new Date(2026, 9, 10, 18, 5).getTime(), now)).toBe('SAT 10 OCT')
})
