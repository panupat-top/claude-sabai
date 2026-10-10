import { expect, test } from 'claude-code/testing'
import { bashLine, seconds } from '../hooks/chat'

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
