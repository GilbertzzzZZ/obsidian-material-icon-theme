#!/usr/bin/env bash
# Build plugin artifacts and publish a GitHub Release (requires: gh auth login)
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:-$(node -p "require('./manifest.json').version")}"

echo "Building..."
npm run build

echo "Packaging..."
chmod +x scripts/package-release.sh
ZIP="$(./scripts/package-release.sh)"

ASSETS=(main.js manifest.json styles.css "$ZIP")

echo "Publishing release ${TAG}..."
if gh release view "$TAG" &>/dev/null; then
  gh release upload "$TAG" "${ASSETS[@]}" --clobber
else
  gh release create "$TAG" "${ASSETS[@]}" --generate-notes
fi

echo "Done: https://github.com/GilbertzzzZZ/obsidian-material-icon-theme/releases/tag/${TAG}"
