# Face Schema v0.1 Specification

## Purpose

Face Schema is the model-neutral representation of facial structure used by Visage Prompt Builder.

The schema should describe **what the face is like**, while a model-specific compiler describes **how to express those properties to an image model**.

## Design principles

1. Separate facial structure from rendering style.
2. Separate inferred Face DNA from photographic observation.
3. Use 0–100 values for genuinely continuous controls.
4. Use categorical values where a numeric axis would be artificial.
5. Do not send raw 0–100 values directly to an image model.
6. Keep capture, lighting, makeup, and hair distinct from bone structure and facial morphology.
7. Calibrate against model behavior instead of assuming every nominally independent parameter is independently controllable.

## Continuous controls

For continuous morphology controls:

```text
0 ---------------- 50 ---------------- 100
negative direction    balanced            positive direction
```

Examples:

- `face_width`: narrow ↔ wide
- `eye_size`: small ↔ large
- `jaw_angle`: soft/rounded ↔ angular
- `alar_width`: narrow ↔ broad

## Semantic mapping

The compiler converts values into natural language. A first-pass mapping can use intensity bands:

| Value | Mapping |
| ---: | --- |
| 0–14 | extremely + negative direction |
| 15–29 | distinctly + negative direction |
| 30–42 | moderately + negative direction |
| 43–47 | slightly + negative direction |
| 48–52 | balanced |
| 53–57 | slightly + positive direction |
| 58–70 | moderately + positive direction |
| 71–85 | distinctly + positive direction |
| 86–100 | extremely + positive direction |

Examples:

- `face_width = 34` → `moderately narrow face`
- `eye_size = 61` → `moderately large eyes`
- `bridge_width = 34` → `moderately narrow nasal bridge`

These thresholds are provisional. Each axis can later receive model-specific calibration curves.

## Observation Layer

A reference image is not Face DNA. It is an observation affected by pose, lens, light, makeup, hair, expression, filtering, and occlusion.

Suggested observation metadata:

```json
{
  "face_visibility": 0.86,
  "pose_quality": 0.72,
  "lighting_quality": 0.81,
  "lens_distortion_risk": 0.38,
  "beauty_filter_risk": 0.71,
  "hair_occlusion": 0.42
}
```

Parameter confidence can be stored separately from Face DNA:

```json
{
  "jaw_width": {
    "value": 34,
    "confidence": 0.91
  }
}
```

The primary profile should remain compact. Confidence and observation data belong in analysis metadata.

## Architecture

```text
Reference Image
      ↓
Observation Layer
      ↓
Face Schema / Face DNA
      ↓
Model-specific Prompt Compiler
      ↓
Render / Calibration Preset
```

Future model support should normally add a compiler rather than redesigning the schema.
