import { expect, test } from 'claude-code/testing'
import type { TurnLog } from '../types'
import { EMPTY_LOG, SPINNER_WORDS, clean, isGenericWord, isReadOnly, logged, receiptOf, receiptText, seconds, seedOf, spinnerWord, splitCallouts, stepOf, stepText, testResult } from '../hooks/chat'


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

const call = (tool: string, input: Record<string, unknown>, output: unknown, more: Record<string, unknown> = {}) =>
  stepOf({ tool, input, output, isRunning: false, isErrored: false, isInterrupted: false, tests: true, ...more })

test('a command is a step titled by what it was for, with the command as its detail', () => {
  const s = call('Bash', { command: 'npm run build\nnpm test', description: 'build the app' }, { stdout: '', stderr: '' }, { durationMs: 4210 })
  expect(s).toEqual({ icon: 'terminal', tone: 'ok', title: 'Build the app', detail: '$ npm run build', time: '4.2s', result: [{ text: '✓ done', tone: 'ok' }] })
  expect(call('Bash', { command: 'x' }, {}, { durationMs: 45_000 })?.time).toBe('🐢 45s')
  expect(call('Bash', { command: 'ls -la' }, {})?.title).toBe('ls -la')
})

test('a command ends failed, interrupted, in the background, or still running', () => {
  expect(stepText(call('Bash', { command: 'false', description: 'fail' }, 'Exit code 1', { isErrored: true, durationMs: 400 })!)).toBe('Fail, $ false, failed, exit 1, 0.4s')
  expect(call('Bash', { command: 'x' }, {}, { isInterrupted: true })).toMatchObject({ icon: 'stop', result: [{ text: 'interrupted' }] })
  expect(call('Bash', { command: 'dev' }, { backgroundTaskId: 'b1' })).toMatchObject({ result: [{ text: 'in the background' }] })
  const running = call('Bash', { command: 'sleep 9' }, undefined, { isRunning: true, durationMs: 100 })
  expect(running).toMatchObject({ result: [{ text: 'running…' }] })
  expect(running?.time).toBeUndefined()
})

test('a test run is a flask step with its counts', () => {
  const pass = call('Bash', { command: 'bun test', description: 'run the tests' }, { stdout: ' 9 pass\n 0 fail\nRan 9 tests across 1 files.' })
  expect(pass).toMatchObject({ icon: 'flask', tone: 'ok', result: [{ text: '✓ 9 passed', tone: 'ok' }] })
  const fail = call('Bash', { command: 'bun test' }, 'Exit code 1\n 8 pass\n 1 fail\nRan 9 tests across 1 files.', { isErrored: true })
  expect(fail).toMatchObject({ icon: 'flask', tone: 'bad', result: [{ text: '✗ 1 of 9 failed', tone: 'bad' }] })
  const later = call('Bash', { command: 'bun test && tsc' }, 'Exit code 2\n 3 pass\n 0 fail\nRan 3 tests across 1 files.\nerror TS1', { isErrored: true })
  expect(later?.result).toEqual([{ text: '✗ exit 2', tone: 'bad' }])
  expect(call('Bash', { command: 'bun test' }, { stdout: ' 9 pass\n 0 fail\nRan 9 tests across 1 files.' }, { tests: false })?.icon).toBe('terminal')
})

