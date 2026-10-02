# bark-web UX review: coins that look lost

Oct 2, 2026. Goal: find what makes a user think coins are lost, or not understand what the wallet is doing, so support tickets go down. This client will be the test client for Bull's expired-coin design (`~/bark-integration-2026-10-01/ark-expired-coin-handling.md`, plan `10-bark-web-client-plan.md`).

**Basis**
- bark-web `5e9c8d2` (this repo, `main`), barkd backend, `@secondts/barkd` 0.7.2 client, `@secondts/bark` 0.24.0 (WASM).
- barkd from `secondark/bark@sha256:eb056e4c…`. It reports `0.7.1` but is master `6768e0fb4`, the same build as the `abandon-regtest` stack.
- bark source refs are to `6768e0fb4` (`~/.cargo/git/checkouts/bark-*/6768e0f`).

**Method**
- I ran my own barkd on `abandon-regtest_default` with a fresh volume and 0.5 BTC from `faucet`, and bark-web (`vite --mode byob`) from a copy.
- I drove it with Playwright and curl.
- I made three boards (998,900 / 399,500 / 29,670 sat) and one refresh. I stopped barkd until both coins expired, then restarted it.
- No sidecar was running during the session, so the "paid out" state was not reproduced live.

**Tags**
- **VERIFIED**: reproduced by running it. The bug says how: live, unit run or simulated error.
- **CODE-READ**: from source only.

Screenshots are in `docs/ux-review-shots/`.

## Summary

1. **An expired coin vanishes from the balance (VERIFIED).** barkd master moves expired coins from `spendable_sat` to `needs_refresh_sat`. The 0.7.2 client has no such field, so bark-web drops them. 1,024,424 sat disappeared from the total, and the "Off-chain" line disappeared with it.
2. **Emergency exit is always blocked against this barkd (VERIFIED).** barkd master returns no `fundable` field. bark-web reads `undefined` as "not fundable" and shows "You don't have enough on-chain bitcoin" with 48.5M sat on-chain.
3. **Refresh failures are invisible (CODE-READ).** A coin the server refuses (paid out, banned) fails bark-web's whole auto-refresh batch. The retry runs every 60 s or more for as long as the tab is open, with no error shown. Refresh history entries are hidden by default.
4. **A paid-out coin stays in the VTXO list forever (CODE-READ, O13).** It shows as `Spendable` + `Expired`, is left out of the total, and has no history entry. Without variant B the user sees money "go missing" with no explanation.
5. **A board was falsely failed by barkd (VERIFIED, upstream bark bug).** Its funding tx was confirmed, but the coin was marked spent. History shows "Ark · Failed · 0 sats" next to "On-chain: Board · Successful · −400,155 sats".

## 1. Coin states: what the UI shows

Refs are to `src/` unless they start with `bark/`.

