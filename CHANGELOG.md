# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-07-22

### Added

- Board on-chain funds into Ark, either everything at once or a chosen amount.
- Board funding transactions are badged "On-chain: Board" in the movements list.

### Changed

- Updated `@secondts/barkd` to 0.4.0 and bumped the Docker images to bark 0.4.0.
- Kraken is ordered first in the Bitcoin price source list.

### Fixed

- On-chain movement details dialog is titled "Transaction details" instead of "On-chain receive", which was wrong for sends and boards.
- VTXO status badge guards against unknown vtxo state types.
- Invalid price data is rejected before it reaches fiat amount entry.
- Branta verification links and logos are restricted to https URLs.

## [0.3.1] - 2026-07-01

### Added

- Opt-in login gate.

### Fixed

- Invalidate VTXO queries on payment receive and send.

## [0.3.0] - 2026-06-29

### Added

- VTXO page.
- Emergency exit for selected VTXOs.
- Input amount field switches between bitcoin unit and fiat.
- Copy a movement's raw JSON and export barkd logs.
- Optimistic pending row for offboard transactions in the movements table.
- Embedded build support.

### Changed

- Updated `@secondts/barkd` to 0.3.0 and bumped the Docker images to bark 0.3.0.
- Refresh and exit-fee payment types are distinguished, dropping auto-labels.
- Ark→on-chain sends are labelled "On-chain" instead of "Ark".
- Locales are bundled into the build instead of fetched over HTTP at runtime.
- Movement and on-chain detail dialogs aligned with the VTXO design.
- Noble crypto provider injected for Branta over HTTP.
- Split exit CPFP change from the pending on-chain balance.
- Theme-legible favicon on a circular tile.

### Fixed

- Balance chart no longer spikes on offboards; improved y-axis formatting.
- Whitespace is stripped from pasted payment input before decoding.
- Selected destination pill is highlighted for uppercase BIP-321 URIs.
- Starting exits are counted in emergency-exit progress.
- Send modal no longer shifts layout on input or amount entry.
- Error toast shown on send failures.
- Larger, clearer status badge and network icons.

## [0.2.6] - 2026-06-15

### Added

- Dark mode.

## [0.2.5] - 2026-06-12

### Fixed

- Generate UUIDs in insecure contexts.

## [0.2.4] - 2026-06-12

### Changed

- Updated `@secondts/barkd` to 0.2.5 and bumped the Docker images to bark 0.2.5.

### Fixed

- After an update replaces the hashed assets, the app reloads once to fetch the fresh `index.html` instead of failing on stale chunks, and stale-chunk 404s are no longer cached.

## [0.2.3] - 2026-06-12

### Changed

- Updated `@secondts/barkd` to 0.2.4.

## [0.2.2] - 2026-06-11

### Added

- Scan QR is hidden in insecure contexts where the camera is unavailable (e.g. plain HTTP), instead of showing a broken scanner.

### Changed

- Start9 app packaging refreshed: icon, manifest, build, and entrypoint updates.
- Added a GitLab release pipeline and a Podman build script.

### Fixed

- Clipboard copy and read fall back gracefully in insecure HTTP contexts where the Clipboard API is unavailable.
- Auto-create wallet handles a "wallet already exists" conflict on startup instead of failing.
- Select dropdown: mobile font size aligned with the input, and the popover width matches its trigger.
- Copy-address button focus ring fixed.

## [0.2.1] - 2026-06-09

### Changed

- App title changed from "Bark web" to "Bark Wallet".
- Wallet data path is now configurable per deployment via the `walletDataPath` runtime config (defaults to `/data/.bark/`), instead of being hardcoded in the settings page.

### Fixed

- Send: destination pills are kept on blur after pasting a payment URI.

## [0.2.0] - 2026-06-09

### Added

- Payment-type tabs and a filter dropdown in the movements history table.
- Refresh controls, including auto-refresh on receive.
- "On-chain: Exit" payment-type chip and label for CPFP exit movements.
- Incoming on-chain payments now animate in as they arrive in the receive flow.
- Balance-history chart auto-grows its window from 1d to 90d, replacing the timeframe selector.

