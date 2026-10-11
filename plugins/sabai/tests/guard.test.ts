import { expect, test } from 'claude-code/testing'

import { GUARD_FAILED, failClosed, riskOf } from '../hooks/guard'

test('the guard names risky commands and lets ordinary ones through', () => {
  const bash = (command: string) => riskOf('Bash', { command })
  expect(bash('rm -rf /')).toBe('deletes the whole disk')
  expect(bash('sudo rm -fr ~')).toBe('deletes your home folder')
  expect(bash('rm -rf $HOME/')).toBe('deletes your home folder')
  expect(bash('rm -rf ./build')).toBeUndefined()
  expect(bash('rm -rf node_modules && npm i')).toBeUndefined()
  expect(bash('git push --force origin main')).toBe('force-pushes to main')
  expect(bash('git push -f origin master')).toBe('force-pushes to master')
  expect(bash('git push --force-with-lease origin main')).toBeUndefined()
  expect(bash('git push --force origin feature/x')).toBeUndefined()
  // Only the branch pushed to counts, not a word inside another branch's name.
  expect(bash('git push --force origin feature/main-thing')).toBeUndefined()
  expect(bash('git push -f origin main-backup')).toBeUndefined()
  expect(bash('git push --force origin HEAD:main')).toBe('force-pushes to main')
  expect(bash('git push origin +refs/heads/master')).toBe('force-pushes to master')
  expect(bash('git push --force origin feature/x && echo main')).toBeUndefined()
  expect(bash('grep KEY .env')).toBe('reads a .env file')
  expect(bash('cat .env')).toBe('reads a .env file')
  expect(bash('cat .env.example')).toBeUndefined()
  expect(riskOf('Read', { file_path: '/work/app/.env.local' })).toBe('reads a .env file')
  expect(riskOf('Read', { file_path: '/work/app/.env.sample' })).toBeUndefined()
  expect(riskOf('Read', { file_path: '/work/app/env.ts' })).toBeUndefined()
  expect(riskOf('Edit', { file_path: '/work/.env' })).toBeUndefined()
  expect(riskOf('Bash', {})).toBeUndefined()
})

test('a heredoc’s text is data for its command, unless a shell reads it as commands', () => {
  const bash = (command: string) => riskOf('Bash', { command })
  // A script or a file being written may hold any words.
  expect(bash("python3 - <<'EOF'\nnote = 'Refuse rm -rf / or ~, cat .env'\nEOF")).toBeUndefined()
  expect(bash('cat > notes.md <<EOF\ngit push --force origin main\nEOF\necho done')).toBeUndefined()
  expect(bash('node <<-"END"\n\tconsole.log("rm -rf ~")\n\tEND')).toBeUndefined()
  // A shell reading the heredoc runs it.
  expect(bash('bash <<EOF\nrm -rf /\nEOF')).toBe('deletes the whole disk')
  expect(bash("sh -s <<'X'\ncat .env\nX")).toBe('reads a .env file')
  // The command line itself, and what follows the heredoc, are still read.
  expect(bash("rm -rf ~ <<EOF\nx\nEOF")).toBe('deletes your home folder')
  expect(bash('cat > a.txt <<EOF\nhello\nEOF\ngit push -f origin main')).toBe('force-pushes to main')
  // An unterminated heredoc keeps its text: nothing is skipped on a guess.
  expect(bash("python3 - <<EOF\nrm -rf /")).toBe('deletes the whole disk')
})

test('a guard that failed refuses the call unless the call already ran', () => {
  expect(failClosed({ called: false }, () => 'ran')).toEqual({ deny: GUARD_FAILED })
  expect(failClosed({ called: true }, () => 'ran')).toBe('ran')
  expect(GUARD_FAILED).toMatch(/could not check this call.*\/sabai-settings/)
})
