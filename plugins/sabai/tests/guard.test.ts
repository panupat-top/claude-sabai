import { expect, test } from 'claude-code/testing'

import { GUARD_FAILED, failClosed, riskOf, risksOf } from '../hooks/guard'

test('the guard names risky commands and lets ordinary ones through', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.reason
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
  expect(riskOf('Read', { file_path: '/work/app/.env.local' })?.reason).toBe('reads a .env file')
  expect(riskOf('Read', { file_path: '/work/app/.env.sample' })?.reason).toBeUndefined()
  expect(riskOf('Read', { file_path: '/work/app/env.ts' })?.reason).toBeUndefined()
  expect(riskOf('Edit', { file_path: '/work/.env' })?.reason).toBeUndefined()
  expect(riskOf('Bash', {})?.reason).toBeUndefined()
})

test('a heredoc’s text is data for its command, unless a shell reads it as commands', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.reason
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

test('each risk names its rule', () => {
  expect(riskOf('Bash', { command: 'rm -rf /' })?.rule).toBe('wipe')
  expect(riskOf('Bash', { command: 'git push -f origin main' })?.rule).toBe('force')
  expect(riskOf('Read', { file_path: '/a/.env' })?.rule).toBe('env')
  expect(riskOf('Bash', { command: 'git reset --hard' })?.rule).toBe('discard')
})

test('the discard rule catches throwing away uncommitted work, and only that', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.reason
  const discards = 'throws away uncommitted work'
  expect(bash('git reset --hard')).toBe(discards)
  expect(bash('git reset --hard HEAD~1')).toBe(discards)
  expect(bash('git clean -fd')).toBe(discards)
  expect(bash('git clean -xdf')).toBe(discards)
  expect(bash('git checkout -- .')).toBe(discards)
  expect(bash('git checkout .')).toBe(discards)
  expect(bash('git restore .')).toBe(discards)
  expect(bash('npm test && git reset --hard origin/main')).toBe(discards)
  // Everyday commands pass.
  expect(bash('git reset --soft HEAD~1')).toBeUndefined()
  expect(bash('git reset HEAD a.ts')).toBeUndefined()
  expect(bash('git clean -n')).toBeUndefined()
  expect(bash('git clean -nd')).toBeUndefined()
  expect(bash('git checkout -- src/a.ts')).toBeUndefined()
  expect(bash('git checkout main')).toBeUndefined()
  expect(bash('git restore src/a.ts')).toBeUndefined()
  expect(bash('git restore --staged .')).toBeUndefined()
  expect(bash('echo git reset --hard')).toBeUndefined()
  expect(bash("cat > n.md <<'EOF'\ngit reset --hard\nEOF")).toBeUndefined()
})

test('every risk in a compound command is named, not only the first', () => {
  expect(risksOf('Bash', { command: 'git reset --hard && cat .env' }).map(r => r.rule)).toEqual(['discard', 'env'])
  expect(risksOf('Bash', { command: 'git push --force origin main; cat .env' }).map(r => r.rule)).toEqual(['force', 'env'])
  expect(risksOf('Bash', { command: 'ls' })).toEqual([])
})

test('discards and force pushes are caught past git’s global options, subshells and wrappers', () => {
  const rule = (command: string) => riskOf('Bash', { command })?.rule
  for (const command of [
    'git -C /repo reset --hard',
    'git -C repo checkout .',
    'git --no-pager reset --hard',
    'git -c core.x=y clean -fd',
    '(cd repo && git reset --hard)',
    '(git checkout .)',
    'env X=1 git clean -fdx',
    'command git reset --hard',
    'nohup git clean -fdx',
    'git checkout HEAD -- .',
    'git checkout HEAD .',
  ])
    expect([command, rule(command)]).toEqual([command, 'discard'])
  expect(rule('git -C x push --force origin main')).toBe('force')
  expect(rule('git -C repo checkout -- src/a.ts')).toBeUndefined()
  expect(rule('(cd repo && git status)')).toBeUndefined()
})

test('git restore -S . only unstages and passes; -W . or plain . discards', () => {
  const rule = (command: string) => riskOf('Bash', { command })?.rule
  expect(rule('git restore -S .')).toBeUndefined()
  expect(rule('git restore -S -W .')).toBe('discard')
  expect(rule('git restore -W .')).toBe('discard')
})

test('rm is read word by word: every rm, every target, long and split flags, quotes and --', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.reason
  const disk = 'deletes the whole disk'
  expect(bash('rm -rf build && rm -rf /')).toBe(disk)
  expect(bash('rm -rf build /')).toBe(disk)
  expect(bash('rm -rf /tmp/x ~')).toBe('deletes your home folder')
  expect(bash('rm -rf --no-preserve-root /')).toBe(disk)
  expect(bash('rm -r -f /')).toBe(disk)
  expect(bash('rm --recursive --force /')).toBe(disk)
  expect(bash('rm -rf -- /')).toBe(disk)
  expect(bash('rm -rf "/"')).toBe(disk)
  expect(bash('rm -rf "$HOME"')).toBe('deletes your home folder')
  expect(bash('rm -rf ${HOME}/*')).toBe('deletes your home folder')
  expect(bash('/bin/rm -rf /')).toBe(disk)
  // Not a wipe: a folder under the root, no -f, an rm inside an echoed string's words.
  expect(bash('rm -rf /tmp/build')).toBeUndefined()
  expect(bash('rm -r build')).toBeUndefined()
  expect(bash('rm -rf ./build 2>/dev/null')).toBeUndefined()
})

test('git calls are found past assignments, sudo options, nice, shell keywords, braces, backticks and sh -c', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.rule
  expect(bash('FOO=1 git push --force origin main')).toBe('force')
  expect(bash('GIT_SSH_COMMAND=x git reset --hard')).toBe('discard')
  expect(bash('sudo -u me git reset --hard')).toBe('discard')
  expect(bash('nice -n 5 git reset --hard')).toBe('discard')
  expect(bash('if true; then git reset --hard; fi')).toBe('discard')
  expect(bash('{ git reset --hard; }')).toBe('discard')
  expect(bash('echo `git reset --hard`')).toBe('discard')
  expect(bash('echo $(git reset --hard)')).toBe('discard')
  expect(bash('bash -c "git reset --hard"')).toBe('discard')
  expect(bash("sh -lc 'rm -rf /'")).toBe('wipe')
  expect(bash('git push --force origin "main"')).toBe('force')
  // A quoted word that only mentions git is not a git call.
  expect(bash('echo "git reset --hard"')).toBeUndefined()
  expect(bash('git commit -m "reset --hard; push --force main"')).toBeUndefined()
})

test('the env rule catches a .env file a command reads, and not one it only names', () => {
  const bash = (command: string) => riskOf('Bash', { command })?.rule
  for (const c of ['sed -n 1,5p .env', 'awk 1 .env', 'cp .env /tmp/x', '. ./.env', 'xargs < .env', 'cat<.env', 'cat .env>out', 'grep -e KEY .env', 'tail -n 3 config/.env.production'])
    expect([c, bash(c)]).toEqual([c, 'env'])
  for (const c of ["grep -q '^.env$' .gitignore || echo '.env' >> .gitignore", 'cat README.md && ls -la .env', 'cat .env.local.example', 'cat .env.prod.example', 'rg .env src', 'echo KEY=1 > .env'])
    expect([c, bash(c)]).toEqual([c, undefined])
})