| # | State | What barkd says | What bark-web shows | Problem | Fix |
|---|---|---|---|---|---|
| 1 | Spendable | `state: spendable`, counted in `spendable_sat` | Badge "Spendable" (green), expiry "in ~2 days", "Off-chain" line | None | None |
| 2 | Expiring soon (inside the threshold) | spendable | Same as 1. bark-web auto-refresh only runs while a dashboard tab is open (`layouts/dashboard.tsx:54`). The threshold option is "16 hours before expiry · free" on regtest. | No warning, and "Refresh" is never explained | Tooltip on the expiry column (wording in §6) |
| 3 | **Expired, inside G** (needs_refresh) | spendable, counted in **`needs_refresh_sat`** (`bark/src/balance.rs:160-170`) | Badge **"Spendable"** (green) and expiry **"Expired"** (`components/vtxos/vtxos-columns.tsx:76-103`). The amount is **left out of the total and the breakdown** (`lib/backend/barkd/map.ts:52-61`). Send says "Insufficient bitcoin" (`hooks/send/use-send-quote.ts:73`). | The balance drops silently (VERIFIED, B1). The badge contradicts the expiry. | Map `needs_refresh_sat` and show it as a **"Renewing"** line and status (I1, I2) |
| 4 | Expired, round swept by Bull, still inside G | Same as 3 (captaind still refreshes it, O1) | Same as 3. The live refresh at tip 2557 succeeded and showed "Queued", then "Pending in round". | Same as 3 | Same as 3 |
| 5 | **Paid out by the sidecar** (server `spent`, client not told) | Locally still spendable and needs_refresh, forever (O13) | Same as 3, **forever**. Every round the daemon tries to refresh it and drops it (`bark/src/lib.rs:1856-1910`). Every bark-web auto-refresh batch that includes it fails (B6). No history entry. The payout to `tr(coin key)` is not watched. | "Where did my money go?" The coin is listed but missing from the total, and never resolves. | Variant B: adopt the server status, then show **"Paying out"** / **"Paid out"**, a history entry and a sweep (I6) |
| 6 | **Banned** (sidecar ban-wait, O19) | Same as 3 locally. The server rejects it with `input vtxo(s) not spendable: unusable inputs: [id]` (`server/src/round/mod.rs:441-452`). | Same as 3. A manual refresh toasts "Refresh started" and then fails silently (B7). | The user can't refresh it, and nothing says why. "Banned" and "spent" give the same error. | Treat it like 5 once the payout lands. Until then, "Renewing" plus the I5 banner |
| 7 | Pending round (queued / refreshing) | `rounds` pending or ongoing, then locked (`pending_in_round_sat`) | Badge "Queued" / "Refreshing" (`components/vtxos/vtxo-refresh-badge.tsx`), "Pending in round" line | A failed or canceled round just drops the badge. Rounds that are over are filtered out (`utils/refresh.ts:126-129`). Refresh movements are hidden by default (`stores/settings.ts:48`, `utils/movements-feed.ts:241-242`). | I5 |
| 8 | Pending board | locked by the `bark.board` movement, `pending_board_sat` | "Pending board" line. The VTXO badge says just **"Locked"**: there is no lock reason for `bark.board` (`utils/vtxo.ts:147-175`). | "Why is my coin locked?" | Label "Boarding: waiting for confirmations" (I9) |
| 9 | Board falsely failed (B5) | `spent`, movement `failed`, effective 0 | "Ark · Failed · 0 sats" row, plus the on-chain "Board · Successful · −400,155" row. The coin is hidden (spent coins are filtered out by default). | 399,500 sat gone. The funding tx is confirmed and the server never registered the board. | Upstream bug report. Meanwhile, explain failed boards in the detail view |
| 10 | Pending Lightning send | locked (`bark.lightning_send`), `pending_lightning_send_sat` | "Sending: Lightning" badge, "Pending Lightning send" line, pending history row | No timeout is shown. A stuck HTLC can stay pending for up to `htlc_send_expiry_delta` (258 blocks here). | "Pending: refunded automatically if not paid by ~<date>" (I10) |
| 11 | Pending Lightning receive (claimable) | `claimable_lightning_receive_sat` | Counted in the total (`utils/balance.ts:67-77`) but **has no breakdown line** (`components/dashboard/balance-card.tsx:33-84`) | The total does not add up | Add the line (I10) |
| 12 | Pending arkoor send / pending offboard | `pending_arkoor_send_sat`, `pending_offboard_sat` (master) | **Dropped** by the 0.7.2 client mapping (same place as 3) | The total dips during a send or offboard (VERIFIED by unit run, B1) | I1 |
| 13 | Exiting | exit state start / processing / awaiting-delta | "Exiting: Broadcasting / Timelocked", "Pending exit" line | "Processing" with no on-chain fee funds stays stuck with no message | I3, I4 |
| 14 | Exited, claimable | `claimable` | "Exiting: Ready to claim". Auto-claim needs a claim address that lives **only in this browser's localStorage** (`stores/wallet.ts:63-66`) and **an open dashboard tab** (`layouts/dashboard.tsx:53`). | From another browser, or after clearing site data: "No address set / Add address to claim". A claim error is silent (no `onError` in `hooks/barkd/use-auto-claim-emergency-exit.ts`). | I11 |
| 15 | Exited / claimed | `exited` | Hidden by default (the "Show exited" filter) | Fine. History shows the exit. | None |
| 16 | Locked (other) | `locked` with movement | Reason only for exit, LN send/receive, offboard and arkoor send. Otherwise just "Locked". | Same as 8 | I9 |
| 17 | Spent | `spent` | Hidden by default | Fine | None |

**States that make the balance drop silently:** 3, 4, 5, 6 and 12 (and 9 through the bark bug). **States that show a wrong balance:** 11 (the total is right but the breakdown does not add up). **Errors the user cannot act on:** 5, 6, 13 and 14, plus B2, B3 and B4.

