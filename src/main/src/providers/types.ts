export interface AliasPlatformProviderJSON {
  "alias": string,
  "status": string,
  "contested": boolean,
  "timestamp": string,
  "txHash": string
}

export interface IdentityPlatformProviderJSON {
  identifier: string,
  revision: string,
  balance: string,
  timestamp: string,
  aliases: AliasPlatformProviderJSON[],
}