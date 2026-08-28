import { describe, expect, it } from 'vitest'
import { isModelHidden, recordModelFailure, recordModelSuccess, restoreModel, type ModelHealthState } from '@/services/model-health-service'

describe('model health', () => {
  it('hides a model after five consecutive failures', () => {
    let state: ModelHealthState = {}
    for (let index = 0; index < 5; index += 1) {
      state = recordModelFailure(state, 'provider-a', 'model-a', `2026-08-27T09:00:0${index}.000Z`)
    }

    expect(isModelHidden(state, 'provider-a', 'model-a')).toBe(true)
  })

  it('resets consecutive failures after success', () => {
    let state: ModelHealthState = {}
    state = recordModelFailure(state, 'provider-a', 'model-a', '2026-08-27T09:00:00.000Z')
    state = recordModelSuccess(state, 'provider-a', 'model-a', '2026-08-27T09:01:00.000Z')

    expect(state['provider-a:model-a'].consecutiveFailures).toBe(0)
    expect(state['provider-a:model-a'].hidden).toBe(false)
  })

  it('restores a hidden model', () => {
    let state: ModelHealthState = {}
    for (let index = 0; index < 5; index += 1) {
      state = recordModelFailure(state, 'provider-a', 'model-a', `2026-08-27T09:00:0${index}.000Z`)
    }

    state = restoreModel(state, 'provider-a', 'model-a')

    expect(isModelHidden(state, 'provider-a', 'model-a')).toBe(false)
    expect(state['provider-a:model-a'].consecutiveFailures).toBe(0)
  })
})
