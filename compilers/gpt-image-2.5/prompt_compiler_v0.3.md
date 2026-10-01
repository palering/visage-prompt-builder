# Prompt compiler v0.3

The executable compiler accepts Face Schema v0.1 and v0.2. It preserves the target's historical name `gpt-image-2.5`; this is a project label, not a verified API model ID.

## Output contract

- Standalone realistic fictional-person portrait request
- Compact natural-language paragraphs ordered by face geometry, tissue, eyes, eyebrows, nose and mouth
- Supplied structural controls retained, including explicit neutral values, subject to the documented regional-cheek override of global cheek fullness
- Missing controls omitted; no invented oval shape, complexion, hairstyle or makeup
- One final structural-priority sentence
- No raw morphology scores, quality-token padding, section-heading clutter, or claims of reference likeness

The old section-heading format and implicit styling are intentionally replaced. Consumers should treat output as prompt text, not parse headings. Schema semantics, CLI command names, capture preset names and safe file-writing behavior remain supported.

## Presets and optional appearance

- `calibration` (default): neutral expression/pose, minimal makeup, contours visible, fixed light and lens
- `profile`: only supplied capture fields, including explicit angles and image/filter settings
- `none`: no capture paragraph
- `enhancers: true` / `--enhancers`: supplied skin, hair, makeup, expression, overall impression; requires profile or none

Profile capture no longer invents missing camera settings. An absent capture block emits nothing for the profile preset. Angles are physical degrees, not morphology scores; yaw/pitch/roll follow the profile author's consistent coordinate convention. Zero image softness/filter means no softening/filter. Makeup intensity zero means no makeup and overrides makeup descriptors.

Invalid schema versions, numeric controls, section shapes, unknown controls/options and conflicting calibration/enhancer selection fail with a useful error. No implicit coercion or clamping occurs. Fields are validated even when their optional module is not selected.

See [Face Schema v0.2](../../docs/face_schema_spec_v0.2.md) for regional precedence and migration. v0.1 profiles without extensions preserve their axis meanings; prompt formatting and default appearance changed intentionally.


## v0.3 prose revision (package v0.8)

The compiler exports `COMPILER_VERSION = gpt-image-2.5-v0.3`; new sampling/iteration manifests record it beside the compiler dependency hash. Schema v0.1/v0.2 inputs remain supported. Previously saved prompts and manifests are historical artifacts, not byte-for-byte expectations for recompilation using this version.

Neutral values 48–52 stay explicit, using axis-appropriate `moderate`, `medium`, `medium-full`, `gently defined`, `gently rounded`, or existing axis-specific neutral terms. The compiler does not insert absent axes. Fullness avoids stacked `slightly softly`/`moderately softly` modifiers; expression openness uses `eyes` rather than `eye openness`. Brow thickness and density remain separate directions (brows versus brow hair); nasal tip size and shape remain separate.

Appearance formatting skips only a full string value `unspecified` (case-insensitive after trim). It preserves `none`, empty accessory lists, and the complete resolved metadata. Absent/off/selected behavior is unchanged; independent layer combinations are regression tested.