## 2. Bugs

### B1. The balance leaves out `needs_refresh_sat`, `pending_arkoor_send_sat` and `pending_offboard_sat` (VERIFIED: live and unit run)

`toBalance` (`lib/backend/barkd/map.ts:52-61`) and `Balance` (`types/domain/balance.ts:1-11`) know only the 0.7.2 fields. The `@secondts/barkd` 0.7.2 model (`dist/models/Balance.d.ts`) has no field for the three new ones, so they are lost before bark-web sees them.

Repro (live):
1. Board, then refresh.
2. Stop barkd until the tip passes expiry.
3. Start barkd and open `/dashboard/vtxos`.

Result:
- barkd returned `{"spendable_sat":0,"needs_refresh_sat":1024424,…}`.
- bark-web showed **48,569,535 sat**, the on-chain amount only. The "Off-chain" line was gone, while the table listed two coins (1,024,424 sat) marked "Expired".
- Screenshot: `ux-review-shots/expired-balance-drop.png`.

Unit run: `BalanceFromJSON` → `toBalance` → `getBalanceTotals` on the master JSON shape gives 29,670 where barkd's total is 1,036,424.

### B2. Emergency exit is always "not fundable" against barkd master (VERIFIED: live)

- barkd `6768e0fb4` `GET /exits/fee` returns `{exit_broadcast_fee_sat, claim_fee_sat, total_fee_sat, fee_rate_sat_per_vb, txs_to_broadcast}` with **no `fundable`**.
- `toEmergencyExitFeeEstimate` copies `dto.fundable`, which is `undefined` (`lib/backend/barkd/map.ts:289-300`).
- `!feeEstimate.fundable` then disables the submit button (`components/emergency-exit-start-dialog.tsx:63-64`).

Repro:
1. Open Settings → Emergency exit all → "Use my Bark on-chain wallet".
2. The dialog shows a cost of ~2,601 sat and an on-chain balance of 48,569,535 sat, then "You don't have enough on-chain bitcoin…", and the button is disabled.

Screenshot: `ux-review-shots/exit-blocked-fundable.png`. The per-VTXO exit dialog uses the same component. In short, bark-web 0.7.2 and the barkd image we test with do not match.

### B3. A failed "Emergency exit all" leaves the button stuck on "Exit in progress" (VERIFIED: simulated barkd 500 with a Playwright route)

`handleSubmitExitAddress` sets `isEmergencyExitAllInProgress(true)` **before** the call (`pages/dashboard/settings.tsx:282-288`). The flag is persisted. The only reset is `summary.isDone` (`settings.tsx:310-314`), and `isDone` is false when there are no exits (`utils/exit-progress.ts:73`). The button stays disabled (`settings.tsx:235`), and the progress card is hidden because `total = 0` (`settings.tsx:232-233`).

After a reload the button read "Exit in progress", was disabled, and localStorage held `"isEmergencyExitAllInProgress":true`. Screenshot: `ux-review-shots/exit-all-stuck.png`. The only way out is clearing site data. `hooks/use-emergency-exit-vtxos.ts:60-66` has the same pattern.

### B4. Exit errors say "Response returned an error code" (VERIFIED: same run as B3)

`errorMessage={startExitError?.message}` (`settings.tsx:587`, `hooks/use-emergency-exit-vtxos.ts:70`) shows the generated client's generic text. barkd's body (`{"message":"simulated barkd failure"}`) is dropped. Other flows already use `backendErrorMessage`.

### B5. barkd falsely fails a board whose funding tx is confirmed (VERIFIED: live, in bark, not bark-web)

What happened: three boards were broadcast back to back. barkd logged that board 2's "funding input was spent by a confirmed conflicting tx, failing the board" and marked coin `2ca8386e…:0` spent. Yet bitcoind shows board 2's tx `caef22e6…` confirmed (35 confirmations later), and board 3 spends its change. Captaind has no row for the coin. bark-web shows "Ark · Failed · 0 sats" next to "On-chain: Board · Successful · −400,155 sats", and the balance is 399,500 sat short. Screenshot: `ux-review-shots/board-false-fail.png`.

