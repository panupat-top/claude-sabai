export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = { contextPercent?: number; contextTokens?: number; contextWindow?: number; rateLimits: Limit[] }

// The session's surroundings: what the band's first row shows.
export type Env = { dir?: string; gitUser?: string; branch?: string; ahead?: number; behind?: number; changes?: number; node?: string }

export type Task = {
  id: string
  subject: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
}

// How the band draws its bars: savvy-progress's dither, square pixel segments, or a solid fill.
export type BarStyle = 'dither' | 'blocks' | 'solid'

// One subagent as the agents pane shows it. `tasks`, `effort`, `result` and `reason` are absent
// on runs from before they were recorded, and while the engine has not said.
export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  contextTokens: number
  steps: number
  effort?: string
  tasks?: Task[]
  result?: string
  reason?: 'answer' | 'aborted' | 'refusal' | 'error'
}

declare module 'claude-code' {
  interface PluginState {
    'sabai-band': {
      usage: Usage | null
      tasks: Task[]
      now: number
      env: Env
      skin: string
      bar: BarStyle
      agents: AgentRun[]
    }
  }
}
