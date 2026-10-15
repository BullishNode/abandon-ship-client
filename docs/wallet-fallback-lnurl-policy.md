# Wallet fallback payer contract

The `wallet-fallback` barkd profile sends `require_lnurl_metadata: true` with
`POST /api/v1/wallet/send`. This uses the authenticated `BaseAPI` request path
because the pinned generated client predates that request field. The generated
client version and dependency lock remain unchanged.

The paired native backend must deserialize the boolean and pass it into
`LightningSendOptions::require_lnurl_metadata`. The native implementation must
verify the signed invoice against the exact advertised metadata, requested
amount and network, and bind the recipient callback and address identifier.
Its HTTPS client must use the declared trusted roots and refuse redirects.
A strict refusal is returned to the caller; the web client does not retry with
generic LNURL validation.

Do not deploy this client as a strict payer against a backend that ignores the
field. Qualification must bind the client and native backend source and binary
identities, exercise both accepted and refused signed invoices through the real
REST endpoint, and verify refusal before signing or paying. Request serialization
tests alone do not establish those guarantees.

The `key-sweep` profile retains the existing generated-client behavior. WASM
payments use separate native bindings and are outside this barkd contract.
The ordinary Ark, BOLT11 and BOLT12 routes still use the same native endpoint;
the strict option governs LNURL resolution.

This source candidate requires focused client tests, UI/API builds and paired
native/browser qualification before deployment.
