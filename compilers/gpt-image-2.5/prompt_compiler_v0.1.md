# GPT Image 2.5 Prompt Compiler v0.1

This document defines the first prompt-compilation target for Face Schema v0.1.

## Full Face Prompt

```text
Create a realistic portrait of one adult fictional character.

FACIAL STRUCTURE
{face_geometry_prompt}

EYES AND EYEBROWS
{eyes_prompt}
{eyebrows_prompt}

NOSE
{nose_prompt}

MOUTH
{mouth_prompt}

FACIAL SOFT TISSUE
{soft_tissue_prompt}

SKIN
{skin_prompt}

MAKEUP
{makeup_prompt}

HAIR
{hair_prompt}

EXPRESSION
{expression_prompt}

CAPTURE
{capture_prompt}

PRIORITY
Facial geometry and feature proportions are the highest priority.
Maintain realistic human anatomy.
Keep all facial features mutually proportional and naturally integrated.
Do not exaggerate individual features unless explicitly specified.
```

## Face Calibration Preset v0.1

Use this preset when comparing Face DNA variations.

```text
Front-facing head-and-shoulders portrait.
Neutral head position.
Looking directly at the camera.
Neutral relaxed expression.

Hair kept away from the main facial contours.
Minimal makeup.
No jewelry or facial accessories.

Eye-level camera.
85mm portrait-lens perspective.
No wide-angle distortion.

Soft symmetrical neutral studio lighting.
Neutral light-grey background.

Realistic natural skin texture.
No beauty filter.
No stylized facial proportions.
```

## Delta Prompt

Use the Delta Prompt for a localized edit while preserving identity and unrelated features.

```text
Keep the same character identity and preserve all existing facial features.

Only modify {target_feature}:

{delta_description}

Keep the current {preserved_features} unchanged.

The change should look anatomically natural and proportionally integrated with the rest of the face.
```

Example:

```text
Keep the same character identity and preserve all existing facial features.

Only modify the jaw:

Make the jaw moderately wider while keeping the chin, cheekbones, eyes,
nose, mouth, hairstyle, expression, skin, camera angle, lighting and
image composition unchanged.

The change should look anatomically natural and proportionally integrated with the rest of the face.
```

## Compiler rule

Do not compile numerical Face Schema values into literal percentages or scores for the image model.

Prefer concise semantic phrases such as:

- `moderately narrow jaw`
- `slightly high cheekbones`
- `balanced eye spacing`
- `moderately large almond-round eyes`

Avoid quality-token clutter such as `masterpiece`, `8K`, `award winning`, or similar terms when the goal is morphology calibration.