test('edits, writes and reads are steps named by their file, with the path as the detail', () => {
  const patch = [{ lines: [' a', '-b', '+c', '+d'] }, { lines: ['+e'] }]
  expect(call('Edit', { file_path: '/repo/plugins/x/hooks/svg.ts' }, { structuredPatch: patch })).toEqual({
    icon: 'pen', tone: 'edit', title: 'Edited svg.ts', detail: '…/x/hooks/', result: [{ text: '+3', tone: 'ok' }, { text: ' −1', tone: 'bad' }], meter: { good: 3, bad: 1 },
  })
  expect(call('Edit', { file_path: 'a.ts' }, { structuredPatch: [{ lines: [' same'] }] })?.result).toEqual([{ text: 'no change', tone: 'muted' }])
  expect(call('Write', { file_path: 'docs/new.md' }, { type: 'create', content: 'a\nb\n' })).toMatchObject({ icon: 'file', title: 'Created new.md', result: [{ text: '2 lines' }] })
  expect(call('Read', { file_path: 'README.md' }, { type: 'text', file: { startLine: 1, numLines: 20, totalLines: 131 } })).toMatchObject({ title: 'Read README.md', result: [{ text: 'lines 1–20 of 131' }] })
  expect(call('Read', { file_path: 'README.md' }, { type: 'text', file: { startLine: 1, numLines: 131, totalLines: 131 } })?.result).toEqual([{ text: '131 lines', tone: 'muted' }])
  expect(call('Grep', { pattern: 'x' }, {})).toBeUndefined()
})

test('a test run carries a pass/fail meter; an edit read from its input counts its lines', () => {
  expect(call('Bash', { command: 'bun test' }, 'Exit code 1\n 8 pass\n 2 fail\nRan 10 tests across 1 files.', { isErrored: true })?.meter).toEqual({ good: 8, bad: 2 })
  expect(call('Edit', { file_path: 'a.ts', old_string: 'a\nb', new_string: 'c' }, undefined)).toMatchObject({ result: [{ text: '+1' }, { text: ' −2' }], meter: { good: 1, bad: 2 } })
})

// Review fixes (2026-10-11).
test('a failed, interrupted or running Edit, Write or Read says so, with the error as its detail', () => {
  expect(call('Edit', { file_path: 'b.ts', old_string: 'x', new_string: 'y' }, '<tool_use_error>String to replace not found in file.</tool_use_error>', { isErrored: true })).toMatchObject({
    icon: 'pen', tone: 'bad', title: 'Edit b.ts', detail: 'String to replace not found in file.', result: [{ text: '✗ failed', tone: 'bad' }],
  })
  expect(call('Read', { file_path: 'missing.ts' }, 'File does not exist.', { isErrored: true })).toMatchObject({ tone: 'bad', title: 'Read missing.ts' })
  expect(call('Write', { file_path: 'c.ts', content: 'a' }, undefined, { isInterrupted: true })).toMatchObject({ icon: 'stop', result: [{ text: 'interrupted' }] })
  expect(call('Read', { file_path: 'x.ts' }, undefined, { isRunning: true })).toMatchObject({ title: 'Reading x.ts', result: [{ text: 'running…' }] })
  expect(call('Edit', { file_path: 'x.ts', new_string: 'a' }, undefined, { isRunning: true })?.result).toEqual([{ text: 'running…', tone: 'muted' }])
})

test('test counts come only from a command that runs tests; go counts top-level tests once', () => {
  expect(call('Bash', { command: 'tail ci.log' }, { stdout: 'Tests:       1 failed, 2 passed, 3 total' })).toMatchObject({ icon: 'terminal', result: [{ text: '✓ done' }] })
  expect(call('Bash', { command: 'cd x && npx vitest run' }, { stdout: '      Tests  4 passed (4)' })?.icon).toBe('flask')
  expect(testResult('--- PASS: TestA (0.00s)\n    --- PASS: TestA/sub (0.00s)\n--- FAIL: TestB (0.01s)')).toEqual({ runner: 'go', passed: 1, failed: 1, skipped: 0 })
  const t = performance.now()
  testResult('\n'.repeat(40_000) + ' '.repeat(10_000))
  expect(performance.now() - t).toBeLessThan(100)
})

