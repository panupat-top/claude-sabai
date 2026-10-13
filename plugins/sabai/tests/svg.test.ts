import { expect, test } from 'claude-code/testing'

import type { AgentRun } from '../types'
import { sprite, spriteSize } from '../hooks/sprites'
import { icon } from '../hooks/icons'
import { contrast } from '../hooks/themes'
import { CALLOUT_KINDS, CARD, CHAT_INK, MOTION, PILL_TINT, TEXT, bandSvg, barPreview, skinPreview, monoWidth, USAGE_STYLES, calloutTitleSvg, infoSvg, lookOf, racePart, receiptSvg, stepSvg, toolIconSvg } from '../hooks/svg'

const LIST = [
  { kind: 'context', label: 'Context', percent: 85, amount: '434.5k / 1M', level: 'warn' },
  { kind: 'session', label: '5H Limit', percent: 7, resetsInMs: 2 * 3600_000 },
  { kind: 'week', label: '7D All', percent: 3, resetsInMs: 3 * 86_400_000 },
] as const

test('the tasks row escapes its title and stays under the engine limits', () => {
  const d = bandSvg({ done: 3, total: 4, title: 'Fix <b> & "quotes"' }, [], 1600)
  expect(d?.source).toContain('Fix &lt;b&gt; &amp; &quot;quotes&quot;')
  expect(d?.source).toContain('>3/4<')
  expect(d?.source).toContain('>75%<')
  expect(d?.source.length).toBeLessThan(131_072)
  expect(d?.alt).toBe('Fix <b> & "quotes": 3/4 tasks, 75%')
  expect([d?.width, d?.height]).toEqual([1600, 20])
})

test('Clawd walks while the turn works and waits otherwise, in his clay on either look', () => {
  const mode = (src = '') => src.match(/shape-rendering="crispEdges" class="(\w+)"/)?.[1]
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, [], 600, { mood: 'working' })?.source)).toBe('run')
  expect(mode(bandSvg({ done: 0, total: 2, title: 'a' }, [], 600)?.source)).toBe('idle')
  const raised = bandSvg({ done: 0, total: 2, title: 'a' }, [], 600, { mood: 'idle', skin: 'raised' })?.source
  expect(raised).toContain('@keyframes wink{91%,96%{fill:#D97757}}')
  expect(spriteSize('tasks')).toEqual({ width: 24, height: 16 })
})

test('cards run side by side when wide, two or one when narrow, 8px apart', () => {
  expect(bandSvg(undefined, LIST, 900)?.height).toBe(44)
  expect(bandSvg(undefined, LIST, 500)?.height).toBe(2 * 44 + 8)
  expect(bandSvg(undefined, LIST, 360)?.height).toBe(3 * 44 + 2 * 8)
  expect(bandSvg({ done: 1, total: 2, title: 'a' }, LIST, 900)?.height).toBe(20 + 8 + 44)
  const wide = bandSvg(undefined, LIST, 900)
  expect(wide?.source.match(/class="p"/g)?.length).toBe(3)
  expect(bandSvg(undefined, LIST.slice(0, 2), 900)?.source).toContain('width="446"')
  for (const id of ['context', 'session', 'week']) expect(wide?.source).toContain(`id="sabai-${id}"`)
  expect(wide?.source).toContain('7D ALL')
  expect(wide?.source.match(/shape-rendering="crispEdges"/g)?.length).toBe(1)
  expect(wide?.source).toContain('↻ 2h 0m')
  expect(wide?.source).toContain('#f08a3c')
  expect(wide?.alt).toBe('Context 434.5k / 1M (85%); 5H Limit 7%, resets in 2h 0m; 7D All 3%, resets in 3d 0h')
})

test('nothing to draw draws nothing', () => {
  expect(bandSvg(undefined, [], 900)).toBeUndefined()
})

test('the info card escapes its words; the user gives way first when room is short', () => {
  const info = {
    left: [
      { icon: 'folder', label: 'Directory', value: 'claude-skins' },
      { icon: 'git', label: 'Git user', value: 'Panupat <dev>' },
      { icon: 'branch', label: 'Branch', value: 'main ±2' },
    ],
    right: [{ icon: 'node', label: 'Node', value: 'v24.1.0' }],
  } as const
  const d = infoSvg(info, 900)!
  expect(d.alt).toBe('Directory claude-skins, Git user Panupat <dev>, Branch main ±2, Node v24.1.0')
  expect(d.source).toContain('Panupat &lt;dev&gt;')
  // The user comes before Node, both after the branch.
  expect(Number(d.source.match(/<text class="m" x="([\d.]+)"[^>]*>Panupat &lt;dev&gt;</)?.[1])).toBeLessThan(Number(d.source.match(/<text class="m" x="([\d.]+)"[^>]*>v24\.1\.0</)?.[1]))
  // Too narrow: the user gives way first; the folder and branch stay, cut if they must.
  expect(infoSvg(info, 276)!.alt).not.toContain('Git user')
  expect(infoSvg(info, 276)!.alt).toContain('Directory claude-skins')
})

test('a narrow info row keeps the branch longest and never leaves a name as a bare `…`', () => {
  const row = (dir: string, branch: string) =>
    ({ left: [{ icon: 'folder', label: 'Directory', value: dir }, { icon: 'branch', label: 'Branch', value: branch, branch, ahead: 2, changes: 3 }], right: [] }) as never
  const texts = (d: { source: string }) => [...d.source.matchAll(/<text[^>]*>([^<]*)</g)].map(m => m[1]!)
  for (const dir of ['プロジェクト管理ツール', 'claude-skins', '项目'])
    for (const branch of ['feature/very-long-branch-name-here', 'main'])
      for (const W of [96, 120, 144, 176, 240, 400]) {
        const d = infoSvg(row(dir, branch), W)!
        const t = texts(d)
        // Nothing is cut to the ellipsis alone, and the branch always shows, at least six characters.
        expect([W, dir, t.filter(s => s === '…')]).toEqual([W, dir, []])
        const b = t.find(s => branch.startsWith(s.replace(/…$/, '')) && s.length > 1)
        expect([W, dir, branch, Boolean(b && b.replace(/…$/, '').length >= Math.min(6, branch.length))]).toEqual([W, dir, branch, true])
        // A name short enough is never given an ellipsis it does not need.
        if (branch === 'main') expect(t).not.toContain('main…')
        // The folder, when it shows, keeps at least three characters; when it is gone, the alt says so.
        const f = t.find(s => s !== b && !/^[↑↓±]/.test(s))
        if (f) expect(f.replace(/…$/, '').length).toBeGreaterThanOrEqual(Math.min(3, dir.length))
        expect(d.alt.includes('Directory')).toBe(Boolean(f))
      }
  // The sync counts give way before the folder is cut: a short folder and branch keep both once the counts go.
  const tight = texts(infoSvg(row('项目', 'main'), 150)!)
  expect(tight).toEqual(['项目', 'main'])
  expect(texts(infoSvg(row('项目', 'main'), 400)!)).toEqual(['项目', 'main', '↑2', '±3'])
})

test('only Clawd and the context draw a sprite, each within the row', () => {
  for (const kind of ['tasks', 'context'] as const) {
    const { width, height } = spriteSize(kind)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeLessThanOrEqual(16)
    if (kind !== 'tasks') expect(width).toBeLessThanOrEqual(18)
    expect(sprite(kind, 0, 0)).toContain('<rect')
  }
})