Likely cause (hypothesis, not proven):
- `run_confirm` treats the funding tx as absent (`tx_status` NotFound). The re-broadcast then returns "missing or spent inputs", which is read as `Fatal` (`bark/src/actions/board.rs:300-302, 470`).
- It does not re-check whether the funding tx itself just confirmed. `run_broadcast` does that re-check (`board.rs:242`).
- The failure came seconds after the other session mined blocks, so a transient NotFound is plausible.

Report it to Second with the txids. The funds are in a confirmed but unregistered board output.

### B6. One server-rejected coin fails the whole bark-web auto-refresh batch, and it retries forever (CODE-READ)

- `useAutoRefresh` sends **all** expiring ids in one `POST /wallet/refresh/vtxos` (`hooks/barkd/use-auto-refresh.ts:39-56`). Expired coins are included (`utils/refresh.ts:96-122`).
- barkd registers an interactive participation. When the attempt starts, a server rejection fails the whole participation, with no exclusion step (`bark/src/round/mod.rs:550-602`).
- The retry key is the id list, throttled to 60 s (`use-auto-refresh.ts:49-55`). There is no `onError`.

So while a paid-out or banned coin sits in the wallet, bark-web's own refresh of the other coins keeps failing. The daemon's maintenance refresh does exclude rejected inputs per call (`bark/src/lib.rs:1856-1910`), so other coins still renew at the daemon's threshold (12 blocks off mainnet, 144 on mainnet: `bark/src/config.rs:268,283`). But the daemon retries the bad coin every round, forever.

On WASM, `refreshVtxosDelegated` submits once with no exclusion either.

Seen live, harmless: bark-web's participation and the daemon's maintenance raced for the same inputs. bark-web's lost ("No usable inputs left… Canceled") and left a hidden canceled refresh movement.

### B7. Refresh failures are never shown (CODE-READ)

- A manual refresh toasts **"Refresh started"** as soon as barkd accepts the registration (`components/vtxos/vtxos-table.tsx:111-119`). The server's rejection only comes when the round starts.
- The failed round is then filtered out of the refreshing list (`utils/refresh.ts:126-129`).
- Its movement is hidden by "Hide refreshes", which is on by default (`stores/settings.ts:48`, `utils/movements-feed.ts:241-242`).
- Auto-refresh has no error handler.
- Refresh all drops barkd's reason: "Could not start refresh. Please try again." (`components/wallet-actions-popover.tsx:61-63`).

### B8. An expired coin's badge says "Spendable" (CODE-READ, consistent with the live run)

`VtxoStatusBadge` shows `state.type`, which is `spendable` (`components/vtxos/vtxo-status-badge.tsx:15`). Meanwhile the expiry cell says "Expired" (`utils/vtxo.ts:135-137`). In the live run the badge was already "Queued" because auto-refresh fired at once. With the tab closed, or with a refused coin, the badge stays "Spendable".

### B9. The balance breakdown leaves out claimable Lightning receives (CODE-READ)

`rows` (`components/dashboard/balance-card.tsx:33-74`) has no `claimableLightningReceiveSat` line, but the total includes it (`utils/balance.ts:69-78`). `onlyOffchain` ignores it as well (`balance-card.tsx:76-83`).

### B10. The exit dialog can be submitted before or without a fee estimate (CODE-READ)

`hasInsufficientFunds` is only checked when `feeEstimate !== undefined` (`components/emergency-exit-start-dialog.tsx:62-64`). While the estimate is loading or after it fails, the button is enabled and no cost is shown. With no on-chain funds the exit then sits at "Broadcasting" with no explanation.

### B11. The exit claim address lives only in this browser, and auto-claim fails silently (CODE-READ)

- `exitClaimAddresses` is in localStorage (`stores/wallet.ts:63-66`). It is written before the exit starts and kept if the start fails (`settings.tsx:285`).
- Auto-claim runs only while a dashboard page is open (`layouts/dashboard.tsx:53`) and has no `onError` (`hooks/barkd/use-auto-claim-emergency-exit.ts:29-42`).
- A reload in the same browser keeps the address. Another device or a cleared profile gets "Add address to claim".

### B12. A restore never shows recovered or skipped counts (CODE-READ, log line VERIFIED)

- barkd logs `Recovered N spendable vtxos from the recovery mailbox (M skipped)`. I saw this line when my wallet was created. bark-web gets only `{fingerprint, scanIncomplete}` (`hooks/use-onboarding-wallet.ts:54-62`).
- The barkd backend does not pass `restore` at all (`lib/backend/barkd/index.ts:129-138`).
- WASM recovery runs inside `Wallet.openWithOnchain` and surfaces nothing either (`lib/backend/wasm/worker.ts:235-288`).