### Changed

- Updated `@secondts/barkd` to 0.2.3 and bumped the Docker images to bark 0.2.3.
- Increased the invoice debounce to 500 ms.
- Default bitcoin price source is now Kraken.
- QR codes use an SVG bark logo instead of a PNG.
- Auto exit/refresh labels are promoted to real editable labels.
- Dashboard design tweaks.
- Sidebar aligned with the shadcn layout.
- Send modal scanner button labeled "Scan QR" instead of "Back".
- Renamed `i18n` strings.

### Fixed

- Exit-tree confirmation now shows real progress instead of staying at 0%.
- On-chain CPFP fees are attributed to the exit movement, and the emergency-exit estimate bills the per-level CPFP fee.
- Exited BTC can be auto-claimed from any page, not just Settings.
- Balance total no longer flickers during an active exit.
- Movements list shows a skeleton until all histories load to avoid staggered paint, plus a full-card skeleton.
- Send: payment rail is detected on blur so an autofilled on-chain address isn't treated as Lightning; scanned bech32 destinations are lowercased to canonical case; no "Not enough funds" flash after an on-chain send.
- Receive: reduced QR density so BIP321 codes scan reliably; fixed infinite re-render when reopening the modal after an invoice; fixed the invoice string for the Lightning tab.
- i18n: repaired unreachable dotted keys and normalized key casing.
- Dialog uses a real border instead of a ring to avoid a Safari double-border artifact.
- Various spacing and margin fixes.

## [0.1.8] - 2026-06-05

### Added

- App-wide error boundary that catches render errors and shows a fallback screen with the error message and a "Reload app" button.

### Changed

- Updated the favicon.

### Fixed

- Send labels are now applied to the movements history immediately, without a reload.

## [0.1.7] - 2026-06-04

### Added

- On-chain CPFP transactions that pay an exit fee are auto-labeled "Exit fee" in the movements list when no custom label is set.
- "Hide exit fee transactions" toggle in the movements options menu, which hides on-chain CPFP exit-fee transactions (on by default).
- Nix flake and Podman support for building and running the app.

### Changed

- Updated `@secondts/barkd` to 0.2.2.
- Wallet mnemonic is now fetched through the barkd client instead of the web API.

## [0.1.6] - 2026-06-02

### Changed

- Umbrel app listing tagline, description, and category refreshed, and now mentions Branta destination verification.

### Fixed

- Movements list orders on-chain transactions by first-seen time.
- Balance-history chart counts pending on-chain funds, so the balance no longer dips while transactions are unconfirmed.

## [0.1.5] - 2026-05-29

### Added

- Movement metadata (labels and tags) is now persisted in the bark database via new endpoints.
- On-chain fees are shown in the movement detail dialog.

### Changed

- Updated `@secondts/barkd` to 0.2.1.
- Bumped `bip-321` to `0.0.11` for an encoding fix.

### Fixed

- Send modal now renders a skeleton while Branta verification is in flight, instead of an empty area.
- Settings shows the correct `/data/.bark` backup path.
- `barkd` data directory is created at container startup, so first-run no longer fails when the volume is empty.

### Security

- API CORS is restricted to the configured web origin and dev ports bind to `localhost` only, preventing other hosts on the network from reaching the local dev API.

## [0.1.4] - 2026-05-26

### Added

- Wallet backup replaces the zip download with a masked seed reveal flow and a warning.
- Pre-React boot loader with config retry and API readiness wait, so the app no longer flashes on a cold start.
- Balance breakdown items animate in and out as balances change.

### Changed

- Movements table column renamed from "Source" to "Payment type".
- Branta destination verification is shown inline on the send modal.
- Dashboard chart is lazy-loaded and `motion` imports are tree-shaken for a smaller initial bundle.
- Bumped `bitcoin-decoder` to 0.6.1 for a BIP-321 metadata fix.

