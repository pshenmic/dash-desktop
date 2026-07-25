# Dash Desktop Wallet

A cross-platform desktop wallet for the Dash network, supporting both **Dash Core** (Layer 1) and **Dash Platform / Evolution** (Layer 2). Built with Electron, React, and TypeScript.

> **Current status:** read-only — balance, transaction history, addresses, and identities are fully visible. Sending and withdrawing will be available in the next release.

---

## Features

### Wallet management
- Create a new wallet from a freshly generated BIP39 12-word seed phrase
- Import an existing wallet by entering your seed phrase
- Manage multiple wallets simultaneously and switch between them at any time
- Password-protected wallets — the mnemonic is encrypted at rest with **AES-256-GCM** and a **PBKDF2-SHA-512** key derivation function
- Delete wallets you no longer need

### Dash Core (L1)
- **BIP44 HD key derivation** — `m/44'/5'/0'` (mainnet) / `m/44'/1'/0'` (testnet)
- 20-address lookahead for both receiving and change chains
- View L1 balance in DASH alongside a fiat equivalent (USD, BTC, RUB)
- Full transaction history per wallet with incoming/outgoing direction detection
- Receive page with QR code and one-click copy
- Address book — browse all derived addresses, label any address, see per-address balance

### Dash Platform (L2 / Evolution)
- Automatic discovery of Dash Platform **identities** linked to your HD key (`m/9'/5'/0'`, 10-identity lookahead)
- Shows **DPNS aliases** (e.g. `alice.dash`) resolved via the Platform SDK
- Displays identity **credit balance**

### Network & connectivity
- Supports **mainnet** and **testnet**
- Connect via the centralized **Insight API** (`insight.dash.org` / `insight.testnet.networks.dash.org`) — default and fully functional
- **P2P direct mode** (work in progress) — header sync → compact filter header sync → compact filter scan (BIP157-style), with LevelDB persisting chain state across restarts

### Preferences
- Fiat currency: USD, BTC, RUB
- Connection type: Insight API or P2P
- Light / dark theme following the system setting

---

## Platforms

| Platform | Format | Architectures |
|----------|--------|---------------|
| macOS | DMG | arm64, x64 |
| Windows | NSIS installer | x64 |
| Linux | AppImage, `.deb` | x64 |

---

## Getting started

### Prerequisites

- **Node.js** 20+ and **Yarn**

### Install dependencies

```bash
yarn
```

### Run in development

```bash
yarn dev
```

### Build and preview

```bash
yarn build   # type-check + compile
yarn start   # preview the compiled app
```

### Build distributables

```bash
yarn build:mac    # produces .dmg for arm64 and x64
yarn build:win    # produces NSIS .exe installer for x64
yarn build:linux  # produces .AppImage and .deb for x64
```

Output is placed in the `dist/` directory.

---

## Data storage

All data is stored locally under `~/.dash-desktop/`.

| File | Purpose |
|------|---------|
| `storage.db` | SQLite database — wallets, addresses, identities, transactions |
| `ChainStorage/` | LevelDB — block headers and compact filter headers (P2P mode) |
| `preferences.json` | User preferences (language, currency, connection type) |

The mnemonic phrase is **never stored in plaintext**. It is encrypted with AES-256-GCM before being written to `storage.db`, and the decryption key is derived from your password via PBKDF2-SHA-512.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 39 |
| Frontend | React 19, TypeScript 5.9, React Router 7 |
| Build | electron-vite 5, Vite 7 |
| UI | dash-ui-kit, Tailwind CSS v4 |
| Wallet logic | dash-platform-sdk, dash-core-sdk, dash-core-p2p |
| Key derivation | @scure/bip39 |
| Local database | SQLite (Knex), LevelDB (classic-level) |
| IPC | Electron contextBridge |

---

## Project structure

```
src/
├── main/           # Electron main process (Node.js backend)
│   ├── src/
│   │   ├── api/        # IPC handlers
│   │   ├── database/   # DAO classes (Knex/SQLite)
│   │   ├── services/   # Business logic
│   │   ├── providers/  # Insight API and P2P wallet providers
│   │   └── types/      # Domain types
│   ├── migrations/     # Knex SQL migrations
│   └── p2p/            # P2P sync workers (header, cfilter)
├── preload/        # contextBridge — exposes window.electronAPI to renderer
└── renderer/       # React SPA
    └── src/
        ├── pages/      # Route-level page components
        ├── components/ # UI components
        ├── hooks/      # React hooks
        └── constants/  # Navigation, labels, copy
```

---

## Roadmap

- **Next release**
  - Send DASH (L1 transfers)
  - Withdraw credits (L2 → L1)
  - Direct P2P connection (no Insight API required)

---

## Contributing

Pull requests and issues are welcome. Please open an issue first for significant changes so the direction can be discussed.

---

## License

[MIT](LICENSE) © pshenmic