test('every text colour reads at 4.5:1 on its card, in light and dark', () => {
  for (const [name, [light, dark]] of Object.entries(TEXT)) {
    expect([name, contrast(light, CARD[0]) >= 4.5]).toEqual([name, true])
    expect([name, contrast(dark, CARD[1]) >= 4.5]).toEqual([name, true])
  }
  expect(contrast('#ffffff', '#b5532f')).toBeGreaterThanOrEqual(4.5)
})

test('figures take their meter colour, then the warning ones', () => {
  expect(bandSvg(undefined, LIST, 900)?.source).toContain('class="c-warn"')
})

test('the raised look colours the cards but draws no background or inset, as flat does', () => {
  const themed = bandSvg(undefined, LIST, 900, { mood: 'idle', skin: 'raised' })
  expect(themed?.height).toBe(44)
  expect(themed?.source).toContain('.p{fill:#ffffff}')
  expect(themed?.source).toContain('.p{fill:#2d2d2b}')
  expect(themed?.source).not.toContain('rx="10" fill=')
  expect(themed?.source).not.toContain('translate(10,10)')
})

test('bars draw as dither, pixel blocks or a solid fill', () => {
  const draw = (style: 'dither' | 'blocks' | 'solid') =>
    bandSvg({ done: 1, total: 2, title: 'a' }, LIST, 800, { mood: 'idle', skin: 'auto', style: style })?.source ?? ''
  expect(draw('dither')).toMatch(/class="d[0-3]"/)
  const blocks = draw('blocks')
  expect(blocks).not.toMatch(/class="d[0-3]"/)
  expect(blocks.match(/rx="1\.5"/g)?.length).toBeGreaterThan(20)
  const solid = draw('solid')
  expect(solid).not.toMatch(/class="d[0-3]"/)
  expect(solid).toContain('<rect fill="#D97757"')
})

const crewRun = (id: string, extra: Partial<AgentRun> = {}): AgentRun => ({
  id, agentId: id, type: 'Explore', description: `job ${id}`, model: 'claude-opus-5-5', status: 'running', startedAt: 0, contextTokens: 0, steps: 4, ...extra,
})

test('the crew row walks one Clawd per running agent, names the latest, and counts the rest', () => {
  const runs = [crewRun('a', { status: 'done', endedAt: 5000 }), crewRun('b', { tasks: [{ id: '1', subject: 'Read', activeForm: 'Reading', status: 'in_progress' }, { id: '2', subject: 'x', status: 'pending' }] })]
  const d = bandSvg(undefined, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs, now: 37_000 } })
  expect(d?.source).toContain('>job b<')
  expect(d?.source).toContain('0/2 · Reading')
  expect(d?.source.match(/class="run"/g)?.length).toBe(1)
  expect(d?.alt).toBe('Agents: 1 running, 1 done; job b')
  const many = bandSvg(undefined, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: Array.from({ length: 7 }, (_, i) => crewRun(String(i))), now: 1000 } })
  expect(many?.source.match(/class="run"/g)?.length).toBe(5)
  expect(many?.source).toContain('>+2<')
  expect(many?.source.length).toBeLessThan(131_072)
  const idle = bandSvg(undefined, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'done', endedAt: 2 })], now: 9000 } })
  expect(idle?.source).toContain('>All 2 done<')
  expect(idle?.source).not.toContain('class="run"')
  const mixed = bandSvg(undefined, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [crewRun('a', { status: 'done', endedAt: 1 }), crewRun('b', { status: 'failed', endedAt: 2 })], now: 9000 } })
  expect(mixed?.source).toContain('>1 done · 1 failed<')
  expect(mixed?.alt).toBe('Agents: 1 done, 1 failed; 1 done · 1 failed')
  expect(mixed?.source.match(/>1<\/text>/g)?.length).toBe(2)
  expect(bandSvg(undefined, [], 800, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [], now: 0 } })).toBeUndefined()
})

test('a dithered band stays inside the engine limits at any width, its dots widening instead of multiplying', () => {
  const list = [{ kind: 'context', label: 'Context', percent: 60, amount: '1k / 1M' }] as const
  for (const W of [800, 2400, 4096]) {
    const d = bandSvg({ done: 3, total: 5, title: 't' }, list, W, { mood: 'working', skin: 'auto', style: 'dither' })
    expect([W, (d?.source.length ?? 0) < 70_000]).toEqual([W, true])
  }
  // Many tasks still draw at most a dozen tick marks.
  const many = bandSvg({ done: 1, total: 120, title: 't' }, [], 800, { mood: 'idle', skin: 'auto', style: 'dither' })?.source ?? ''
  expect((many.match(/width="1.5" height="6"/g) ?? []).length).toBeLessThanOrEqual(12)
})

test('a title of emoji is cut on whole characters, never mid-pair', () => {
  const d = bandSvg({ done: 0, total: 1, title: '🚀'.repeat(60) }, [], 300)?.source ?? ''
  const run = crewRun('x', { description: '🚀'.repeat(60), tasks: [{ id: '1', subject: '🚀'.repeat(60), status: 'in_progress' }] })
  const crew = bandSvg(undefined, [], 330, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs: [run], now: 1 } })?.source ?? ''
  for (const s of [d, crew]) expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)).toBe(false)
})

test('text the band draws on the bare surface follows the OS, whatever the skin; auto defines every meter class', () => {
  for (const skin of ['auto', 'raised']) {
    const d = bandSvg({ done: 1, total: 2, title: 'Polish' }, [], 600, { mood: 'idle', skin: skin })?.source ?? ''
    expect([skin, d.includes('<text class="st"'), d.includes('.st{fill:#1f1f1f}'), d.includes('prefers-color-scheme: dark){.st')]).toEqual([skin, true, true, true])
    const crew = bandSvg(undefined, [], 600, { mood: 'idle', skin: skin, style: 'dither', crew: { runs: [crewRun('a')], now: 1 } })?.source ?? ''
    expect(crew).toContain('<text class="st"')
  }
  expect(lookOf('auto').css).toContain('.c-tasks{')
})

test('on a narrow band the crew walks fewer Clawds and drops words it has no room for, never overlapping the counts', () => {
  const runs = [...Array.from({ length: 5 }, (_, i) => crewRun(String(i))), crewRun('f', { status: 'failed', endedAt: 1 })]
  const d = bandSvg(undefined, [], 330, { mood: 'idle', skin: 'auto', style: 'dither', crew: { runs, now: 1000 } })?.source ?? ''
  expect((d.match(/class="run"/g) ?? []).length).toBeLessThan(5)
  const titleX = Number(d.match(/<text class="st" x="([\d.]+)"[^>]*font-size="12.5"/)?.[1] ?? 0)
  const firstCount = Math.min(...[...d.matchAll(/<text class="st" x="([\d.]+)"[^>]*font-size="11.5"/g)].map(m => Number(m[1])))
  if (titleX) expect(titleX).toBeLessThan(firstCount - 40)
})

