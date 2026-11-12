import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  RenderSurface,
  SessionContextUsage,
  SessionCost,
  SessionRateLimit,
} from 'claude-code'

import type { Snapshot, Totals } from '../types'

const ZERO: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }
const PANE = 'usage'
// Surfaces that never raise the band above the prompt: they get a pane instead
// (on the phone it lives in the Mods sheet).
const PANE_SURFACES: readonly RenderSurface[] = ['mobile', 'vscode']

const snap = atom({ plugin: 'usage-band', key: 'snap' } as const, null)
const totals = atom({ plugin: 'usage-band', key: 'totals' } as const, ZERO)

const toSnapshot = (u: {
  context: SessionContextUsage
  rateLimits: SessionRateLimit[]
  cost?: SessionCost
}): Snapshot => ({
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  contextPercent: u.context.percent,
  usd: u.cost?.usd,
  limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
})

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7 ngày',
  spend_limit: 'Hạn mức chi',
}

const untilReset = (iso: string | undefined, now: number): string => {
  if (iso === undefined) return ''
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const left = d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${m}m` : `${m}m`
  return `↻ ${left}`
}

const BAR = 8
const filled = (pct: number) => Math.min(BAR, Math.max(0, Math.round((pct / 100) * BAR)))

const levelColor = (pct: number | undefined) =>
  pct === undefined ? undefined : pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success'

/** The labelled figures, drawn with the surface's own elements. */
const usageItems = async (
  $: EngineInterface,
  // The surface's own Text element, from `$.ui.resolve(e)`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: any,
): Promise<unknown[] | null> => {
  const s = await read($, snap)
  const t = await read($, totals)
  if (s === null && t.turns === 0) return null

  const now = await $.clock.now()

  const item = (label: string, value: unknown) => (
    <Text wrap="truncate-end">
      <Text dimColor size="caption">
        {label}{' '}
      </Text>
      {value}
    </Text>
  )

  const meter = (pct: number | undefined, detail: string) =>
    pct === undefined ? (
      <Text dimColor>—</Text>
    ) : (
      <Text tabular>
        <Text color={levelColor(pct)}>{'▰'.repeat(filled(pct))}</Text>
        <Text dimColor>{'▱'.repeat(BAR - filled(pct))}</Text>
        <Text color={levelColor(pct)} weight="semibold">
          {' '}
          {Math.round(pct)}%
        </Text>
        {detail === '' ? null : <Text dimColor> {detail}</Text>}
      </Text>
    )

  return [
    item(
      'Context',
      meter(
        s?.contextPercent,
        s?.contextTokens === undefined ? '' : `${fmt(s.contextTokens)}/${fmt(s.contextWindow)}`,
      ),
    ),
    ...(s?.limits ?? []).map(l =>
      item(LIMIT_NAMES[l.kind] ?? l.kind, meter(l.percentUsed, untilReset(l.resetsAt, now))),
    ),
    item(
      'Token',
      <Text tabular>
        <Text weight="semibold">↑{fmt(t.input + t.cacheRead + t.cacheWrite)}</Text>
        <Text dimColor> vào  </Text>
        <Text weight="semibold">↓{fmt(t.output)}</Text>
        <Text dimColor> ra</Text>
      </Text>,
    ),
    ...(s?.usd === undefined
      ? []
      : [
          item(
            'Chi phí',
            <Text tabular weight="semibold" color="claude">
              ${s.usd.toFixed(2)}
            </Text>,
          ),
        ]),
  ]
}

/** Opens the pane while a surface without the band is attached, closes it after. */
const syncPane = async ($: EngineInterface) => {
  const surfaces = await $.session.surfaces()
  const wantsPane = surfaces.some(s => PANE_SURFACES.includes(s))
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (wantsPane && !isOpen) await $.ui.open({ id: PANE, title: 'Usage' })
  if (!wantsPane && isOpen) await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const u = await $.session.usage()
    await update($, snap, () => toSnapshot(u))
    await syncPane($)
    return result
  })

  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    await syncPane($)
    return result
  })

  on('session.detach', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'detach') await syncPane($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snap, () => toSnapshot(e))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u !== undefined) {
      await update($, totals, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        turns: t.turns + 1,
      }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const items = await usageItems($, Text)
    if (items === null) return next(e)

    return (
      <Box
        borderStyle="round"
        borderColor="subtle"
        paddingX={1}
        flexDirection="row"
        flexWrap="wrap"
        columnGap={3}
      >
        {items}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const items = await usageItems($, Text)

    return (
      <Box flexDirection="column" rowGap={1}>
        {items ?? <Text dimColor>Chưa có số liệu usage.</Text>}
      </Box>
    )
  })
}
