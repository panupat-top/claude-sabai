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
  const push = /\bgit\s+push\b(.*)/.exec(cmd)
  if (push && /(\s--force(?!-with-lease)\b|\s-f\b)/.test(push[1]!)) {
    const branch = /\b(main|master)\b/.exec(push[1]!)
    if (branch) return `force-pushes to ${branch[1]}`
  }
  if (/\b(cat|less|more|head|tail|bat|source)\b/.test(cmd) && ENV_FILE.test(cmd)) return 'reads a .env file'
  return undefined
}
