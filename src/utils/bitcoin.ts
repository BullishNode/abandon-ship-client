const SATS_PER_BTC = 100_000_000

export function btcToSats(btc: number) {
  return Math.floor(btc * SATS_PER_BTC)
}

export function satsToBTC(sats: number) {
  return sats / SATS_PER_BTC
}
