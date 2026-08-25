# Bark on StartOS

Bark is a self-custodial Bitcoin wallet built on the Ark protocol. Payments
settle off-chain through Ark rounds, so they are fast and low-fee while you
keep unilateral exit to the base chain.

## First-time setup

1. Click **Launch** to open the Web UI.
2. Set a password when the UI asks for one. This password guards the web
   interface itself; it is stored on your server, not derived from your seed.
   Do this before sharing the interface's address with anyone — the setup screen
   is open until a password exists, so the first visitor is the one who sets it.
3. Choose **Create wallet** to generate a fresh mnemonic, or **Restore** to
   import an existing twelve-word seed.
4. Write down the recovery phrase. The seed is the only way to recover funds
   if your StartOS server is lost.
5. Fund the wallet by receiving an on-chain deposit or an Ark payment.

## Defaults

The package ships pre-configured for Bitcoin mainnet:

- **Ark server**: `https://ark.second.tech`
- **Chain source**: `https://mempool.second.tech/api`
- **Network**: `mainnet`

These values are baked into the image. To change them, fork the wrapper repo
and override the environment variables in `start9-app/s6/api/run`.

## Data on disk

Everything lives under the `main` volume at `/data/.bark`:

- `db.sqlite` — wallet database
- `mnemonic` — encrypted seed
- `auth_token` — barkd bearer token (never reaches your browser)
- `ui_password` — the web interface password you set on first launch

Backups capture this directory wholesale via StartOS' duplicity-based backup
mechanism. Bark is stopped before backup so the SQLite database is consistent.

## Restoring after data loss

If you restore from a StartOS backup, your wallet returns exactly as it was.
If you only have the twelve-word seed, install Bark, choose **Restore**, and
re-enter the words; balances rebuild from the Ark server.

## Notes

- The web interface is reachable over Tor and over LAN (HTTPS).
- The bearer token never leaves the container — the bundled API proxy injects
  it on every request the browser makes.
- WebSocket notifications use a short-lived ticket, not the bearer token.
