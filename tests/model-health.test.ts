import { describe, expect, it } from 'vitest'
import { classifyProbeFailure, isModelDueForProbe, isModelHidden, recordModelFailure, recordModelSuccess, restoreModel, type ModelHealthState } from '@/services/model-health-service'

describe('model health', () => {
  it('hides a model after thirty consecutive request failures', () => {
    let state: ModelHealthState = {}
    for (let index = 0; index < 30; index += 1) {
      state = recordModelFailure(state, 'provider-a', 'model-a', `2026-08-27T09:00:${String(index).padStart(2, '0')}.000Z`)
    }

    expect(isModelHidden(state, 'provider-a', 'model-a')).toBe(true)
    expect(state['provider-a:model-a'].requestFailureCount).toBe(30)
  })

  it('resets request failure count after success', () => {
    let state: ModelHealthState = {}
    for (let index = 0; index < 29; index += 1) {
      state = recordModelFailure(state, 'provider-a', 'model-a', `2026-08-27T09:00:${String(index).padStart(2, '0')}.000Z`)
    }
    state = recordModelSuccess(state, 'provider-a', 'model-a', '2026-08-27T09:01:00.000Z')

    expect(state['provider-a:model-a'].requestFailureCount).toBe(0)
    expect(state['provider-a:model-a'].consecutiveFailures).toBe(0)
    expect(state['provider-a:model-a'].hidden).toBe(false)
  })

  it('restores a hidden model', () => {
    let state: ModelHealthState = {}
    for (let index = 0; index < 30; index += 1) {
      state = recordModelFailure(state, 'provider-a', 'model-a', `2026-08-27T09:00:${String(index).padStart(2, '0')}.000Z`)
    }

    state = restoreModel(state, 'provider-a', 'model-a')

    expect(isModelHidden(state, 'provider-a', 'model-a')).toBe(false)
    expect(state['provider-a:model-a'].consecutiveFailures).toBe(0)
    expect(state['provider-a:model-a'].requestFailureCount).toBe(0)
  })

  it('rechecks successful models hourly and rate-limited models after two minutes', () => {
    let state: ModelHealthState = {}
    state = recordModelSuccess(state, 'provider-a', 'ok-model', '2026-08-27T09:00:00.000Z')
    state = recordModelFailure(state, 'provider-a', 'limited-model', '2026-08-27T09:00:00.000Z', 'rate_limited')

    expect(isModelDueForProbe(state, 'provider-a', 'ok-model', new Date('2026-08-27T09:59:59.000Z'))).toBe(false)
    expect(isModelDueForProbe(state, 'provider-a', 'ok-model', new Date('2026-08-27T10:00:00.000Z'))).toBe(true)
    expect(isModelDueForProbe(state, 'provider-a', 'limited-model', new Date('2026-08-27T09:01:59.000Z'))).toBe(false)
    expect(isModelDueForProbe(state, 'provider-a', 'limited-model', new Date('2026-08-27T09:02:00.000Z'))).toBe(true)
  })

  it('classifies probe failures for retry scheduling', () => {
    expect(classifyProbeFailure('Probe failed with HTTP 429')).toBe('rate_limited')
    expect(classifyProbeFailure('Operation timed out after 10000ms')).toBe('transient_failure')
    expect(classifyProbeFailure('Probe failed with HTTP 503')).toBe('transient_failure')
    expect(classifyProbeFailure('Probe failed with HTTP 404')).toBe('permanent_failure')
  })
})
