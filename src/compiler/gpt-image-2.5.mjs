const clamp = (value) => Math.max(0, Math.min(100, Number(value)));

function intensity(value) {
  const v = clamp(value);
  if (v <= 14) return { direction: -1, degree: 'extremely' };
  if (v <= 29) return { direction: -1, degree: 'distinctly' };
  if (v <= 42) return { direction: -1, degree: 'moderately' };
  if (v <= 47) return { direction: -1, degree: 'slightly' };
  if (v <= 52) return { direction: 0, degree: 'balanced' };
  if (v <= 57) return { direction: 1, degree: 'slightly' };
  if (v <= 70) return { direction: 1, degree: 'moderately' };
  if (v <= 85) return { direction: 1, degree: 'distinctly' };
  return { direction: 1, degree: 'extremely' };
}

function axisAdj(value, negative, positive, neutral = 'balanced') {
  const { direction, degree } = intensity(value);
  if (direction === 0) return neutral;
  return `${degree} ${direction < 0 ? negative : positive}`;
}

function words(value = '') {
  return String(value).replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
}

function joinNatural(items) {
  const clean = items.filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean.at(-1)}`;
}

function makeupIntensity(value) {
  const v = clamp(value);
  if (v <= 10) return 'barely visible';
  if (v <= 30) return 'minimal';
  if (v <= 50) return 'light';
  if (v <= 70) return 'moderate';
  if (v <= 85) return 'strong';
  return 'very strong';
}

function buildCapture(presetName, p) {
  if (presetName === 'none') return '';

  if (presetName === 'profile') {
    const c = p.capture ?? {};
    return `Use a ${words(c.view || 'front')} view, ${words(c.camera_height || 'eye level')} camera height, ${words(c.lens_equivalent || '85mm')} lens perspective, ${words(c.camera_distance || 'portrait')} camera distance, ${words(c.lighting || 'soft neutral studio')} lighting, and a ${words(c.background || 'neutral plain')} background.`;
  }

  return `Front-facing head-and-shoulders portrait.
