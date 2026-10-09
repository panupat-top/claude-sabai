import type { MeterKind } from './model'

// Skins for the band: each theme's own published colours. `auto` is not here: it keeps the
// band's built-in look, which follows the OS between light and dark.

export type Palette = {
  name: string
  base: string
  surface: string
  track: string
  text: string
  subtext: string
  accents: Record<MeterKind | 'tasks', string>
  warn: string
  alert: string
}

export const THEMES: Record<string, Palette> = {
  'catppuccin-latte': {
    name: 'Catppuccin Latte',
    base: '#eff1f5', surface: '#e6e9ef', track: '#ccd0da', text: '#4c4f69', subtext: '#6c6f85',
    accents: { tasks: '#fe640b', context: '#179299', session: '#7287fd', week: '#df8e1d', scoped: '#ea76cb' },
    warn: '#fe640b', alert: '#d20f39',
  },
  'catppuccin-frappe': {
    name: 'Catppuccin Frappé',
    base: '#303446', surface: '#292c3c', track: '#414559', text: '#c6d0f5', subtext: '#a5adce',
    accents: { tasks: '#ef9f76', context: '#81c8be', session: '#babbf1', week: '#e5c890', scoped: '#f4b8e4' },
    warn: '#ef9f76', alert: '#e78284',
  },
  'catppuccin-macchiato': {
    name: 'Catppuccin Macchiato',
    base: '#24273a', surface: '#1e2030', track: '#363a4f', text: '#cad3f5', subtext: '#a5adcb',
    accents: { tasks: '#f5a97f', context: '#8bd5ca', session: '#b7bdf8', week: '#eed49f', scoped: '#f5bde6' },
    warn: '#f5a97f', alert: '#ed8796',
  },
  'catppuccin-mocha': {
    name: 'Catppuccin Mocha',
    base: '#1e1e2e', surface: '#181825', track: '#313244', text: '#cdd6f4', subtext: '#a6adc8',
    accents: { tasks: '#fab387', context: '#94e2d5', session: '#b4befe', week: '#f9e2af', scoped: '#f5c2e7' },
    warn: '#fab387', alert: '#f38ba8',
  },
  dracula: {
    name: 'Dracula',
    base: '#282a36', surface: '#21222c', track: '#44475a', text: '#f8f8f2', subtext: '#6272a4',
    accents: { tasks: '#ffb86c', context: '#8be9fd', session: '#bd93f9', week: '#f1fa8c', scoped: '#ff79c6' },
    warn: '#ffb86c', alert: '#ff5555',
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    base: '#1a1b26', surface: '#16161e', track: '#292e42', text: '#c0caf5', subtext: '#565f89',
    accents: { tasks: '#ff9e64', context: '#73daca', session: '#7aa2f7', week: '#e0af68', scoped: '#bb9af7' },
    warn: '#ff9e64', alert: '#f7768e',
  },
  nord: {
    name: 'Nord',
    base: '#2e3440', surface: '#3b4252', track: '#434c5e', text: '#eceff4', subtext: '#d8dee9',
    accents: { tasks: '#d08770', context: '#88c0d0', session: '#81a1c1', week: '#ebcb8b', scoped: '#b48ead' },
    warn: '#d08770', alert: '#bf616a',
  },
  gruvbox: {
    name: 'Gruvbox Dark',
    base: '#282828', surface: '#32302f', track: '#504945', text: '#ebdbb2', subtext: '#a89984',
    accents: { tasks: '#fe8019', context: '#8ec07c', session: '#83a598', week: '#fabd2f', scoped: '#d3869b' },
    warn: '#fe8019', alert: '#fb4934',
  },
  'rose-pine': {
    name: 'Rosé Pine',
    base: '#191724', surface: '#1f1d2e', track: '#26233a', text: '#e0def4', subtext: '#908caa',
    accents: { tasks: '#ebbcba', context: '#9ccfd8', session: '#3e8fb0', week: '#f6c177', scoped: '#c4a7e7' },
    warn: '#ea9a97', alert: '#eb6f92',
  },
}

export const SKINS = ['auto', ...Object.keys(THEMES)]

// A skin by any spelling of its name: `TokyoNight`, `Catppuccin Mocha`, `frappe` (the flavour
// alone names its Catppuccin) all find theirs.
export function pickSkin(input: string): string | undefined {
  const squash = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '')
  const want = squash(input)
  if (!want) return undefined
  return SKINS.find(k => squash(k) === want || squash(k) === `catppuccin${want}` || squash(THEMES[k]?.name ?? '') === want)
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const hex = (c: number[]) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`

// WCAG 2 contrast ratio of two #rrggbb colours.
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r = 0, g = 0, bl = 0] = rgb(h).map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi = 0, lo = 0] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// `color` as is when it reads on `bg`, else stepped toward white or black (whichever `bg` is
// not) until it does. A theme's own colour wins wherever it is legible.
export function readable(color: string, bg: string, min = 4.5): string {
  const toward = contrast('#ffffff', bg) > contrast('#000000', bg) ? [255, 255, 255] : [0, 0, 0]
  const from = rgb(color)
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const mixed = hex(from.map((v, i) => v + ((toward[i] ?? 0) - v) * t))
    if (contrast(mixed, bg) >= min) return mixed
  }
  return hex(toward)
}
