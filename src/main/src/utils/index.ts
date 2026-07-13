import fs from 'fs'
import os from 'os'
import path from 'path'
import {HomeFolderName, PBKDF2_DIGEST, PBKDF2_KEY_LENGTH, PBKDF2_SALT_LENGTH} from '../constants'
import knex, {Knex} from 'knex'
import * as migration0000 from '../../migrations/0000_init'
import * as migration0001 from '../../migrations/0001_identities'
import * as migration0002 from '../../migrations/0002_transactions'
import * as migration0003 from '../../migrations/0003_address_used'
import * as migration0004 from '../../migrations/0004_pending_tx'
import * as migration0005 from '../../migrations/0005_contacts'
import * as migration0006 from '../../migrations/0006_asset_lock_fundings'
import * as migration0007 from '../../migrations/0007_shielded_spent_notes'
import * as migration0008 from '../../migrations/0008_platform_xpub'
import * as migration0009 from '../../migrations/0009_shielded_address_count'
import * as migration0010 from '../../migrations/0010_asset_lock_funding_kind'

const migrations = [
  { name: '0000_init.ts', migration: migration0000 },
  { name: '0001_identities.ts', migration: migration0001 },
  { name: '0002_transactions.ts', migration: migration0002 },
  { name: '0003_address_used.ts', migration: migration0003 },
  { name: '0004_pending_tx.ts', migration: migration0004 },
  { name: '0005_contacts.ts', migration: migration0005 },
  { name: '0006_asset_lock_fundings.ts', migration: migration0006 },
  { name: '0007_shielded_spent_notes.ts', migration: migration0007 },
  { name: '0008_platform_xpub.ts', migration: migration0008 },
  { name: '0009_shielded_address_count.ts', migration: migration0009 },
  { name: '0010_asset_lock_funding_kind.ts', migration: migration0010 },
]

const inlineMigrationSource = {
  getMigrations: () => Promise.resolve(migrations),
  getMigrationName: (m: typeof migrations[number]) => m.name,
  getMigration: (m: typeof migrations[number]) => Promise.resolve(m.migration),
}
import {TransactionWalletProviderJSON} from "../providers/types";
import {Address} from "../types/Address";
import {TransactionStatus} from "../enums/TransactionStatus";
import {Transaction} from "../types/Transaction";
import {IdentityWASM, PrivateKeyWASM} from "dash-platform-sdk/types.js";
import {DashPlatformSDK} from "dash-platform-sdk";
import {Network} from "../types";
import {createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes} from "node:crypto";

export function calibratePBKDF2Iterations(targetMs: number): number {
  const testPassword = 'benchmark';
  const testSalt = randomBytes(PBKDF2_SALT_LENGTH);

  function measure(iterations: number): number {
    const start = process.hrtime.bigint();
    pbkdf2Sync(testPassword, testSalt, iterations, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6;
  }

  const base = 10_000;
  const t1 = measure(base);
  const estimate = Math.floor(base * (targetMs / t1));

  const t2 = measure(estimate);

  return Math.floor(estimate * (targetMs / t2));
}

export function deriveKeyFromPassword(password: string, iterations: number, salt: Buffer): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    iterations,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  )
}

// AES-256-GCM with a PBKDF2-derived key. Layout written to storage:
//   iv(12) | salt(32) | iterations(u32 BE) | ciphertext | tag(16)
// Returns a hex-encoded blob ready for SQL persistence.
export function encryptMnemonic(mnemonic: string, password: string, iterations: number): string {
  const salt = randomBytes(32)
  const passwordKey = deriveKeyFromPassword(password, iterations, salt)

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', passwordKey, iv)
  const ciphertext = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const iterBuf = Buffer.alloc(4)
  iterBuf.writeUInt32BE(iterations)

  return Buffer.concat([iv, salt, iterBuf, ciphertext, tag]).toString('hex')
}

