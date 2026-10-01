# v0.12 stable backup · image-free

This source backup derives from the frozen v0.12 checkpoint `fe604692cc677a7626c4518082069836443adeb6`. It is deliberately different from the complete original release.

## Publication changes

- Omit the synthetic demo PNG at `output/head-v0.8-smoke/complete-head-v0.8-native.png`
- Replace `web/example-image.mjs` with an empty value, without embedded image data
- Start the workbench with an empty preview and hide the unavailable example control; local reference import and removal remain available
- Update the source and offline DOM harness to verify the empty default, no image source, and local-reference behavior
- Clarify this variant in the README, historical workbench guide and image-generation record

All remaining v0.12 source, synthetic profiles, tests, text research records and Feather MIT license are retained. Public source links in research notes remain references, not bundled images. The full original archive is preserved separately. No v0.13 code, repository history, private reference images, or generated `dist/` output is included.

## Local verification

```sh
npm test
npm run build:web
npm run test:ui
```

Open the generated `dist/visage-workbench.html` after building. Unit tests and DOM event checks do not establish browser-rendered layout, native file chooser, storage or clipboard compatibility. Historical test and image-review notes describe their original runs, not new visual validation of this variant.
