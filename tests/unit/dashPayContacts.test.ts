import {describe, it, expect} from 'vitest'
import {ContactRequest} from '../../src/main/src/types/Contact'
import {dashPayContacts} from '../../src/main/src/utils/dashPayContacts'

function request(id: string, ownerId: string, toUserId: string): ContactRequest {
  return {id, ownerId, toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 0, encryptedPublicKey: new Uint8Array(96), createdAt: 0}
}

describe('dashPayContacts', () => {
  it('pairs a request each way into one established contact', () => {
    const sent = request('s', 'ours', 'alice')
    const received = request('r', 'alice', 'ours')
    expect(dashPayContacts([sent, received], ['ours'])).toEqual([{identifier: 'ours', contactId: 'alice', sent, received}])
  })

  it('keeps a one-way request as pending on its side', () => {
    expect(dashPayContacts([request('s', 'ours', 'alice'), request('r', 'bob', 'ours')], ['ours'])).toEqual([
      {identifier: 'ours', contactId: 'alice', sent: expect.objectContaining({id: 's'}), received: null},
      {identifier: 'ours', contactId: 'bob', sent: null, received: expect.objectContaining({id: 'r'})},
    ])
  })

  // One stored row between two of our identities is a contact for each of them.
  it('lists a request between two of our identities on both sides', () => {
    expect(dashPayContacts([request('x', 'ours', 'other')], ['ours', 'other'])).toEqual([
      {identifier: 'ours', contactId: 'other', sent: expect.objectContaining({id: 'x'}), received: null},
      {identifier: 'other', contactId: 'ours', sent: null, received: expect.objectContaining({id: 'x'})},
    ])
  })

  it('takes the latest request to the same contact', () => {
    expect(dashPayContacts([request('old', 'ours', 'alice'), request('new', 'ours', 'alice')], ['ours'])[0].sent?.id).toBe('new')
  })
})
