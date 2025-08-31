# Raycast Steam Utilities (Windows)
Launch and manage Steam on Windows from Raycast. The extension discovers your Steam install and libraries, lists installed games for the currently signed-in account, and provides Steam actions.

## Features
- List/search installed Steam games (current account only)
- Launch via steam://rungameid/<appid> with fallback to steam.exe -applaunch <appid>
- Open Steam, open Game Files (opens each library's steamapps/common)
- Autodiscovers Steam path (registry) and all libraries (libraryfolders.vdf)
- Contextual toasts: success and failure toasts include the game title for quick clarity

## Requirements
- Windows with Steam installed
- Raycast for Windows
- Node.js (for local development)

## Installation & Usage
- Install from the Raycast Store (Windows) once approved, or run locally using the steps below.
- Open the command: "Steam Utilities".
  - The command shows two sections: Games and Steam Actions.
  - Use search to filter games by name.
  - Shows library drive tag for each title (no App IDs in the list)

## Install & Run (local)
```bash
npm install
npm ci
npm run dev
```

Then in Raycast:
- Steam — unified command with two sections:
  - Games (listed first): browse/search/launch installed games (filtered to current account)
  - Shows library drive tag for each title (no App IDs in the list)
  - Steam Actions: open Steam, open Game Files, restart Steam

## How it works
- Steam path from registry: HKCU\Software\Valve\Steam (fallbacks to HKLM).
- Libraries from <Steam>\steamapps\libraryfolders.vdf.
- Games from steamapps\appmanifest_*.acf.
- All installed games are listed and can be launched.

## Limitations
- Only installed titles (with manifests) are shown.

## Permissions & Privacy
- This extension uses Raycast APIs for UI and to open files/URLs on your machine.
- No external network requests are made.
- No credentials are stored.

## Dev notes
- Command: src/steam-games.tsx (unified)
- (Legacy files kept for reference): src/steam-accounts.tsx, src/steam-actions.tsx
- Utils: src/utils/steam.ts (registry/VDF discovery, parsing, launch), src/utils/vdf.ts (minimal VDF)
 - Icon asset: package.json now references `command-icon.png` (filename only; file lives under `assets/`), replacing the emoji to satisfy Raycast validation
 - Linting: replaced `any` in catches with `unknown` and added no-op comments to empty catch blocks; updated `debounce` generics to avoid explicit `any`

### Game actions
- Launch game
- Open Game Folder (uses Windows `start`)
- Copy App ID
- Success/failure toasts explicitly name the game launched

## Troubleshooting
- If no games appear, ensure Steam is installed and you are signed in.
- If libraries were recently moved, restart Steam once and relaunch the command.
- If launching fails, make sure `steam://` protocol is registered and `steam.exe` is on the default path.

## Support
Issues and contributions are welcome via GitHub.

## Changelog
See [CHANGELOG.md](./CHANGELOG.md).

## License
MIT

## Store submission & metadata
- Screenshots live under `metadata/` (max 6). Recommended at least 3.
- Specs: 2000x1250 px, 16:10, PNG. Keep a consistent background and avoid sensitive data.
- Tip: Use Raycast Window Capture and enable “Save to Metadata” to auto-save screenshots to this folder.

## Code style
- Prettier config: see `.prettierrc` (printWidth 120, trailing commas, etc.).
- Scripts:
  - `npm run lint` to check style and ESLint rules.
  - `npm run fix-lint` to auto-fix common issues.
  - `npm run build` to create a distribution build prior to publishing.
