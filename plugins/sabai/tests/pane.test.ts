import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import {
  CALLS_KEPT, CREWS_KEPT, QUIET_MS, agentMood, dayOf, needsLook, called, calling, clearEarlier, crewsOf, factsLine, filesOf, openCrews, reported, spawned, stepped,
  summaryOf, summaryPrompt, laneLine, toolsOf, touched,
} from '../hooks/agents'
import { actOf } from '../hooks/chat'
import { activitySvg, agentHeadSvg, crewSvg, earlierSvg, filesSvg, laneSvg, lookOf, stepsSvg, toolsSvg } from '../hooks/svg'
import { DEFAULT_THEME } from '../hooks/themes'

const run = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id, agentId: id, type: 'Explore', description: `task ${id}`, model: 'claude-haiku-4-5', status: 'running', startedAt: 1000, contextTokens: 0, requests: 0, lastActiveAt: 1000, ...extra,
})
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 900 }
const READ = actOf('Read', { file_path: '/p/hooks/svg.ts' })
const GREP = actOf('Grep', { pattern: 'on\\(', path: '/p/hooks' })

test('a call is named for the pane by its tool: files, commands, patterns, skills and MCP tools', () => {
  expect(READ).toEqual({ kind: 'read', title: 'Read svg.ts', target: 'svg.ts', key: 'Read', now: 'Reading svg.ts' })
  expect(GREP).toMatchObject({ kind: 'search', title: 'Grep on\\( · hooks', key: 'Grep' })
  expect(actOf('Bash', { command: 'cd /p && bun test' })).toMatchObject({ kind: 'test', title: '$ bun test' })
  expect(actOf('Bash', { command: 'ls -la' })).toMatchObject({ kind: 'command', target: 'ls -la' })
  expect(actOf('Skill', { skill: 'superpowers:brainstorming' })).toMatchObject({ kind: 'skill', key: 'skill:superpowers:brainstorming' })
  expect(actOf('mcp__context7__query-docs', {})).toMatchObject({ kind: 'mcp', title: 'context7 · query-docs', key: 'mcp__context7__query-docs' })
  // An MCP tool by its server's own name, without the ids around it, the same in every place.
  expect(actOf('mcp__Claude_Browser__computer', {})).toMatchObject({ title: 'Browser · computer', now: 'Using Browser · computer' })
  expect(actOf('mcp__plugin_context-mode_context-mode__ctx_search', {}).title).toBe('context-mode · ctx search')
  // While it runs a call says what it is doing; a command by its description when it has one.
  expect(actOf('Bash', { command: 'python3 -m http.server', description: 'serve the preview' }).now).toBe('Serve the preview')
  expect(actOf('Bash', { command: 'ls -la' }).now).toBe('Running ls -la')
  expect(actOf('Bash', { command: 'bun test' }).now).toBe('Running tests')
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
  const { atWork: now, earlier } = openCrews(crewsOf(list))
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
  // Main whose turn ended while its crew's agents run waits on them, as the band says.
  const waits = run('m', { type: 'main', waitingOn: 2, lastActiveAt: at - QUIET_MS })
  expect(agentMood(waits, at)).toBe('waiting')
  expect(laneLine(waits, at)).toBe('Waiting on 2 subagents')
})

