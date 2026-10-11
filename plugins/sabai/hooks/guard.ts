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
  discard: { name: 'Discard uncommitted', note: 'git reset --hard, git clean -f, git checkout/restore .', action: 'ask' },
}

export const GUARD_FAILED = "sabai's guard could not check this call, so it refused it. The person can turn the guard off in /sabai-settings."

// The guard's `.catch`: a guard that failed would be skipped and its call run, so a failure before
// the call ran refuses it; once it ran, its own result stands.
export const failClosed = <T>(next: { called: boolean }, run: () => T): T | { deny: string } => (next.called ? run() : { deny: GUARD_FAILED })
// The same for a permission decision: a failure before the verdict beneath was reached denies.
export const checkFailClosed = <T>(next: { called: boolean }, run: () => T): T | { decision: 'deny'; reason: string } =>
  next.called ? run() : { decision: 'deny', reason: GUARD_FAILED }

const ENV_FILE = /(^|[\s/'"])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?(?=$|[\s'";|&)])/

// The first risk of a call, or nothing.
export const riskOf = (tool: string, input: { command?: unknown; file_path?: unknown }): Risk | undefined => risksOf(tool, input)[0]

// Every risk of a call, in rule order: a compound command can hold several, and the guard acts on
// the strictest of them.
export function risksOf(tool: string, input: { command?: unknown; file_path?: unknown }): Risk[] {
  if (tool === 'Read') {
    const path = typeof input.file_path === 'string' ? input.file_path : ''
    return ENV_FILE.test(path) ? [{ rule: 'env', reason: 'reads a .env file' }] : []
  }
  if (tool !== 'Bash' || typeof input.command !== 'string') return []
  const cmd = withoutData(input.command)
  const risks: Risk[] = []
  // rm with both -r and -f (in any order or spelling) aimed at the root or the home folder.
  const rm = /\brm\s+(?:-\w*\s+)*-\w*(?:r\w*f|f\w*r)\w*(?:\s+-\w+)*\s+(\S+)/i.exec(cmd)
  if (rm) {
    const target = rm[1]!.replace(/\/\*?$/, '/')
    if (target === '/' || target === '/*') risks.push({ rule: 'wipe', reason: 'deletes the whole disk' })
    else if (['~', '~/', '$HOME', '$HOME/', '${HOME}', '${HOME}/'].includes(target)) risks.push({ rule: 'wipe', reason: 'deletes your home folder' })
  }
  const calls = gitCalls(cmd)
  const force = forcedPush(calls)
  if (force) risks.push({ rule: 'force', reason: `force-pushes to ${force}` })
  if (discards(calls)) risks.push({ rule: 'discard', reason: 'throws away uncommitted work' })
  if (/\b(cat|less|more|head|tail|bat|source|grep|rg)\b/.test(cmd) && ENV_FILE.test(cmd)) risks.push({ rule: 'env', reason: 'reads a .env file' })
  return risks
}

// Each git call in a command: its subcommand and arguments, up to the next shell operator or the
// end of a subshell, past wrappers (`sudo`, `env X=1`, `command`, `time`, `nohup`) and git's own
// global options (`-C <dir>`, `-c <key=value>`, `--no-pager`, …).
function gitCalls(cmd: string): { sub: string; args: string[] }[] {
  const out: { sub: string; args: string[] }[] = []
  const wrappers = /(?:(?:sudo|command|time|nohup)\s+|env\s+(?:\w+=\S*\s+)*)*/.source
  for (const m of cmd.matchAll(new RegExp(`(?:^|[;&|(]|\\n)\\s*${wrappers}git\\s+([^;&|)\\n]*)`, 'g'))) {
    const words = m[1]!.trim().split(/\s+/).filter(Boolean)
    let i = 0
    while (i < words.length && words[i]!.startsWith('-')) i += ['-C', '-c', '--git-dir', '--work-tree', '--namespace'].includes(words[i]!) ? 2 : 1
    if (i < words.length) out.push({ sub: words[i]!, args: words.slice(i + 1) })
  }
  return out
}

// A git call that throws away work not yet committed: `reset --hard`, `clean` with -f (not a dry
// run), and `checkout` or `restore` of the whole tree (a last path of `.`), but not
// `restore --staged`, which only unstages.
function discards(calls: { sub: string; args: string[] }[]): boolean {
  return calls.some(({ sub, args }) => {
    const whole = args.filter(a => !a.startsWith('-')).at(-1) === '.'
    if (sub === 'reset') return args.includes('--hard')
    if (sub === 'clean') return args.some(a => /^-[a-z]*f/i.test(a) || a === '--force') && !args.some(a => /^-[a-z]*n/i.test(a) || a === '--dry-run')
    if (sub === 'checkout') return whole
    if (sub === 'restore') {
      const staged = args.includes('--staged') || args.some(a => /^-[A-Za-z]*S/.test(a))
      const worktree = args.includes('--worktree') || args.some(a => /^-[A-Za-z]*W/.test(a))
      return whole && !(staged && !worktree)
    }
    return false
  })
}

// The command without the text of its heredocs: a script piped to python or a file written with
// cat is data, whatever words it holds. A heredoc a shell reads is commands and is kept, and so
// is one never closed, rather than skip text on a guess.
function withoutData(cmd: string): string {
  const lines = cmd.split('\n')
  const kept: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    kept.push(line)
    for (const m of line.matchAll(/(^|[^<])<<(-?)\s*(['"]?)([A-Za-z_][\w-]*)\3/g)) {
      const runner = line.slice(0, m.index! + m[1]!.length).split(/&&|\|\||[;|]/).pop()!
      const isShell = /^\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b/.test(runner)
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
