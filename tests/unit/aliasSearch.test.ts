import {describe, it, expect} from 'vitest'
import {aliasSearch} from '../../src/main/platform/operations/alias/search'
import {OperationContext} from '../../src/main/platform/operations/types'

describe('aliasSearch', () => {
  it('asks DPNS for labels starting with the normalized prefix and answers each owner', async () => {
    const queries: unknown[][] = []
    const ctx = {
      sdk: {
        names: {normalizeLabel: (label: string) => label.toLowerCase().replace(/o/g, '0')},
        documents: {
          query: async (...args: unknown[]) => {
            queries.push(args)
            return [{ownerId: {base58: () => 'owner'}, properties: {label: 'Owl352', parentDomainName: 'dash'}}]
          },
        },
      },
    } as unknown as OperationContext

    expect(await aliasSearch({prefix: 'Ow'}, ctx)).toEqual({results: [{identifier: 'owner', name: 'Owl352.dash'}]})
    expect(queries[0][2]).toEqual([['normalizedParentDomainName', '==', 'dash'], ['normalizedLabel', 'startsWith', '0w']])
  })
})