A coin paid out by the sidecar is "skipped" (O5: "6 skipped"), so a user restoring after a payout sees a lower balance and no reason.

### B13. The Lightning invoice shows no expiry, no fee and no "stay online" note (VERIFIED: screenshot)

`ux-review-shots/ln-invoice.png`: a 5,000 sat invoice with no expiry (captaind `invoice_expiry = 48h`) and no receive fee (100 sat + 2,000 ppm, so about 110 sat). On WASM the wallet must be open to claim. bark-web does not read `fees.lightningReceive` anywhere outside the backend mappers.

## 3. Refresh and maintenance errors (question 2)

- **"Unusable inputs" or "banned" from the server:** the user sees nothing from auto-refresh. A manual refresh says "Refresh started" and the coin's badge then quietly returns to "Spendable" (B7). Banned and spent coins get the same error text (`server/src/round/mod.rs:441-452`). The reason (`is banned until block …`, `not spendable (state: spent)`) only reaches captaind's debug log.
- **Does it retry forever?**
  - Yes, twice over: the barkd daemon at every round (`bark/src/daemon/mod.rs:151-160` → `lib.rs:1856-1910`, which drops the input per call but starts again next round);
  - and bark-web every 60 s or more while open (B6).
- **Does one bad coin block the rest?**
  - In bark-web's batch, yes (B6).
  - In the daemon's maintenance refresh, no. The rest still refresh, at the daemon's threshold.

## 4. Restore and recovery (question 3)

- **Long recoveries:** fixed upstream for WASM in `09d1659`: the import page stays up instead of showing an error. Still, nothing shows progress or "this can take minutes" during the scan (`pages/import.tsx:204-216`: just a spinner on Continue).
- **Partial recovery and skipped coins:** never shown (B12). The only restore notice is "Restoring from your seed phrase relies on the Ark server." (WASM only, `i18n/locales/en.json:95`).
- **After a sidecar payout:** the coin is skipped, and the payout at `tr(coin key)` is not watched. The user's balance is lower and nothing explains it. Variant B's chain check covers this (I6).

## 5. Unilateral exit (question 4)

- **Fee estimate:** shown as "~X sats at Y sat/vB" (`emergency-exit-start-dialog.tsx:147-181`). Against barkd master it is unusable because the fundable check fails (B2). It can also be skipped while loading (B10).
- **No on-chain funds:** the estimate shows "Deposit more to continue", but there is no "Receive on-chain" shortcut, unlike the board dialog (`en.json:52-55`). An exit already running that runs out of fee funds shows "Broadcasting" with no hint.
- **Claim address:**
  - per browser only (B11);
  - pre-filled with "Use my Bark on-chain wallet";
  - the "Change" button only works while the exit is in a state where the address can still change (`utils/vtxo.ts:42-47`).
- **Reload mid-exit:**
  - Progress is polled from barkd (`hooks/barkd/use-exit-status.ts`), so it survives a reload.
  - The progress card on Settings shows only for "exit all" or when a claim address is missing (`settings.tsx:232-233`). An exit started from the VTXO table shows only as badges and the "Pending exit" line.
  - A failed exit-all leaves the page stuck (B3).
  - On WASM, exit progress and claims only advance while a tab is open.

## 6. Lightning pending states and wording (questions 5 and 6)

**Lightning**
- **Send:** `POST /wallet/send` returns "Payment sent successfully" even when the payment is still pending. bark-web closes the modal with no toast (`hooks/send/use-send-execute.ts:51-73`). The history row then spins as "Pending" with no expected end. The coins sit in "Pending Lightning send"; a failed payment brings them back.
- **Receive:** see B13. A claimable receive is counted in the total but has no breakdown line (B9).

**Likely ticket triggers**

