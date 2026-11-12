export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  usd?: number
  limits: Limit[]
}

export type Totals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { snap: Snapshot | null; totals: Totals }
  }
}