test('a lane line says its state once, in the band’s words, with its real numbers and its round', () => {
  const at = 100_000
  expect(laneLine(run('a', { doing: [{ kind: 'read', title: 'Read svg.ts', target: 'svg.ts', now: 'Reading svg.ts' }] }), at)).toBe('Reading svg.ts')
  // A call kept from before the calls said their words names itself by its title.
  expect(laneLine(run('a', { doing: [{ kind: 'read', title: 'Read svg.ts', target: 'svg.ts' }] }), at)).toBe('Read svg.ts')
  // Between calls: how long it has thought, and the call it made last.
  // Between calls: the files it touched last, newest first, by what it did to the newest; a call
  // that touched no file says nothing more.
  const file = (reads: number, edits: number) => ({ reads, edits, added: edits, removed: 0 })
  expect(laneLine(run('a', { lastActiveAt: at - 5000, calls: [{ title: 'Read crew.ts', kind: 'read', ms: 1, ok: true }] }), at)).toBe('Thinking 5s')
  expect(laneLine(run('a', { lastActiveAt: at - 5000, files: { 'hooks/a.ts': file(1, 0), 'hooks/svg.ts': file(1, 2), 'tests/crew.ts': file(1, 0) } }), at)).toBe('Thinking 5s · reading crew.ts, svg.ts')
  expect(laneLine(run('a', { lastActiveAt: at - 5000, files: { 'hooks/a.ts': file(1, 0), 'hooks/svg.ts': file(0, 1) } }), at)).toBe('Thinking 5s · editing svg.ts, a.ts')
  expect(laneLine(run('a', { lastActiveAt: at - 5000 }), at)).toBe('Thinking 5s')
  expect(laneLine(run('a', { lastActiveAt: at + 900 }), at)).toBe('Thinking 0s')
  expect(laneLine(run('a', { lastActiveAt: at - 45_000 }), at)).toBe('Quiet 45s')
  expect(laneLine(run('a', { contextTokens: 172_000, lastActiveAt: at }), at, 200_000)).toBe('Context 86%')
  expect(laneLine(run('a', { status: 'failed', reason: 'error', callFails: 2 }), at)).toBe('Failed · 2 failed calls')
  expect(laneLine(run('a', { status: 'failed', reason: 'aborted', progress: { done: 2, total: 3 } }), at)).toBe('Stopped at step 2/3')
  expect(laneLine(run('a', { status: 'done', startedAt: 0, endedAt: 16_000 }), at)).toBe('Done in 16s')
  expect(laneLine(run('a', { status: 'done', summary: 'pending', startedAt: 0, endedAt: 9000 }), at)).toBe('Done in 9s · summing up')
  expect(laneLine(run('a', { rounds: [{}], doing: [{ kind: 'edit', title: 'Edit x', target: 'x', now: 'Editing x' }] }), at)).toBe('Round 2 · Editing x')
  // One line per state, the same for every run: no word is picked at random.
  expect(laneLine(run('x', { lastActiveAt: at - 5000 }), at)).toBe(laneLine(run('y', { lastActiveAt: at - 5000 }), at))
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
  expect(factsLine({ ...a, startedAt: 0, endedAt: 27_000, spent: 49_400 }, 0)).toBe('Read 0 files · changed 1 file · 4 calls (1 failed) · 27s · 49.4k tokens')
})

const busy = (id: string, extra: Partial<AgentRun> = {}) =>
  run(id, {
    callCount: 9, callFails: 1, spent: 51_000, contextTokens: 31_000, progress: { done: 2, total: 3, note: 'reading bandSvg' }, notes: ['scanning', 'reading bandSvg'],
    calls: [{ kind: 'search', title: 'Grep x', ok: true, ms: 300 }, { kind: 'command', title: '$ ls /nope', ok: false, ms: 20 }],
    doing: [{ kind: 'read', title: 'Read svg.ts', target: 'svg.ts', now: 'Reading svg.ts' }],
    tools: { Grep: 1, Bash: 1, Read: 1, 'skill:superpowers:brainstorming': 1, mcp__sabai__step: 3 },
    files: { 'hooks/svg.ts': { reads: 2, edits: 0, added: 0, removed: 0 }, 'tests/n.test.ts': { reads: 0, edits: 1, added: 38, removed: 0, created: true } },
    ...extra,
  })

test('the overview lays the crew on one time axis, a Clawd riding each bar at work, then three tiles', () => {
  const list = [busy('a'), busy('b', { status: 'done', endedAt: 20_000 }), busy('c', { status: 'failed', reason: 'aborted', endedAt: 20_000 })]
  const d = crewSvg(list, 530, 30_000)
  // No headline: the box's title says how the crew stands.
  expect(d.source).not.toContain('agents<')
  expect([d.source.includes('>task a<'), d.source.includes('>task b<'), d.source.includes('>task c<')]).toEqual([true, true, true])
  // Ends marked: done, stopped; the one at work rides its bar to now.
  expect([d.source.includes('#sabai-du-circle-check'), d.source.includes('#sabai-du-circle-stop'), d.source.includes('>now<')]).toEqual([true, true, true])
  expect(d.source).toContain('class="run"')
  expect(d.alt).toBe('3 subagents on the timeline: task a working, task b done, task c stopped; 27 calls, 3 failed; 153k tokens; 29s')
  expect([d.source.includes('>27<'), d.source.includes('>153k<'), d.source.includes('>FILES<')]).toEqual([true, true, false])
  const all = crewSvg(list.slice(1), 530, 90_000)
  // Settled: the axis ends at the crew's own end, and nothing moves.
  expect(all.source).not.toContain('>now<')
  expect(all.source).not.toContain('@keyframes')
  // Past six members the rest are counted.
  expect(crewSvg(Array.from({ length: 8 }, (_, i) => busy(`m${i}`)), 530, 30_000).source).toContain('>+ 2 more<')
  // A very narrow pane stacks the tiles.
  expect(crewSvg(list, 260, 30_000).height).toBeGreaterThan(d.height)
})

