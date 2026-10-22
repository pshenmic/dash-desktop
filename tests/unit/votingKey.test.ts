import { describe, expect, it } from 'vitest'
import { classifyVotingKeyInput, isProTxHash, votingKeyMessage } from '../../src/renderer/src/utils/votingKey'
import { VotingKeyInputKind } from '../../src/renderer/src/enums/Masternodes'

const BODY = 'V'

const testnetCompressedWif = `c${BODY.repeat(51)}`
const testnetUncompressedWif = `9${BODY.repeat(50)}`
const mainnetCompressedWif = `X${BODY.repeat(51)}`
const mainnetUncompressedWif = `7${BODY.repeat(50)}`
const testnetAddress = `y${BODY.repeat(33)}`
const mainnetAddress = `X${BODY.repeat(33)}`
const hexKey = 'ab'.repeat(32)

describe('classifyVotingKeyInput', () => {
  it('accepts compressed and uncompressed WIF keys of the selected network', () => {
    expect(classifyVotingKeyInput(testnetCompressedWif, 'testnet')).toBe(VotingKeyInputKind.Valid)
    expect(classifyVotingKeyInput(testnetUncompressedWif, 'testnet')).toBe(VotingKeyInputKind.Valid)
    expect(classifyVotingKeyInput(mainnetCompressedWif, 'mainnet')).toBe(VotingKeyInputKind.Valid)
    expect(classifyVotingKeyInput(` ${mainnetUncompressedWif} `, 'mainnet')).toBe(VotingKeyInputKind.Valid)
  })

  it('recognises a key of the other network', () => {
    expect(classifyVotingKeyInput(mainnetCompressedWif, 'testnet')).toBe(VotingKeyInputKind.WrongNetwork)
    expect(classifyVotingKeyInput(testnetCompressedWif, 'mainnet')).toBe(VotingKeyInputKind.WrongNetwork)
  })

  it('tells addresses and hex keys apart from WIF', () => {
    expect(classifyVotingKeyInput(testnetAddress, 'testnet')).toBe(VotingKeyInputKind.Address)
    expect(classifyVotingKeyInput(mainnetAddress, 'testnet')).toBe(VotingKeyInputKind.Address)
    expect(classifyVotingKeyInput(hexKey, 'testnet')).toBe(VotingKeyInputKind.Hex)
  })

  it('rejects empty, non-base58 and wrongly sized input', () => {
    expect(classifyVotingKeyInput('   ', 'testnet')).toBe(VotingKeyInputKind.Empty)
    expect(classifyVotingKeyInput(`c${'0'.repeat(51)}`, 'testnet')).toBe(VotingKeyInputKind.Invalid)
    expect(classifyVotingKeyInput(`c${BODY.repeat(40)}`, 'testnet')).toBe(VotingKeyInputKind.Invalid)
    expect(classifyVotingKeyInput(`Q${BODY.repeat(51)}`, 'testnet')).toBe(VotingKeyInputKind.Invalid)
  })
})

describe('votingKeyMessage', () => {
  it('names the network a foreign key belongs to', () => {
    expect(votingKeyMessage(VotingKeyInputKind.WrongNetwork, 'testnet')).toBe('This key is for mainnet')
    expect(votingKeyMessage(VotingKeyInputKind.Valid, 'testnet')).toBe('Looks good')
  })
})

describe('isProTxHash', () => {
  it('accepts 64 hex characters only', () => {
    expect(isProTxHash(` ${hexKey.toUpperCase()} `)).toBe(true)
    expect(isProTxHash(hexKey.slice(1))).toBe(false)
    expect(isProTxHash(`${hexKey.slice(1)}g`)).toBe(false)
  })
})