test('an edit read from its input counts only the lines that changed', () => {
  expect(call('Edit', { file_path: 'a.ts', old_string: 'a\nb\nc', new_string: '' }, undefined)?.result).toEqual([{ text: '+0', tone: 'ok' }, { text: ' −3', tone: 'bad' }])
  expect(call('Edit', { file_path: 'a.ts', old_string: 'a\nb\nc\nd\ne', new_string: 'a\nb\nX\nd\ne' }, undefined)?.result).toEqual([{ text: '+1', tone: 'ok' }, { text: ' −1', tone: 'bad' }])
  const all = call('Edit', { file_path: 'a.ts', old_string: 'foo', new_string: 'bar', replace_all: true }, undefined)
  expect(all?.result).toEqual([{ text: '+1', tone: 'ok' }, { text: ' −1', tone: 'bad' }, { text: ' · every match', tone: 'muted' }])
  expect(all?.meter).toBeUndefined()
})

test('read ranges follow the tool: offset 0 is line 1, an offset alone reads on from there, an image is an image', () => {
  expect(call('Read', { file_path: 'r.md', offset: 0, limit: 10 }, undefined)?.result).toEqual([{ text: 'lines 1–10', tone: 'muted' }])
  expect(call('Read', { file_path: 'r.md', offset: 500 }, undefined)?.result).toEqual([{ text: 'from line 500', tone: 'muted' }])
  expect(call('Read', { file_path: 'p.png' }, { type: 'image', file: {} })?.result).toEqual([{ text: 'image', tone: 'muted' }])
})

test('paths of either kind give the file as the title and its folder as the detail', () => {
  expect(call('Edit', { file_path: 'C:\\Users\\me\\proj\\src\\a.ts', new_string: 'x' }, undefined)).toMatchObject({ title: 'Edited a.ts', detail: '…/proj/src/' })
  expect(call('Edit', { file_path: '/repo/plugins/sabai/hooks/svg.ts', new_string: 'x' }, undefined)?.detail).toBe('…/sabai/hooks/')
  expect(call('Read', { file_path: 'README.md' }, undefined)?.detail).toBe('')
})

test('a command without a description is its own title, as typed, with no repeated detail', () => {
  expect(call('Bash', { command: 'ls -la' }, {})).toMatchObject({ title: 'ls -la', detail: '' })
  expect(call('Bash', { command: 'cd /x/y && npm run build' }, {})?.title).toBe('npm run build')
  expect(call('Bash', { command: '\n\n  git status' }, {})?.title).toBe('git status')
  expect(call('Bash', { command: 'echo \u001b[31mhi\u0000' }, {})?.title).toBe('echo hi')
})

test('a failed command names its error, and only a slow run earns a mark', () => {
  expect(call('Bash', { command: 'tsc', description: 'type-check' }, 'Exit code 2\nerror TS2322: Type x is not assignable', { isErrored: true, durationMs: 300 })).toMatchObject({
    detail: 'error TS2322: Type x is not assignable', result: [{ text: '✗ exit 2' }], time: '0.3s',
  })
  expect(call('Bash', { command: 'x' }, {}, { durationMs: 45_000 })?.time).toBe('🐢 45s')
  expect(call('Write', { file_path: 'n.md' }, { type: 'create', content: 'a\nb\nc\n' })?.result).toEqual([{ text: '3 lines', tone: 'ok' }])
})

test('a step’s alt text reads as words, without the marks', () => {
  expect(stepText({ icon: 'flask', tone: 'ok', title: 'Run the tests', detail: '$ bun test', result: [{ text: '✓ 9 passed', tone: 'ok' }], time: '🐢 45s' })).toBe('Run the tests, $ bun test, 9 passed, 45s')
  expect(stepText({ icon: 'terminal', tone: 'bad', title: 'Fail', detail: '', result: [{ text: '✗ exit 1', tone: 'bad' }] })).toBe('Fail, failed, exit 1')
})

test('a marker inside a longer fence, or under a fence opened with an info string, stays code', () => {
  const nested = '````md\n```md\n> [!NOTE]\n> x\n```\n````'
  expect(splitCallouts(nested)).toEqual([{ kind: 'md', text: nested }])
  const info = '```\n```js\n> [!NOTE]\n> x\n```'
  expect(splitCallouts(info).every(s => s.kind === 'md')).toBe(true)
})

