import type { MeterKind } from './model'

// Pixel sprites, one character per pixel ('.' is empty). Each colour key may carry a class
// that the band's stylesheet animates. Drawn at `px` (default PX) css pixels per sprite pixel.

export const PX = 2

type Sprite = { rows: string[]; colors: Record<string, string>; classes?: Record<string, string>; px?: number }

export const ICON_COLORS: Record<MeterKind | 'tasks', string> = {
  tasks: '#D97757',
  context: '#2bb5a6',
  session: '#8f8cf4',
  week: '#e0a030',
  scoped: '#e06cb0',
}

const c = ICON_COLORS
// Only Clawd and the context have a sprite; the limit cards carry their label alone.
export type SpriteKind = 'tasks' | 'context'

const SPRITES: Record<SpriteKind, Sprite> = {
  // Pixel Clawd, the shape savvy-progress draws (after DockCrab's Clawdy): walks while work
  // runs, stands and blinks while it waits.
  tasks: {
    rows: [
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....ookkooooooookkoo....',
      '....ookkooooooookkoo....',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      'oooooooooooooooooooooooo',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....oooooooooooooooo....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
      '....ll..nn....ll..nn....',
    ],
    colors: { o: c.tasks, k: '#1F1E1D', l: c.tasks, n: c.tasks },
    classes: { o: 'bd', k: 'eye', l: 'la', n: 'lb' },
    px: 1,
  },
  // A memory chip whose two LEDs blink out of step.
  context: {
    rows: ['.l.l.l.l.', 'lgggggggl', '.gdddddg.', 'lgdLdMdgl', '.gdddddg.', 'lgggggggl', '.l.l.l.l.'],
    colors: { l: '#9a9a9a', g: c.context, d: '#2c2c2c', L: '#5fe0a0', M: '#5fe0a0' },
    classes: { L: 'led1', M: 'led2' },
  },
}

export const spriteSize = (kind: SpriteKind) => {
  const { rows, px = PX } = SPRITES[kind]
  return { width: (rows[0]?.length ?? 0) * px, height: rows.length * px }
}

// Pixels of one class share a <g> so one animation moves them together; `mode` (`run` or
// `idle`) picks which of the sprite's motions play.
export function sprite(kind: SpriteKind, x: number, y: number, mode = ''): string {
  const { rows, colors, classes = {}, px = PX } = SPRITES[kind]
  const groups = new Map<string, string[]>()
  rows.forEach((row, r) =>
    [...row].forEach((ch, col) => {
      const color = colors[ch]
      if (!color) return
      const cls = classes[ch] ?? ''
      const rect = `<rect x="${col * px}" y="${r * px}" width="${px}" height="${px}" fill="${color}"/>`
      groups.set(cls, [...(groups.get(cls) ?? []), rect])
    }),
  )
  const body = [...groups].map(([cls, rects]) => (cls ? `<g class="${cls}">${rects.join('')}</g>` : rects.join(''))).join('')
  return `<g transform="translate(${x},${y})" shape-rendering="crispEdges"${mode ? ` class="${mode}"` : ''}>${body}</g>`
}

export const SPRITE_CSS =
  '.run g.la{animation:step .4s steps(1) infinite}.run g.lb{animation:step .4s steps(1) infinite -.2s}' +
  '.run g.bd,.run g.eye{animation:bob .4s steps(1) infinite -.1s}' +
  '@keyframes step{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}' +
  // A blink repaints the eyes in the body's colour, so no hole shows through.
  `.idle g.eye rect{animation:wink 3.2s steps(1) infinite}@keyframes wink{91%,96%{fill:${c.tasks}}}` +
  'g.led1{animation:blink 1.2s steps(1) infinite}g.led2{animation:blink 1.2s steps(1) infinite -.6s}' +
  '@keyframes blink{50%{opacity:.15}}'