test('a lane carries its mood’s stripe; viewed, it is ringed and its Clawd waves; Main is named so and wears its cap; still once settled', () => {
  const lane = laneSvg(busy('a'), 454, 30_000, DEFAULT_THEME, undefined, true)
  expect(lane.source).toContain('Reading svg.ts')
  // Its skill and MCP server's row makes it 59 px tall.
  expect(lane.source).toContain('<rect y="6" width="4" height="47" rx="2" fill="var(--kl-skill)"/>')
  expect(lane.source).toContain('stroke="#D97757" stroke-width="1.5"')
  expect(lane.source).toContain('class="run wave"')
  expect(lane.source).toContain('font-weight="800"')
  expect(lane.source).toContain('>2/3<')
  expect(laneSvg(busy('a'), 454, 30_000, DEFAULT_THEME).source).not.toContain('wave')
  const quiet = laneSvg(busy('q', { doing: [], lastActiveAt: 0 }), 454, 60_000)
  expect(quiet.source).toMatch(/class="c-warn"[^>]*>Quiet 60s/)
  expect(quiet.source).toContain(`<rect y="6" width="4" height="47" rx="2" fill="var(--kl-warn)"/>`)
  expect(laneSvg(busy('d', { status: 'done', endedAt: 1000 }), 454, 60_000).source).not.toContain('@keyframes')
  const main = laneSvg(busy('main:1', { type: 'main', description: 'Main' }), 454, 30_000)
  expect([main.source.includes('>Main<'), main.source.includes('#3a5899'), main.alt.startsWith('Main:')]).toEqual([true, true, true])
  // Its line leads with its state's tile, moving while it works: the call's, the quiet moon, Main's hourglass.
  expect(lane.source).toMatch(/<g class="st-pulse"><use href="#sabai-du-book-open"/)
  expect(lane.source).toContain('@keyframes stp')
  expect(quiet.source).toMatch(/<g class="st-fade"><use href="#sabai-du-moon"/)
  const waits = laneSvg(busy('main:2', { type: 'main', description: 'Main', doing: [], waitingOn: 2 }), 454, 30_000)
  expect(waits.source).toMatch(/<g class="st-flip"><use href="#sabai-du-hourglass"/)
  expect(waits.source).toContain('@keyframes stf')
  // An ended run's tile stays still, with no motion carried.
  const done = laneSvg(busy('d', { status: 'done', endedAt: 1000 }), 454, 60_000).source
  expect(done).toMatch(/<use href="#sabai-du-circle-check"/)
  // The head's mood tag carries the same tile.
  expect(agentHeadSvg(busy('h', { doing: [], lastActiveAt: 29_000 }), 530, 30_000).source).toContain('class="st-b1"')
})

test('an ended lane says how it ended by its line’s icon alone: a check, a cross or a stop, no badge on its Clawd; just ended, its lane is tinted', () => {
  const ended = (status: AgentRun['status'], reason?: AgentRun['reason']) => run('e', { status, endedAt: 10_000, ...(reason ? { reason } : {}) })
  const later = 60_000
  expect(laneSvg(run('r'), 400, later, DEFAULT_THEME).source).not.toContain('<circle cx="')
  const done = laneSvg(ended('done'), 400, later, DEFAULT_THEME).source
  expect(done).toContain('href="#sabai-du-circle-check"')
  const failed = laneSvg(ended('failed', 'error'), 400, later, DEFAULT_THEME).source
  expect(failed).toContain('href="#sabai-du-circle-x"')
  expect(laneSvg(ended('failed', 'aborted'), 400, later, DEFAULT_THEME).source).toContain('href="#sabai-du-circle-stop"')
  // The tile is the one mark: no disc on Clawd's corner to run into it.
  expect([done, failed].some(s => s.includes('r="6.5"'))).toBe(false)
  // Settled, no tint; in its first seconds a failed lane is tinted red and its Clawd falls.
  expect(failed).not.toContain('class="flash"')
  const fresh = laneSvg(ended('failed', 'error'), 400, 11_000, DEFAULT_THEME).source
  expect(fresh).toContain('class="flash" x="5" y="2"')
  expect(fresh).toContain('fill="var(--kl-fail)" opacity=".35"')
  expect(fresh).toContain('class="out')
  expect(laneSvg(ended('done'), 400, 11_000, DEFAULT_THEME).source).toContain('fill="var(--kl-ok)" opacity=".35"')
})

