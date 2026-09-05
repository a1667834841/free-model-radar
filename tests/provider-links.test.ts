import { describe, expect, it } from 'vitest'
import { AIHUBMIX_REGISTER_URL, getProviderHomeUrl, getProviderRegistrationUrl } from '@/lib/provider-icon'

describe('provider links', () => {
  it('keeps the AIHubMix affiliate registration URL even without models or endpoint data', () => {
    const provider = { id: 'aihubmix', name: 'AIHubMix' }

    expect(getProviderHomeUrl(provider)).toBe(AIHUBMIX_REGISTER_URL)
    expect(getProviderRegistrationUrl(provider, '')).toBe(AIHUBMIX_REGISTER_URL)
  })

  it('uses explicit non-empty registration URLs before provider home fallbacks', () => {
    const provider = { id: 'aihubmix', name: 'AIHubMix' }
    const registerUrl = 'https://example.com/register'

    expect(getProviderRegistrationUrl(provider, registerUrl)).toBe(registerUrl)
  })
})
