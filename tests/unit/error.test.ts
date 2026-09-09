import {describe, expect, it} from 'vitest'
import {getErrorMessage} from '@renderer/utils/error'

describe('getErrorMessage', () => {
  it('removes the Electron remote method wrapper', () => {
    const error = new Error(
      "Error invoking remote method 'pushStaticPeer': Error: Unreachable peer 207.154.204.134:9999: no handshake within 8000ms",
    )

    expect(getErrorMessage(error)).toBe(
      'Unreachable peer 207.154.204.134:9999: no handshake within 8000ms',
    )
  })

  it('preserves a domain error message', () => {
    expect(getErrorMessage(new Error('Unreachable peer'))).toBe('Unreachable peer')
  })

  it('stringifies non-error values', () => {
    expect(getErrorMessage('Connection failed')).toBe('Connection failed')
  })
})
