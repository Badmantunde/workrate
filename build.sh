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

echo "→ Copying marketing and admin pages into dist..."
cd ..
cp marketing/home.html       workrate-dashboard/dist/home.html
cp admin/admin.html          workrate-dashboard/dist/admin.html
cp marketing/about.html      workrate-dashboard/dist/about.html
cp marketing/blog.html       workrate-dashboard/dist/blog.html
cp marketing/changelog.html  workrate-dashboard/dist/changelog.html
cp marketing/contact.html    workrate-dashboard/dist/contact.html
cp marketing/privacy.html    workrate-dashboard/dist/privacy.html
cp marketing/terms.html      workrate-dashboard/dist/terms.html
cp marketing/security.html   workrate-dashboard/dist/security.html

echo "✓ Build complete. dist/ contains:"
ls workrate-dashboard/dist/
