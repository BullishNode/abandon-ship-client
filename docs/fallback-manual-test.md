# Fallback client qualification

Status: implementation in progress. No deployment or actual fallback payout has been qualified by this web milestone.

This branch starts from Second bark-web `9f307f5`. It displays the immutable fallback registration returned by native barkd, and warns about unrefreshed coins near expiry. It does not implement Ark synchronization in JavaScript.

## Verified source checks

- `npm run typecheck`: passed.
- `npm run build`: passed; upstream-sized bundle warning remains.
- `npm test -- src/lib/backend/barkd/fallback.test.ts`: 2 passed, including unreachable and inconsistent registration responses.
- Ultracite on the new fallback source files: passed.

The registration adapter expects the actual authenticated native route `GET /api/v1/wallet/fallback`, forwarded by the existing barkd proxy. An unreachable backend is shown as unavailable, never as an unregistered wallet.

## Runtime acceptance still required

Run the WC6 scenarios from the client companion plan against an explicitly BIP84-enabled native barkd, with the completed server payout implementation. Record source and binary hashes, the served web build hash, and screenshots for each step:

1. Create wallet; observe its permanent payout address in Settings and prove ordinary funding addresses differ.
2. Receive through Ark and Lightning; observe actual native wallet balances.
3. Stop the wallet; allow an eligible coin to expire; observe a real fallback payout.
4. Restart; verify its payout history entry and actual BIP84 onchain balance.
5. Verify a below-dust result is explained without claiming payment.
6. Return before a decision; verify a normal refresh succeeds.
7. Restore from the original seeds; verify the same registration, history and onchain funds.

These steps have not been run. A normal onchain deposit is not evidence of a fallback payout. Regrouping and reorg history must be reconciled by stable per-coin entitlements before payout history is enabled.

## Source milestone: receipt display and typed refusals

The UI now reads native `abandon.fallback_payout` receipt metadata. It shows prepared, broadcast, confirmed, conflicted, below-dust and awaiting-settlement states, with the actual payout transaction and amount when supplied by native code. It keeps the native Ark accounting delta separate from the displayed onchain payout amount. An incoming onchain transaction is collapsed in the feed only when its exact transaction ID and complete wallet value are covered by native receipts.

Coins carrying native `awaiting_settlement` are shown with that label and excluded from new UI selection. The upstream TypeScript SDK currently omits this additive field, so the adapter reads it from the same authenticated response; it performs no ownership or synchronization logic in JavaScript. Refusal explanations select stable native `code` values, not diagnostic message text.

Validation for this milestone: all 1,038 existing and added web tests passed across 109 files, changed TypeScript files passed Ultracite, and the production build passed. An additional transaction-feed coverage test is recorded separately in the commit evidence. These are source and display tests. Actual native fallback receipt delivery, browser screenshots, and WC6 remain unrun until the new backend runtime and authenticated history RPC are integrated.

## Awaiting-settlement balance

Native `awaiting_settlement_sat` is read from the same authenticated balance response as the upstream fields. It remains in the owned total and appears under Awaiting settlement; it is excluded from available Ark value and refresh/fee selection. A permanent payout entitlement is represented by its receipt instead of returning as a second available Ark balance when Core is unreachable or its tip rolls back.

The web build/typecheck and changed-file lint passed. The complete updated suite passed 1,042 tests in 109 files. Native cache/chain-outage regression and real browser acceptance remain pending in the paired backend/client gate; these web checks do not claim those outcomes.