Neutral head position and neutral relaxed expression.
Looking directly at the camera.
Keep the main facial contours clearly visible.
Eye-level camera with an 85mm portrait-lens perspective and no wide-angle distortion.
Soft symmetrical neutral studio lighting on a neutral light-grey background.
Realistic natural skin texture. No beauty filter. No stylized facial proportions.`;
}

export function compileFacePrompt(p, options = {}) {
  const preset = options.preset ?? 'calibration';

  if (p.schema_version !== 'face-v0.1') {
    throw new Error(`Unsupported schema_version: ${p.schema_version ?? 'missing'}. Expected face-v0.1.`);
  }

  const g = p.face_geometry ?? {};
  const s = p.soft_tissue ?? {};
  const e = p.eyes ?? {};
  const b = p.eyebrows ?? {};
  const n = p.nose ?? {};
  const m = p.mouth ?? {};
  const skin = p.skin ?? {};
  const makeup = p.makeup ?? {};
  const hair = p.hair ?? {};
  const expression = p.expression ?? {};
  const subject = p.subject ?? {};

  const impressions = Array.isArray(subject.overall_impression) && subject.overall_impression.length
    ? ` Overall facial impression: ${subject.overall_impression.map(words).join(', ')}.`
    : '';

  const intro = `Create a realistic portrait of one ${words(subject.age_group || 'adult')} fictional ${words(subject.gender_presentation || 'person')}.${impressions}`;

  const faceGeometry = [
    `The face has an overall ${words(g.face_shape || 'oval')} shape, with ${axisAdj(g.face_length ?? 50, 'short', 'long')} facial length and ${axisAdj(g.face_width ?? 50, 'narrow', 'wide')} facial width.`,
    `The forehead is ${axisAdj(g.forehead_width ?? 50, 'narrow', 'broad')} in width and ${axisAdj(g.forehead_height ?? 50, 'low', 'tall')} in height.`,
    `The cheekbones are ${axisAdj(g.cheekbone_width ?? 50, 'narrow', 'broad')} in width and ${axisAdj(g.cheekbone_height ?? 50, 'low-set', 'high-set', 'balanced in height')}.`,
    `The jaw is ${axisAdj(g.jaw_width ?? 50, 'narrow', 'wide')} with ${axisAdj(g.jaw_angle ?? 50, 'soft and rounded', 'angular and defined', 'balanced')} jaw angles.`,
    `The chin is ${axisAdj(g.chin_width ?? 50, 'narrow', 'broad')} in width and ${axisAdj(g.chin_length ?? 50, 'short', 'long')} in length, with ${axisAdj(g.chin_projection ?? 50, 'recessed', 'projected')} forward projection.`
  ].join('\n');

  const eyes = [
    `The eyes are ${axisAdj(e.eye_size ?? 50, 'small', 'large')} in size, ${axisAdj(e.eye_length ?? 50, 'short', 'long')} horizontally, and ${axisAdj(e.eye_roundness ?? 50, 'narrow', 'round')} in shape.`,
    `Eye spacing is ${axisAdj(e.eye_spacing ?? 50, 'close-set', 'wide-set')}, with ${axisAdj(e.eye_tilt ?? 50, 'downturned', 'upturned', 'level')} outer corners.`,
    `The eye sockets are ${axisAdj(e.eye_socket_depth ?? 50, 'shallow', 'deep')} in depth.`,
    e.upper_eyelid ? `The upper eyelids are ${words(e.upper_eyelid)}.` : '',
    e.lower_eyelid_shape ? `The lower eyelids are ${words(e.lower_eyelid_shape)}.` : ''
  ].filter(Boolean).join('\n');

  const brows = [
    `The eyebrows are ${axisAdj(b.brow_thickness ?? 50, 'thin', 'thick')}, ${axisAdj(b.brow_height ?? 50, 'low-set', 'high-set', 'balanced in placement')}, and ${axisAdj(b.brow_arch ?? 50, 'straight', 'arched', 'gently curved')}.`,
    `They are ${axisAdj(b.brow_length ?? 50, 'short', 'long')} with ${axisAdj(b.brow_density ?? 50, 'sparse', 'dense')} density.`
  ].join('\n');

  const nose = [
    `The nose has a ${axisAdj(n.bridge_height ?? 50, 'low', 'high')} bridge with ${axisAdj(n.bridge_width ?? 50, 'narrow', 'broad')} bridge width.`,
    `The nose is ${axisAdj(n.nose_length ?? 50, 'short', 'long')} with ${axisAdj(n.nose_projection ?? 50, 'subtle', 'prominent')} projection.`,
    `The nasal tip is ${axisAdj(n.tip_size ?? 50, 'small', 'large')}, ${axisAdj(n.tip_roundness ?? 50, 'defined', 'rounded')}, and ${axisAdj(n.tip_rotation ?? 50, 'downturned', 'upturned', 'neutral')} in rotation.`,
    `The alar base is ${axisAdj(n.alar_width ?? 50, 'narrow', 'broad')}, with ${axisAdj(n.nostril_visibility ?? 50, 'low', 'high')} nostril visibility.`
  ].join('\n');

  const mouth = [
    `The mouth is ${axisAdj(m.mouth_width ?? 50, 'narrow', 'wide')} in width.`,
    `The upper lip is ${axisAdj(m.upper_lip_fullness ?? 50, 'thin', 'full')}, while the lower lip is ${axisAdj(m.lower_lip_fullness ?? 50, 'thin', 'full')}.`,
    `The cupid's bow is ${axisAdj(m.cupid_bow_definition ?? 50, 'softly defined', 'strongly defined', 'moderately defined')}.`,
    `The mouth corners are ${axisAdj(m.mouth_corner_direction ?? 50, 'downturned', 'upturned', 'neutral')}, with a ${axisAdj(m.philtrum_length ?? 50, 'short', 'long')} philtrum.`
  ].join('\n');

  const softTissue = [
    `The cheeks are ${axisAdj(s.cheek_fullness ?? 50, 'lean', 'full')} in soft-tissue volume.`,
    `The midface is ${axisAdj(s.midface_length ?? 50, 'short', 'long')} in vertical proportion.`,
    `The under-eye area is ${axisAdj(s.under_eye_volume ?? 50, 'hollow', 'softly full')} in volume.`,
    `The nasolabial region is ${axisAdj(s.nasolabial_definition ?? 50, 'soft', 'pronounced', 'subtle')} in definition.`,
    `Overall facial soft tissue is ${axisAdj(s.facial_softness ?? 50, 'lean and defined', 'soft and rounded')}, with ${axisAdj(s.temple_fullness ?? 50, 'hollow', 'full')} temple volume.`
  ].join('\n');

  const skinText = `Skin tone is ${words(skin.tone || 'neutral')}, with ${words(skin.texture || 'natural')} texture, ${axisAdj(skin.translucency ?? 50, 'low', 'high')} translucency, ${axisAdj(skin.blemish_visibility ?? 50, 'low', 'high')} visible skin variation, and ${axisAdj(skin.freckle_visibility ?? 0, 'minimal', 'prominent')} freckling.`;

  const makeupItems = [
    makeup.base && words(makeup.base),
    makeup.eyeliner && `${words(makeup.eyeliner)} eyeliner`,
    makeup.eyeshadow && `${words(makeup.eyeshadow)} eyeshadow`,
    makeup.lashes && `${words(makeup.lashes)} lashes`,
    makeup.blush && `${words(makeup.blush)} blush`,
    makeup.lip_style && `${words(makeup.lip_style)} lip styling`,
    makeup.lip_color && `${words(makeup.lip_color)} lip color`
  ].filter(Boolean);
  const makeupText = `${makeupIntensity(makeup.intensity ?? 0)} makeup: ${joinNatural(makeupItems)}.`;

  const hairText = `Hair is ${words(hair.color || 'natural')} and ${words(hair.length || 'medium')} length, with ${words(hair.texture || 'natural')} texture, ${axisAdj(hair.volume ?? 50, 'low', 'high')} volume, a ${words(hair.parting || 'natural')} parting, and ${words(hair.face_framing || 'natural')} face-framing strands.`;

  const expressionText = `Expression is ${words(expression.expression || 'neutral')}, with ${axisAdj(expression.eye_openness ?? 50, 'relaxed', 'open', 'natural')} eye openness and a ${axisAdj(expression.mouth_relaxation ?? 50, 'tense', 'relaxed', 'natural relaxed')} mouth posture.`;

  const capture = buildCapture(preset, p);

  return [
    intro,
    `FACIAL STRUCTURE\n${faceGeometry}`,
    `EYES AND EYEBROWS\n${eyes}\n${brows}`,
    `NOSE\n${nose}`,
    `MOUTH\n${mouth}`,
    `FACIAL SOFT TISSUE\n${softTissue}`,
    `SKIN\n${skinText}`,
    `MAKEUP\n${makeupText}`,
    `HAIR\n${hairText}`,
    `EXPRESSION\n${expressionText}`,
    capture ? `CAPTURE\n${capture}` : '',
    `PRIORITY\nFacial geometry and feature proportions are the highest priority.\nMaintain realistic human anatomy.\nKeep all facial features mutually proportional and naturally integrated.\nDo not exaggerate individual features unless explicitly specified.`
  ].filter(Boolean).join('\n\n');
}
