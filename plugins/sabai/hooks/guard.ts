// What the guard catches, by tool and input, in four rules: wiping the disk or the home folder,
// force-pushing over main, reading a secrets file, and throwing away uncommitted work. Each is
// set to block, ask or pass in Settings. Anything it cannot name passes.

import type { GuardAction, GuardRule } from '../types'

export type Risk = { rule: GuardRule; reason: string }

// Each rule's name and note in Settings, and what it does until the person picks otherwise.
export const GUARD_RULES: Record<GuardRule, { name: string; note: string; action: GuardAction }> = {
  wipe: { name: 'Delete disk or home', note: 'rm -rf aimed at / or ~', action: 'block' },
  force: { name: 'Force-push main', note: 'git push --force to main or master', action: 'ask' },
  env: { name: 'Read .env', note: 'Reading a .env file, with Read or a shell reader', action: 'block' },
  discard: { name: 'Discard uncommitted', note: 'git reset --hard, clean -f, checkout -f, checkout/restore .', action: 'ask' },
}

export const GUARD_FAILED = "sabai's guard could not check this call, so it refused it. The person can turn the guard off in /sabai-settings."

// The guard's `.catch`: a guard that failed would be skipped and its call run, so a failure before
// the call ran refuses it; once it ran, its own result stands.
export const failClosed = <T>(next: { called: boolean }, run: () => T): T | { deny: string } => (next.called ? run() : { deny: GUARD_FAILED })

// A secrets file by its name: `.env` or `.env.<anything>`, but not an example, sample or template.
const isEnvFile = (path: string) => {
  const base = path.split('/').pop()!
  return /^\.env(\.[\w.-]+)?$/.test(base) && !/\.(example|sample|template)(\.|$)/.test(base)
}

// The first risk of a call, or nothing.
export const riskOf = (tool: string, input: { command?: unknown; file_path?: unknown }): Risk | undefined => risksOf(tool, input)[0]

// Every risk of a call, in rule order: a compound command can hold several, and the guard acts on
// the strictest of them.
export function risksOf(tool: string, input: { command?: unknown; file_path?: unknown }): Risk[] {
  if (tool === 'Read') return typeof input.file_path === 'string' && isEnvFile(input.file_path) ? [{ rule: 'env', reason: 'reads a .env file' }] : []
  if (tool !== 'Bash' || typeof input.command !== 'string') return []
  const cmds = programsOf(withoutData(input.command), 0)
  const risks: Risk[] = []
  const wipe = cmds.map(wipes).find(Boolean)
  if (wipe) risks.push({ rule: 'wipe', reason: wipe })
  const calls = cmds.flatMap(gitCall)
  const force = forcedPush(calls)
  if (force) risks.push({ rule: 'force', reason: `force-pushes to ${force}` })
  if (discards(calls)) risks.push({ rule: 'discard', reason: 'throws away uncommitted work' })
  if (cmds.some(readsEnv)) risks.push({ rule: 'env', reason: 'reads a .env file' })
  return risks
}

type Command = { words: string[]; from: string[] }

// The commands that print, copy or run a file's contents; for the pattern-first ones the first
// word is the pattern or script, unless it came with -e or -f.
const READERS = ['cat', 'tac', 'less', 'more', 'head', 'tail', 'bat', 'nl', 'source', '.', 'grep', 'egrep', 'rg', 'sed', 'awk', 'cp', 'xxd', 'od', 'strings', 'base64', 'sort', 'cut', 'diff']
const PATTERN_FIRST = ['grep', 'egrep', 'rg', 'sed', 'awk']
const PROGRAMS = new Set(['rm', 'git', ...READERS])
const SHELL = /^(?:ba|z|da|k)?sh$/
// Commands that only print their words, so a program named among them does not run.
const PRINTERS = ['echo', 'printf']
// How deep `sh -c` and `eval` may nest before the guard refuses: no real script comes near it,
// and a crafted one would otherwise take seconds.
const MAX_DEPTH = 8

// Every command the guard knows that a line runs, as its words from the program on, with the
// files read with `<`. Each simple command but echo or printf is searched for its first known
// program at any word, so wrappers (`sudo -u me`, `timeout 30`, `xargs`, `FOO=1`, `then`) need no list; `sh -c '…'`
// and `eval` are read as the commands they run.
function programsOf(line: string, depth: number): Command[] {
  if (depth > MAX_DEPTH) throw new Error('nested too deep to check')
  const { commands, nested } = simpleCommands(line)
  const out = nested.flatMap(n => programsOf(n, depth + 1))
  for (const { words, from } of commands) {
    if (from.length) out.push({ words: [], from })
    if (PRINTERS.includes(words[0]?.split('/').pop() ?? '')) continue
    const inner = (text: string) => programsOf(text, depth + 1).map(c => ({ ...c, from: [...c.from, ...from] }))
    for (let i = 0; i < words.length; i++) {
      const name = words[i]!.split('/').pop()!
      const rest = words.slice(i)
      const c = SHELL.test(name) ? rest.findIndex(a => /^-[a-z]*c$/.test(a)) : -1
      if (c > 0 && rest[c + 1] !== undefined) out.push(...inner(rest[c + 1]!))
      else if (name === 'eval') out.push(...inner(rest.slice(1).join(' ')))
      else if (PROGRAMS.has(name)) out.push({ words: rest, from })
      else continue
      break
    }
  }
  return out
}

