#!/bin/sh

if [ -d "/root/.bark" ] && [ "$(ls -A /root/.bark 2>/dev/null)" ]; then
  echo "Wallet found, starting barkd..."
  exec ./barkd --port 4000
else
  echo "No wallet found, waiting..."
  exec tail -f /dev/null
fi
