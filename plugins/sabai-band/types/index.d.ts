export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = { contextPercent?: number; contextTokens?: number; contextWindow?: number; rateLimits: Limit[] }

export type Reading = { percent: number; resetsAt?: string }

// The windows in the statusline's usage cache: 5H and 7D as a fallback before the engine has
// a reading (a fresh or resumed session), and the model-scoped week (7D Fable) it never has.
export type Cache = { session?: Reading; week?: Reading; scoped?: Reading & { name: string } }

// The session's surroundings: what the info row under the tasks shows.
export type Env = { dir?: string; gitUser?: string; branch?: string; changes?: number; node?: string }

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
      cache: Cache
      tasks: Task[]
      now: number
      env: Env
      skin: string
    }
  }
}