// A line's simple commands, each as its words with quotes removed and the files it reads with
// `<` apart, split at ; & | newlines ( ) ` $( and a { or } standing alone; and the text of each
// $( ) or backtick inside double quotes, which runs too. Comments are skipped and redirections
// leave the words, so `cat<.env` and `"main"` read as typed.
function simpleCommands(line: string): { commands: Command[]; nested: string[] } {
  const commands: Command[] = []
  const nested: string[] = []
  let words: string[] = [], from: string[] = [], word = '', inWord = false, quote = '', redirect = ''
  const endWord = () => {
    if (inWord) {
      if (redirect === '<') from.push(word)
      else if (!redirect) words.push(word)
      redirect = ''
    }
    word = ''
    inWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length || from.length) commands.push({ words, from })
    words = []
    from = []
    redirect = ''
  }
  const standsAlone = (i: number) => !inWord && /^(\s|;|$)/.test(line[i + 1] ?? '')
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    const next = line[i + 1]
    if (c === '\\' && next === '\n' && quote !== "'") i++
    else if (quote === "'") {
      if (c === "'") quote = ''
      else word += c
    } else if (quote === '$') {
      if (c === "'") quote = ''
      else word += c === '\\' && next !== undefined ? line[++i] : c
    } else if (quote === '"') {
      if (c === '"') quote = ''
      else if (c === '\\' && next !== undefined) word += line[++i]
      else if ((c === '$' && next === '(') || c === '`') {
        const close = c === '`' ? line.indexOf('`', i + 1) : closingParen(line, i + 1)
        const end = close === -1 ? line.length : close
        nested.push(line.slice(i + (c === '`' ? 1 : 2), end))
        word += line.slice(i, end + 1)
        i = end
      } else word += c
    } else if (c === "'" || c === '"') {
      quote = c
      inWord = true
    } else if (c === '$' && next === "'") {
      quote = '$'
      inWord = true
      i++
    } else if (c === '$' && next === '$') {
      word += '$$'
      inWord = true
      i++
    } else if (c === '\\' && next !== undefined) {
      word += line[++i]
      inWord = true
    } else if (c === '#' && !inWord) {
      const newline = line.indexOf('\n', i)
      i = newline === -1 ? line.length : newline - 1
    } else if (c === '$' && next === '{') {
      const close = line.indexOf('}', i)
      word += close === -1 ? line.slice(i) : line.slice(i, close + 1)
      inWord = true
      i = close === -1 ? line.length : close
    } else if (c === '$' && next === '(') {
      endCommand()
      i++
    } else if (';&|\n()`'.includes(c) || ((c === '{' || c === '}') && standsAlone(i))) endCommand()
    else if (c === '<' || c === '>') {
      // A file descriptor written before the operator (`2>`) belongs to it.
      if (/^\d+$/.test(word)) {
        word = ''
        inWord = false
      }
      endWord()
      let op = c
      while ('<>&'.includes(line[i + 1] ?? '.')) op += line[++i]
      redirect = op
    } else if (/\s/.test(c)) endWord()
    else {
      word += c
      inWord = true
    }
  }
  endCommand()
  return { commands, nested }
}

// The index of the ) that closes a ( just before `from`, or -1.
function closingParen(line: string, from: number): number {
  let depth = 1
  for (let i = from + 1; i < line.length; i++) {
    if (line[i] === '(') depth++
    else if (line[i] === ')' && --depth === 0) return i
  }
  return -1
}

const programOf = (words: string[]) => words[0]?.split('/').pop() ?? ''

// rm with both -r and -f (in any order or spelling) aimed at the root or the home folder: what it
// deletes, or nothing.
function wipes({ words }: Command): string | undefined {
  if (programOf(words) !== 'rm') return undefined
  const args = words.slice(1)
  const dashes = args.indexOf('--')
  const flags = (dashes === -1 ? args : args.slice(0, dashes)).filter(a => a.startsWith('-'))
  const short = (letter: RegExp) => flags.some(a => !a.startsWith('--') && letter.test(a.slice(1)))
  if (!((short(/[rR]/) || flags.includes('--recursive')) && (short(/f/) || flags.includes('--force')))) return undefined
  const targets = dashes === -1 ? args.filter(a => !a.startsWith('-')) : [...args.slice(0, dashes).filter(a => !a.startsWith('-')), ...args.slice(dashes + 1)]
  for (const t of targets) {
    const bare = t.replace(/\/+\*?$/, '')
    if (bare === '' && t.startsWith('/')) return 'deletes the whole disk'
    if (['~', '$HOME', '${HOME}'].includes(bare)) return 'deletes your home folder'
  }
  return undefined
}