test('the detail draws its head a line for each thing, then its tools, steps, calls and files', () => {
  const a = busy('a', { effort: 'high', lastActiveAt: 25_000 })
  const head = agentHeadSvg(a, 530, 30_000, DEFAULT_THEME, 200_000)
  expect(head.source).toContain('>Working<')
  // Beside the tag, what it runs on: its model after a robot, its effort after a gauge, in the
  // family's hue; its calls are the Calls box's, not the head's.
  expect(head.source).toMatch(/href="#sabai-du-bot" fill="var\(--kb-ok\)"[^>]*\/><text class="m"[^>]*>Haiku 4\.5</)
  expect(head.source).toMatch(/href="#sabai-du-gauge"[^>]*\/><text class="m"[^>]*>high effort</)
  expect(head.source).not.toContain('Reading svg.ts')
  expect(head.source).toContain('31k · 16%')
  expect(head.source).toContain('>TOKENS<')
  expect(head.source).toContain('>51k<')
  // The small print keeps its type alone.
  expect(head.source).toContain('>Explore<')
  expect(head.alt).toContain('Explore · Haiku 4.5 · high effort')
  expect(head.source).toContain('>active 5s ago<')
  // A quiet agent's tag already counts its silence.
  const quiet = agentHeadSvg(busy('q', { doing: [], lastActiveAt: 0 }), 530, 60_000, DEFAULT_THEME)
  expect([quiet.source.includes('>Quiet 60s<'), quiet.source.includes('active')]).toEqual([true, false])
  const tools = toolsSvg(a, 530)!.source
  expect([tools.includes('>BUILT-IN<'), tools.includes('>SKILLS<'), tools.includes('sabai · step'), tools.includes('>×3<')]).toEqual([true, true, true, true])
  expect(toolsSvg(run('none'), 530)).toBeUndefined()
  const steps = stepsSvg(a, 530)!.source
  expect([steps.includes('>scanning<'), steps.includes('>1 more step planned<')]).toEqual([true, true])
  // How many calls are left out is the box's title's to say.
  const calls = activitySvg(a, 530)!.source
  expect([calls.includes('earlier call'), calls.includes('$ ls /nope'), calls.includes('Running…')]).toEqual([false, true, true])
  const files = filesSvg(a, 530)!.source
  expect([files.includes('Changed · 1'), files.includes('>NEW<'), files.includes('Read · 1'), files.includes('>2×<')]).toEqual([true, true, true, true])
  // How it ended in the timeline's tiles, each with its count; its alt says it in words.
  const one = earlierSvg([busy('x', { status: 'done', endedAt: 28_000, startedAt: 1000 })], 454)
  expect([one.source.includes('href="#sabai-du-circle-check"'), one.source.includes('>27s · 51k<'), one.source.includes('✓')]).toEqual([true, true, false])
  expect(one.alt).toContain(': 1 done · 27s · 51k.')
  const ended = earlierSvg([busy('d', { status: 'done', endedAt: 9000 }), busy('f', { status: 'failed', reason: 'error', endedAt: 9000 }), busy('s', { status: 'failed', reason: 'aborted', endedAt: 9000 })], 600).source
  for (const g of ['circle-check', 'circle-x', 'circle-stop']) expect([g, ended.includes(`href="#sabai-du-${g}"`)]).toEqual([g, true])
  expect(ended).not.toContain('✋')
  // A dynamic workflow's run is named so; a turn's group needs no name.
  expect(earlierSvg([busy('w', { status: 'done', endedAt: 28_000, crew: 'wf:r1' })], 454).alt).toMatch(/^\d\d:\d\d · workflow run · 1 subagent:/)
  // A tally that would run into the longer title is left out.
  const narrow = earlierSvg([1, 2, 3].map(i => busy(`w${i}`, { status: i === 2 ? 'failed' : 'done', reason: i === 2 ? 'error' : 'answer', endedAt: 240_000, crew: 'wf:r1' })), 362).source
  expect(narrow).not.toContain('sabai-du-')
  // A title too long for a narrow row is cut, never drawn past its card.
  expect(earlierSvg(Array.from({ length: 12 }, (_, i) => busy(`n${i}`, { status: 'done', endedAt: 9000, crew: 'wf:r1' })), 200).source).toMatch(/>[^<]*…</)
})

