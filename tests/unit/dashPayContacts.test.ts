import {describe, it, expect} from 'vitest'
import {DashPayContactRequest} from '../../src/main/src/types/DashPay'
import {dashPayContacts, dashPayPayments} from '../../src/main/src/utils/dashPayContacts'
import {Transaction} from '../../src/main/src/types/Transaction'

function request(id: string, ownerId: string, toUserId: string, createdAt = 0): DashPayContactRequest {
  return {id, ownerId, toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 0, encryptedPublicKey: new Uint8Array(96), createdAt, contactXpub: null, paymentChannelBroken: false}
}

const contact = (identifier: string, contactId: string, relationship: string, incomingCreatedAt: number | null, outgoingCreatedAt: number | null) =>
  ({identifier, contactId, relationship, aliasesList: [], incomingCreatedAt, outgoingCreatedAt, paymentChannelBroken: false})

describe('dashPayContacts', () => {
  it('pairs a request each way into one established contact', () => {
    expect(dashPayContacts([request('s', 'ours', 'alice', 1), request('r', 'alice', 'ours', 2)], ['ours']))
      .toEqual([contact('ours', 'alice', 'established', 2, 1)])
  })

  it('keeps a one-way request as outgoing or incoming', () => {
    expect(dashPayContacts([request('s', 'ours', 'alice', 1), request('r', 'bob', 'ours', 2)], ['ours'])).toEqual([
      contact('ours', 'alice', 'outgoing', null, 1),
      contact('ours', 'bob', 'incoming', 2, null),
    ])
  })

  // One stored row between two of our identities is a contact for each of them.
  it('lists a request between two of our identities on both sides', () => {
    expect(dashPayContacts([request('x', 'ours', 'other', 5)], ['ours', 'other'])).toEqual([
      contact('ours', 'other', 'outgoing', null, 5),
      contact('other', 'ours', 'incoming', 5, null),
    ])
  })

  it('dates each side by its latest request', () => {
    expect(dashPayContacts([request('old', 'ours', 'alice', 1), request('new', 'ours', 'alice', 9)], ['ours'])[0].outgoingCreatedAt).toBe(9)
  })

  // A broken channel belongs to the request it was found on, so a newer one from the contact clears it.
  it("reports a contact unpayable only while their latest request is the broken one", () => {
    const broken = {...request('old', 'alice', 'ours', 1), paymentChannelBroken: true}
    expect(dashPayContacts([broken], ['ours'])[0].paymentChannelBroken).toBe(true)
    expect(dashPayContacts([broken, request('new', 'alice', 'ours', 2)], ['ours'])[0].paymentChannelBroken).toBe(false)
  })
})

describe('dashPayPayments', () => {
  const tx = (txid: string, date: number, outputs: Array<[string, string]>) =>
    ({txid, date: new Date(date), vout: outputs.map(([address, value], n) => ({address, value, n}))}) as unknown as Transaction

  it('lists what they paid our chain and what we paid theirs, newest first, in duffs', () => {
    const payments = dashPayPayments([
      tx('in', 1, [['ours-0', '0.12345678'], ['someone', '5.00000000']]),
      tx('out', 2, [['theirs-0', '1.00000000'], ['our-change', '3.00000000']]),
      tx('unrelated', 3, [['someone', '1.00000000']]),
    ], new Set(['ours-0']), new Set(['theirs-0']))

    expect(payments).toEqual([
      {txid: 'out', amountDuffs: 100_000_000n, direction: 'sent', date: 2},
      {txid: 'in', amountDuffs: 12_345_678n, direction: 'received', date: 1},
    ])
  })
})