test('the raised look’s empty bar track stands out from its card, light and dark', () => {
  const cards = [...lookOf('raised').css.matchAll(/\.p\{fill:(#[0-9a-f]{6})\}/g)].map(m => m[1]!)
  const tracks = [...lookOf('raised').css.matchAll(/\.k\{fill:(#[0-9a-f]{6})\}/g)].map(m => m[1]!)
  for (const i of [0, 1]) expect([i, contrast(tracks[i]!, cards[i]!) >= 1.35]).toEqual([i, true])
})

test('chat ink reads on a light and a dark conversation', () => {
  for (const [tone, [light, dark]] of Object.entries(CHAT_INK)) {
    expect([tone, contrast(light, '#ffffff') >= 4.5, contrast(dark, '#1a1a1a') >= 4.5]).toEqual([tone, true, true])
  }
})

test('callout inks read on light and dark, and a title is one small drawing in its kind’s colour', () => {
  for (const [kind, k] of Object.entries(CALLOUT_KINDS)) expect([kind, contrast(k.ink[0], '#ffffff') >= 4.5, contrast(k.ink[1], '#1a1a1a') >= 4.5]).toEqual([kind, true, true])
  const d = calloutTitleSvg('warning')
  expect(d.alt).toBe('Warning')
  expect(d.source).toContain('>Warning<')
  expect(d.source).toContain(`fill:${CALLOUT_KINDS.warning.ink[0]}`)
  expect(d.source).toMatch(/<g class="co an-pop"[^>]*fill="none"/)
})

test('a step is one minimal 560×24 line: a small icon, title, detail, a meter, the result in a pill, the time', () => {
  const d = stepSvg({ icon: 'flask', tone: 'ok', title: 'Run the tests', detail: '$ bun test', result: [{ text: '✓ 141 passed', tone: 'ok' }], meter: { good: 141, bad: 0 }, time: '5.1s' })
  expect([d.width, d.height]).toEqual([560, 24])
  expect(d.alt).toBe('Run the tests, $ bun test, 141 passed, 5.1s')
  expect(d.source).not.toContain('<circle class="trk"')
  expect(d.source).toMatch(/scale\(0\.5416666666666666\)"><g class="s-ok an-pop" fill="none" stroke-width="2"/)
  expect(d.source).toMatch(/font-size="12" font-weight="600">Run the tests</)
  expect(d.source).toContain('>$ bun test<')
  expect(d.source).toMatch(/<rect class="k-ok" opacity="0.1"[^>]*height="16" rx="8"/)
  expect((d.source.match(/height="8" rx="1"/g) ?? []).length).toBe(5)
})

test('a long title is cut short of the result, never under it', () => {
  const d = stepSvg({ icon: 'terminal', tone: 'bad', title: 'A'.repeat(200), detail: '$ ' + 'x'.repeat(200), result: [{ text: '✗ failed', tone: 'bad' }], time: '1m 4s' })
  expect(d.source).toContain('…')
  expect(d.source).toContain('an-shake')
  const titleChars = (d.source.match(/font-weight="600">([^<]*)</)?.[1] ?? '').length
  expect(titleChars).toBeLessThan(70)
})

test('an animated icon keeps its place: the motion sits inside the group that positions it', () => {
  const d = stepSvg({ icon: 'terminal', tone: 'ok', title: 't', detail: 'd', result: [] })
  expect(d.source).toMatch(/<g transform="translate\(1,5\.5\) scale\(0\.5416666666666666\)"><g class="s-ok an-pop"/)
})

test('motion starts and ends on the icon’s own size, so an image held on its first frame looks right', () => {
  const src = stepSvg({ icon: 'terminal', tone: 'ok', title: 't', detail: 'd', result: [] }).source
  expect(src).toContain('@keyframes an-pop{0%,100%{transform:scale(1)}')
})

test('the detail starts after the title it follows, measured by its letters', () => {
  const at = (title: string) => Number(stepSvg({ icon: 'read', tone: 'read', title, detail: 'README.md', result: [] }).source.match(/<text class="k-muted" x="([\d.]+)"/)?.[1])
  expect(at('Read README.md')).toBeGreaterThan(20 + 14 * 12 * 0.56 + 10)
  expect(at('iiiiiiiiii')).toBeLessThan(at('MMMMMMMMMM'))
})

// Review fixes (2026-10-11).
test('a very long title is cut in linear time', () => {
  const t = performance.now()
  stepSvg({ icon: 'terminal', tone: 'ok', title: 'x'.repeat(20_000), detail: 'd', result: [{ text: '✓ done', tone: 'ok' }] })
  expect(performance.now() - t).toBeLessThan(50)
})

test('Thai marks take no width and CJK takes a full em, so the detail sits right after the title', () => {
  const at = (title: string) => Number(stepSvg({ icon: 'read', tone: 'read', title, detail: 'dir/', result: [] }).source.match(/<text class="k-muted" x="([\d.]+)"/)?.[1])
  expect(at('กำลังทำงาน')).toBe(at('กำลงทำงาน'))
  expect(at('日本語のタイトル')).toBeGreaterThan(20 + 8 * 12 * 0.9)
})

test('pill text reads at 4.5:1 over its own tint on light and dark conversations', () => {
  const mix = (fg: string, bg: string, a: number) => {
    const c = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
    const [f, b] = [c(fg), c(bg)]
    return `#${f.map((v, i) => Math.round(v * a + b[i]! * (1 - a)).toString(16).padStart(2, '0')).join('')}`
  }
  for (const [tone, [light, dark]] of Object.entries(CHAT_INK)) {
    for (const bg of ['#ffffff', '#faf9f5']) expect([tone, bg, contrast(light, mix(light, bg, PILL_TINT)) >= 4.5]).toEqual([tone, bg, true])
    for (const bg of ['#1a1a1a', '#262624', '#30302e']) expect([tone, bg, contrast(dark, mix(dark, bg, PILL_TINT)) >= 4.5]).toEqual([tone, bg, true])
  }
})

test('pills line up row to row: the time column is always kept', () => {
  const end = (time?: string) => {
    const m = stepSvg({ icon: 'pen', tone: 'edit', title: 't', detail: '', result: [{ text: '+1 −1', tone: 'ok' }], ...(time ? { time } : {}) }).source.match(/<rect class="k-ok" opacity="[\d.]+" x="([\d.]+)"[^>]*width="([\d.]+)"/)
    return Number(m?.[1]) + Number(m?.[2])
  }
  expect(Math.round(end())).toBe(Math.round(end('1m 4s')))
  expect(Math.round(end('0.3s'))).toBe(Math.round(end('12s')))
})

test('an Important callout’s title is the colour of its border', () => {
  expect(CALLOUT_KINDS.important.key).toBe('claude')
  expect(CALLOUT_KINDS.important.ink[0]).not.toBe('#8250df')
})

test('Clawd sits in the tasks row when there is one, else at the left of the info card', () => {
  const info = { left: [{ icon: 'folder' as const, label: 'Folder', value: 'work' }], right: [] }
  const p = { title: 'Doing a', done: 1, total: 2 }
  const withTasks = bandSvg(p, [], 600, { mood: 'sad', skin: 'auto', style: 'dither' })!
  expect(withTasks.source.match(/class="dizzy"/g)?.length).toBe(1)
  expect(withTasks.alt).toContain('Clawd is sad')
  const noTasks = infoSvg(info, 600, { clawd: { mood: 'sleeping' } })!
  expect(noTasks.source.match(/class="sleep"/g)?.length).toBe(1)
  expect(noTasks.alt).toContain('Clawd is sleeping')
  // The folder moves right of Clawd.
  expect(noTasks.source).toMatch(/<path class="m" transform="translate\((3[2-9]|[4-9]\d)/)
  // Idle says nothing extra; with no rows the band draws nothing, Clawd stands in the info card.
  expect(infoSvg(info, 600, { clawd: { mood: 'idle' } })!.alt).not.toContain('Clawd')
  expect(bandSvg(undefined, [], 600, { mood: 'sad', skin: 'auto', style: 'dither' })).toBeUndefined()
  // An info card with no chips still holds Clawd.
  expect(infoSvg({ left: [], right: [] }, 600, { clawd: { mood: 'sweating' } })!.source).toContain('class="sweat"')
  // Celebrating hops with confetti.
  expect(infoSvg(info, 600, { clawd: { mood: 'celebrating' } })!.source).toContain('class="cf"')
})

test('a receipt is one minimal line: its icon, a headline and muted parts, fixed in size', () => {
  const green = receiptSvg({ tone: 'ok', headline: 'All green', test: { passed: 9, failed: 0 }, commands: { count: 2, failed: 0 } })
  expect([green.width, green.height]).toEqual([560, 24])
  expect(green.source).toContain('class="s-ok an-pop"')
  // No card: no box, no pills, no confetti.
  expect(green.source).not.toContain('<rect')
  const failing = receiptSvg({ tone: 'bad', headline: 'Tests failing', files: { count: 3, added: 40, removed: 12 }, test: { passed: 96, failed: 2 }, commands: { count: 4, failed: 1 } })
  expect(failing.source).toContain('class="s-bad an-shake"')
  expect(failing.alt).toBe('Turn receipt: Tests failing; 3 files +40 −12; 2 of 98 failed; 4 commands · 1 failed')
  for (const words of ['3 files ', '+40', ' −12', '2 of 98 failed', '4 commands', ' · 1 failed']) expect([words, failing.source.includes(`>${words}<`)]).toEqual([words, true])
})

test('compact density draws the chosen usage style at its shortest, the band at least 35% shorter', () => {
  const roomy = bandSvg(undefined, LIST, 900, { hero: true })!
  const marks = { tiles: 'sabai-u-', rings: 'k-stroke', columns: 'sabai-c-', rows: 'sabai-r-' }
  for (const usageStyle of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[])
    for (const W of [300, 600, 900]) {
      const tight = bandSvg(undefined, LIST, W, { hero: true, density: 'compact', usageStyle })!
      expect([usageStyle, W, tight.height, tight.source.includes(marks[usageStyle])]).toEqual([usageStyle, W, 50, true])
      expect(tight.alt).toBe(roomy.alt.split('; ').slice(1).join('; '))
    }
  expect(bandSvg(undefined, LIST, 900, { density: 'compact' })!.height).toBeLessThanOrEqual(Math.floor(roomy.height * 0.65))
})

test('the live strip shows the turn’s time, step and tallies, and takes Clawd when there are no tasks', () => {
  const live = { elapsedMs: 102_000, step: { icon: 'pen' as const, title: 'Editing svg.ts' }, files: 2, commands: 5, test: { passed: 178, failed: 0 } }
  const d = bandSvg(undefined, [], 800, { mood: 'working', live })!
  expect(d.alt).toContain('Working 1m 42s: Editing svg.ts; 2 files, 5 commands, 178 passed')
  expect(d.source.match(/class="run"/g)?.length).toBe(1)
  // With a tasks row, Clawd stays there.
  const withTasks = bandSvg({ title: 't', done: 1, total: 2 }, [], 800, { mood: 'working', live })!
  expect(withTasks.source.match(/class="run"/g)?.length).toBe(1)
  expect(withTasks.alt).toContain('Working 1m 42s')
})

test('on the narrowest band the live strip keeps the step and lets the tallies go', () => {
  const live = { elapsedMs: 31_000, step: { icon: 'terminal' as const, title: 'Wait eight seconds so the live strip can be seen' }, files: 0, commands: 2, test: { passed: 200, failed: 0 } }
  const d = bandSvg(undefined, [], 200, { mood: 'working', live })!
  expect(d.source).toContain('› Wait eight')
  // Wide enough, both show.
  expect(bandSvg(undefined, [], 600, { mood: 'working', live })!.source).toMatch(/› Wait eight[\s\S]*✓ 200/)
})

test('the comfortable band puts Clawd large in his own panel, with his mood and the turn’s time', () => {
  const live = { elapsedMs: 102_000, files: 0, commands: 0 }
  const d = bandSvg(undefined, LIST, 900, { hero: true, mood: 'working', live })!
  expect(d.source).toMatch(/scale\(3\)/)
  expect(d.source).toContain('>working<')
  expect(d.source).toContain('>1m 42s<')
  expect(d.alt.startsWith('Clawd: working, 1m 42s')).toBe(true)
  // Under 480 px, or compact, or Clawd hidden: not this layout.
  expect(bandSvg(undefined, LIST, 470, { hero: true })!.source).not.toMatch(/scale\(3\)/)
  expect(bandSvg(undefined, LIST, 900, { hero: true, density: 'compact' })!.source).not.toMatch(/scale\(3\)/)
  expect(bandSvg(undefined, LIST, 900, { hero: true, clawd: false })!.source).not.toMatch(/scale\(3\)/)
})

// A race lane as raceOf makes it, with what a test leaves out filled in.
const lane = (over: object) => ({ id: 'main', who: 'Main', step: 'n', count: 0, fails: 0, state: 'running', ...over })
const race = (lanes: object[], over: object = {}) => ({ agents: lanes.length - 1, done: 0, fails: 0, elapsedMs: 1000, more: 0, lanes: lanes.map(lane), ...over }) as never

test('the race box draws a row per member: its stripe, Clawd, name, step, failed calls, plan and time', () => {
  const look = lookOf('auto')
  const part = racePart(look, race([
    { step: 'Editing svg.ts', timeMs: 102_000, steps: { done: 2, total: 4 }, doing: 'edit' },
    { id: 'e', who: 'Explore', type: 'Explore', many: 3, step: '3 running', timeMs: 12_000, count: 1, state: 'scored' },
    { id: 'b', who: 'Write race tests', type: 'general-purpose', step: 'bun test failed', timeMs: 31_000, count: 1, fails: 1, mood: 'working', state: 'tripped' },
    { id: 'q', who: 'Plan the race', type: 'Plan', step: 'Read PLAN.md', timeMs: 125_000, mood: 'quiet', quietMs: 47_000, state: 'running' },
  ], { done: 1, fails: 1, elapsedMs: 102_000, more: 1 }), 300, 0)
  expect(part.height).toBe(24 + 4 * 22 + 16 + 6)
  for (const s of ['>3 agents<', '> · 1 done<', '>✗ 1<', '>1:42<', '>×3<', '>Write race tests<', '>· bun test failed<', '>✗1<', '>0:31<', '>2/4<', '>· quiet 47s<', '>+1 more · open Agents for all<', 'class="dizzy', 'class="hop', 'class="sleep'])
    expect([s, part.body.includes(s)]).toEqual([s, true])
  // A quiet agent's stripe and words are amber; a tripped one's red; Main's in Clawd's colour.
  expect(part.body).toMatch(/class="c-warn"[^>]*>· quiet 47s</)
  expect(part.body).toMatch(/class="c-alert"[^>]*>· bun test failed</)
  expect(part.body).toContain(`fill="${look.bar('tasks', 'warn')}"`)
  // Gone: the turn's worked calls, a lane's ✓ tally, the track, its footprints and flags.
  for (const s of ['✓', 'class="flag', 'class="scroll"', 'sabai-tr-', 'OUCH']) expect([s, part.body.includes(s)]).toEqual([s, false])
  expect(part.alt).toBe('Race: 3 agents, 1 done, 1 failed call, 1:42; Main running: Editing svg.ts (2/4); Explore ×3 scored: 3 running; Write race tests tripped: bun test failed, 1 failed; Plan the race running: quiet 47s; 1 more in the Agents pane')
})

test('a just-finished agent hops among confetti on a flashing row, then folds to a check', () => {
  const fresh = racePart(lookOf('auto'), race([{ state: 'waiting', step: 'waiting on 0' }, { id: 'p', who: 'Plan', type: 'Plan', step: 'Done', timeMs: 5000, fresh: true, mood: 'done', state: 'finished' }]), 300, 0).body
  for (const s of ['class="flash"', 'class="cf"', 'class="hop', '>· Done! 🎉<']) expect([s, fresh.includes(s)]).toEqual([s, true])
  const later = racePart(lookOf('auto'), race([{ state: 'waiting', step: 'waiting on 0' }, { id: 'p', who: 'Plan', type: 'Plan', step: 'Done', timeMs: 5000, mood: 'done', state: 'finished' }]), 300, 0).body
  for (const s of ['class="flash"', 'class="cf"', 'class="hop', '🎉']) expect([s, later.includes(s)]).toEqual([s, false])
  expect(later).toMatch(/class="c-ok"[^>]*>· Done</)
  // Main waiting fades its stripe; it wears the captain's cap.
  expect(later).toContain('opacity=".35"')
})

test('a row’s words stay inside the box, a long step cut for its failures, plan and time', () => {
  const body = racePart(lookOf('auto'), race([
    { step: 'Edited a file with a rather long name indeed.ts', timeMs: 3_599_000, count: 150, fails: 30, steps: { done: 12, total: 20 }, state: 'thinking' },
    { id: 'l', who: 'A very long agent description that goes on well past what a lane can hold', type: 'Explore', step: 'a very long step that will not fit either', timeMs: 3_600_000, fails: 9, state: 'running' },
  ], { fails: 39, elapsedMs: 6_000_000 }), 300, 0).body
  expect(body).toMatch(/>· Edited[^<]*…</)
  // Every word stays inside the 300 px box (mono widths: an upper bound for the sans words).
  for (const m of body.matchAll(/<text [^>]*?x="([\d.]+)"[^>]*?font-size="([\d.]+)"[^>]*>([^<]*)</g)) {
    const x = Number(m[1])
    const w = monoWidth(m[3]!, Number(m[2]))
    const [a, b] = m[0].includes('text-anchor="end"') ? [x - w, x] : [x, x + w]
    expect([m[3], a >= 0 && b <= 300]).toEqual([m[3], true])
  }
  // The header's failed calls end before its time.
  const fails = Number(body.match(/x="([\d.]+)"[^>]*>✗ 39</)![1])
  expect(fails).toBeLessThanOrEqual(300 - 12 - monoWidth('100:00', 10.5) - 10)
})

test('a turn with no known start draws no time: Clawd says his line, the strip and the race skip the clock', () => {
  const live = { step: { icon: 'pen' as const, title: 'Editing svg.ts' }, files: 0, commands: 0 }
  const raced = { agents: 1, done: 0, fails: 0, more: 0, lanes: [lane({ step: 'Editing svg.ts' }), lane({ id: 'a', who: 'A', type: 'Explore' })] }
  const hero = bandSvg(undefined, LIST, 900, { hero: true, mood: 'working', live, race: raced as never, clawdLine: 'on it' })!
  expect(hero.source).toContain('>on it<')
  expect(hero.source).not.toMatch(/undefined|NaN|\d+:\d\d</)
  expect(hero.alt).not.toMatch(/undefined|NaN/)
  const strip = bandSvg(undefined, LIST, 600, { hero: true, mood: 'working', live })!
  expect(strip.source).toContain('Editing svg.ts')
  expect(strip.source + strip.alt).not.toMatch(/undefined|NaN/)
})

test('the comfortable band’s tiers: three panels from 760 px, two below, stacked under 480', () => {
  const live = { elapsedMs: 102_000, step: { icon: 'pen' as const, title: 'Editing svg.ts' }, files: 1, commands: 2 }
  const raced = race([{ step: 'Editing svg.ts', doing: 'edit' }, { id: 'a', who: 'Survey', type: 'Explore' }], { elapsedMs: 102_000 })
  const crew = { runs: [{ id: 'a', agentId: 'a', type: 'Explore', description: 'Survey', model: 'm', status: 'running', startedAt: 0, contextTokens: 0, steps: 1 }], now: 1000 } as never
  const opts = { hero: true, mood: 'working' as const, live, race: raced, crew }
  const wide = bandSvg(undefined, LIST, 900, opts)!
  expect(wide.alt).toContain('Race: 1 agent')
  expect(wide.alt).not.toContain('Working 1m 42s:')
  expect(wide.alt).not.toContain('Agents:')
  const mid = bandSvg(undefined, LIST, 600, opts)!
  expect(mid.alt).not.toContain('Race:')
  expect(mid.alt).toContain('Working 1m 42s: Editing svg.ts')
  expect(mid.alt).toContain('Agents:')
  expect(bandSvg(undefined, LIST, 400, opts)!.source).not.toMatch(/scale\(3\)/)
  // Clawd hidden: no panel, the race stays.
  const noClawd = bandSvg(undefined, LIST, 900, { ...opts, clawd: false })!
  expect(noClawd.source).not.toMatch(/scale\(3\)/)
  expect(noClawd.alt).toContain('Race: 1 agent')
})

test('no race element carries two class attributes, whatever its Clawd is doing', () => {
  for (const doing of ['read', 'edit', 'command', 'test'] as const) {
    const body = racePart(lookOf('auto'), race([
      { doing, fails: 1 },
      { id: 'w', who: 'W', type: 'Plan', mood: 'quiet', quietMs: 31_000 },
      { id: 'f', who: 'F', type: 'Explore', step: 'Done', fresh: true, mood: 'done', state: 'finished' },
      { id: 'o', who: 'O', type: 'Explore', step: 'Failed', mood: 'failed', state: 'out' },
    ]), 300, 0).body
    const twice = body.match(/<[a-z]+\b[^>]*\bclass="[^"]*"[^>]*\bclass="[^>]*>/g)
    expect([doing, twice]).toEqual([doing, null])
  }
})

test('in the comfortable band the race box’s words take the card’s ink', () => {
  const raced = race([{ doing: 'test' }, { id: 'c', who: 'Plan', type: 'Plan', step: 'Done', state: 'finished' }], { done: 1, more: 1 })
  const source = bandSvg(undefined, LIST, 900, { hero: true, skin: 'raised', race: raced })!.source
  const [middle, box] = source.split('translate(600,0)')
  expect(box!.match(/class="(st|sm|f-ok)[" ]/g)).toBeNull()
  expect(middle).toContain('class="usage"')
})

test('the Clawd panel shows his headline and why, the failing count in alert ink', () => {
  const sad = bandSvg(undefined, LIST, 900, { hero: true, mood: 'sad', clawdLine: '2 failed' })!
  expect(sad.source).toContain('>tests failing<')
  expect(sad.source).toMatch(/class="c-alert"[^>]*>2 failed</)
  expect(sad.alt.startsWith('Clawd: tests failing, 2 failed')).toBe(true)
  const idle = bandSvg(undefined, LIST, 900, { hero: true, mood: 'idle', clawdLine: 'your turn' })!
  expect(idle.source).toContain('>ready<')
  expect(Number(idle.source.match(/height="(\d+)"/)![1])).toBeGreaterThanOrEqual(112)
})

const USAGE_LIST = [
  { kind: 'context', label: 'Context', percent: 74, amount: '743.5k / 1M', left: '256.5k left', level: 'warn' },
  { kind: 'session', label: '5H Limit', percent: 27, resetsInMs: 1_140_000 },
  { kind: 'week', label: '7D All', percent: 18, resetsInMs: 3.85e8 },
] as const
const RACE4 = { agents: 3, done: 0, fails: 0, elapsedMs: 1000, more: 0, lanes: ['main', 'a', 'b', 'c'].map(id => ({ id, who: id, step: 's', count: 0, state: 'running' })) }
// Every <text> inside the usage group, with its start and end by the mono estimate, in band x.
function usageTexts(source: string, x0: number) {
  const g = source.slice(source.indexOf('<g class="usage"'), source.indexOf('</g><!--usage-->'))
  return [...g.matchAll(/<text[^>]*? x="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
    const x = x0 + Number(m[1]), w = monoWidth(m[4]!.replace(/&amp;/g, '&'), Number(m[2]))
    const anchor = m[3]!.match(/text-anchor="(middle|end)"/)?.[1]
    return anchor === 'end' ? [x - w, x] : anchor === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]
  })
}

for (const style of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[]) {
  test(`usage style ${style}: fills the height, colours the percent by level, and keeps its words inside at 760 px with the race`, () => {
    const now = new Date('2026-10-11T13:00:00').getTime()
    const idle = bandSvg(undefined, USAGE_LIST as never, 900, { hero: true, usageStyle: style, now })!
    const working = bandSvg(undefined, USAGE_LIST as never, 900, { hero: true, usageStyle: style, now, race: RACE4 as never })!
    expect(Number(working.source.match(/height="(\d+)"/)![1])).toBeGreaterThan(Number(idle.source.match(/height="(\d+)"/)![1]))
    expect(idle.source).toMatch(/class="c-warn"[^>]*>74%</)
    const group = idle.source.slice(idle.source.indexOf('<g class="usage"'), idle.source.indexOf('</g><!--usage-->'))
    expect(group).not.toMatch(/class="(st|sm)"/)
    expect(working.alt).toMatch(/Context [^;]*74%/)
    const narrow = bandSvg(undefined, USAGE_LIST as never, 760, { hero: true, usageStyle: style, now, race: RACE4 as never })!.source
    const left = 116, right = 760 - 300 - 8
    // The percent is never cut, however narrow the cell.
    for (const pct of ['>74%<', '>27%<', '>18%<']) expect([style, pct, narrow.includes(pct)]).toEqual([style, pct, true])
    const texts = usageTexts(narrow, left)
    expect(texts.length).toBeGreaterThan(5)
    for (const [a, b] of texts) expect([style, a! >= left - 1 && b! <= right + 1]).toEqual([style, true])
  })
}

test('the usage gets its floor with Clawd hidden and no race, and no part without limits', () => {
  // Review Focus 2.
  const d = bandSvg(undefined, USAGE_LIST as never, 900, { hero: true, clawd: false, usageStyle: 'tiles' })!
  expect(Number(d.source.match(/height="(\d+)"/)![1])).toBeGreaterThanOrEqual(50)
  expect(d.source).not.toMatch(/height="(0|-)/)
  expect(bandSvg(undefined, [], 900, { hero: true, usageStyle: 'tiles' })!.source).not.toContain('class="usage"')
})

// Every usage text as a box: [x0, x1, top, baseline], in the usage group's coordinates.
function usageBoxes(source: string) {
  const g = source.slice(source.indexOf('<g class="usage"'), source.indexOf('</g><!--usage-->'))
  return [...g.matchAll(/<text[^>]*? x="([\d.]+)" y="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
    const x = Number(m[1]), y = Number(m[2]), size = Number(m[3]), w = monoWidth(m[5]!.replace(/&amp;/g, '&'), size)
    const anchor = m[4]!.match(/text-anchor="(middle|end)"/)?.[1]
    const [a, b] = anchor === 'end' ? [x - w, x] : anchor === 'middle' ? [x - w / 2, x + w / 2] : [x, x + w]
    return { a, b, top: y - size * 0.72, y, text: m[5]! }
  })
}

for (const style of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[]) {
  test(`usage style ${style} lays out in the short heights a working band gives it, words inside and apart`, () => {
    const now = new Date('2026-10-11T13:00:00').getTime()
    const race1 = { running: 1, done: 0, ok: 0, fails: 0, elapsedMs: 1000, more: 0, lanes: [{ id: 'main', who: 'Main', step: 's', count: 0, calls: [], state: 'running' }] }
    const tasks = { title: 'Ship it', done: 1, total: 3 }
    // The usage takes what the tasks row leaves, in 107 px cells beside the race.
    for (const clawd of [true, false]) {
      const d = bandSvg(tasks, USAGE_LIST as never, 760, { hero: true, clawd, usageStyle: style, now, race: race1 as never })!
      const top = Number(d.source.match(/<g class="usage" transform="translate\(0,(\d+)\)"/)![1])
      const h = Number(d.source.match(/height="(\d+)"/)![1]) - top
      const boxes = usageBoxes(d.source)
      for (const t of boxes) expect([style, clawd, t.text, t.top >= 0 && t.y <= h]).toEqual([style, clawd, t.text, true])
      for (const [i, p] of boxes.entries())
        for (const q of boxes.slice(i + 1)) {
          const overlap = p.a < q.b && q.a < p.b && p.top < q.y && q.top < p.y
          expect([style, clawd, p.text, q.text, overlap]).toEqual([style, clawd, p.text, q.text, false])
        }
      for (const pct of ['>74%<', '>27%<', '>18%<']) expect([style, pct, d.source.includes(pct)]).toEqual([style, pct, true])
    }
  })
}

test('a mark can take a class in place of its own colour', () => {
  expect(icon('git', 0, 0, 12)).toContain('fill="#F05032"')
  const classed = icon('git', 0, 0, 12, 'sm')
  expect(classed).toContain('class="sm"')
  expect(classed).not.toContain('fill=')
})

const ROW = {
  left: [
    { icon: 'folder', label: 'Directory', value: 'claude-skins' },
    { icon: 'git', label: 'Git user', value: 'Panupat' },
    { icon: 'branch', label: 'Branch', value: 'sabai-2.4 ↑2 ↓1 ±3', branch: 'sabai-2.4', ahead: 2, behind: 1, changes: 3 },
  ],
  right: [{ icon: 'node', label: 'Node', value: 'v24.21.0' }],
} as const
// The info card's texts in order.
const infoRow = (source: string) => source.slice(source.indexOf('<g class="info">'), source.indexOf('</g><!--info-->'))
const rowTexts = (source: string) => [...infoRow(source).matchAll(/<text class="([^"]+)"[^>]*>([^<]*)</g)].map(m => [m[1], m[2]])
// Each text's [left, right] in the card's own coordinates.
const textBoxes = (source: string) =>
  [...infoRow(source).matchAll(/<text[^>]*? x="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)].map(m => {
    const x = Number(m[1]), w = monoWidth(m[4]!, Number(m[2]))
    return m[3]!.includes('text-anchor="end"') ? [x - w, x] : [x, x + w]
  })

test('the info card: the project, a branch tag with its sync, then the user and Node in muted ink', () => {
  const d = infoSvg(ROW, 900)!
  expect(rowTexts(d.source)).toEqual([
    ['t', 'claude-skins'], ['c-session', 'sabai-2.4'], ['c-ok', '↑2'], ['c-context', '↓1'], ['c-warn', '±3'],
    ['m', 'Panupat'], ['m', 'v24.21.0'],
  ])
  // The tag's words sit 8 px from either end.
  expect(infoRow(d.source)).toContain('width="92.4"')
  expect(d.alt).toBe('Directory claude-skins, Git user Panupat, Branch sabai-2.4 ↑2 ↓1 ±3, Node v24.21.0')
})

test('a cut branch keeps six characters; a Node version without its v reads like one with it', () => {
  const row = { left: [{ icon: 'folder', label: 'Directory', value: 'w' }, { icon: 'branch', label: 'Branch', value: 'x', branch: 'abcdefghijklmnop' }], right: [] } as const
  // At 96 px the folder has already given way; the branch alone is then cut.
  expect(rowTexts(infoSvg(row, 96)!.source)).toEqual([['c-session', 'abcdef…']])
  expect(rowTexts(infoSvg({ left: [], right: [{ icon: 'node', label: 'Node', value: '24.1.0' }] }, 900)!.source)).toEqual([['m', 'v24.1.0']])
})

test('a narrow info card drops the user, then Node, then the sync counts; then the folder gives way to the branch', () => {
  const at = (W: number) => rowTexts(infoSvg(ROW, W)!.source).map(t => t[1]!)
  expect(at(900)).toContain('Panupat')
  const noUser = [400, 380, 360, 340, 320].map(at).find(t => !t.includes('Panupat'))!
  expect(noUser).toContain('v24.21.0')
  const tiny = at(240)
  expect(tiny).not.toContain('v24.21.0')
  expect(tiny).not.toContain('↑2')
  expect(tiny).toContain('sabai-2.4')
  expect(at(150)).toEqual(['sabai-2.4'])
})

test('hidden or unread parts leave no gap; a plain branch chip draws its value', () => {
  const noFolder = { ...ROW, left: ROW.left.slice(1) }
  expect(rowTexts(infoSvg(noFolder, 900)!.source)[0]).toEqual(['c-session', 'sabai-2.4'])
  const noBranch = { ...ROW, left: ROW.left.slice(0, 2) }
  expect(rowTexts(infoSvg(noBranch, 900)!.source).map(t => t[0])).not.toContain('c-ok')
  const plain = { left: [{ icon: 'branch', label: 'Branch', value: 'main ±2' }], right: [] } as const
  expect(rowTexts(infoSvg(plain, 900)!.source)).toEqual([['c-session', 'main ±2']])
  // Zero counts are not drawn.
  const zero = { left: [{ icon: 'branch', label: 'Branch', value: 'main', branch: 'main', ahead: 0, behind: 0, changes: 0 }], right: [] } as const
  expect(rowTexts(infoSvg(zero, 900)!.source)).toEqual([['c-session', 'main']])
})

test('no two info-card texts overlap, nor run past the card, at any width, with or without Clawd', () => {
  for (const W of [240, 320, 400, 480, 600, 760, 900, 1400]) {
    for (const clawd of [undefined, { mood: 'idle' as const }]) {
      const boxes = textBoxes(infoSvg(ROW, W, clawd ? { clawd } : {})!.source)
      for (const [i, p] of boxes.entries()) for (const q of boxes.slice(i + 1)) expect([W, Boolean(clawd), p[0]! < q[1]! && q[0]! < p[1]!]).toEqual([W, Boolean(clawd), false])
      // The words sit 8 px into the card, so they end within W − 16.
      for (const [a, b] of boxes) expect([W, Boolean(clawd), a! >= -1 && b! <= W - 16 + 1]).toEqual([W, Boolean(clawd), true])
    }
  }
})

test('the desktop top row packs every chip from the left on a card as wide as its room', () => {
  const d = infoSvg(ROW, 900)!
  // The user follows the counts a gap apart, not from the right edge; Node ends well short of it.
  const counts = d.source.match(/<text class="c-warn" x="([\d.]+)"/)!
  const user = d.source.match(/<text class="m" x="([\d.]+)"[^>]*>Panupat</)!
  expect(Number(user[1])).toBeGreaterThan(Number(counts[1]) + monoWidth('±3', 10.5) + 7)
  const node = d.source.match(/<text class="m" x="([\d.]+)"[^>]*>v24\.21\.0</)!
  expect(Number(node[1]) + monoWidth('v24.21.0', 10.5)).toBeLessThan(600)
  // The card fills the room the buttons leave, the words 8 px inside it.
  expect(d.width).toBe(900)
  expect(d.source).toContain('<rect class="p" y="0" width="900" height="22" rx="6"/><g transform="translate(8,0)">')
  expect(infoSvg(ROW, 390)!.width).toBeLessThanOrEqual(390)
  // Clawd leads it when he stands here; with nothing to show and no Clawd there is no drawing.
  expect(infoSvg(ROW, 900, { clawd: { mood: 'idle' } })!.source).toContain('crispEdges')
  expect(infoSvg(ROW, 900)!.source).not.toContain(MOTION)
  // No surface ink is left on the card, where it may not read (a dark skin's card on a light OS).
  expect(infoRow(d.source)).not.toMatch(/class="s(t|m|-[a-z]+)"/)
  expect(infoSvg({ left: [], right: [] }, 900)).toBeUndefined()
})

test('a toolbar icon sits on a tile of the card, its Lucide shape and count in the skin\u2019s ink', () => {
  const quiet = toolIconSvg('settings')
  expect([quiet.width, quiet.height]).toEqual([26, 22])
  expect(quiet.source).toContain('<rect class="p" width="26" height="22" rx="6"/>')
  // The shape masks a rect in the muted ink, so light and dark follow the skin's own stylesheet.
  expect(quiet.source).toContain('<rect class="m" x="5" y="3" width="16" height="16" mask="url(#sabai-tool)"/>')
  expect(quiet.source).toContain(`.m{fill:${TEXT.m[0]}}`)
  expect(quiet.source).not.toContain('<text')
  const busy = toolIconSvg('compact', '82%', 'warn', 'raised')
  expect(busy.source).toContain('<text class="c-warn"')
  expect(busy.source).toContain('>82%</text>')
  expect(busy.source).toContain('.p{fill:#ffffff}')
  expect(busy.width).toBe(26 + 4 + Math.ceil(monoWidth('82%', 11)))
  expect(toolIconSvg('agents', '2', 'tasks').source).toContain('<rect width="16" height="12" x="4" y="8" rx="2"/>')
})

test('a long branch name is cut before it pushes Node off a wide row', () => {
  const long = { ...ROW, left: [ROW.left[0], ROW.left[1], { icon: 'branch', label: 'Branch', value: 'x', branch: 'dependabot/npm_and_yarn/some-package-1.2.3-beta', ahead: 1 }] } as const
  const texts = rowTexts(infoSvg(long, 700)!.source).map(t => t[1]!)
  expect(texts).toContain('v24.21.0')
  expect(texts.find(t => t.startsWith('dependabot'))!.endsWith('…')).toBe(true)
})

test('at 240 px nothing is drawn after the branch in the info card', () => {
  const texts = rowTexts(infoSvg(ROW, 240)!.source)
  expect(texts.filter(t => t[0] === 'm')).toEqual([])
})

test('an emoji branch is measured as it is cut, so the counts stay inside the row', () => {
  const branch = 'feat/' + '🚀'.repeat(25)
  const row = { left: [{ icon: 'folder', label: 'Directory', value: 'w' }, { icon: 'branch', label: 'Branch', value: branch, branch, ahead: 2, changes: 3 }], right: [] } as const
  for (const W of [300, 417, 418, 419, 460]) {
    const row2 = infoRow(infoSvg(row, W)!.source)
    for (const m of row2.matchAll(/<text[^>]*? x="([\d.]+)"[^>]*? font-size="([\d.]+)"([^>]*)>([^<]*)</g)) {
      const end = m[3]!.includes('text-anchor="end"') ? Number(m[1]) : Number(m[1]) + [...m[4]!].length * Number(m[2]) * 0.6
      // The words sit 8 px into the card.
      expect([W, m[4], end <= W - 16 + 1]).toEqual([W, m[4], true])
    }
  }
})

test('cutting a long branch never splits a joined emoji', () => {
  const family = '👨‍👩‍👧‍👦'
  const branch = 'feat/' + family.repeat(25)
  const row = { left: [{ icon: 'branch', label: 'Branch', value: branch, branch }], right: [] } as const
  const drawn = rowTexts(infoSvg(row, 900)!.source).find(t => t[0] === 'c-session')![1]!
  expect(drawn.endsWith('…')).toBe(true)
  expect(drawn).not.toMatch(/‍…$/)
  expect(drawn.slice(5, -1).split(family).join('')).toBe('')
})

// The [left, right] span of each end-anchored mono text a drawing puts on line `y`.
const endSpans = (body: string, y: number) =>
  [...body.matchAll(/<text [^>]*x="([\d.]+)" y="([\d.]+)" text-anchor="end" font-family="[^"]*monospace[^"]*" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    .filter(m => Number(m[2]) === y)
    .map(m => [Number(m[1]) - monoWidth(m[4]!, Number(m[3])), Number(m[1])] as const)
    .sort((a, b) => a[0] - b[0])

test('a stacked ring with nothing beside its label leaves no dangling separator', () => {
  const list = [{ kind: 'context', label: 'Context', percent: 12 }, { kind: 'session', label: '5H Limit', percent: 30 }, { kind: 'week', label: '7D All', percent: 40 }] as never
  expect(bandSvg(undefined, list, 480, { hero: true, usageStyle: 'rings' })!.source).not.toContain(' · </text>')
})

test('idle skin swatches and the still bar previews carry no motion stylesheet', () => {
  expect(skinPreview('raised', 400).source).not.toContain(MOTION)
  expect(skinPreview('raised', 400, true).source).toContain(MOTION)
  expect(barPreview('solid', 'raised', 400).source).not.toContain(MOTION)
  expect(barPreview('dither', 'raised', 400).source).toContain(MOTION)
})

test('a ring at 0% draws its track and no dot', () => {
  const list = [{ kind: 'session', label: '5H Limit', percent: 0 }, { kind: 'week', label: '7D All', percent: 40 }] as never
  const source = bandSvg(undefined, list, 900, { hero: true, usageStyle: 'rings', clawd: false })!.source
  expect(source.match(/stroke-dasharray/g)!.length).toBe(1)
  expect(source).not.toContain('stroke-dasharray="0 ')
})

test('a slow step’s tortoise time sits clear of its pill', () => {
  const d = stepSvg({ icon: 'terminal', tone: 'ok', title: 'Run', detail: '', result: [{ text: '✓ done', tone: 'ok' }], time: '🐢 1m 5s' })
  const pill = d.source.match(/<rect class="k-ok" opacity="[\d.]+" x="([\d.]+)" y="4" width="([\d.]+)"/)!
  const time = endSpans(d.source, 15.5)[0]!
  expect(Number(pill[1]) + Number(pill[2]) <= time[0]).toBe(true)
  // A plain time keeps the column, so pills line up from row to row.
  const plain = stepSvg({ icon: 'terminal', tone: 'ok', title: 'Run', detail: '', result: [{ text: '✓ done', tone: 'ok' }], time: '1.2s' })
  const none = stepSvg({ icon: 'terminal', tone: 'ok', title: 'Run', detail: '', result: [{ text: '✓ done', tone: 'ok' }] })
  const pillX = (src: string) => src.match(/<rect class="k-ok" opacity="[\d.]+" x="([\d.]+)"/)![1]
  expect(pillX(plain.source)).toBe(pillX(none.source))
})

test('mono widths count an emoji or a CJK character as wide, and a joined emoji once', () => {
  expect(['ab', '🐢', '日本', '👨‍👩‍👧'].map(s => Math.round(monoWidth(s, 10)))).toEqual([12, 12, 20, 12])
})

test('the band’s loops each last a second or less', () => {
  const loops = [...MOTION.matchAll(/animation(?:-duration)?:[^;}]*?([\d.]+)s/g)].map(m => Number(m[1]))
  expect(loops.length).toBeGreaterThan(5)
  expect(loops.filter(n => n > 1).filter(n => n !== 3.2)).toEqual([])
})

test('the skeleton holds the loaded band’s height in every layout and style, and draws no number', () => {
  expect(infoSvg({ left: [], right: [], pending: true }, 600)!.alt).toBe('Reading the project')
  const ghosts = LIST.map(({ kind, label }) => ({ kind, label, percent: 0, pending: true as const }))
  for (const W of [360, 600, 900, 1200])
    for (const density of ['comfortable', 'compact'] as const)
      for (const usageStyle of Object.keys(USAGE_STYLES) as (keyof typeof USAGE_STYLES)[]) {
        const opts = { hero: true, density, usageStyle }
        const loaded = bandSvg(undefined, LIST, W, opts)!
        const skeleton = bandSvg(undefined, ghosts, W, opts)!
        expect([W, density, usageStyle, skeleton.height]).toEqual([W, density, usageStyle, loaded.height])
        expect(skeleton.source).not.toMatch(/>\d+%</)
        expect(skeleton.source).toContain('>—<')
        expect(skeleton.alt).toContain('Context loading')
      }
})

test('a usage with nothing to show leaves a note in its place', () => {
  for (const opts of [{ hero: true }, {}, { density: 'compact' as const }]) {
    const d = bandSvg(undefined, [], 900, { ...opts, usageNote: 'No usage reading yet' })!
    expect(d.source).toContain('>No usage reading yet<')
    expect(d.alt).toContain('No usage reading yet')
  }
})
