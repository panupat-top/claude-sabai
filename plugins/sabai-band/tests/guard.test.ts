import { expect, test } from 'claude-code/testing'

import { riskOf } from '../hooks/guard'

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
  expect(bash('cat .env')).toBe('reads a .env file')
  expect(bash('cat .env.example')).toBeUndefined()
  expect(riskOf('Read', { file_path: '/work/app/.env.local' })).toBe('reads a .env file')
  expect(riskOf('Read', { file_path: '/work/app/.env.sample' })).toBeUndefined()
  expect(riskOf('Read', { file_path: '/work/app/env.ts' })).toBeUndefined()
  expect(riskOf('Edit', { file_path: '/work/.env' })).toBeUndefined()
  expect(riskOf('Bash', {})).toBeUndefined()
})
