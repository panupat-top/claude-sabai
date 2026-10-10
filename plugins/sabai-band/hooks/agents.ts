import type { AgentRun } from '../types'

// The pane keeps the newest runs; older ones fall off.
const KEEP = 40

// `claude-opus-5-5` → `opus 5.5`, `claude-sonnet-4-5-20250929` → `sonnet 4.5`; anything else as is.
export function modelName(id: string): string {
  const m = id.replace(/^claude-/, '').replace(/-\d{8}$/, '').match(/^([a-z]+)-(\d+)(?:-(\d+))?$/)
  return m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : id
}

export const spawned = (list: AgentRun[], run: AgentRun): AgentRun[] => [...list.filter(a => a.id !== run.id), run].slice(-KEEP)

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One model request of a subagent: its context is everything that request read and wrote.
export const stepped = (list: AgentRun[], agentId: string, model: string, u: Usage): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          model: model || a.model,
          steps: a.steps + 1,
          contextTokens: u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
        },
  )

export const finished = (list: AgentRun[], agentId: string, isAnswered: boolean, at: number): AgentRun[] =>
  list.map(a => (a.agentId !== agentId ? a : { ...a, status: isAnswered ? 'done' : 'failed', endedAt: at }))

export const elapsed = (a: AgentRun, now: number): number => Math.max(0, (a.endedAt ?? now) - a.startedAt)

// 4s, 1m 4s, 1h 2m.
export function clock(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

// Running first, newest first within each group.
export function groups(list: AgentRun[]): { running: AgentRun[]; finished: AgentRun[] } {
  const newest = [...list].reverse()
  return { running: newest.filter(a => a.status === 'running'), finished: newest.filter(a => a.status !== 'running') }
}
