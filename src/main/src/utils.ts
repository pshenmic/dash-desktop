import fs from 'fs'
import os from 'os'
import path from 'path'
import {HomeFolderName, PBKDF2_DIGEST, PBKDF2_KEY_LENGTH, PBKDF2_SALT_LENGTH} from './constants'
import knex, {Knex} from 'knex'
import {TransactionWalletProviderJSON} from "./providers/types";
import {Address} from "./types/Address";
import {TransactionStatus} from "./enums/TransactionStatus";
import {Transaction} from "./types/Transaction";
import {IdentityWASM, PrivateKeyWASM} from "pshenmic-dpp";
import {DashPlatformSDK} from "dash-platform-sdk";
import {Network} from "./types";
import {pbkdf2Sync, randomBytes} from "node:crypto";

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

export function getKnex (path?: string): Knex {
  return knex({
    client: 'sqlite3',
    connection: {
      filename: path ?? ':memory:'
    },
    useNullAsDefault: true
  })
}

export async function migrateKnex (knex, migrationsPath): Promise<void> {
  await knex.migrate.latest({
    directory: migrationsPath.toString()
  })
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
        address: address ?? null,
      };
    })

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
      vin: tx.vin,
      vout: txVout
    }
  })
}
