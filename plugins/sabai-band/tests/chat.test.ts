import { expect, test } from 'claude-code/testing'
import { bashLine, commandOf, editLine, logoOf, readLine, seconds, testLine, testResult, writeLine } from '../hooks/chat'

test('seconds keeps one decimal under ten seconds, then whole units', () => {
  expect([seconds(420), seconds(4210), seconds(12_400), seconds(64_000)]).toEqual(['0.4s', '4.2s', '12s', '1m 4s'])
})

test('a Bash line says how the call ended, with the time when it was measured', () => {
  expect(bashLine({ isErrored: false, isInterrupted: false, durationMs: 4210 })).toEqual({
    mark: 'terminal',
    parts: [{ text: '✓', tone: 'ok' }, { text: ' 4.2s', tone: 'muted' }],
  })
  expect(bashLine({ isErrored: true, isInterrupted: false, durationMs: 3400 })?.parts).toEqual([
    { text: '✗ failed', tone: 'bad' },
    { text: ' · 3.4s', tone: 'muted' },
  ])
  expect(bashLine({ isErrored: false, isInterrupted: true })).toEqual({ mark: 'stop', parts: [{ text: 'interrupted', tone: 'muted' }] })
})

test('a quick success, or one the mod did not time, adds nothing; a failure without a time still shows', () => {
  expect(bashLine({ isErrored: false, isInterrupted: false, durationMs: 300 })).toBeUndefined()
  expect(bashLine({ isErrored: false, isInterrupted: false })).toBeUndefined()
  expect(bashLine({ isErrored: true, isInterrupted: false })?.parts).toEqual([{ text: '✗ failed', tone: 'bad' }])
})

const hunk = (...lines: string[]) => ({ lines })

test('an Edit line counts added and removed lines across hunks, with a bar of the two', () => {
  const line = editLine([hunk(' a', '-b', '+c', '+d'), hunk('+e', ' f', '-g')])
  expect(line?.mark).toBe('pencil')
  expect(line?.parts).toEqual([
    { text: '+3', tone: 'ok' },
    { text: ' −2', tone: 'bad' },
    { text: ' · 2 hunks', tone: 'muted' },
  ])
  expect(line?.bar).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'bad', 'bad', 'bad', 'bad'])
})

test('a one-hunk Edit says no hunk count; an empty patch adds nothing', () => {
  expect(editLine([hunk('+a')])?.parts).toEqual([{ text: '+1', tone: 'ok' }, { text: ' −0', tone: 'bad' }])
  expect(editLine([])).toBeUndefined()
  expect(editLine([hunk(' same')])).toBeUndefined()
})

test('a Write line names a new file and its size, or reads an update as an Edit', () => {
  expect(writeLine({ type: 'create', content: 'a\nb\nc\n', structuredPatch: [] })).toEqual({
    mark: 'file-added',
    parts: [{ text: 'new file', tone: 'ok' }, { text: ' · 3 lines', tone: 'muted' }],
  })
  expect(writeLine({ type: 'update', content: '', structuredPatch: [hunk('-a', '+b')] })?.parts[0]).toEqual({ text: '+1', tone: 'ok' })
})

test('a Read line gives the range read, or the whole file; images and notebooks add nothing', () => {
  const text = (startLine: number, numLines: number, totalLines: number) => ({ type: 'text', file: { filePath: 'a', content: '', startLine, numLines, totalLines } })
  expect(readLine(text(1, 20, 131))).toEqual({ mark: 'eye', parts: [{ text: 'lines 1–20', tone: 'text' }, { text: ' of 131', tone: 'muted' }] })
  expect(readLine(text(1, 131, 131))?.parts).toEqual([{ text: 'all 131 lines', tone: 'text' }])
  expect(readLine({ type: 'image', file: {} })).toBeUndefined()
  expect(readLine(undefined)).toBeUndefined()
})

test('the command is read past cd, env assignments, sudo, time and package runners', () => {
  expect(commandOf('cd plugins/x && bun test')).toBe('bun')
  expect(commandOf('FOO=1 BAR="a b" npm run build')).toBe('npm')
  expect(commandOf('sudo docker ps')).toBe('docker')
  expect(commandOf('npx playwright test')).toBe('playwright')
  expect(commandOf('bunx tsc -p .')).toBe('tsc')
  expect(commandOf('pnpm dlx jest')).toBe('jest')
  expect(commandOf('time /usr/bin/git status')).toBe('git')
  expect(commandOf('  ')).toBe('')
})

test('known commands get their logo; anything else is bash', () => {
  expect(['git push', 'bun test', 'pnpm i', 'python3 -m pytest', 'uv run x', 'cargo test', 'go test ./...', 'tsc', 'jest', 'ls -la'].map(logoOf)).toEqual([
    'git', 'bun', 'pnpm', 'python', 'python', 'rust', 'golang', 'typescript', 'jest', 'bash',
  ])
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

test('a test line cheers an all-green run and counts the failures of a red one', () => {
  expect(testLine({ runner: 'bun', passed: 96, failed: 0, skipped: 0 }, 3100)).toEqual({
    mark: 'bun',
    parts: [{ text: '✓ all 96 passed 🎉', tone: 'ok' }, { text: ' · 3.1s', tone: 'muted' }],
    bar: Array(10).fill('ok'),
  })
  const red = testLine({ runner: 'pytest', passed: 96, failed: 2, skipped: 1 })
  expect(red.mark).toBe('python')
  expect(red.parts).toEqual([{ text: '✗ 2 of 98 failed', tone: 'bad' }, { text: ' · 1 skipped', tone: 'muted' }])
  expect(red.bar?.filter(t => t === 'bad')).toHaveLength(1)
  expect(testLine({ runner: 'vitest', passed: 1, failed: 0, skipped: 0 }).mark).toBe('terminal')
})
