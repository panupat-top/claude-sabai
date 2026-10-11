// What the guard refuses, by tool and input: the few commands that are almost never meant —
// wiping the disk or the home folder, force-pushing over main, and reading a secrets file.
// Anything it cannot name passes.

export const GUARD_FAILED = "sabai's guard could not check this call, so it refused it. The person can turn the guard off in /sabai-settings."

// The guard's `.catch`: a guard that failed would be skipped and its call run, so a failure before
// the call ran refuses it; once it ran, its own result stands.
export const failClosed = <T>(next: { called: boolean }, run: () => T): T | { deny: string } => (next.called ? run() : { deny: GUARD_FAILED })

const ENV_FILE = /(^|[\s/'"])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?(?=$|[\s'";|&)])/

export function riskOf(tool: string, input: { command?: unknown; file_path?: unknown }): string | undefined {
  if (tool === 'Read') {
    const path = typeof input.file_path === 'string' ? input.file_path : ''
    return ENV_FILE.test(path) ? 'reads a .env file' : undefined
  }
  if (tool !== 'Bash' || typeof input.command !== 'string') return undefined
  const cmd = withoutData(input.command)
  // rm with both -r and -f (in any order or spelling) aimed at the root or the home folder.
  const rm = /\brm\s+(?:-\w*\s+)*-\w*(?:r\w*f|f\w*r)\w*(?:\s+-\w+)*\s+(\S+)/i.exec(cmd)
  if (rm) {
    const target = rm[1]!.replace(/\/\*?$/, '/')
    if (target === '/' || target === '/*') return 'deletes the whole disk'
    if (['~', '~/', '$HOME', '$HOME/', '${HOME}', '${HOME}/'].includes(target)) return 'deletes your home folder'
  }
  const force = forcedPush(cmd)
  if (force) return `force-pushes to ${force}`
  if (/\b(cat|less|more|head|tail|bat|source|grep|rg)\b/.test(cmd) && ENV_FILE.test(cmd)) return 'reads a .env file'
  return undefined
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

// The branch a force push lands on, when it is main or master: the push's own arguments up to the
// next shell operator, its refspecs read for their destination (`src:dst`, `+dst`), so a word
// inside another branch's name or a later command never counts.
function forcedPush(cmd: string): string | undefined {
  const m = /\bgit\s+push\b([^;&|]*)/.exec(cmd)
  if (!m) return undefined
  const args = m[1]!.trim().split(/\s+/).filter(Boolean)
  const isForced = args.some(a => a === '-f' || a === '--force' || /^-[a-z]*f[a-z]*$/.test(a))
  const refs = args.filter(a => !a.startsWith('-')).slice(1)
  for (const ref of refs) {
    const branch = ref.replace(/^\+/, '').split(':').pop()!.replace(/^refs\/heads\//, '')
    if ((branch === 'main' || branch === 'master') && (isForced || ref.startsWith('+'))) return branch
  }
  return undefined
}