const BUN_OK = 'bun test v1\n\n 9 pass\n 0 fail\nRan 9 tests across 2 files. [1.2s]'
const BUN_BAD = 'bun test v1\n\n 7 pass\n 2 fail\nRan 9 tests across 2 files. [1.2s]'

test('the turn log adds up edits by file, commands and the last test run', () => {
  let log = EMPTY_LOG
  log = logged(log, { tool: 'Edit', path: 'a.ts', oldText: 'x\ny', newText: 'x\nz\nw' })
  log = logged(log, { tool: 'Edit', path: 'a.ts', oldText: 'q', newText: 'r' })
  log = logged(log, { tool: 'Write', path: 'b.md', content: 'one\ntwo\n' })
  log = logged(log, { tool: 'Bash', command: 'ls', output: '', isError: false, at: 1 })
  log = logged(log, { tool: 'Bash', command: 'false', output: 'Exit code 1', isError: true, at: 2 })
  log = logged(log, { tool: 'Bash', command: 'bun test', output: BUN_BAD, isError: true, at: 3 })
  log = logged(log, { tool: 'Bash', command: 'bun test', output: BUN_OK, isError: false, at: 4 })
  expect(log.files).toEqual({ 'a.ts': { added: 3, removed: 2 }, 'b.md': { added: 2, removed: 0 } })
  expect(log.commands).toBe(4)
  expect(log.failed).toBe(2)
  expect(log.test).toEqual({ passed: 9, failed: 0, at: 4 })
  // Words that look like a summary from a command that does not run tests are not a run.
  expect(logged(EMPTY_LOG, { tool: 'Bash', command: 'cat log.txt', output: BUN_OK, isError: false, at: 5 }).test).toBeUndefined()
})

test('the receipt says only what the turn did, in one line', () => {
  expect(receiptText(EMPTY_LOG)).toBeUndefined()
  const one = { ...EMPTY_LOG, files: { 'a.ts': { added: 1, removed: 0 } } }
  expect(receiptText(one)).toBe('✎ 1 file +1 −0')
  expect(receiptText({ ...EMPTY_LOG, commands: 1 })).toBe('› 1 command')
  expect(receiptText({ ...EMPTY_LOG, commands: 6, failed: 1 })).toBe('› 6 commands, 1 failed')
  expect(receiptText({ ...EMPTY_LOG, commands: 1, test: { passed: 159, failed: 0, at: 0 } })).toBe('✓ 159 passed · › 1 command')
  expect(
    receiptText({
      files: { 'a.ts': { added: 30, removed: 10 }, 'b.ts': { added: 10, removed: 2 }, 'c.ts': { added: 0, removed: 0 } },
      commands: 2,
      failed: 1,
      test: { passed: 96, failed: 2, at: 0 },
    }),
  ).toBe('✎ 3 files +40 −12 · ✗ 2 of 98 failed · › 2 commands, 1 failed')
  // The guard's stamp alone is no work.
  expect(receiptText({ ...EMPTY_LOG, caught: 5 })).toBeUndefined()
})

test('a receipt’s parts and mood: all green, failing tests, a failed command, or plain work', () => {
  const files = { 'a.ts': { added: 30, removed: 10 }, 'b.ts': { added: 10, removed: 2 } }
  expect(receiptOf(EMPTY_LOG)).toBeUndefined()
  expect(receiptOf({ ...EMPTY_LOG, caught: 1 })).toBeUndefined()
  expect(receiptOf({ files, commands: 2, failed: 0, test: { passed: 9, failed: 0, at: 0 } })).toEqual({
    tone: 'ok',
    headline: 'All green',
    files: { count: 2, added: 40, removed: 12 },
    test: { passed: 9, failed: 0 },
    commands: { count: 2, failed: 0 },
  })
  expect(receiptOf({ files: {}, commands: 1, failed: 1, test: { passed: 7, failed: 2, at: 0 } })).toMatchObject({ tone: 'bad', headline: 'Tests failing' })
  expect(receiptOf({ files, commands: 3, failed: 1 })).toMatchObject({ tone: 'warn', headline: '1 command failed' })
  expect(receiptOf({ files, commands: 0, failed: 0 })).toMatchObject({ tone: 'edit', headline: 'Done', files: { count: 2, added: 40, removed: 12 } })
})

