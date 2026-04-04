#!/bin/sh

TOKEN_FILE="/wallet-data/.bark/auth_token"

echo "Waiting for barkd auth token..."
while [ ! -f "$TOKEN_FILE" ]; do
  sleep 1
done

export VITE_BARKD_TOKEN=$(cat "$TOKEN_FILE")
echo "Auth token loaded."

exec npm run dev:bark-web