function readsEnv({ words, from }: Command): boolean {
  if (from.some(isEnvFile)) return true
  const name = programOf(words)
  if (!READERS.includes(name)) return false
  const args = words.slice(1)
  const files = args.filter(a => !a.startsWith('-'))
  if (PATTERN_FIRST.includes(name) && !args.some(a => /^(-[ef]|--regexp|--file|--expression)/.test(a))) files.shift()
  // cp reads its sources, not where it writes.
  if (name === 'cp') files.pop()
  return files.some(isEnvFile)
}

// A git call: its subcommand and arguments, past git's own global options (`-C <dir>`,
// `-c <key=value>`, `--no-pager`, …).
function gitCall({ words }: Command): { sub: string; args: string[] }[] {
  if (programOf(words) !== 'git') return []
  let i = 1
  while (i < words.length && words[i]!.startsWith('-')) i += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(words[i]!) ? 2 : 1
  return i < words.length ? [{ sub: words[i]!, args: words.slice(i + 1) }] : []
}

// A git call that throws away work not yet committed: `reset --hard`, `clean` with -f (not a dry
// run), `checkout` or `restore` of the whole tree (a last path of `.`, `./` or `:/`), and a forced
// `checkout` or `switch`, but not `restore --staged`, which only unstages.
function discards(calls: { sub: string; args: string[] }[]): boolean {
  return calls.some(({ sub, args }) => {
    const whole = /^(?:\.\/*|:\/)$/.test(args.filter(a => !a.startsWith('-')).at(-1) ?? '')
    const forced = args.some(a => a === '--force' || a === '--discard-changes' || /^-[a-zA-Z]*f/.test(a))
    if (sub === 'reset') return args.includes('--hard')
    if (sub === 'clean') return args.some(a => /^-[a-z]*f/i.test(a) || a === '--force') && !args.some(a => /^-[a-z]*n/i.test(a) || a === '--dry-run')
    if (sub === 'checkout') return whole || forced
    if (sub === 'switch') return forced
    if (sub === 'restore') {
      const staged = args.includes('--staged') || args.some(a => /^-[A-Za-z]*S/.test(a))
      const worktree = args.includes('--worktree') || args.some(a => /^-[A-Za-z]*W/.test(a))
      return whole && !(staged && !worktree)
    }
    return false
  })
}

// A shell as a command's program: `bash`, `/bin/sh`, `sudo zsh`.
const SHELL_RUN = /^\s*(?:sudo\s+)?(?:\S*\/)?(?:ba|z|da|k)?sh\b/

// The command without the text of its heredocs: a script piped to python or a file written with
// cat is data, whatever words it holds. A heredoc a shell reads, itself or through a pipe, is
// commands and is kept, and so is one never closed, rather than skip text on a guess.
function withoutData(cmd: string): string {
  const lines = cmd.split('\n')
  const kept: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    kept.push(line)
    for (const m of line.matchAll(/(^|[^<])<<(-?)\s*(['"]?)([A-Za-z_][\w-]*)\3/g)) {
      const runner = line.slice(0, m.index! + m[1]!.length).split(/&&|\|\||[;|]/).pop()!
      const piped = line.slice(m.index! + m[0].length).split(/&&|\|\||;/)[0]!.split('|').slice(1)
      const isShell = [runner, ...piped].some(c => SHELL_RUN.test(c))
      const end = lines.findIndex((l, j) => j > i && (m[2] ? l.replace(/^\t+/, '') : l) === m[4])
      if (end === -1) return cmd
      if (isShell) kept.push(...lines.slice(i + 1, end))
      i = end
    }
  }
  return kept.join('\n')
}

// The branch a force push lands on, when it is main or master: the push's own arguments, its
// refspecs read for their destination (`src:dst`, `+dst`), so a word inside another branch's name
// or a later command never counts.
function forcedPush(calls: { sub: string; args: string[] }[]): string | undefined {
  for (const { sub, args } of calls) {
    if (sub !== 'push') continue
    const isForced = args.some(a => a === '-f' || a === '--force' || /^-[a-z]*f[a-z]*$/.test(a))
    const refs = args.filter(a => !a.startsWith('-')).slice(1)
    for (const ref of refs) {
      const branch = ref.replace(/^\+/, '').split(':').pop()!.replace(/^refs\/heads\//, '')
      if ((branch === 'main' || branch === 'master') && (isForced || ref.startsWith('+'))) return branch
    }
  }
  return undefined
}
