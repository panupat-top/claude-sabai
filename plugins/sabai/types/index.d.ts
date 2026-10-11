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

// How the comfortable band draws the usage limits.
export type UsageStyle = 'tiles' | 'rings' | 'columns' | 'rows'

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
  // Launched by a Workflow script's agent().
  workflow?: boolean
  // What the agent reported through the mod's step tool, when it did.
  progress?: { done: number; total: number; note?: string }
}

// The person's choices in the settings pane, kept across sessions.
export type Prefs = {
  rows: { info: boolean; tasks: boolean; crew: boolean; usage: boolean; toolbar: boolean; live: boolean }
  notify: boolean
  limits: boolean
  guard: boolean
  steps: boolean
  chat: { spinner: boolean; tools: boolean; tests: boolean; callouts: boolean; receipt: boolean }
  guardRules: Record<GuardRule, GuardAction>
  show: Show
  warnAt: number
  alertAt: number
  density: 'comfortable' | 'compact'
  // Clawd's hats and props for the hour and holidays, and his tricks.
  extras: { accessories: boolean; tricks: boolean }
  usageStyle: UsageStyle
}

// What the band shows: each info chip, each usage card, and Clawd.
export type Show = { folder: boolean; gitUser: boolean; branch: boolean; node: boolean; context: boolean; session: boolean; week: boolean; clawd: boolean }

// The race: what kind a call is, and each member's calls ('main' or an agentId).
export type CallKind = 'read' | 'edit' | 'command' | 'test'
export type RaceLog = {
  calls: Record<string, { kind: CallKind; ok: boolean }[]>
  doing: Record<string, CallKind>
  fellAt: Record<string, number>
  scoredAt: Record<string, number>
  // The turn's finished calls, and how many of them failed.
  fails: number
  total: number
}

export type GuardRule = 'wipe' | 'force' | 'env' | 'discard'
export type GuardAction = 'block' | 'ask' | 'off'

// The main conversation's current turn: what its receipt and Clawd's mood read.
export type TurnLog = {
  files: Record<string, { added: number; removed: number }>
  commands: number
  failed: number
  // Commands that only read, counted apart: alone they are no work for a receipt.
  reads?: number
  // The turn's last test run, with the clock time it ended.
  test?: { passed: number; failed: number; at: number }
  // Clock time of the guard's latest refusal or ask.
  caught?: number
}


declare module 'claude-code' {
  interface PluginState {
    'sabai': {
      usage: Usage | null
      tasks: Task[]
      now: number
      env: Env
      skin: string
      bar: BarStyle
      prefs: Prefs
      finishedOpen: boolean
      openResults: string[]
      agents: AgentRun[]
      durations: StateFamily<number>
      turnLog: TurnLog
      guardCaught: number
      lastTurnAt: number
      receipts: Record<string, TurnLog>
      turnStartedAt: number
      race: RaceLog
      liveStep: { icon: string; title: string } | null
    }
  }
}