| Ticket | Where it comes from | Proposed copy (short) |
|---|---|---|
| "Where did my money go?" | B1 and B5; states 5 and 6 | Balance line **"Renewing"**: "Expired coins. They renew automatically the next time your wallet is online. No action needed." |
| "Where did my money go?" after a payout | State 5 | Status **"Paying out"**: "This coin expired before it was renewed, so it is being sent to your on-chain balance." **"Paid out"**: "Sent on-chain · <txid>". History: **"Expired coin paid out on-chain"** |
| "Why can't I send?" | `spendable_sat` excludes Renewing coins (`use-send-quote.ts:73`) | Under "Insufficient bitcoin": "<X> sats are renewing and can be sent after the next round." |
| "What is refresh?" | `en.json:27`, `en.json:502`, the expiry column | "Ark coins have an expiry date. Refreshing swaps them for new ones before they expire. The wallet does this automatically while it is open." |
| "Why is my coin locked?" | State 8 | "Boarding: waiting for N confirmations" |
| "Nothing to refresh. None of your VTXOs are spendable." | `en.json:31` | "Nothing to refresh right now." |
| "Exit in progress", stuck | B3 | Fixed by the code change, no copy needed |
| "Response returned an error code" | B4 | Show barkd's message |

## 7. Ranked improvements (ticket reduction ÷ effort)

Each fix is the minimal one. Effort: XS is under 1 h, S is about half a day, M is 1–3 days, L is about a week or more.

| Rank | Change | Fixes | Effort |
|---|---|---|---|
| **I1** | Read `needs_refresh_sat`, `pending_arkoor_send_sat` and `pending_offboard_sat` (bump the client, or read the raw JSON in `map.ts`). Add `needsRefreshSats` to `Balance`, add it to `totalSat`, and show a **"Renewing"** line on the balance card. | B1, states 3/4/5/6/12. Biggest ticket source. | S |
| **I2** | VTXO status **"Renewing"** when `state = spendable && expiryHeight ≤ tip` (`vtxos-columns.tsx:89-103`). One condition and one i18n key. | B8 | XS |
| **I3** | Exit fundability: if `fundable` is missing, use `onchainSpendable ≥ totalFeeSats`. Keep the button disabled until an estimate exists. | B2, B10 | XS |
| **I4** | Exit-all: set the in-progress flag in `onSuccess`, not before the call. Show errors with `backendErrorMessage`. Write claim addresses on success only. | B3, B4 | XS |
| **I5** | Refresh errors: add an `onError` to auto-refresh that remembers ids barkd reports as unusable (parse `unusable inputs: [..]`) and **leaves them out of the next batch**. Show one persistent note: "N coins could not be renewed". Keep failed refreshes visible even with "Hide refreshes" on. | B6, B7, state 6 | S |
| **I6** | **Variant B** (the plan's Phase 2; needs Phase 1 bark additions):<br>1. a `use-expired-vtxos` hook runs before auto-refresh: coins with `expiry + G ≤ tip` → `adoptServerVtxoStatus` → for the ones now spent, `findExpiryPayouts`;<br>2. those coins are excluded from refresh;<br>3. VTXO status **Renewing / Paying out / Paid out** (txid link);<br>4. a balance card "Paying out" line;<br>5. a history entry **"Expired coin paid out on-chain"**;<br>6. a "Move to on-chain balance" sweep button.<br>Also covers a restore after a payout (the chain check finds it). | State 5, B12 for payouts | L (with the bark work) |
| **I7** | Copy-only changes from §6 (refresh tooltip, "Insufficient… X renewing", "Nothing to refresh right now", the failed-board explanation in the detail dialog). | Wording tickets | XS |
| **I8** | File B5 (board false-fail) upstream with the txids and the `board.rs` refs. | B5 | XS |
| **I9** | Lock reason for `bark.board`: "Boarding" (`utils/vtxo.ts:147-175`). | States 8 and 16 | XS |
| **I10** | Lightning: a breakdown line for claimable receives; show invoice expiry and fee in the receive modal; "pending until ~<date>" on pending LN sends. | B9, B13, state 10 | S |
| **I11** | Restore summary: "N coins restored, M skipped (already spent on the server)". Needs barkd to return the counts from create; it only logs them today. | B12 | M (bark change) |
| **I12** | Claim address held by barkd rather than localStorage, or at least warn "claims run only while this page is open, in this browser". The warning is XS; the move is upstream. | B11 | XS / M |

**Order for the Bull test client:** I1, I2, I3, I4 and I5 first, all small and needed for the sidecar scenarios to be readable at all. Then I6.

**Version pinning:** before the S1/S4/S5 E2E runs (plan §4), pin bark-web's client and the barkd image to the same API version. B1 and B2 both come from 0.7.2 client ↔ master barkd skew.
