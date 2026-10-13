// The band's and the panes' colours: one theme for light and one for dark, each picked in the
// settings, the drawings following the app between them. Every theme's words read at 4.5:1 on its
// card, white at 4.5:1 on its pill, and each tile's glyph at 5:1 on its ground (checked by the tests).
import type { Theme } from '../types'
export type { Theme }

export type Ink = 't' | 'm' | 'tasks' | 'context' | 'session' | 'week' | 'warn' | 'alert' | 'ok'
export type BarKind = 'tasks' | 'context' | 'session' | 'week' | 'warn' | 'alert'
// The status and call-kind hues: a tile's ground, the glyph on it, and its lines and bars.
export type Hue = 'read' | 'edit' | 'command' | 'ok' | 'web' | 'skill' | 'fail' | 'stop' | 'warn'
export type Colors = {
  name: string
  card: string
  track: string
  pill: string
  text: Record<Ink, string>
  bar: Record<BarKind, string>
  tiles: Record<Hue, readonly [kb: string, kf: string, kl: string]>
}

export const LIGHT_THEMES = {
  mono: {
    name: 'Mono',
    card: '#fafaf9',
    track: '#d6d6d4',
    pill: '#ae5f46',
    text: { t: '#111110', m: '#6b6b66', tasks: '#a95d44', context: '#5a5a55', session: '#696964', week: '#70706b', warn: '#a95d44', alert: '#ca3c3c', ok: '#5a5a55' },
    bar: { tasks: '#d97757', context: '#5a5a55', session: '#86867f', week: '#a9a9a2', warn: '#d97757', alert: '#d23f3f' },
    tiles: {
      read: ['#aaaaa7', '#363633', '#9a9a97'],
      edit: ['#c0c0bc', '#43433f', '#b4b4b0'],
      command: ['#cbcbc7', '#4b4b48', '#c2c2bd'],
      ok: ['#aaaaa7', '#363633', '#9a9a97'],
      web: ['#d2d2ce', '#51514e', '#c9c9c5'],
      skill: ['#eab9a8', '#6c3b2b', '#e6ab98'],
      fail: ['#e69d9c', '#691f1f', '#e28a89'],
      stop: ['#cbcbc7', '#4b4b48', '#c2c2bd'],
      warn: ['#eab9a8', '#6c3b2b', '#e6ab98'],
    },
  },
  pastel: {
    name: 'Pastel',
    card: '#fcfaff',
    track: '#dbd5e4',
    pill: '#9d6551',
    text: { t: '#2a2438', m: '#6e6680', tasks: '#98624f', context: '#407a6b', session: '#6d64a0', week: '#836f33', warn: '#8f673e', alert: '#a95b64', ok: '#4a7b59' },
    bar: { tasks: '#f59e7f', context: '#6fd3b8', session: '#a99bf7', week: '#f3cd5f', warn: '#f7b26b', alert: '#f2828f' },
    tiles: {
      read: ['#b6e7dc', '#315d51', '#a7e3d4'],
      edit: ['#d3cbfb', '#514a77', '#cac1fa'],
      command: ['#e0dce9', '#5a5761', '#dad5e5'],
      ok: ['#bee7cd', '#385d44', '#b1e3c2'],
      web: ['#f8e4af', '#6b5a2a', '#f7df9f'],
      skill: ['#f9ccbf', '#71493a', '#f8c3b2'],
      fail: ['#f7bec7', '#743e45', '#f6b2bc'],
      stop: ['#e0dce9', '#5a5761', '#dad5e5'],
      warn: ['#fad6b5', '#6d4e2f', '#f9cfa6'],
    },
  },
  matcha: {
    name: 'Matcha',
    card: '#f7faf2',
    track: '#d1d9c7',
    pill: '#9f6842',
    text: { t: '#1f2a1a', m: '#5f6b55', tasks: '#98633f', context: '#577941', session: '#915b6a', week: '#866d23', warn: '#9c652a', alert: '#bf4a47', ok: '#4a7b37' },
    bar: { tasks: '#b9794d', context: '#79a85a', session: '#e28ea6', week: '#e0b63a', warn: '#d98c3a', alert: '#d4524f' },
    tiles: {
      read: ['#b8d1a6', '#3a512b', '#abc997'],
      edit: ['#edc4cc', '#68414c', '#eab9c4'],
      command: ['#d0d7c7', '#4d5247', '#c8cfbe'],
      ok: ['#aaca9c', '#2e4d22', '#9ac08a'],
      web: ['#ecd896', '#63501a', '#e9d184'],
      skill: ['#d8baa0', '#5c3c26', '#d2ad8f'],
      fail: ['#e6a6a1', '#6a2927', '#e29590'],
      stop: ['#d0d7c7', '#4d5247', '#c8cfbe'],
      warn: ['#e8c396', '#68431c', '#e5b884'],
    },
  },
} satisfies Record<Theme['light'], Colors>

