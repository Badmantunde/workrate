#!/bin/sh
# WorkRate — Netlify build script
# Run as the build command: sh build.sh
# ────────────────────────────────
# 1. Installs and builds the React dashboard
# 2. Copies the static landing page into the build output
# so Netlify serves both from the same dist folder.

set -e  # exit on any error

echo "→ Installing dashboard dependencies..."
cd workrate-dashboard
npm install

echo "→ Building dashboard..."
npm run build

echo "→ Copying landing page into dist..."
cd ..
cp workrate-landing.html workrate-dashboard/dist/landing.html

echo "✓ Build complete. dist/ contains:"
ls workrate-dashboard/dist/
