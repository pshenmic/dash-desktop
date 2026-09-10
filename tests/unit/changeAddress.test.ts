import { describe, expect, it } from 'vitest'
import type { WalletAddressDto } from '../../src/renderer/src/api/types'
import { coreSendChangeTo, hasUnallocatedCoreFunds, selectedChangeAddress, suggestedChangeAddress } from '../../src/renderer/src/utils/changeAddress'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'

function address(value: string, isUsed = false): WalletAddressDto {
  return {walletId: 'wallet', accountId: 0, address: value, derivationPath: '', index: 0, isChange: 1, isUsed, balance: 0n, txCount: 0, label: null, usdBalance: null}
}

describe('change address draft', () => {
  it('suggests the first unused change address even with no balance', () => {
    expect(suggestedChangeAddress([address('used', true), address('unused'), address('next')])).toBe('unused')
  })

  it('falls back to the last used change address or leaves an empty change list without a suggestion', () => {
    expect(suggestedChangeAddress([address('first', true), address('last', true)])).toBe('last')
    expect(suggestedChangeAddress([])).toBeNull()
  })

  it('preserves wallet and manually entered addresses, including an unfinished or empty draft', () => {
    const change = [address('suggested'), address('custom')]
    expect(selectedChangeAddress(change, 'custom')).toBe('custom')
    expect(selectedChangeAddress(change, 'receive')).toBe('receive')
    expect(selectedChangeAddress(change, 'manual')).toBe('manual')
    expect(selectedChangeAddress(change, '')).toBe('')
    expect(selectedChangeAddress(change, '  manual  ')).toBe('  manual  ')
    expect(selectedChangeAddress([], 'manual')).toBe('manual')
    expect(selectedChangeAddress(change)).toBe('suggested')
    expect(selectedChangeAddress([])).toBeNull()
  })

  it('only shows an allocation remainder for a positive partial amount and known maximum', () => {
    expect(hasUnallocatedCoreFunds(90n, 100n)).toBe(true)
    expect(hasUnallocatedCoreFunds(100n, 100n)).toBe(false)
    expect(hasUnallocatedCoreFunds(101n, 100n)).toBe(false)
    expect(hasUnallocatedCoreFunds(0n, 100n)).toBe(false)
    expect(hasUnallocatedCoreFunds(90n, null)).toBe(false)
  })

  it('uses the selected or suggested change address only for an advanced partial Core send', () => {
    const params = {advanced: true, operation: TransferOperation.CoreSend, amountDuffs: 90n, maxDuffs: 100n, change: [address('suggested')]}
    expect(coreSendChangeTo(params)).toBe('suggested')
    expect(coreSendChangeTo({...params, selected: '  external  '})).toBe('external')
    expect(coreSendChangeTo({...params, selected: ' '})).toBeUndefined()
    expect(coreSendChangeTo({...params, change: []})).toBeUndefined()
    expect(coreSendChangeTo({...params, advanced: false, selected: 'saved-advanced'})).toBeUndefined()
    for (const operation of Object.values(TransferOperation).filter(operation => operation !== TransferOperation.CoreSend)) {
      expect(coreSendChangeTo({...params, operation, selected: 'saved'})).toBeUndefined()
    }
    expect(coreSendChangeTo({...params, amountDuffs: 100n, selected: 'hidden-custom'})).toBeUndefined()
    expect(coreSendChangeTo({...params, maxDuffs: null})).toBeUndefined()
  })
})