export const DARK_THEMES = {
  ink: {
    name: 'Ink',
    card: '#191918',
    track: '#353533',
    pill: '#a1634c',
    text: { t: '#f2f2f0', m: '#9b9b96', tasks: '#e08a6a', context: '#c8c8c3', session: '#a2a29c', week: '#858580', warn: '#e08a6a', alert: '#ef6b6b', ok: '#c8c8c3' },
    bar: { tasks: '#e08a6a', context: '#c8c8c3', session: '#a2a29c', week: '#7d7d78', warn: '#e08a6a', alert: '#ef6b6b' },
    tiles: {
      read: ['#636360', '#efefed', '#c8c8c3'],
      edit: ['#53534f', '#d4d4d1', '#a2a29c'],
      command: ['#3b3b39', '#b2b2af', '#6a6a66'],
      ok: ['#636360', '#efefed', '#c8c8c3'],
      web: ['#434340', '#bebebc', '#7d7d78'],
      skill: ['#6d483a', '#f1c9ba', '#e08a6a'],
      fail: ['#733b3b', '#f8bbbb', '#ef6b6b'],
      stop: ['#3b3b39', '#b2b2af', '#6a6a66'],
      warn: ['#6d483a', '#f1c9ba', '#e08a6a'],
    },
  },
  forest: {
    name: 'Forest',
    card: '#1d2a23',
    track: '#33453a',
    pill: '#a26643',
    text: { t: '#e6efe8', m: '#9db3a5', tasks: '#e8915f', context: '#6fd3a8', session: '#b59ae8', week: '#e8c25a', warn: '#f0a35a', alert: '#ef6f6f', ok: '#7ed38a' },
    bar: { tasks: '#e8915f', context: '#6fd3a8', session: '#b59ae8', week: '#e8c25a', warn: '#f0a35a', alert: '#ef6f6f' },
    tiles: {
      read: ['#3f715b', '#ebf9f3', '#6fd3a8'],
      edit: ['#5d5976', '#e9e1f8', '#b59ae8'],
      command: ['#35443b', '#b4bdb7', '#55695c'],
      ok: ['#46714e', '#f0faf1', '#7ed38a'],
      web: ['#726a3a', '#fdf9ef', '#e8c25a'],
      skill: ['#72553c', '#f8dccc', '#e8915f'],
      fail: ['#754743', '#f9cbcb', '#ef6f6f'],
      stop: ['#35443b', '#b4bdb7', '#55695c'],
      warn: ['#765d3a', '#fbe9d7', '#f0a35a'],
    },
  },
  synthwave: {
    name: 'Synthwave',
    card: '#241b33',
    track: '#3f3157',
    pill: '#b8507d',
    text: { t: '#f3ecff', m: '#ab9cc8', tasks: '#ff6fae', context: '#3ee6e0', session: '#b48cff', week: '#ffd85e', warn: '#ffa85e', alert: '#ff5c7a', ok: '#5ef2a0' },
    bar: { tasks: '#ff6fae', context: '#3ee6e0', session: '#b48cff', week: '#ffd85e', warn: '#ffa85e', alert: '#ff5c7a' },
    tiles: {
      read: ['#2f707c', '#e4fcfb', '#3ee6e0'],
      edit: ['#604a89', '#e1d1ff', '#b48cff'],
      command: ['#3e3352', '#b1aabe', '#62557d'],
      ok: ['#3c7561', '#f5fef9', '#5ef2a0'],
      web: ['#806a45', '#ffffff', '#ffd85e'],
      skill: ['#803e67', '#ffc8e0', '#ff6fae'],
      fail: ['#803651', '#ffbeca', '#ff5c7a'],
      stop: ['#3e3352', '#b1aabe', '#62557d'],
      warn: ['#805645', '#ffe5cf', '#ffa85e'],
    },
  },
} satisfies Record<Theme['dark'], Colors>

export const DEFAULT_THEME: Theme = { light: 'mono', dark: 'ink' }

// A stored pair, each side kept only when it names a theme of its mode (an older version saved none).
export const themeOf = (v: unknown): Theme => {
  const o = (v ?? {}) as Partial<Record<keyof Theme, unknown>>
  return {
    light: typeof o.light === 'string' && Object.hasOwn(LIGHT_THEMES, o.light) ? (o.light as Theme['light']) : DEFAULT_THEME.light,
    dark: typeof o.dark === 'string' && Object.hasOwn(DARK_THEMES, o.dark) ? (o.dark as Theme['dark']) : DEFAULT_THEME.dark,
  }
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

// WCAG 2 contrast ratio of two #rrggbb colours.
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r = 0, g = 0, bl = 0] = rgb(h).map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi = 0, lo = 0] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
