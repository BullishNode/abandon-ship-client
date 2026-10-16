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
