import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 200,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the band shows context, tokens, cost and limits', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.complete', () => ({ text: '' }))
  on('clock.now', () => ({ value: 0 }))

  await $.session.measure({
    context: { tokens: 68_000, window: 200_000, percent: 34 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 92 }],
    cost: { usd: 3.214 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  await $.turn.complete({
    answer: 'hi',
    durationMs: 10,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5-5',
      input_tokens: 1_000,
      output_tokens: 2_500,
      cache_read_input_tokens: 40_000,
      cache_creation_input_tokens: 500,
    },
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const ctx = await ui.find({ type: 'Text', text: /^Context/ })
    expect(ctx?.text).toBe('Context ▰▰▰▱▱▱▱▱ 34% 68k/200k')
    const five = await ui.find({ type: 'Text', text: /^5h/ })
    expect(five?.text).toBe('5h ▰▰▰▰▰▰▰▱ 92%')
    const tok = await ui.find({ type: 'Text', text: /^Token/ })
    expect(tok?.text).toBe('Token ↑42k vào  ↓2.5k ra')
    const cost = await ui.find({ type: 'Text', text: /^Chi phí/ })
    expect(cost?.text).toBe('Chi phí $3.21')
    await ui.unmount()
  }

  // The phone (Remote Control) and VS Code get the same figures in a pane.
  for (const surface of ['mobile', 'vscode'] as const) {
    const ui = await $.ui.mount({
      plugin: 'usage-band',
      component: 'Pane',
      requestId: 'usage',
      surface,
      props: {
        title: 'Usage',
        isFocused: false,
        bodyColumns: 40,
        placement: 'inline',
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    expect((await ui.find({ type: 'Text', text: /^Context/ }))?.text).toContain('34%')
    expect((await ui.find({ type: 'Text', text: /^Token/ }))?.text).toContain('↑42k')
    await ui.unmount()
  }
})

test('a phone attaching opens the usage pane', async ($, on) => {
  let surfaces: string[] = ['desktop']
  const opened: string[] = []
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.attach', (_, e) => ({ clientId: e.clientId }))

  surfaces = ['desktop', 'mobile']
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default' })
  expect(opened).toEqual(['usage'])
})
