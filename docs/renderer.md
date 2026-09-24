# Renderer (`src/renderer/src/`)

React SPA, React Router v7 (`HashRouter`), `@renderer` → `src/renderer/src/`.
UI is `dash-ui-kit` + Tailwind v4; extended kit wrappers/icons live in
`components/dash-ui-kit-enxtended/`.

- **Use Tailwind utilities for component styling.** Add custom CSS only when
  Tailwind cannot reasonably express the required behavior. Do not add CSS
  files beside components or move ordinary component styles into global CSS.
  Data-dependent chart coordinates and dimensions may use SVG attributes or
  inline styles.

- **Auth/app state lives in `contexts/AuthContext.tsx`** (`useAuth()`), NOT in
  `App.tsx`. It polls `getStatus` every 1s and exposes `status` (which holds
  `selectedWalletId`, `network`, `walletSync`), `isAuthenticated`,
  `switchWallet`. **Read `network`/`selectedWalletId` from `useAuth()` at the
  component that needs them — do not prop-drill them down the tree.**
- Routes are declared in `App.tsx`; sidebar nav items in
  `constants/navigation.ts`. A route with no matching `navGroups` entry is
  reachable only by URL.
- **CSP blocks external fetch.** `src/renderer/index.html` sets
  `default-src 'self'`, so the renderer CANNOT fetch external URLs or do `blob:`
  downloads. Any outbound HTTP or file write goes through the **main process**
  (`net.fetch` / `dialog`+`fs`) and an IPC channel — see `RatesService` and the
  `saveTextFile` handler.
- **External links:** `window.open(url, '_blank')` is intercepted by
  `setWindowOpenHandler` in `main/index.ts` → `shell.openExternal`. Use the
  `utils/explorer.ts` helpers for dashscan links.
- **Theme:** preference (`light`/`dark`/`system`) is persisted in localStorage
  and applied by `hooks/useThemeController.ts` (`ThemeController` mounted in
  `main.tsx`); `system` tracks the OS via `matchMedia`. Use
  `useThemePreference`/`setThemePreference`, not dash-ui-kit's `toggleTheme`.
- **Fiat:** `useFiat()` gives `format(duffs)`, `rateReady`, `currency`,
  `setCurrency`; live rates via the shared `useRates()` store. Amounts are in
  **duffs** (1 DASH = 1e8) — format with `utils/balance.ts`.

## Fonts

The `@fontsource/manrope` faces are imported from `main.tsx`, not through
`base.css`. `postcss-import` inlines a CSS `@import` without rebasing its
`url()`, so importing them there resolved `./files/…` against `assets/styles/` —
the woff2 files were silently never emitted and the build warned `didn't resolve
at build time`. Any such warning means fonts are missing from the bundle again;
a clean build emits them into `out/renderer/assets/`.
