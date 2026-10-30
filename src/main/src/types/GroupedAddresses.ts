import {Address} from "./Address";

export interface GroupedAddresses {
  receiving: Address[],
  change: Address[],
  // Our DashPay receiving chains, outside both BIP-44 chains.
  dashPay?: Address[],
}
