import { expect, test } from 'claude-code/testing'
import { SPINNER_WORDS, clean, isGenericWord, outputOf, seconds, seedOf, spinnerWord, splitCallouts, stepOf, stepText, testResult } from '../hooks/chat'


test('seconds keeps one decimal under ten seconds, then whole units', () => {
  expect([seconds(420), seconds(4210), seconds(12_400), seconds(64_000)]).toEqual(['0.4s', '4.2s', '12s', '1m 4s'])
})

test('test summaries of each runner are read from their real output', () => {
  expect(testResult('hooks/x.test.ts:\n(pass) a\n\n 96 pass\n 0 fail\n 2 skip\nRan 98 tests across 7 files. [3.04s]')).toEqual({ runner: 'bun', passed: 96, failed: 0, skipped: 2 })
  expect(testResult('PASS src/a.test.js\nTests:       1 failed, 2 skipped, 95 passed, 98 total\nTime: 4 s')).toEqual({ runner: 'jest', passed: 95, failed: 1, skipped: 2 })
  expect(testResult(' Test Files  3 passed (3)\n      Tests  95 passed | 1 failed (96)\n   Duration  1.2s')).toEqual({ runner: 'vitest', passed: 95, failed: 1, skipped: 0 })
  expect(testResult('=========== 95 passed, 2 failed, 1 skipped in 12.40s ===========')).toEqual({ runner: 'pytest', passed: 95, failed: 2, skipped: 1 })
  expect(testResult('test result: ok. 10 passed; 0 failed; 1 ignored\n\ntest result: FAILED. 4 passed; 2 failed; 0 ignored')).toEqual({ runner: 'cargo', passed: 14, failed: 2, skipped: 1 })
  expect(testResult('=== RUN TestA\n--- PASS: TestA (0.00s)\n--- FAIL: TestB (0.01s)\nFAIL\tpkg\t0.2s')).toEqual({ runner: 'go', passed: 1, failed: 1, skipped: 0 })
  expect(testResult('ok  \tgithub.com/x/a\t0.1s\nok  \tgithub.com/x/b\t0.3s')).toEqual({ runner: 'go', passed: 2, failed: 0, skipped: 0 })
})

test('text that only mentions passes is not a test summary', () => {
  expect(testResult('0 fail')).toBeUndefined()
  expect(testResult('5 passed the review')).toBeUndefined()
  expect(testResult('ok then')).toBeUndefined()
  expect(testResult('Ran 0 tests across 0 files.\n 0 pass\n 0 fail')).toBeUndefined()
})

test('callouts are cut out of a message in order, with the text around them kept', () => {
  expect(splitCallouts('Intro.\n\n> [!WARNING]\n> Deletes the cache.\n> Rerun the build.\n\nAfter.')).toEqual([
    { kind: 'md', text: 'Intro.\n' },
    { kind: 'callout', type: 'warning', body: 'Deletes the cache.\nRerun the build.' },
    { kind: 'md', text: 'After.' },
  ])
})

test('every kind, any case, a title on the marker line, and back-to-back callouts', () => {
  expect(splitCallouts('> [!tip] Use bun\n> [!Caution]\n> Careful')).toEqual([
    { kind: 'callout', type: 'tip', body: 'Use bun' },
    { kind: 'callout', type: 'caution', body: 'Careful' },
  ])
  for (const k of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) expect(splitCallouts(`> [!${k}]\n> x`)[0]).toMatchObject({ kind: 'callout' })
})

test('a marker inside a code fence, a plain quote and an unknown kind stay text', () => {
  const fenced = '```md\n> [!NOTE]\n> example\n```'
  expect(splitCallouts(fenced)).toEqual([{ kind: 'md', text: fenced }])
  expect(splitCallouts('> just a quote')).toEqual([{ kind: 'md', text: '> just a quote' }])
  expect(splitCallouts('> [!FOO]\n> x')).toEqual([{ kind: 'md', text: '> [!FOO]\n> x' }])
})

test('every spinner mode has Thai words, picked steadily for a seed', () => {
  for (const [mode, words] of Object.entries(SPINNER_WORDS)) {
    expect([mode, words.length > 0, words.every(w => /[\u0E00-\u0E7F]/.test(w) && !w.endsWith('…'))]).toEqual([mode, true, true])
  }
  const seed = seedOf('turn-42')
  expect(spinnerWord('thinking', seed)).toBe(spinnerWord('thinking', seed))
  expect(SPINNER_WORDS.thinking).toContain(spinnerWord('thinking', seed))
  expect(spinnerWord('tool-input', 7)).toBe('กำลังเตรียมคำสั่ง')
})

test('only the desktop’s generic word is replaced there', () => {
  expect([isGenericWord('Working'), isGenericWord('Creating notes.md'), isGenericWord('')]).toEqual([true, false, true])
})

test('output is cleaned of terminal colour codes and carriage-return redraws', () => {
  expect(clean('\x1b[32mok\x1b[0m\r\nstep 1\rstep 2\x07')).toBe('ok\nstep 2')
})

test('Bash output shows its last lines, counting the rest; an empty run shows nothing', () => {
  const out = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') + '\n\n'
  expect(outputOf('Bash', { stdout: out, stderr: '' })).toEqual({ source: 'line 5\nline 6\nline 7\nline 8\nline 9\nline 10', more: 4 })
  expect(outputOf('Bash', 'Exit code 1\nboom')).toEqual({ source: 'Exit code 1\nboom', more: 0 })
  expect(outputOf('Bash', { stdout: '', stderr: '  \n' })).toBeUndefined()
})