// Reverse of encryptMnemonic. Throws if the password is wrong (GCM auth
// tag mismatch) or the blob is shorter than the fixed header — callers
// translate to user-facing errors.
export function decryptMnemonic(encryptedHex: string, password: string): string {
  const data = Buffer.from(encryptedHex, 'hex')

  const iv = data.slice(0, 12)
  const salt = data.slice(12, 44)
  const iterations = data.readUInt32BE(44)
  const tag = data.slice(data.length - 16)
  const ciphertext = data.slice(48, data.length - 16)

  const passwordKey = deriveKeyFromPassword(password, iterations, salt)

  const decipher = createDecipheriv('aes-256-gcm', passwordKey, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

export function getKnex (path?: string): Knex {
  return knex({
    client: 'sqlite3',
    connection: {
      filename: path ?? ':memory:'
    },
    useNullAsDefault: true
  })
}

export async function migrateKnex (knex: Knex): Promise<void> {
  await knex.migrate.latest({ migrationSource: inlineMigrationSource })
}

export function ensureHomeFolder (): void {
  if (!fs.existsSync(path.join(os.homedir(), HomeFolderName))) {
    fs.mkdirSync(path.join(os.homedir(), HomeFolderName))
  }
}

export const fetchIdentitiesBySeed = async (seed: Uint8Array, sdk: DashPlatformSDK, network: Network): Promise<IdentityWASM[]> => {
  const walletHDKey = sdk.keyPair.seedToHdKey(seed, network)

  const identities = []

  let identity = null
  let identityIndex = 0

  do {
    const hdKey = sdk.keyPair.deriveIdentityPrivateKey(walletHDKey, identityIndex, 0, network)
    const privateKey = hdKey.privateKey

    if (privateKey == null) {
      throw new Error('Could not derive private key from wallet hd key')
    }

    const pkh = PrivateKeyWASM.fromBytes(privateKey, network).getPublicKeyHash()

    let uniqueIdentity

    try {
      uniqueIdentity = await sdk.identities.getIdentityByPublicKeyHash(pkh)
    } catch { /* empty */ }

    let nonUniqueIdentity

    try {
      nonUniqueIdentity = await sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh)
    } catch { /* empty */ }

    [identity] = [uniqueIdentity, nonUniqueIdentity].filter(e => e != null)

    if (identity != null) {
      identities.push(identity)
    }

    identityIndex = identityIndex + 1
  } while (identity != null)

  return identities
}

export const processProviderTransactions = (txs: TransactionWalletProviderJSON[], walletId: string, addresses: Address[]): Transaction[] => {
  const addressesBase58Check = addresses.map(({address}) => address)

  return  txs.map(tx => {
    const walletVins = tx.vin.filter(input =>
      addressesBase58Check.includes(input.addr)
    );

    const walletVouts = tx.vout
      .filter(output => {
        if (output.scriptPubKey.addresses != null) {
          return output.scriptPubKey.addresses.some(address =>
            addressesBase58Check.includes(address)
          );
        }
        return false;
      })
      .map(vout => {
        const addresses = vout.scriptPubKey.addresses ?? [];

        const address = addresses.find(addr =>
          addressesBase58Check.includes(addr)
        );

        return {
          value: vout.value,
          addresses,
          address: address ?? null,
        };
      });

    const inAmount = walletVins.reduce((acc, curr) => acc + BigInt(curr.valueSat), BigInt(0))
    const outAmount = walletVouts.reduce((acc, curr) => acc + BigInt(Math.round(Number(curr.value) * 100_000_000)), BigInt(0))

    // outgoing = -1, incoming = 1
    const direction = inAmount > outAmount ? -1 : 1
    // reverse direction because in outgoing txs direction == -1
    const transferAmount = (inAmount - outAmount) * BigInt(direction * -1)

    let address: string

    if (direction===-1) {
      address = walletVins[0].addr
    } else {
      const [voutWithAddress] = walletVouts.filter(({address}) => address!=null)
      // TODO: There can't be undefined in production (????)
      address = voutWithAddress.address ?? ''
    }

    let status: keyof typeof TransactionStatus = 'Pending'

    if (tx.txlock == true) {
      status = 'Locked'
    }

    const txVout = tx.vout.map(vout => {
      const addresses = vout.scriptPubKey.addresses ?? [];

      const [address] = addresses;

      return {
        value: vout.value,
        n: vout.n,
        spentTxId: vout.spentTxId,
        spentIndex: vout.spentIndex,
        spentHeight: vout.spentHeight,
        address: address ?? '',
      };
    })

    const txVin = tx.vin.map(vin => ({
      value: (vin.value ?? 0).toString(),
      n: vin.n,
      addr: vin.addr ?? '',
      prevTxId: vin.txid,
      prevVout: vin.vout,
      sequence: vin.sequence,
    }))

    // TODO: Implement usd amount
    return {
      address,
      direction,
      inAmount,
      outAmount,
      transferAmount,
      walletId,
      status,
      size: tx.size,
      usdAmount: '0.0',
      blockHeight: tx.blockheight,
      // time in seconds
      date: new Date(tx.time * 1000),
      confirmations: tx.confirmations,
      txid: tx.txid,
      vin: txVin,
      vout: txVout
    }
  })
}
