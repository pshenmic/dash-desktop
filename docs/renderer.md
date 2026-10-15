# Renderer (`src/renderer/src/`)

React SPA, React Router v7 (`HashRouter`), `@renderer` → `src/renderer/src/`.
UI is `dash-ui-kit` + Tailwind v4; extended kit wrappers/icons live in
`components/dash-ui-kit-enxtended/`.

## Required UI discovery and reuse

Before creating **any UI component**, you MUST check both inventories:

1. Search the project codebase with `rg` / `rg --files`: existing pages,
   `components/ui/`, `components/modal/`, and
   `components/dash-ui-kit-enxtended/`. Read the closest matching implementation
   and at least one existing usage on a comparable screen.
2. Search the installed `dash-ui-kit` exports and declarations under
   `node_modules/dash-ui-kit/dist/react/`. Read the relevant props and behavior;
   inspect its implementation when the declarations do not answer whether it
   fits. Do not infer that a component is missing from unfamiliarity with it.
3. Reuse the suitable existing component. Prefer established project wrappers
   where they carry application styling or behavior. Compose existing pieces
   for feature-specific content, or extend a shared component with the smallest
   compatible capability if needed. Do not copy its implementation or introduce
   a feature-local replacement for an existing primitive.
4. Create a new component only after identifying a concrete requirement neither
   inventory covers. Explain that gap in the change/review description; this
   rule does not add an approval step.

This workflow applies to every UI change, including prototypes, mock data,
empty/loading/error states, and feature-local helpers. In particular, check
`Tabs` in `dash-ui-kit/react`, the extended `Input` / `Select` / `Badge` / `Text`
and `Button`, `DropdownField`, `SegmentedControl`, `Checkbox`, `CopyButton`,
`Spinner`, and `NoResults` before implementing their behavior with raw elements.
Check the kit's `Avatar` and `Dialog` as well. A native element may remain when
the existing components cannot provide the required semantics; first verify
and explain that specific gap.

## Consistent UI and UX

Before adding a feature or page, inspect the closest existing screen and use
its UI/UX patterns as the baseline. The feature must feel like part of this
wallet in both light and dark themes, including:

- Page headings, descriptive text, gutters, section/card treatment and spacing.
- Main tabs and their content panels; secondary filters or choices use the
  existing segmented-control/select patterns rather than a new tab system.
- Field labels, input/select sizes, help text, validation and disabled states.
- Primary/secondary actions, their placement, confirmation steps and feedback.
- Dialog layout, dismiss behavior, focus and keyboard interaction.
- Loading, empty and error states, retry actions, and list/detail navigation.

Change established behavior only when the new task requires it. Prefer a shared
improvement used consistently over styling the same control differently on each
page. Keep feature-specific layout separate from generic control behavior.

`components/ui/DropdownField.tsx` is the application's **Select** component:
use it for choosing one option, including identity, status and source fields.
Its optional `editable` mode combines a typed value with dropdown choices.
For ordinary dropdown fields, reuse it as in
Send's From/To picker. Its trigger and popup follow the same rounded, translucent
menu treatment used by Receive and Transaction Filters. Do not substitute the
extended `Select`'s default appearance just because its props fit; inspect the
comparable screen's actual control and open menu first.

Component reuse includes matching appearance and interaction, not only imports:

- Kit `ValueCard` transparent backgrounds and gray hover colors can override
  `dash-block`. Check the actual cascade; use the app's theme-aware surfaces and
  accent hover treatment, and keep distinct subsections visible inside tabs.
- Kit `Dialog` defaults to a nearly black dark surface. Match existing wallet
  modals such as `TransferConfirmModal` / `AddressQrModal`: rounded-3xl,
  white / translucent white with blur, p-6, a title/close row and grouped actions.
- The extended `Button`'s `sm` size remains a large action. Use `xs` for compact
  secondary, row and toolbar actions; reserve larger buttons for the main step.
- Search uses a labelled `Input type="search"`, a search prefix and the native
  clear affordance. Live list filters do not need a separate oversized Search
  or Clear button. Align controls to one height when composing a toolbar.
- Lists that can grow need search/filtering and bounded pages or another
  established scalable navigation pattern. Do not use a fixed sample sidebar
  as the navigation model for an unbounded production list.

The extended `Text` component defaults to `reset={false}`, which adds `inline`
even when `as` is a heading or paragraph. Use `reset` when native block display
or an explicit `block` utility is required; changing `as` alone does not change
that styling. Check the rendered layout as well as the prop types.

## Renderer constraints

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

Vite inlines any face under its 4 KB asset limit as a `data:` URI — today the
`cyrillic-ext` subsets — which is why the CSP carries `font-src 'self' data:`.
Drop `data:` and those faces fall back to a system font with no build warning.
