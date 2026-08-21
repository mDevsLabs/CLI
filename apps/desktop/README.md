# mAI Desktop

Application de bureau qui lance **mAI** dans un terminal intégré à l'ouverture. Windows, macOS, Linux.

## Stack

- **Electron 32** + **electron-vite** (main / preload / renderer)
- **node-pty** — PTY natif, même moteur que VS Code / Ghostty
- **xterm.js 5** + `@xterm/addon-fit` + `@xterm/addon-web-links`

Le CLI `mAI` (`dist/cli.js`) est embarqué comme `extraResources/cli` à l'empaquetage. Au démarrage le renderer crée immédiatement un PTY `mai-main` et s'y attache. Pas de shell intermédiaire : le PTY lance directement `electron -- ELECTRON_RUN_AS_NODE=1 cli.js` (pas besoin de Node installé). Fallback → `mai` global dans le PATH.

## Développement

```bash
# 1. Build le CLI (requis pour le bundle embarqué)
bun run build

# 2. Installer deps desktop (native, doit compiler node-pty)
cd apps/desktop
bun install
# ou npm install puis rebuild
npm run rebuild

# 3. Dev (hot reload main+preload+renderer)
npm run dev

# Dev avec inspect
ELECTRON_ENABLE_LOGGING=1 npm run dev
```

Env overrides :
- `MAI_CLI_PATH=/chemin/vers/cli.js` — force le CLI à lancer
- `ELECTRON_RENDERER_URL` — injecté par electron-vite en dev

## Build

```bash
cd apps/desktop

# Build renderer+main (copie dist/ automatiquement)
npm run build

# Paquets non signés (test local)
npm run build:unpack   # dossier unpacked
npm run build:win      # nsis + portable (sur Windows)
npm run build:mac      # dmg + zip (sur macOS)
npm run build:linux    # AppImage + deb + rpm (sur Linux)

# Tous (sur CI uniquement — nécessite runners par OS)
npm run build:all
```

Sortie : `apps/desktop/release/`

## Icônes

`resources/icon.png` (512×512, #D77757) est la source. `electron-builder` génère `.ico` / `.icns` automatiquement. Remplacez par les vrais assets :

- `resources/icon.png` — 512×512 minimum
- `resources/icon.ico` — Windows (optionnel, généré depuis png)
- `resources/icon.icns` — macOS (optionnel, généré depuis png)

## Architecture

```
apps/desktop/
  src/main/
    index.ts   — Bootstrap Electron, single-instance, IPC
    window.ts  — BrowserWindow (hiddenInset mac, dark bg)
    pty.ts     — Gestion Map<id, IPty> + spawn/resize/kill
    cli.ts     — Résolution commande mAI (bundle → dev → global)
  src/preload/
    index.ts   — contextBridge.exposeInMainWorld('mai', …)
  src/renderer/
    index.html
    main.ts    — Terminal xterm, FitAddon, auto-spawn PTY à l'ouverture
    styles.css — Thème sombre chaud (Impeccable, accent #D77757)
  resources/
    icon.png / entitlements.mac.plist
  scripts/copy-cli.mjs
  electron.vite.config.ts
```

### Flux au démarrage

1. `main/index.ts` `app.whenReady()` → `createMainWindow()` → `loadFile/index.html`
2. `renderer/main.ts` `spawn()` immédiat → `window.mai.createPty('mai-main', cols, rows)`
3. `main/pty.ts` `resolveMaiCommand()` → `pty.spawn(command, args, { env, cwd })`
4. `pty.onData` → `wc.send('pty:data')` → `term.write()`
5. `term.onData` → `window.mai.writePty()` → `pty.write()`

Fermeture fenêtre → `killAllPtys()` → `app.quit()` (sauf macOS).

## CI

Workflow `.github/workflows/desktop.yml` :

- Trigger : `push` tag `desktop-v*`, `workflow_dispatch`, ou `push` sur `main` modifiant `apps/desktop/**`
- Matrix 3 OS × 2 arch (x64/arm64 où dispo)
- Étapes : checkout → setup Node 22 + Bun → `bun install` → `bun run build` (CLI) → `cd apps/desktop && npm ci` ou `bun install` → `npm run rebuild` → `npm run build` → `electron-builder --publish never` → upload artifacts
- Release job agrège les artifacts et publie une GitHub Release si tag.

## Sécurité

- `contextIsolation: true`, `sandbox: false` (requis pour preload), `nodeIntegration: false`
- `will-navigate` bloqué, `setWindowOpenHandler` → `shell.openExternal`
- CSP `default-src 'self'` dans `index.html`
