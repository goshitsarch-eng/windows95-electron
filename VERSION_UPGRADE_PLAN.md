# Version Upgrade Audit & Plan

## Current vs Target Versions

| Dependency | Current | Target | Risk |
|---|---|---|---|
| **electron** | 34.2.0 | 40.1.0 | HIGH — Major jump (Node 22→24, Chromium 128→144) |
| **@electron-forge/cli + makers** | 7.6.1 | 7.11.x | LOW — Minor version bump |
| **react** | 17.0.1 | 19.2.4 | HIGH — Multiple breaking changes |
| **react-dom** | 17.0.1 | 19.2.4 | HIGH — `ReactDOM.render` removed |
| **@types/react** | 17.0.0 | 19.x | MEDIUM — Follows React |
| **@types/react-dom** | 17.0.0 | 19.x | MEDIUM — Follows React |
| **parcel-bundler** | 1.12.5 | parcel 2.16.3 | HIGH — Package renamed, API changed |
| **update-electron-app** | 2.0.1 | 3.1.2 | LOW — Drop-in upgrade |
| **electron-squirrel-startup** | 1.0.1 | 1.0.1 | NONE — No update needed |
| **typescript** | 5.7.3 | 5.7.3 | NONE — Already latest 5.7.x |
| **@types/node** | 20.x | 24.x | LOW — Match Node in Electron 40 |
| **less** | 3.13.0 | 4.x | LOW |
| **prettier** | 3.5.1 | 3.5.x | NONE — Already current |
| **dotenv** | 16.4.7 | 16.x | NONE — Already current |
| **rimraf** | 6.0.1 | 6.x | NONE — Already current |
| **patch-package** | 8.0.0 | 8.x | NONE — Already current |
| **v86 (bundled)** | Static JS+WASM | Static JS+WASM | LOW — WASM compat maintained |
| **Node.js (CI)** | 18.x | 22.x+ | MEDIUM — Electron 40 ships Node 24 |
| **GitHub Actions** | checkout@v2, setup-node@v1, cache@v1 | v4, v4, v4 | LOW |

## v86 Compatibility Analysis

v86 is bundled as static `libv86.js` + `v86.wasm` files (not an npm dependency). It runs via WebAssembly in Chromium's renderer process. Key compatibility concerns:

- **Chromium 144 (Electron 40)**: Full WebAssembly support. No known regressions for WASM-based emulators.
- **Node.js fs API**: The build script patches `libv86.js` to use Node's `fs.read` instead of `XMLHttpRequest`. Node 24's `fs` API is backward-compatible.
- **Context Isolation**: Electron 40 enforces stricter context isolation defaults. The app sets `contextIsolation: false` and `nodeIntegration: true` — these still work but show deprecation warnings. Must verify v86's `window["emulator"]` pattern still works.
- **Verdict**: v86 should work with Electron 40 without changes. The bundled WASM binary is architecture-independent.

## Upgrade Order (Recommended)

### Phase 1: Low-risk infrastructure (no code changes)

1. **Upgrade electron-forge 7.6.1 → 7.11.x**
   - Update all `@electron-forge/*` packages to 7.11.x
   - Check if the `@electron+packager+18.3.6.patch` still applies cleanly (packager version may have changed)
   - If packager version bumped, regenerate or drop the patch

2. **Upgrade update-electron-app 2.0.1 → 3.1.2**
   - Check for API changes (v3 may have new config options)

3. **Upgrade @types/node 20 → 24**

4. **Upgrade less 3.x → 4.x**
   - Minor syntax changes; test LESS compilation

5. **Update GitHub Actions versions**
   - `actions/checkout@v2` → `@v4`
   - `actions/setup-node@v1` → `@v4`
   - `actions/cache@v1` → `@v4`
   - Node version in CI: `18.x` → `22.x`

### Phase 2: Parcel 1 → Parcel 2 migration

6. **Replace `parcel-bundler` with `parcel`**
   - Package renamed from `parcel-bundler` to `parcel`
   - CLI API changed: `parcel build` replaces `new Bundler()` programmatic API
   - Update `tools/parcel-build.js` to use Parcel 2's `@parcel/core` API or CLI
   - Add `.parcelrc` config if needed
   - Entry point handling changed; verify `static/index.html` and `src/main/main.ts` still build
   - The custom `copyLib()` post-build step for v86 must be preserved

### Phase 3: React 17 → 19 migration

7. **First upgrade React 17 → 18.3** (intermediate step)
   - `ReactDOM.render()` → `ReactDOM.createRoot().render()`
   - Fix any deprecation warnings from 18.3
   - This app has minimal React (just the emulator UI), so impact should be small

8. **Then upgrade React 18.3 → 19.2.4**
   - Remove any `defaultProps` on function components (use default params)
   - Ensure new JSX transform is configured
   - Update `@types/react` and `@types/react-dom` to 19.x

### Phase 4: Electron 34 → 40

9. **Upgrade Electron 34.2.0 → 40.1.0**
   - This is a 6-major-version jump. Key concerns:
     - **Node 22 → 24**: Most APIs backward-compatible
     - **Chromium 128 → 144**: WebAssembly and DOM APIs stable
     - **Deprecated APIs**: Check for removed Electron APIs between v34–v40
     - **Context Isolation**: May need to address stricter defaults
   - Test v86 emulator startup, disk image loading, keyboard/mouse input
   - Test all platform builds (Windows/macOS/Linux)
   - Verify the `@electron+packager` patch still applies or is no longer needed

### Phase 5: Validation

10. **Full test matrix**
    - `npm run tsc` — TypeScript compilation
    - `npm run start` — Dev mode launch
    - `npm run make` — Build packages for all platforms
    - Verify Windows 95 boots and is interactive in the emulator
    - Verify auto-update mechanism works

## Breaking Change Risks Summary

| Change | Breaking Risk | Mitigation |
|---|---|---|
| Electron 34→40 | `contextIsolation` defaults, removed APIs | Test incrementally; check migration guides for each major |
| React 17→19 | `ReactDOM.render` removed | Small UI surface area; straightforward migration |
| Parcel 1→2 | Completely new API | Rewrite build script; or consider switching to Vite |
| v86 + Electron 40 | Minimal | WASM is stable; fs.read patch should still work |
| Node 18→22 in CI | npm/package resolution changes | Test CI build before merging |

## Alternative: Consider Vite instead of Parcel 2

Since Parcel 1→2 is a full rewrite anyway, it may be worth considering **Vite** as the bundler:
- Better Electron ecosystem support via `electron-vite` or `vite-plugin-electron`
- Faster dev server with HMR
- Widely adopted in the Electron community
- Trade-off: More config than Parcel's zero-config approach

## Sources

- [Electron 40.0.0 Release](https://www.electronjs.org/blog/electron-40-0)
- [Electron Releases](https://github.com/electron/electron/releases/)
- [Electron Forge Releases](https://github.com/electron/forge/releases)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2)
- [Parcel v2 (npm)](https://www.npmjs.com/package/parcel)
- [update-electron-app (npm)](https://www.npmjs.com/package/update-electron-app)
- [v86 GitHub](https://github.com/copy/v86)
- [React 17→19 Migration Guide (Medium)](https://medium.com/@garimabeli92/a-practical-step-by-step-guide-to-migrating-from-react-17-to-react-19-93139079ff4a)
