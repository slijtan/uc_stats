#!/usr/bin/env bash
# Download CDE FRPM (Free or Reduced-Price Meals) data
# Source: https://www.cde.ca.gov/ds/ad/filessp.asp

set -euo pipefail

DEST_DIR="raw-data/cde/frpm"
mkdir -p "$DEST_DIR"

# 2024-25 FRPM data
URL="https://www.cde.ca.gov/ds/ad/documents/frpm2425.xlsx"
DEST="$DEST_DIR/frpm2425.xlsx"

if [ -f "$DEST" ]; then
  echo "Already downloaded: $DEST"
else
  echo "Downloading FRPM 2024-25..."
  curl -L -o "$DEST" "$URL"
  echo "Saved to $DEST"
fi

echo "Done."
