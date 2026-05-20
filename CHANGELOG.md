# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.3]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.3
[0.1.2]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.2
[0.1.1]: https://gitlab.com/ark-bitcoin/labs/bark-web/-/tags/v0.1.1
