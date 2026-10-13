export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = { contextPercent?: number; contextTokens?: number; contextWindow?: number; rateLimits: Limit[] }

// The session's surroundings: what the band's first row shows. `read` once git and node have
// answered (or given up); until then the row is a skeleton.
export type Env = { dir?: string; gitUser?: string; branch?: string; ahead?: number; behind?: number; changes?: number; node?: string; read?: boolean }

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
  // The fields below are what the agents pane's detail shows; absent on runs from before them.
  // The crew it belongs to: the main turn (or the workflow run) that started it.
  crew?: string
  // The task as the Agent call gave it, cut short.
  brief?: string
  background?: boolean
  // Its latest calls, oldest first, with every call and failure counted past them.
  calls?: AgentCall[]
  callCount?: number
  callFails?: number
  // Calls in flight, oldest first: parallel calls each hold their own.
  doing?: { kind: ActKind; title: string; target: string }[]
  // How often each tool was called; a skill as `skill:<name>`.
  tools?: Record<string, number>
  files?: Record<string, AgentFile>
  // The step tool's notes, in the order they came.
  notes?: string[]
  // Every request's new tokens (input, cache writes, output), summed; cache reads left out.
  spent?: number
  // Clock time of its latest call, call's end or request.
  lastActiveAt?: number
  // The Thai summary of its report: bullets, `pending` while Haiku writes them.
  summary?: string[] | 'pending'
  // Earlier rounds' reports, when it was sent more work after finishing.
  rounds?: AgentRound[]
}

// What a subagent's call was: the race's kinds and the tools they leave out.
export type ActKind = CallKind | 'search' | 'web' | 'skill' | 'mcp' | 'other'
export type AgentCall = { kind: ActKind; title: string; ok: boolean; ms: number }
export type AgentFile = { reads: number; edits: number; added: number; removed: number; created?: boolean }
export type AgentRound = { result?: string; reason?: AgentRun['reason']; summary?: string[] }

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
  // A finished agent's report summed up in Thai by Haiku.
  agentSummary: boolean
}

// What the band shows: each info chip, each usage card, and Clawd.
export type Show = { folder: boolean; gitUser: boolean; branch: boolean; node: boolean; context: boolean; session: boolean; week: boolean; clawd: boolean }

// The race: what kind a call is, and each member's calls ('main' or an agentId).
export type CallKind = 'read' | 'edit' | 'command' | 'test'
export type RaceLog = {
  calls: Record<string, { kind: CallKind; ok: boolean }[]>
  // Each member's finished calls, past the last tiles `calls` keeps.
  count: Record<string, number>
  // Each member's calls in flight, oldest first: parallel calls each hold their own.
  doing: Record<string, CallKind[]>
  // Each member's latest call as its step line names it, and how many of its calls failed.
  said: Record<string, string>
  failed: Record<string, number>
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
      // Reset was pressed once and waits a few seconds for the second press.
      resetArmed: boolean
      // The agents pane: the agent its detail shows (null: the one most worth a look), the
      // detail's folds that are open, and the earlier crews shown in full.
      selectedAgent: string | null
      detailOpen: string[]
      earlierOpen: string[]
      // The earlier crews' box folded or not; null: folded while a crew is at work.
      earlierFolded: boolean | null
      // The main loop's model, whose context window a subagent on the same model shares.
      mainModel: string
      agents: AgentRun[]
      // The main loop's turns as the agents pane draws them: the one at work, and those whose crew had agents.
      mains: AgentRun[]
      durations: StateFamily<number>
      turnLog: TurnLog
      guardCaught: number
      lastTurnAt: number
      receipts: Record<string, TurnLog>
      turnStartedAt: number
      race: RaceLog
      liveStep: { icon: string; title: string } | null
      warned: string[]
    }
  }
}
