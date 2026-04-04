# Evil Empire UI Component Library — Implementation Plan

## 1. Goal

Build a shared, cross-platform (React Native + React Web) component library inside the existing `evil_empire` Turborepo monorepo. The library follows [shadcn/ui](https://ui.shadcn.com) patterns via **Gluestack UI v2**, uses a dark "Tactical Ops" design system extracted from the dashboard screenshot, and is immediately consumable by PeakTrack and any future web app.

---

## 2. Design System — "Tactical" Theme

### 2.1 Color Tokens

Extracted from the dashboard screenshot cross-referenced with PeakTrack's existing `styles/common.ts`:

```
Token Name             Hex         Usage
─────────────────────────────────────────────────────────────
background             #0D0D0D     Page / root background
background-card        #1A1A1A     Card surfaces
background-elevated    #222222     Inputs, elevated surfaces
background-input       #262626     Form fields
border                 #2A2A2A     Card borders, dividers
border-focus           #c65d24     Focused input rings

primary                #c65d24     Orange accent (buttons, links, highlights)
primary-foreground     #FFFFFF     Text on primary backgrounds
primary-muted          #A04D1E     Hover/pressed state of primary

success                #22C55E     Online indicators, success states
success-muted          #166534     Success backgrounds

destructive            #EF4444     Errors, failed missions, danger
destructive-muted      #991B1B     Destructive backgrounds

warning                #F59E0B     Warnings, medium-risk items

text                   #FFFFFF     Primary text
text-secondary         #9BA1A6     Secondary / muted text
text-muted             #666666     Tertiary / disabled text

chart-line-1           #c65d24     Primary data series (orange, solid)
chart-line-2           #FFFFFF     Secondary data series (white, dashed)
```

### 2.2 Typography Scale

```
Token            Size    Weight   Line Height   Usage
────────────────────────────────────────────────────
display          32px    700      1.2           Page titles
heading-lg       24px    700      1.3           Section headers
heading          20px    600      1.3           Card titles
heading-sm       16px    600      1.4           Sub-headings
body             14px    400      1.5           Body text
body-sm          12px    400      1.5           Secondary text, timestamps
caption          10px    500      1.4           Labels, status tags
mono             13px    400      1.5           Terminal/log text (monospace)
```

Font family: System default (San Francisco on iOS, Roboto on Android, system-ui on web).
Mono font: `monospace` / platform mono default.

### 2.3 Spacing & Radius

```
Spacing:  4, 8, 12, 16, 20, 24, 32, 40, 48, 64
Radius:   sm=4  md=8  lg=12  xl=16  full=9999
```

### 2.4 Shadows / Elevation

Minimal — the dark theme relies on subtle border differentiation rather than shadows.

---

## 3. Architecture

### 3.1 New Package: `@evil-empire/ui`

```
packages/
├── ui/                          # NEW — the component library
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsup.config.ts           # Build config (CJS + ESM + dts)
│   ├── src/
│   │   ├── index.ts             # Public barrel export
│   │   ├── theme/
│   │   │   ├── tokens.ts        # Color, spacing, typography tokens
│   │   │   ├── tactical-theme.ts # Gluestack theme config
│   │   │   └── tailwind-preset.ts # Tailwind preset for consumers
│   │   ├── primitives/          # Low-level building blocks
│   │   │   ├── Box.tsx
│   │   │   ├── Text.tsx
│   │   │   ├── Pressable.tsx
│   │   │   └── Icon.tsx
│   │   ├── components/          # Composite components (shadcn-style)
│   │   │   ├── card/
│   │   │   │   ├── Card.tsx
│   │   │   │   └── index.ts
│   │   │   ├── stat-card/
│   │   │   │   ├── StatCard.tsx
│   │   │   │   └── index.ts
│   │   │   ├── activity-feed/
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   └── index.ts
│   │   │   ├── badge/
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── index.ts
│   │   │   ├── status-indicator/
│   │   │   │   ├── StatusIndicator.tsx
│   │   │   │   └── index.ts
│   │   │   ├── sidebar-nav/
│   │   │   │   ├── SidebarNav.tsx
│   │   │   │   └── index.ts
│   │   │   ├── data-table/
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── index.ts
│   │   │   ├── stat-row/
│   │   │   │   ├── StatRow.tsx
│   │   │   │   └── index.ts
│   │   │   ├── header/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── index.ts
│   │   │   ├── button/
│   │   │   │   ├── Button.tsx
│   │   │   │   └── index.ts
│   │   │   ├── input/
│   │   │   │   ├── Input.tsx
│   │   │   │   └── index.ts
│   │   │   └── terminal-block/
│   │   │       ├── TerminalBlock.tsx
│   │   │       └── index.ts
│   │   └── hooks/
│   │       ├── use-tactical-theme.ts
│   │       └── use-color-mode.ts
│   └── __tests__/
│       └── ...
```

### 3.2 How It Fits in the Monorepo

```
pnpm-workspace.yaml   →  already includes "packages/*"  ✅
turbo.json            →  build task already chains ^build  ✅
Metro (PeakTrack)     →  already resolves @evil-empire/* from src/  ✅
```

The new package slots in with zero config changes to the monorepo infrastructure.

### 3.3 Technology Stack

| Concern              | Tool                         | Why                                                |
|----------------------|------------------------------|----------------------------------------------------|
| Component primitives | Gluestack UI v2              | shadcn-compatible, copy-paste, RN + Web            |
| Styling              | NativeWind v4 + Tailwind CSS | Already in PeakTrack, cross-platform               |
| Build                | tsup                         | Same as @evil-empire/parsers and @evil-empire/types |
| Type exports         | TypeScript + dts              | Consistent with existing packages                  |
| Theme distribution   | Tailwind preset + JS tokens  | Consumers just add the preset                      |
| Testing              | Jest + RNTL                  | Matches existing test setup                        |

### 3.4 shadcn MCP Integration

Add the [shadcn MCP server](https://ui.shadcn.com/docs/mcp) to `.mcp.json` at the repo root for AI-assisted component generation:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/shadcn-mcp@latest"]
    }
  }
}
```

This gives Claude Code (and Cursor/VS Code Copilot) direct access to browse, search, and install shadcn components as starting points that we then adapt to our tactical theme.

---

## 4. Components — Phase 1 (Dashboard Match)

These components map directly to elements visible in the Tactical Ops screenshot:

### 4.1 Primitives

| Component      | Description                                     |
|----------------|-------------------------------------------------|
| `Box`          | Themed View wrapper with token-based styling     |
| `Text`         | Typography component with variant support        |
| `Pressable`    | Touch target with hover/press states             |
| `Icon`         | Icon wrapper (Expo Vector Icons compatible)      |

### 4.2 Dashboard Components

| Component          | Maps to (screenshot)                  | Props / Variants                                                    |
|--------------------|---------------------------------------|---------------------------------------------------------------------|
| `Card`             | All card containers                   | `variant: default | bordered | ghost`, padding, header/footer slots |
| `StatCard`         | Agent Allocation (190 / 990 / 290)    | `value`, `label`, `trend?`, `icon?`                                 |
| `Badge`            | Agent names (gh0st_Fire, etc.)        | `variant: default | primary | destructive | success`, `size`        |
| `StatusIndicator`  | Green/gray/red dots on agent list     | `status: online | offline | danger | warning`                       |
| `ActivityFeed`     | Activity Log panel                    | `items: ActivityItem[]`, timestamps, highlighted names              |
| `DataTable`        | Agent list (G-078W, G-079X...)        | `columns`, `data`, row press handler                                |
| `StatRow`          | Mission Information rows              | `label`, `value`, `variant: success | danger`                       |
| `SidebarNav`       | Left sidebar navigation               | `items: NavItem[]`, `activeKey`, `collapsed`                        |
| `Header`           | TACTICAL COMMAND / OVERVIEW bar       | `breadcrumbs`, `actions` slot, `timestamp`                          |
| `TerminalBlock`    | Encrypted Chat Activity               | `lines: TerminalLine[]`, mono font, colored syntax                  |
| `SystemStatus`     | SYSTEM ONLINE widget (bottom-left)    | `status`, `uptime`, `stats: Record<string, number>`                 |
| `Button`           | General purpose                       | `variant: primary | ghost | outline | destructive`, `size`, `loading` |
| `Input`            | General purpose                       | `variant: default | filled`, `error`, `label`                       |

### 4.3 Future / Phase 2

Chart components (line chart, radar) are better handled by dedicated charting libraries (recharts for web, react-native-svg-charts or victory-native for RN) wrapped in thin theme-aware containers. Not in Phase 1 scope.

---

## 5. Implementation Steps

### Step 1 — Scaffold the package (Day 1)

1. Create `packages/ui/` directory structure
2. Set up `package.json` with name `@evil-empire/ui`, tsup build, peer dependencies on `react`, `react-native`, `nativewind`
3. Create `tsconfig.json` extending `@evil-empire/typescript-config/base.json`
4. Define theme tokens in `src/theme/tokens.ts`
5. Create the Tailwind preset in `src/theme/tailwind-preset.ts` so consumers can do:
   ```js
   // tailwind.config.js in any consuming app
   module.exports = {
     presets: [require('@evil-empire/ui/tailwind-preset')],
     // ...
   }
   ```
6. Add the package to PeakTrack's dependencies: `"@evil-empire/ui": "workspace:*"`
7. Update PeakTrack's `metro.config.cjs` resolver to include `ui` (should auto-work with existing `@evil-empire/*` pattern)

### Step 2 — Build primitives (Day 1–2)

1. `Box` — thin wrapper around `View` with className support via NativeWind
2. `Text` — variant-driven text with token-mapped styles
3. `Pressable` — with hover/pressed visual feedback
4. `Icon` — compatible with `@expo/vector-icons`
5. Unit tests for each primitive

### Step 3 — Build dashboard components (Day 2–4)

Build each component from §4.2 in order of dependency:
1. `Card` → `StatCard` → `StatRow`
2. `Badge` → `StatusIndicator`
3. `ActivityFeed` (uses `Badge`, `Text`)
4. `DataTable` (uses `StatusIndicator`, `Text`)
5. `TerminalBlock` (uses `Text` mono variant)
6. `SidebarNav` (uses `Icon`, `Pressable`)
7. `Header` (uses `Text`, `Button`)
8. `SystemStatus` (uses `StatusIndicator`, `StatRow`)
9. `Button`, `Input` (general purpose)

### Step 4 — Integrate into PeakTrack (Day 4–5)

1. Update PeakTrack's `tailwind.config.js` to use the `@evil-empire/ui` preset
2. Migrate PeakTrack's `styles/common.ts` colors → imported from `@evil-empire/ui` tokens
3. Replace `ThemedText` / `ThemedView` usage with `@evil-empire/ui` primitives (gradually)
4. Build one demo screen using the new components to validate cross-platform rendering

### Step 5 — Documentation & validation (Day 5)

1. Add a Storybook-like example app or screen showcasing all components
2. Verify on iOS simulator + web (Expo web)
3. Ensure `pnpm build` and `pnpm typecheck` pass across the monorepo

---

## 6. Key Technical Decisions

### Why Gluestack v2 over alternatives

- **Tamagui**: Different styling paradigm, would require replacing NativeWind. PeakTrack already uses NativeWind — Gluestack aligns with it.
- **React Native Reusables**: Community project, less mature, fewer components.
- **Custom from scratch**: Too much work for cross-platform primitives that Gluestack already solves.
- **Gluestack v2**: Uses NativeWind/Tailwind (already in stack), follows shadcn copy-paste philosophy, officially supports RN + Web.

### Cross-platform strategy

Components use `react-native` primitives (`View`, `Text`, `Pressable`) styled with NativeWind classes. On web, these resolve through `react-native-web` (bundled with Expo's web target). No platform-specific code needed for Phase 1 components.

### Why a Tailwind preset (not just tokens)

A preset lets any consuming app (PeakTrack, a future Next.js admin panel, etc.) get the full tactical theme by adding one line to their Tailwind config. It bundles colors, typography, spacing, and component-level utilities.

### shadcn MCP as development accelerator

The shadcn MCP server lets us use AI to browse the shadcn registry, pull component source code, and adapt it to our Gluestack/NativeWind setup. It accelerates the "copy-paste → customize" workflow that shadcn is designed for.

---

## 7. Package Configuration Reference

### `packages/ui/package.json`

```json
{
  "name": "@evil-empire/ui",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./tailwind-preset": "./src/theme/tailwind-preset.js",
    "./tokens": {
      "import": "./dist/theme/tokens.mjs",
      "require": "./dist/theme/tokens.js",
      "types": "./dist/theme/tokens.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.72",
    "nativewind": ">=4"
  },
  "devDependencies": {
    "@evil-empire/eslint-config": "workspace:*",
    "@evil-empire/typescript-config": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Tailwind Preset (sketch)

```js
// src/theme/tailwind-preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        tactical: {
          bg:          '#0D0D0D',
          card:        '#1A1A1A',
          elevated:    '#222222',
          input:       '#262626',
          border:      '#2A2A2A',
          primary:     '#c65d24',
          'primary-fg':'#FFFFFF',
          success:     '#22C55E',
          destructive: '#EF4444',
          warning:     '#F59E0B',
          muted:       '#666666',
          secondary:   '#9BA1A6',
        }
      },
      fontFamily: {
        mono: ['monospace'],
      },
    },
  },
};
```

---

## 8. Risk & Mitigation

| Risk                                           | Mitigation                                                          |
|------------------------------------------------|---------------------------------------------------------------------|
| NativeWind v4 breaking changes                 | Pin version, test on both platforms in CI                           |
| Gluestack v2 not covering all needed primitives| Fall back to raw RN components + NativeWind for gaps                |
| Web rendering differences                      | Test every component on Expo web; use Platform.select sparingly     |
| Theme token drift between apps                 | Single source of truth in `@evil-empire/ui/tokens`                  |
| Bundle size for RN apps                        | Tree-shakeable exports; consumers import only what they use         |
