# Visage v0.12 design QA

**final result: blocked**

## Evidence and verification boundary

- Selected source visual truth: `visage-reference-revisions/visage-porcelain-signal.png` and `visage-reference-revisions/visage-graphite-film.png`, both 1487 × 1058 pixels. Both actual source images were opened before implementation
- Selected direction: rounded, layered light porcelain / dark graphite cards with restrained mint accents. The later compact/flat mockups were explicitly not used as the visual target
- Implementation: `web/index.html`, `web/workbench.css`, `web/shell.mjs` and the generated `dist/visage-workbench.html`
- Intended comparison viewport: 1487 × 1058 CSS pixels, device scale factor 1, light/dark, initial static-example state
- Browser-rendered implementation screenshot: **not available**
- Actual implementation pixel dimensions, CSS viewport, density normalization and full-view / focused-region comparisons: **not performed**; there is no browser screenshot to normalize or compare
- Primary interactions: covered by a minimum DOM event harness against source and offline bundle, not exercised in a real browser
- Browser console check: **not performed**. Node syntax, compilation and event-harness checks are separate evidence

The supported managed preview client (`sites-preview`) is absent from PATH and the provided runtime locations. The preview-route investigation verified that the supported contract prohibits recreating it or substituting direct local servers/ports. No denied localhost/file routes were retried. No deployment was made. Build success, unit tests and simulated DOM events are not a rendered visual pass.

## Findings

- [P1 / verification blocker] Required source-to-rendered comparison cannot be performed
  - Location: whole app in both themes
  - Evidence: source images are readable; there is no supported browser-rendered implementation capture
  - Impact: final pixel proportions, card depth, text wrapping, focus visibility, scrolling and responsive layout cannot be certified
  - Next step: when an authorized supported browser runtime is available, capture both themes and the responsive / interaction states below, compare them with their selected references in the same comparison input, and fix actionable discrepancies

## Required fidelity surfaces

1. Fonts / typography: code uses system-compatible Inter / PingFang / Noto Sans CJK / Microsoft YaHei fallbacks. Intended hierarchy is 21–22px titles, compact 10–13px controls. Actual font fallback, glyph weight, wrapping and density are unverified
2. Spacing / layout rhythm: implementation retains four zones, rounded nested cards, moderate spacing, a large static preview and lower prompt card. Source-level sizing issues in short-height split bounds and 801–832px layout were corrected. Rendered alignment, scroll and elevation are unverified
3. Colors / tokens: separate light porcelain / dark graphite token sets, translucent surfaces, restrained shadow and mint accents. Small light-theme secondary text and focus colors were darkened after static contrast review. Actual composite contrast and surface clarity are unverified
4. Image quality / asset fidelity: actual vendored Feather 4.29.2 icons are used, with MIT license included. The initial portrait reuses the repository’s v0.8 synthetic static image, not a screenshot of the mockup. It is explicitly labeled as not generated from current parameters. This content difference is intentional; final crop and display sharpness are unverified
5. Copy / content: preserves real v0.10 controls and explanatory limits. The initial workspace has one unsaved character and no fabricated versions. The UI does not claim live image generation. Actual truncation, clipping and long-name behavior are unverified

## Source-level review history (not visual-QA iterations)

Independent review identified and implementation corrected:

- Mobile JSON import/export access hidden by CSS → keep the backup controls and expand the workspace when opened
- Mobile collapse action inert → hide the rail and expose an expansion control; move focus to the surviving control
- Short-screen split overflow → clamp against a 180px prompt minimum and derive keyboard / ARIA bounds from available height
- Valid custom text rejected by image-prefix detection → remove content-based filtering; keep structural reference-field rejection
- Workspace validation after app mutation → validate workspace admissibility before changing active state, prompt or undo; regression proves deep malformed import is atomic
- Missing output / dialog accessible names → add heading associations
- Focus lost after replacing character/version buttons → restore the focused control by stable ID
- Isolated core bundle tests requiring unrelated license/CSS files → conditionally read those assets only for actual shell bundles
- Light small-text / focus contrast and 801–832px grid overflow → adjust tokens and move the responsive breakpoint to 850px

No before/after browser images exist, so these source-level fixes do not constitute visual-QA passes.

## Implementation checklist for browser verification

- Capture light and dark at 1487 × 1058, plus 1280 × 800, 850 × 900 and 390 × 844
- Compare the full app and focused inspector / cards / typography regions against selected sources
- Check all schema groups, empty/reference/imported/stale states, long character names, character and saved-version switching
- Exercise repeated tab navigation, help open/close/Escape, collapse/expand, keyboard and pointer divider boundaries, short-screen scrolling
- Exercise actual file selection/cancel/decode errors, native clipboard fallback and local storage save/load/unavailable conditions
- Check browser console and network behavior; offline app should not request external assets or upload references
- Re-capture after each P0/P1/P2 fix; only then set `final result: passed`

## v0.12 incremental verification boundary

The existing layered light/dark shell and divider remain. New subject preset controls,
global/current-tab reroll buttons, language toggle, progressive output menu, context
controls and copy notification lifecycle are covered by source/offline DOM events and
unit tests. Their browser-rendered appearance and actual browser APIs remain unverified.
The earlier blocked/denied preview routes were not retried or replaced.

Additional real-browser checks required:
- Output menu remains reachable above a short prompt panel at every responsive width
- Module checkboxes, keyboard focus, Chinese strings and scope-dependent labels fit
- Global and current-tab buttons remain visually distinct and within the inspector
- Copy status is announced and dismisses, including fast repeated clicks and denial
- Native clipboard, mobile menu scrolling and the persisted old/new JSON migration work