### Fixed

- Balance-history chart uses a step interpolation and a full-window domain so flat periods no longer collapse.
- Round-and-price card divider is symmetric again.
- Receive modal layout no longer shifts when the QR code or route badge updates.
- Metadata annotations and bindings are scoped by wallet fingerprint, preventing cross-wallet leakage.
- Wallet fingerprint is persisted when a pre-existing wallet is detected on startup.
- `DecodedData` is narrowed by `kind` to match the updated `bitcoin-decoder` type surface.

## [0.1.3] - 2026-05-20

### Added

- Community forum and community chat links in settings.
- Combined next-round and bitcoin price card with a circular countdown ring.
- Auto-claim of emergency exit outputs once an on-chain destination address is set.
- Branta destination verification now also runs when the destination input loses focus.

### Changed

- Dashboard cards reorganized into a two-column layout; balance breakdown lays out horizontally on wider screens.
- Balance chart uses a numeric time scale with evenly spaced day ticks for more consistent axis labels.
- Emergency exit description in settings clarifies that on-chain bitcoin is needed to cover fees.
- Round countdown now exposes a progress value driven by the server's `roundInterval`.
- Movements from the `offboard` subsystem are classified as Ark transactions.
- Updated `@branta-ops/branta` and `@secondts/barkd`.

### Fixed

- Emergency exit progress card no longer shows a stale "done" state after completion.
- Claim address prompt opens automatically when outputs become ripe without a destination set, and is cleared when a new exit is started after a previous one finished.
- Branta verification result is cleared when the send destination is edited, avoiding stale matches.

## [0.1.2] - 2026-05-18

### Added

- Kraken as a Bitcoin price provider option in settings.
- Pagination on the movements table.
- Package for Umbrel.
- Package for Start9.
- Report issues field in settings.
- Send modal can spend the on-chain pending balance.
- Auto-labelling for exit transactions in the movements list.

### Changed

- How the balance breakdown is displayed.
- Movements list now shows one row per on-chain transaction, with addresses decoded from the raw transaction.
- Render performance improvements across the app.

### Fixed

- Movements list now refreshes on `movement-created` and `movement-updated` notifications.
- Emergency exit dialog no longer uses a monospaced font for fee and balance values.
- Mobile responsiveness.
- Detail dialog now places label and tags below the created date.
- Metadata bindings persist and re-match against movements on poll.
- Modal scroll fade now aligns with the inner content edge.

## [0.1.1] - 2026-05-13

### Added

- Source selector when sending to an on-chain address — choose between Ark balance or on-chain wallet, with available funds shown next to each option.
- Fiat value displayed next to the amount input on the send and receive modals.

### Changed

- Destination badges redesigned for clearer route identification.
- Estimated fee presentation refined on the send modal.
- Sent transaction amounts now use foreground color instead of red.
- Movements list, receive flow, and destination selection refined.
- Amounts displayed with thousands separators.
- Next-round countdown shows seconds when under one minute.
- Loading spinner now includes contextual helper text.
- Wallet avatar generated from fingerprint instead of name for stability across renames.
- Mono font switched to Source Code Pro.
- Help texts updated across the app.
- Bitcoin unit label changed from "Satoshi" to "Sats".
- Receive modal description removed.
- Danger zone field spacing increased.
- QR-code logo no longer has rounded corners.

### Fixed

- Lightning state now resets when the receive modal reopens.
- Block height display corrected.
- Balance totals routed through `getBalanceTotals` to avoid drift between callers.
- UI flickers on modal transitions.
- Multi-row display for long content.

[0.2.6]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.6
[0.2.5]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.5
[0.2.4]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.4
[0.2.3]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.3
[0.2.2]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.2
[0.2.1]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.1
[0.2.0]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.2.0
[0.1.8]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.8
[0.1.7]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.7
[0.1.6]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.6
[0.1.5]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.5
[0.1.4]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.4
[0.1.3]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.3
[0.1.2]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.2
[0.1.1]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.1