test('an earlier crew crowns its MVP: done without a failed call, the most files changed, then the quickest', () => {
  const done = (id: string, extra: Partial<AgentRun> = {}) => busy(id, { status: 'done', endedAt: 20_000, callFails: 0, ...extra })
  const what = (crew: AgentRun[]) => earlierSvg(crew, 600).alt.split('. ')[1]
  expect(what([done('a', { files: {} }), done('b'), done('c', { callFails: 2 })])).toBe('task a · 👑 task b · task c')
  expect(what([done('a', { files: {}, endedAt: 9000 }), done('b', { files: {} })])).toBe('👑 task a · task b')
  // One agent, or none done clean: no crown.
  expect(what([done('a')])).toBe('task a')
  expect(what([done('a', { callFails: 1 }), busy('b', { status: 'failed', endedAt: 5000 })])).not.toContain('👑')
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
  const { atWork: now, earlier } = openCrews(crewsOf(many))
  expect([now.length, earlier.length]).toEqual([1, CREWS_KEPT - 1])
})

test('an earlier crew’s day reads today, yesterday, else its date', () => {
  const now = new Date(2026, 9, 13, 1, 30).getTime()
  expect(dayOf(new Date(2026, 9, 13, 0, 5).getTime(), now)).toBe('TODAY')
  expect(dayOf(new Date(2026, 9, 12, 23, 50).getTime(), now)).toBe('YESTERDAY')
  expect(dayOf(new Date(2026, 9, 10, 18, 5).getTime(), now)).toBe('SAT 10 OCT')
})

test('a lane names the skills and MCP servers it called as chips: the one in use first and pulsing, then the most called, +N past the room', () => {
  const at = (tools: Record<string, number>, over: object = {}, W = 454) => laneSvg(busy('u', { tools, ...over }), W, 30_000, DEFAULT_THEME)
  // None called: no row, the lane keeps its height.
  expect(at({ Read: 4 }).height).toBe(42)
  const lane = at({ Read: 4, 'skill:pdf': 1, mcp__claude_ai_Slack__search: 2, mcp__claude_ai_Slack__fetch: 1, 'mcp__plugin_context7_context7__query-docs': 1 }, { doing: [{ kind: 'skill', title: 'Skill pdf', target: 'pdf', now: 'Using pdf' }] })
  expect(lane.height).toBe(59)
  // An MCP tool counts under its server; the skill in use leads, outlined, its bulb pulsing.
  const words = [...lane.source.matchAll(/fill="var\(--kf-(?:skill|web)\)">([^<]+)</g)].map(m => m[1])
  expect(words).toEqual(['pdf', 'Slack ×3', 'context7'])
  expect(lane.source).toMatch(/stroke="var\(--kf-skill\)" stroke-width="1"\/><g class="st-pulse"><use href="#sabai-du-lightbulb"/)
  expect(lane.source).toContain('href="#sabai-du-plug"')
  expect(lane.alt).toContain('. Used pdf, Slack, context7')
  // A narrow lane keeps what fits and counts the rest.
  expect(at({ 'skill:frontend-design': 1, 'skill:superpowers:brainstorming': 1, mcp__claude_ai_Notion__fetch: 1, mcp__claude_ai_Slack__search: 1 }, {}, 280).source).toMatch(/>\+\d</)
})

test('a run keeps its files newest last: touching one again moves it to the end', () => {
  let l = [{ id: 'a', agentId: 'a', type: 'Explore', description: 'a', model: 'm', status: 'running', startedAt: 0, contextTokens: 0 } as AgentRun]
  for (const p of ['x.ts', 'y.ts', 'x.ts']) l = touched(l, 'a', p, { read: true })
  expect(Object.keys(l[0]!.files!)).toEqual(['y.ts', 'x.ts'])
  expect(l[0]!.files!['x.ts']!.reads).toBe(2)
})