test('read-only commands are told apart from ones that change things', () => {
  for (const c of ['cat a.ts', 'ls -la', 'grep -n x a.ts', 'rg foo', 'git status', 'git log --oneline -3', 'git diff', 'head -5 a', 'wc -l a', 'find . -name x', 'cd x && git show HEAD', 'cat a 2>/dev/null', 'grep -i x a', 'ls 2>&1', 'git branch -a', 'git remote -v'])
    expect([c, isReadOnly(c)]).toEqual([c, true])
  for (const c of ['bun test', 'git commit -m x', 'rm a', 'ls && npm i', 'cat a > b', 'echo x >> f', 'sed -i s/a/b/ f', 'find . -delete', 'find . -exec rm {} \\;', 'git branch -D x', 'git remote add o u', 'git diff --output=f', 'cat $(rm x)', 'cat a & rm b', 'ls\nrm a'])
    expect([c, isReadOnly(c)]).toEqual([c, false])
})

test('reads do not fill a receipt alone; with an edit or a test run they count', () => {
  const read = (log: TurnLog) => logged(log, { tool: 'Bash', command: 'cat a', output: '', isError: false, at: 1, readOnly: true })
  expect(receiptOf(read(read(EMPTY_LOG)))).toBeUndefined()
  const edited = logged(EMPTY_LOG, { tool: 'Edit', path: 'a', oldText: 'a', newText: 'b' })
  expect(receiptOf(read(edited))?.commands).toEqual({ count: 1, failed: 0 })
  expect(receiptOf(logged(EMPTY_LOG, { tool: 'Bash', command: 'cat nope', output: 'No such file', isError: true, at: 1, readOnly: true }))?.commands).toEqual({ count: 1, failed: 1 })
  // replace_all: the engine's patch holds every occurrence.
  expect(logged(EMPTY_LOG, { tool: 'Edit', path: 'a', oldText: 'x', newText: 'y', patch: [{ lines: ['-x', '-x', '-x', '+y', '+y', '+y'] }] }).files.a).toEqual({ added: 3, removed: 3 })
})

test('an overwrite counts its diff, a new file every line', () => {
  const patch = [{ lines: [' keep', '-old', '+new'] }]
  expect(logged(EMPTY_LOG, { tool: 'Write', path: 'a', content: 'keep\nnew\n', patch }).files.a).toEqual({ added: 1, removed: 1 })
  expect(logged(EMPTY_LOG, { tool: 'Write', path: 'a', content: 'one\ntwo\n' }).files.a).toEqual({ added: 2, removed: 0 })
})

test('a test run whose counts cannot be read drops the older run’s, so no stale result stands', () => {
  const passed = logged(EMPTY_LOG, { tool: 'Bash', command: 'bun test', output: BUN_OK, isError: false, at: 1 })
  expect(passed.test).toBeDefined()
  const crashed = logged(passed, { tool: 'Bash', command: 'bun test', output: 'SyntaxError: Unexpected token', isError: true, at: 2 })
  expect([crashed.test, receiptOf(crashed)?.headline]).toEqual([undefined, '1 command failed'])
  // Any other command leaves the test result alone.
  expect(logged(passed, { tool: 'Bash', command: 'ls', output: '', isError: false, at: 3 }).test).toEqual(passed.test)
})
