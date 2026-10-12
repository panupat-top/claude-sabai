// The band's two looks, both following the app between light and dark: cards raised off the band,
// or flat on it (`auto`, the look sabai started with). A stored look not listed here is raised.
export const SKINS = ['raised', 'auto'] as const
export type Skin = (typeof SKINS)[number]
export const SKIN_NAMES: Record<string, string> = { raised: 'Raised', auto: 'Flat' }

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
