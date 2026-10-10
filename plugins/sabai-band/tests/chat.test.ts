import { expect, test } from 'claude-code/testing'
import { bashLine, commandOf, editLine, logoOf, readLine, seconds, writeLine } from '../hooks/chat'

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