test('an edit shows its diff as unified hunks, cut whole and re-counted when long', () => {
  const short = outputOf('Edit', { filePath: 'a.ts', structuredPatch: [{ oldStart: 3, oldLines: 2, newStart: 3, newLines: 2, lines: [' a', '-b', '+c'] }] })
  expect(short).toEqual({ source: '@@ -3,2 +3,2 @@\n a\n-b\n+c', format: 'diff', path: 'a.ts', more: 0 })
  const long = outputOf('Edit', { filePath: 'a.ts', structuredPatch: [{ oldStart: 1, oldLines: 20, newStart: 1, newLines: 20, lines: Array.from({ length: 20 }, (_, i) => (i % 2 ? `+n${i}` : ` c${i}`)) }] })
  expect(long?.more).toBe(8)
  expect(long?.source.split('\n')[0]).toBe('@@ -1,6 +1,12 @@')
})

test('a new file shows its first lines, highlighted by its path', () => {
  expect(outputOf('Write', { type: 'create', filePath: 'x.py', content: 'a\nb\nc\nd\ne\nf\ng\nh\n', structuredPatch: [] })).toEqual({ source: 'a\nb\nc\nd\ne\nf', path: 'x.py', more: 2 })
  expect(outputOf('Read', { type: 'text', file: {} })).toBeUndefined()
})

const call = (tool: string, input: Record<string, unknown>, output: unknown, more: Record<string, unknown> = {}) =>
  stepOf({ tool, input, output, isRunning: false, isErrored: false, isInterrupted: false, tests: true, ...more })

test('a command is a step titled by what it was for, with the command as its detail', () => {
  const s = call('Bash', { command: 'npm run build\nnpm test', description: 'build the app' }, { stdout: '', stderr: '' }, { durationMs: 4210 })
  expect(s).toEqual({ icon: 'terminal', tone: 'ok', title: 'Build the app', detail: '$ npm run build', time: '4.2s', result: [{ text: '✓ done', tone: 'ok' }] })
  expect(call('Bash', { command: 'ls -la' }, {})?.title).toBe('Ls -la')
})

test('a command ends failed, interrupted, in the background, or still running', () => {
  expect(stepText(call('Bash', { command: 'false', description: 'fail' }, 'Exit code 1', { isErrored: true, durationMs: 400 })!)).toBe('Fail · ✗ failed · 0.4s')
  expect(call('Bash', { command: 'x' }, {}, { isInterrupted: true })).toMatchObject({ icon: 'stop', result: [{ text: 'interrupted' }] })
  expect(call('Bash', { command: 'dev' }, { backgroundTaskId: 'b1' })).toMatchObject({ result: [{ text: 'in the background' }], quiet: true })
  const running = call('Bash', { command: 'sleep 9' }, undefined, { isRunning: true, durationMs: 100 })
  expect(running).toMatchObject({ result: [{ text: 'running…' }], quiet: true })
  expect(running?.time).toBeUndefined()
})

test('a test run is a flask step with its counts; passing, its output is not repeated', () => {
  const pass = call('Bash', { command: 'bun test', description: 'run the tests' }, { stdout: ' 9 pass\n 0 fail\nRan 9 tests across 1 files.' })
  expect(pass).toMatchObject({ icon: 'flask', tone: 'ok', result: [{ text: '✓ 9 passed', tone: 'ok' }], quiet: true })
  const fail = call('Bash', { command: 'bun test' }, 'Exit code 1\n 8 pass\n 1 fail\nRan 9 tests across 1 files.', { isErrored: true })
  expect(fail).toMatchObject({ icon: 'flask', tone: 'bad', result: [{ text: '✗ 1 of 9 failed', tone: 'bad' }] })
  expect(fail?.quiet).toBeUndefined()
  const later = call('Bash', { command: 'bun test && tsc' }, 'Exit code 2\n 3 pass\n 0 fail\nRan 3 tests across 1 files.\nerror TS1', { isErrored: true })
  expect(later?.result).toEqual([{ text: '✗ failed', tone: 'bad' }])
  expect(call('Bash', { command: 'bun test' }, { stdout: ' 9 pass\n 0 fail\nRan 9 tests across 1 files.' }, { tests: false })?.icon).toBe('terminal')
})

test('edits, writes and reads are steps named by their file, with the path as the detail', () => {
  const patch = [{ lines: [' a', '-b', '+c', '+d'] }, { lines: ['+e'] }]
  expect(call('Edit', { file_path: '/repo/plugins/x/hooks/svg.ts' }, { structuredPatch: patch })).toEqual({
    icon: 'pen', tone: 'edit', title: 'Edited svg.ts', detail: '…/x/hooks/svg.ts', result: [{ text: '+3', tone: 'ok' }, { text: ' −1', tone: 'bad' }],
  })
  expect(call('Edit', { file_path: 'a.ts' }, { structuredPatch: [{ lines: [' same'] }] })?.result).toEqual([{ text: 'no change', tone: 'muted' }])
  expect(call('Write', { file_path: 'docs/new.md' }, { type: 'create', content: 'a\nb\n' })).toMatchObject({ icon: 'file', title: 'Created new.md', result: [{ text: 'new · 2 lines' }] })
  expect(call('Read', { file_path: 'README.md' }, { type: 'text', file: { startLine: 1, numLines: 20, totalLines: 131 } })).toMatchObject({ title: 'Read README.md', result: [{ text: 'lines 1–20 of 131' }], quiet: true })
  expect(call('Read', { file_path: 'README.md' }, { type: 'text', file: { startLine: 1, numLines: 131, totalLines: 131 } })?.result).toEqual([{ text: '131 lines', tone: 'muted' }])
  expect(call('Grep', { pattern: 'x' }, {})).toBeUndefined()
})
