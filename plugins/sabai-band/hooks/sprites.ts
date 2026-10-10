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

export type HatKind = 'explorer' | 'hardhat' | 'cap' | 'grad' | 'beanie'
export const HAT_H = 4

// Hats for the agents pane, 24 wide like Clawd and HAT_H rows tall, drawn just above him.
const HATS: Record<HatKind, string[]> = {
  explorer: ['........................', '......hhhhhhhhhhhh......', '......hhhhhhhhhhhh......', '..hhhhhhhhhhhhhhhhhhhh..'],
  hardhat: ['........................', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......', '....hhhhhhhhhhhhhhhh....'],
  cap: ['........................', '......hhhhhhhhhh........', '......hhhhhhhhhh........', '......hhhhhhhhhhhhhhhh..'],
  grad: ['..hhhhhhhhhhhhhhhhhhhh..', '.......hhhhhhhhhh..h....', '.......hhhhhhhhhh..h....', '........................'],
  beanie: ['...........hh...........', '.........hhhhhh.........', '.......hhhhhhhhhh.......', '......hhhhhhhhhhhh......'],
}

// Rows of colour keys as rects, a run of one key in a row merged into one rect, grouped by class
// so one animation moves a part together. `paint` gives a key's fill, or a class when it has none.
function draw(rows: string[], px: number, y0: number, paint: (ch: string) => { fill?: string; cls?: string; group?: string } | undefined) {
  const groups = new Map<string, string[]>()
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; ) {
      const ch = row[c]!
      let end = c + 1
      while (end < row.length && row[end] === ch) end++
      const p = paint(ch)
      if (p) {
        const look = p.fill ? `fill="${p.fill}"` : `class="${p.cls}"`
        const rect = `<rect x="${c * px}" y="${(y0 + r) * px}" width="${(end - c) * px}" height="${px}" ${look}/>`
        groups.set(p.group ?? '', [...(groups.get(p.group ?? '') ?? []), rect])
      }
      c = end
    }
  })
  return [...groups].map(([g, rects]) => (g ? `<g class="${g}">${rects.join('')}</g>` : rects.join(''))).join('')
}

// `mode`: `run` walks, `idle` blinks, `hop` jumps twice (a finished agent), `dizzy` shuts the
// eyes (a failed one). `tint` repaints Clawd's body; `hat` sits on top and moves with the body.
export function sprite(kind: SpriteKind, x: number, y: number, mode = '', tint?: string, hat?: { kind: HatKind; color?: string }): string {
  const { rows, classes = {}, px = PX } = SPRITES[kind]
  const colors = tint && kind === 'tasks' ? { ...SPRITES[kind].colors, o: tint, l: tint, n: tint } : SPRITES[kind].colors
  // Shut eyes: the lower of the two eye rows is painted as body.
  const body = mode === 'dizzy' && kind === 'tasks' ? rows.map((r, i) => (i === 3 ? r.replace(/k/g, 'o') : r)) : rows
  const art =
    (hat ? draw(HATS[hat.kind], px, -HAT_H, ch => (ch === 'h' ? { fill: hat.color, cls: 'm', group: 'bd' } : undefined)) : '') +
    draw(body, px, 0, ch => (colors[ch] ? { fill: colors[ch], group: classes[ch] } : undefined))
  return `<g transform="translate(${x},${y})" shape-rendering="crispEdges"${mode ? ` class="${mode}"` : ''}>${art}</g>`
}

export const SPRITE_CSS =
  '.run g.la{animation:step .4s steps(1) infinite}.run g.lb{animation:step .4s steps(1) infinite -.2s}' +
  '.run g.bd,.run g.eye{animation:bob .4s steps(1) infinite -.1s}' +
  '@keyframes step{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}' +
  // A blink repaints the eyes in the body's colour (the look's `wink` keyframes), so no hole shows.
  '.idle g.eye rect{animation:wink 3.2s steps(1) infinite}' +
  'g.led1{animation:blink 1.2s steps(1) infinite}g.led2{animation:blink 1.2s steps(1) infinite -.6s}' +
  '@keyframes blink{50%{opacity:.15}}' +
  '.hop g{animation:hop .45s ease-out 2}@keyframes hop{50%{transform:translateY(-3px)}}'
