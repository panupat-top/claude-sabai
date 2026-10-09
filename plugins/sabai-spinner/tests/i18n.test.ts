import { expect, test } from 'claude-code/testing'
import { pickLang } from '../hooks/i18n'

test('an explicit option wins', () => {
  expect(pickLang('th', 'English', 'en_US.UTF-8')).toBe('th')
  expect(pickLang('en', 'Thai', 'th_TH.UTF-8')).toBe('en')
})

test('auto follows the language setting before the locale', () => {
  for (const s of ['th', 'Thai', 'Thai, English', 'ไทย']) expect(pickLang('auto', s, 'en_US.UTF-8')).toBe('th')
  expect(pickLang('auto', 'English', 'th_TH.UTF-8')).toBe('en')
})

test('auto falls back to the locale, then English', () => {
  expect(pickLang('auto', undefined, 'th_TH.UTF-8')).toBe('th')
  expect(pickLang('auto', '  ', 'th_TH.UTF-8')).toBe('th')
  expect(pickLang('auto', undefined, 'en_US.UTF-8')).toBe('en')
  expect(pickLang(undefined, undefined, undefined)).toBe('en')
})
