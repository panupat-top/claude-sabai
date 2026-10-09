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

declare module 'claude-code' {
  interface PluginState {
    'sabai-band': {
      usage: Usage | null
      tasks: Task[]
      now: number
      env: Env
      skin: string
    }
  }
}
