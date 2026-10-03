# Privacy Policy — Dash Desktop

_Effective date: September 13, 2026_

Dash Desktop ("the app") is an open-source, non-custodial wallet for the Dash
network, developed by pshenmic ("we", "us"). This policy explains what
information the app handles and where it goes.

**In short:** we do not collect, sell or share your personal information. The
app has no user accounts, no analytics, no advertising and no crash reporting.
Your wallet stays on your computer. To show balances and send transactions,
the app has to talk to the Dash network and a few services, described below.

## 1. Information stored on your device

The app stores the following **locally only**, in its data folder in your
user profile:

- **Wallet data:** your recovery phrase (mnemonic), **encrypted with your
  password**; public keys, addresses, identities, transaction history, balances
  and shielded notes.
- **Preferences:** network, connection mode, theme, display currency and
  similar settings.
- **Logs:** diagnostic log files, kept for up to 14 days. The app redacts
  recovery phrases, passwords, private and extended keys, and addresses
  before writing them.

We never receive this data. We cannot see, recover or reset your
password or recovery phrase. If you lose both, nobody can restore access to
your funds. Uninstalling the app does not necessarily delete this folder, so
delete it yourself if you want the data gone.

## 2. Information sent over the network

The app has to contact external servers to work. Any server it connects to
can see your **IP address** and the requests it receives.

| Service | When | What it receives |
|---|---|---|
| **Dashscan API** (`dashscan.pshenmic.dev`, operated by us) | "RPC" connection mode (the default) | Your wallet's **extended public key (xpub)** and addresses, so the server can return transactions, balances and unspent outputs. The server can link these addresses together as one wallet. |
| **Dash network peers** (independent nodes) | Always, for broadcasting and InstantSend/ChainLock updates; also block sync in "P2P" mode | Transactions you broadcast. In P2P mode the app downloads block headers and compact filters and matches them **on your device**, so peers do not receive your address list. |
| **Dash Platform nodes (DAPI)** (independent masternodes) | When you use Platform features (identities, credits, platform or shielded addresses) | The identity IDs, platform addresses and state transitions the app queries or submits. Shielded notes are decrypted on your device. |
| **CoinGecko** (`api.coingecko.com`) and **CryptoCompare** (`min-api.cryptocompare.com`) | To show fiat values | A request for the DASH price. No wallet information is sent. |

Transactions on the Dash blockchain and Dash Platform are **public and
permanent** by design. Anyone can see them, and we cannot change or delete
them.

To limit what the Dashscan API sees, switch to **P2P** connection mode in
Settings.

**Third-party services** (independent Dash nodes, CoinGecko, CryptoCompare)
follow their own privacy policies. We do not control them.

## 3. How we handle data on our Dashscan server

Our Dashscan server uses the addresses and extended public keys in API
requests only to answer those requests. We do not use them for advertising,
sell them or share them with third parties. Like any web server, it may keep
standard access logs (such as IP address, time and requested URL) for
operation and security.

## 4. External links

Links such as block explorer pages open in your web browser. The websites they
lead to have their own privacy practices.

## 5. Microsoft Store

If you install the app from the Microsoft Store, Microsoft may collect
information about your purchase, installation and usage under the
[Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement).
We do not receive personal information from Microsoft beyond the aggregated
reports Microsoft gives publishers.

## 6. Children

The app is not directed at children under 13 (or the minimum age in your
country), and we do not knowingly collect information from children.

## 7. Your rights

We hold no account or profile data about you, so we have nothing to access,
correct or delete on your behalf. To delete your data, remove the app and its
local data folder. You can also ask about request logs on our Dashscan server
using the contact below.

## 8. Changes to this policy

When this policy changes, we will publish the new version at this address and
update the effective date.

## 9. Contact

For questions about this policy, open an issue at
<https://github.com/pshenmic/dash-desktop/issues>.
