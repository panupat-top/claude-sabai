// What the guard refuses, by tool and input: the few commands that are almost never meant —
// wiping the disk or the home folder, force-pushing over main, and reading a secrets file.
// Anything it cannot name passes.

const ENV_FILE = /(^|[\s/'"])\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?(?=$|[\s'";|&)])/

export function riskOf(tool: string, input: { command?: unknown; file_path?: unknown }): string | undefined {
  if (tool === 'Read') {
    const path = typeof input.file_path === 'string' ? input.file_path : ''
    return ENV_FILE.test(path) ? 'reads a .env file' : undefined
  }
  if (tool !== 'Bash' || typeof input.command !== 'string') return undefined
  const cmd = input.command
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
