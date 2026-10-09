import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { WORDS } from '../hooks/words'

const SURFACES = ['terminal', 'desktop'] as const
type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

// Stands in for the engine's own Spinner: records the word the mod handed on.
function engine(on: On) {
  const seen: string[] = []
  on('ui.render', ($, e) => {
    if (e.component === 'Spinner') seen.push(e.props.word)
    return { type: 'engine', ref: 0 }
  })
  return seen
}

async function spin($: Engine, surface: (typeof SURFACES)[number], word: string, mode: Mode = 'thinking') {
  const ui = await $.ui.mount({
    plugin: 'sabai-spinner',
    surface,
    component: 'Spinner',
    requestId: 'main',
    viewport: { columns: 100, rows: 30 },
    props: { word, message: null, suffix: '…', mode },
  })
  await ui.unmount()
}

test('the terminal gets a casual word in the chosen language', { options: { words: 'th' } }, async ($, on) => {
  const seen = engine(on)
  await spin($, 'terminal', 'Sauteing')
  expect(WORDS.th.casual).toContain(seen[0])
})

test('the desktop replaces only its generic word, by mode', { options: { words: 'th' } }, async ($, on) => {
  const seen = engine(on)
  await spin($, 'desktop', 'Working', 'thinking')
  await spin($, 'desktop', 'Working', 'tool-input')
  await spin($, 'desktop', 'Creating notes.md')
  expect(WORDS.th.thinking).toContain(seen[0])
  expect(WORDS.th['tool-use']).toContain(seen[1])
  expect(seen[2]).toBe('Creating notes.md')
})

test('the word stays put while the spinner redraws', { options: { words: 'en' } }, async ($, on) => {
  const seen = engine(on)
  for (const surface of SURFACES) {
    await spin($, surface, 'Working')
    await spin($, surface, 'Working')
  }
  expect(seen[0]).toBe(seen[1])
  expect(seen[2]).toBe(seen[3])
})

test('auto follows the language setting', async ($, on) => {
  const seen = engine(on)
  on('session.start', () => ({ cwd: '/work' }))
  on('settings.read', () => ({ value: { language: 'Thai, English' } }))
  mock.env(on, { LANG: 'en_US.UTF-8' })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await spin($, 'terminal', 'Sauteing')
  expect(WORDS.th.casual).toContain(seen[0])
})

test('off leaves Claude Code its own words', { options: { words: 'off' } }, async ($, on) => {
  const seen = engine(on)
  for (const surface of SURFACES) await spin($, surface, 'Working')
  expect(seen).toEqual(['Working', 'Working'])
})
