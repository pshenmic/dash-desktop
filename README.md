<div align="center">

<img src="buildResources/icon.png" alt="Dash Desktop Wallet" width="128" height="128">

# Dash Desktop Wallet

**One wallet for all of Dash — Core payments, Platform identities and shielded transactions.**

Non-custodial · Open source · macOS, Windows and Linux

[![Latest release](https://img.shields.io/github/v/release/pshenmic/dash-desktop?label=release&color=008de4)](https://github.com/pshenmic/dash-desktop/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/pshenmic/dash-desktop/total?color=008de4)](https://github.com/pshenmic/dash-desktop/releases)
[![License: MIT](https://img.shields.io/github/license/pshenmic/dash-desktop?color=008de4)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-008de4)](#download)

[**Download**](#download) · [Features](#features) · [Security](#security--privacy) · [Build from source](#build-from-source)

<br>

<img src=".github/assets/screenshot.png" alt="Dash Desktop Wallet dashboard" width="860">

</div>

---

## Why Dash Desktop

Dash has two layers: **Dash Core** for fast, final payments and **Dash Platform** for identities, usernames and credits. Until now, using both meant juggling separate tools. Dash Desktop puts them in one app, built on a single recovery phrase, with your keys never leaving your computer.

- **Both layers, one seed.** Send DASH, register an identity, top it up and withdraw back to L1 without switching apps.
- **Private by choice.** Move credits into the shielded pool and transact between shielded addresses.
- **Your node, if you want it.** Start instantly through Dashscan, or switch to a built-in SPV client that syncs straight from the Dash peer-to-peer network.

## Features

<table>
<tr>
<td width="50%" valign="top">

### 💸 Dash Core (L1)
- Send DASH with fee preview and **coin control**
- **InstantSend** and **ChainLock** status on every transaction
- Full history with incoming / outgoing detection
- Receive with QR code; label any address
- Contacts for the people you pay often

</td>
<td width="50%" valign="top">

### 🪪 Dash Platform (L2)
- Register **identities**, funded from L1 or Platform addresses
- Top up, transfer and **withdraw credits** back to L1
- **DPNS usernames** (e.g. `alice.dash`) resolved automatically
- **Platform addresses** for direct credit transfers

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🛡️ Shielded transactions
- **Shield** credits into the Orchard pool
- Send **privately** between shielded addresses
- **Unshield** or withdraw back out when you need to

</td>
<td width="50%" valign="top">

### 🔌 Network
- **Mainnet** and **testnet**
- **Dashscan** mode — instant start, no sync
- **P2P mode** — SPV sync with BIP157/158 compact filters
- Manage peers, DNS seeds and fee multipliers

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### 👛 Wallets
Create or import BIP39 wallets · keep several and switch at any time · export your recovery phrase · change a wallet's password · see balances in USD, EUR, BTC or RUB

</td>
</tr>
</table>

## Download

| Platform | Package | |
|---|---|---|
| **macOS** | Universal `.dmg` (Apple silicon + Intel), signed and notarized | [Download](https://github.com/pshenmic/dash-desktop/releases/latest) |
| **Windows** | `.exe` installer, x64 | [Download](https://github.com/pshenmic/dash-desktop/releases/latest) |
| **Linux** | APT repository, Snap, `.deb`, AppImage — x64 | [See below](#linux) |

> [!NOTE]
> The Windows installer is not code-signed yet, so SmartScreen may warn on first launch. Choose **More info → Run anyway**.

### Linux

**Debian / Ubuntu — APT repository (recommended).** Signed, and updates with the rest of your system:

```sh
curl -fsSL https://pshenmic.github.io/dash-desktop/key.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/dash-desktop.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/dash-desktop.gpg] https://pshenmic.github.io/dash-desktop stable main" \
  | sudo tee /etc/apt/sources.list.d/dash-desktop.list

sudo apt update && sudo apt install dash-desktop
```

<details>
<summary>Remove the repository</summary>

```sh
sudo apt remove dash-desktop
sudo rm /etc/apt/sources.list.d/dash-desktop.list /usr/share/keyrings/dash-desktop.gpg
```

</details>

**Snap**

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/dash-desktop-wallet)

```sh
sudo snap install dash-desktop-wallet
```

**AppImage / `.deb`** — download from [Releases](https://github.com/pshenmic/dash-desktop/releases/latest).

Pre-releases are published on [GitHub Releases](https://github.com/pshenmic/dash-desktop/releases) only.

## Security & privacy

- **Non-custodial.** Keys are derived on your machine; nobody else can move your funds.
- **Encrypted at rest.** Your recovery phrase is encrypted with **AES-256-GCM**, using a key derived from your password with **PBKDF2-SHA-512**. It is never written in plaintext.
- **No tracking.** No accounts, analytics, ads or crash reporting.
- **Verified sync.** In P2P mode, headers are checked against the difficulty rules and blocks against their merkle roots before anything is trusted.

Read the full [Privacy Policy](PRIVACY.md) for exactly which services the app talks to and why.

> [!IMPORTANT]
> Write down your recovery phrase and keep it offline. It is the only way to restore your wallet — nobody, including the developers, can recover it for you.

### Where your data lives

Everything is stored locally in `~/.dash-desktop/`:

| Path | Contents |
|---|---|
| `storage.db` | Wallets, addresses, identities and transactions (SQLite) |
| `ChainStorage/` | Block headers and compact filters for P2P mode |
| `preferences.json` | Settings |
| `logs/` | Application logs |

## Build from source

Requires **Node.js 22.12+** and **Yarn 1**.

```sh
git clone https://github.com/pshenmic/dash-desktop.git
cd dash-desktop
yarn

yarn build:mac     # universal .dmg
yarn build:win     # NSIS .exe, x64
yarn build:linux   # AppImage + .deb, x64
```

The installer is written to `dist/`. To compile and run the app without packaging it, use `yarn build && yarn start`.

<details>
<summary>Development</summary>

```sh
yarn dev
```

Starts the app with hot reload. A development run keeps its data in `~/.dash-desktop/dev/`, so it never touches an installed wallet.

Before opening a pull request, run:

```sh
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json
npx tsc --noEmit -p tests/tsconfig.json
npx vitest run
npx electron-vite build
```

</details>

**Built with** Electron, React 19, TypeScript, [dash-platform-sdk](https://www.npmjs.com/package/dash-platform-sdk) and [dash-core-sdk](https://www.npmjs.com/package/dash-core-sdk). Architecture notes for contributors are in [`docs/`](docs/).

## Contributing

Bug reports and pull requests are welcome. For larger changes, please [open an issue](https://github.com/pshenmic/dash-desktop/issues) first so we can agree on the direction.

## License

[MIT](LICENSE) © pshenmic
