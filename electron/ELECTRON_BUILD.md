# ChitVault Desktop — Electron Build Guide

This packages the ChitVault Next.js SaaS app as a native Windows .exe (or Mac .dmg) desktop application.

---

## How It Works

```
Next.js app (built in standalone mode)
        ↓
Electron wraps it as a native desktop app
        ↓
Windows installer (.exe) via electron-builder
```

The built Next.js server runs locally inside the app — no internet needed to load the UI. Only Supabase calls (database reads/writes) require internet.

---

## Prerequisites

- Node.js 18+ installed
- The root ChitVault project set up with `.env.local` filled in

---

## Build Steps

### 1. Build Next.js in standalone mode
```bash
# From the root chitvault-saas/ folder:
npm run build:electron
```
This creates `.next/standalone/` — the bundled server.

### 2. Install Electron dependencies
```bash
cd electron
npm install
```

### 3. Build the Windows installer
```bash
npm run build:win
```
Output: `electron/dist/ChitVault Setup 2.0.0.exe`

### Or do both at once from root:
```bash
npm run build:electron:win
```

---

## Per-Client Customisation

Before building for a client, update these two places:

**1. Root `.env.local`** — client's Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://client-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_APP_NAME=Kumari Chit Funds
```

**2. `electron/main.js`** — app name in title bar:
```js
const APP_NAME = 'Kumari Chit Funds'
```

**3. `electron/package.json`** — product name and appId:
```json
"productName": "Kumari Chit Funds",
"appId": "app.chitvault.kumari"
```

Then build — the .exe will be branded for that client.

---

## Development (test without building)

Run Next.js dev server first:
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run electron:dev
```

---

## File Structure

```
electron/
  main.js       ← Electron entry: manages window + starts Next.js server
  preload.js    ← Secure bridge between Electron and Next.js
  loading.html  ← Splash screen while server boots (~3–5 sec)
  package.json  ← Electron + electron-builder config
  LICENSE.txt   ← Shown during install
  build/
    icon.ico    ← Windows icon (copy from chitvault-release/icons/)
    icon.icns   ← Mac icon (convert from .ico if needed)
```

---

## Icon Preparation

Copy the icon files generated earlier:
```bash
cp ../chitvault-release/icons/app.ico electron/build/icon.ico
```

For Mac (.icns), use an online converter or:
```bash
# On Mac:
iconutil -c icns icon.iconset -o electron/build/icon.icns
```

---

## Installer Size

| Component | Size |
|-----------|------|
| Electron runtime (Chromium) | ~120 MB |
| Next.js standalone build | ~30–50 MB |
| Total installer (.exe) | ~80–100 MB |
| Installed size | ~250 MB |

This is normal — VS Code, Slack, and Discord are all Electron apps of similar size.

---

## "Windows Protected Your PC" Warning

New unsigned apps trigger SmartScreen. Client clicks **"More info" → "Run anyway"**.

To remove this warning permanently, purchase a Code Signing Certificate (~₹15,000/yr from Sectigo/DigiCert) and configure it in `electron/package.json`:
```json
"win": {
  "certificateFile": "cert.pfx",
  "certificatePassword": "password"
}
```
