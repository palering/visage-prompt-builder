# Face Schema v0.2: optional regional structure

Version 0.2 is a small, explicit extension of [v0.1](face_schema_spec_v0.1.md), not a calibrated likeness model. All v0.1 controls keep their meanings. Existing `face-v0.1` profiles remain supported; none are automatically migrated.

The compiler target name `gpt-image-2.5` is a project label, not a verified provider API model identifier. This tool creates text only.

## Missing versus neutral

Omit controls you do not know. The compiler does not fill missing morphology with template defaults. A supplied `50` is an intentional neutral control and is emitted. A supplied `0` is a valid endpoint. Numbers must be finite numbers within 0–100, not numeric strings; invalid fields fail before output is written. Capture angles instead accept −180 through 180 degrees. Text controls must be nonempty strings.

The sparse `schemas/face_schema_v0.2.json` is a starting profile, not a JSON Schema validator. Validation lives in `src/compiler/validate.mjs`. Top-level metadata is allowed under `baseline_id`, `source`, `metadata`, `observation`, `confidence`, and `analysis_metadata` and ignored in output; other top-level fields are rejected. unknown controls within recognized sections are rejected, including misspellings. Null sections are rejected; omit them instead.

## Optional subject appearance

`subject.appearance` is an optional user-authored, model-neutral semantic cue of at most 200 characters, for example `"East Asian appearance"`. It is retained in the subject introduction even when enhancers are off. It is not inferred from images or geometry and is not a measurable anatomy parameter or a guarantee of identity/likeness. No ancestry, ethnicity or appearance default is supplied. Existing age and gender presentation remain unchanged.

## Three additional structural controls

| Control | Type | Meaning |
| --- | --- | --- |
| `soft_tissue.upper_medial_cheek_fullness` | 0–100 | Lean ↔ softly full volume in the upper, inner cheek, distinct from the immediate under-eye region |
| `soft_tissue.lateral_cheek_fullness` | 0–100 | Restrained ↔ full soft-tissue volume at the lateral cheek; not cheekbone width |
| `face_geometry.cheek_to_chin_contour` | enum | Overall contour trajectory, separately from local jaw angle and chin size |

A regional value of 50 means moderate volume. If **either** regional volume is present, the legacy global `cheek_fullness` phrase is suppressed. If only one is supplied, the other region remains unspecified. This partial override is deliberate: a global fullness instruction could contradict the regional one. Other soft-tissue controls remain active.

Contour enum:

- `smooth_taper`: a continuous smooth contour tapering from cheeks through jaw to chin
- `angular_taper`: an angular contour tapering from cheeks through jaw to chin
- `near_parallel`: nearly parallel lateral contours from cheeks to jaw

These describe trajectory, not the rate of narrowing, taper magnitude, tissue softness, chin size, or projection. They do not infer a small, pointed chin. `jaw_angle`, `chin_width`, and `chin_length` stay independent. Choose values that make sense together; this compiler is not an anatomical constraint solver.

Existing `eyes.eye_length`, `eye_size`, `eye_roundness`, and `eye_socket_depth` independently describe horizontal length, overall size, opening shape, and socket depth. A horizontally long eye does not automatically become large or deeply set. No new eye-size axis is needed. The numeric scales are semantic controls, not measured ratios; do not compare cheek, jaw, and chin numbers as physical widths.

## Explicit migration

1. Keep a copy of the original profile
2. Change only `schema_version` from `face-v0.1` to `face-v0.2`
3. Optionally add the regional/contour controls below
4. Review the resulting prompt before generation

Changing only the version produces exactly the same prompt. Adding v0.2 controls to a v0.1 profile is an error.

Synthetic example:

```json
{
  "schema_version": "face-v0.2",
  "subject": { "age_group": "adult", "gender_presentation": "person" },
  "face_geometry": { "cheek_to_chin_contour": "near_parallel" },
  "soft_tissue": {
    "upper_medial_cheek_fullness": 40,
    "lateral_cheek_fullness": 65
  },
  "eyes": { "eye_size": 50, "eye_length": 65, "eye_roundness": 40 }
}
```

Run the complete public-safe example:

```sh
node src/cli.mjs baselines/example_synthetic_regional_001.json
```

## Styling is optional

The default compiles supplied subject age/presentation and morphology. Skin tone/texture, hair, makeup, expression and overall impression are optional profile styling selected with `--enhancers`; these do not modify structural clauses. This placement is an explicit compiler choice, not a claim that complexion is merely cosmetic. Include enhancers when complexion or other appearance context is necessary for your output.

Use `--preset profile --enhancers` to include that appearance and the supplied capture settings, or `--preset none --enhancers` for appearance without camera instructions. `none` controls only capture. `calibration` supplies standardized neutral expression, minimal makeup and natural skin; combining it with profile enhancers is rejected to avoid contradictions. No styling or ethnicity is inferred from anatomy.

These controls have text-level regression coverage. Their independent effects on generated images have not yet been established experimentally.
