import { validateProfile } from './validate.mjs';
import { resolveAppearance } from '../appearance/modules.mjs';
import { resolveBody } from '../body/body.mjs';

export const COMPILER_VERSION = 'gpt-image-2.5-v0.3';

const words = (value) => value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const sentence = (parts) => parts.filter(Boolean).join('; ') + '.';

function adjective(value, negative, positive, neutral = 'moderate') {
  if (value <= 14) return `extremely ${negative}`;
  if (value <= 29) return `distinctly ${negative}`;
  if (value <= 42) return `moderately ${negative}`;
  if (value <= 47) return `slightly ${negative}`;
  if (value <= 52) return neutral;
  if (value <= 57) return `slightly ${positive}`;
  if (value <= 70) return `moderately ${positive}`;
  if (value <= 85) return `distinctly ${positive}`;
  return `extremely ${positive}`;
}

// Each axis retains its own meaning. Size, horizontal length, aperture and socket
// depth are deliberately not collapsed into one eye-size or "almond" label.
const axes = {
  face_geometry: {
    face_length: ['facial length', 'short', 'long'],
    face_width: ['facial width', 'narrow', 'wide'],
    forehead_width: ['forehead width', 'narrow', 'broad'],
    forehead_height: ['forehead height', 'low', 'tall'],
    cheekbone_width: ['cheekbone width', 'narrow', 'broad'],
    cheekbone_height: ['cheekbone placement', 'low-set', 'high-set'],
    jaw_width: ['jaw width', 'narrow', 'wide'],
    jaw_angle: ['jaw angles', 'soft and rounded', 'angular and defined', 'gently defined'],
    chin_width: ['chin width', 'narrow', 'broad'],
    chin_length: ['chin length', 'short', 'long'],
    chin_projection: ['chin projection', 'recessed', 'projected']
  },
  soft_tissue: {
    upper_medial_cheek_fullness: ['upper-medial cheek volume', 'lean', 'full', 'moderate'],
    lateral_cheek_fullness: ['lateral cheek volume', 'restrained', 'full', 'moderate'],
    cheek_fullness: ['cheek volume', 'lean', 'full'],
    midface_length: ['midface length', 'short', 'long'],
    under_eye_volume: ['under-eye volume', 'hollow', 'full'],
    nasolabial_definition: ['nasolabial definition', 'soft', 'pronounced', 'subtle'],
    facial_softness: ['facial soft tissue', 'lean and defined', 'soft and rounded'],
    temple_fullness: ['temple volume', 'hollow', 'full']
  },
  eyes: {
    eye_size: ['eye size', 'small', 'large', 'medium'],
    eye_length: ['horizontal eye length', 'short', 'long'],
    eye_roundness: ['eye aperture', 'narrow', 'round'],
    eye_spacing: ['eye spacing', 'close-set', 'wide-set'],
    eye_tilt: ['outer eye corners', 'downturned', 'upturned', 'level'],
    eye_socket_depth: ['eye sockets', 'shallow', 'deep']
  },
  eyebrows: {
    brow_thickness: ['brows', 'thin', 'thick', 'medium-thickness'],
    brow_height: ['brow placement', 'low-set', 'high-set'],
    brow_arch: ['brow shape', 'straight', 'arched', 'gently curved'],
    brow_length: ['brow length', 'short', 'long'],
    brow_density: ['brow hair', 'sparse', 'dense', 'medium-density']
  },
  nose: {
    bridge_height: ['nasal bridge height', 'low', 'high'],
    bridge_width: ['nasal bridge width', 'narrow', 'broad'],
    nose_length: ['nose length', 'short', 'long'],
    nose_projection: ['nose projection', 'subtle', 'prominent'],
    tip_size: ['nasal tip', 'small', 'large', 'medium-sized'],
    tip_roundness: ['nasal tip shape', 'defined', 'rounded', 'gently rounded'],
    tip_rotation: ['nasal tip rotation', 'downturned', 'upturned', 'neutral'],
    alar_width: ['alar width', 'narrow', 'broad'],
    nostril_visibility: ['nostril visibility', 'low', 'high']
  },
  mouth: {
    mouth_width: ['mouth width', 'narrow', 'wide'],
    upper_lip_fullness: ['upper lip', 'thin', 'full', 'medium-full'],
    lower_lip_fullness: ['lower lip', 'thin', 'full', 'medium-full'],
    cupid_bow_definition: ["cupid's bow", 'soft-edged', 'strongly defined', 'moderately defined'],
    mouth_corner_direction: ['mouth corners', 'downturned', 'upturned', 'neutral'],
    philtrum_length: ['philtrum length', 'short', 'long']
  },
  skin: {
    translucency: ['skin translucency', 'low', 'high'],
    blemish_visibility: ['visible skin variation', 'low', 'high'],
    freckle_visibility: ['freckling', 'minimal', 'prominent']
  },
  hair: { volume: ['hair volume', 'low', 'high'] },
  expression: {
    eye_openness: ['eyes', 'relaxed', 'open', 'naturally open'],
    mouth_relaxation: ['mouth posture', 'tense', 'relaxed', 'naturally relaxed']
  }
};

function axisPhrases(section, values = {}) {
  const regional = section === 'soft_tissue' && (values.upper_medial_cheek_fullness !== undefined || values.lateral_cheek_fullness !== undefined);
  return Object.entries(axes[section]).filter(([key]) => !(regional && key === 'cheek_fullness')).flatMap(([key, [noun, low, high, neutral]]) =>
    values[key] === undefined ? [] : [`${adjective(values[key], low, high, neutral)} ${noun}`]);
}

// UI descriptions use the very same adjective mapping as final compilation.
export function describeFaceValue(section, key, value) {
  if (!Object.hasOwn(axes, section) || !Object.hasOwn(axes[section], key) || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('Invalid face axis/value.');
  return axisPhrases(section, { [key]: value })[0];
}

function textPhrases(values, fields) {
  return Object.entries(fields).flatMap(([key, label]) =>
    values?.[key] === undefined ? [] : [`${words(values[key])} ${label}`.trim()]);
}

function capture(preset, c = {}) {
  if (preset === 'none') return '';
  if (preset === 'calibration') {
    return 'Front-facing head-and-shoulders portrait, neutral head position and relaxed neutral expression, looking at the camera. Hair clear of facial contours, minimal makeup, no jewelry. Eye-level 85mm perspective, soft symmetrical neutral studio lighting, plain light-grey background. Natural skin texture, no beauty filter or stylized proportions.';
  }
  const parts = textPhrases(c, {
    view: 'view', camera_height: 'camera height', lens_equivalent: 'lens perspective',
    camera_distance: 'camera distance', lighting: 'lighting', background: 'background'
  });
  for (const key of ['head_yaw', 'head_pitch', 'head_roll']) {
    if (c[key] !== undefined) parts.push(`${words(key)} ${c[key]} degrees`);
  }
  if (c.image_softness !== undefined) parts.push(c.image_softness === 0 ? 'no image softening' : `${adjective(c.image_softness, 'low', 'high')} image softness`);
  if (c.beauty_filter_strength !== undefined) parts.push(c.beauty_filter_strength === 0 ? 'no beauty filter' : `${adjective(c.beauty_filter_strength, 'low', 'high')} beauty-filter strength`);
  return parts.length ? `Capture: ${sentence(parts)}` : '';
}

function styling(p, appearance) {
  p = structuredClone(p);
  for (const key of ['hair','makeup','expression']) if (appearance?.[key]) delete p[key];
  const parts = [];
  if (p.subject?.overall_impression?.length) parts.push(`Overall impression: ${[...new Set(p.subject.overall_impression.map(words))].join(', ')}.`);
  const skin = [...textPhrases(p.skin, { tone: 'skin tone', texture: 'skin texture' }), ...axisPhrases('skin', p.skin)];
  if (skin.length) parts.push(sentence(skin));
  const hair = [...textPhrases(p.hair, { color: 'hair', length: 'hair length', texture: 'hair texture', parting: 'parting', face_framing: 'face framing' }), ...axisPhrases('hair', p.hair)];
  if (hair.length) parts.push(sentence(hair));
  const m = p.makeup ?? {};
  if (m.intensity === 0) {
    parts.push('No makeup.');
  } else {
    const details = textPhrases(m, { base: 'base', eyeliner: 'eyeliner', eyeshadow: 'eyeshadow', lashes: 'lashes', blush: 'blush', lip_style: 'lip styling', lip_color: 'lip color' });
    const level = m.intensity === undefined ? '' : m.intensity <= 10 ? 'Barely visible' : m.intensity <= 30 ? 'Minimal' : m.intensity <= 50 ? 'Light' : m.intensity <= 70 ? 'Moderate' : m.intensity <= 85 ? 'Strong' : 'Very strong';
    if (level || details.length) parts.push(`${level ? `${level} makeup` : 'Makeup'}${details.length ? `: ${details.join(', ')}` : ''}.`);
  }
  const expression = [...textPhrases(p.expression, { expression: 'expression' }), ...axisPhrases('expression', p.expression)];
  if (expression.length) parts.push(sentence(expression));
  return parts.join(' ');
}

export function compileFacePrompt(p, options = {}) {
  validateProfile(p);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Compiler options must be an object.');
  for (const key of Object.keys(options)) if (!['preset', 'enhancers', 'appearance', 'body', 'capture'].includes(key)) throw new Error(`Unknown compiler option: ${key}.`);
  const preset = options.preset ?? 'calibration';
  if (!['calibration', 'profile', 'none'].includes(preset)) throw new Error(`Unknown preset: ${preset}. Expected calibration, profile, or none.`);
  if (options.enhancers !== undefined && typeof options.enhancers !== 'boolean') throw new Error('enhancers must be a boolean.');
  if (options.enhancers && preset === 'calibration') throw new Error('Profile enhancers conflict with calibration. Use preset profile or none with enhancers.');

  if (options.capture !== undefined && !['head','full_body'].includes(options.capture)) throw new Error('Capture must be head or full_body.');
  const body = resolveBody(options.body, {profile:p, capture:options.capture ?? 'full_body'});
  const fullBody = options.capture === 'full_body' || (body.active && options.capture === undefined);
  if (fullBody && p.subject?.age_group !== 'adult') throw new Error('Full-body capture requires subject.age_group to be adult.');
  const modules = resolveAppearance(options.appearance, {preset, enhancers: options.enhancers, profile:p});
  const subject = p.subject ?? {};
  const identity = [(options.appearance?.apparentAge?.state === 'selected' ? `adult, approximately ${options.appearance.apparentAge.years} years old,` : options.appearance?.apparentAge?.state === 'off' ? 'adult' : words(subject.age_group ?? 'adult')), 'fictional', words(subject.gender_presentation ?? 'person')].join(' ');
  const appearance = subject.appearance ? ` with ${words(subject.appearance)}` : '';
  const paragraphs = [`Create a realistic portrait of one ${identity}${appearance}.`];
  for (const section of ['face_geometry', 'soft_tissue', 'eyes', 'eyebrows', 'nose', 'mouth']) {
    const parts = axisPhrases(section, p[section]);
    if (section === 'face_geometry' && p[section]?.face_shape !== undefined) parts.unshift(`${words(p[section].face_shape)} face shape`);
    if (section === 'face_geometry' && p[section]?.cheek_to_chin_contour) {
      parts.push({
        smooth_taper: 'a continuous smooth contour tapering from the cheeks through the jaw to the chin',
        angular_taper: 'an angular contour tapering from the cheeks through the jaw to the chin',
        near_parallel: 'nearly parallel lateral contours from the cheeks to the jaw'
      }[p[section].cheek_to_chin_contour]);
    }
    if (section === 'eyes') parts.push(...textPhrases(p.eyes, { upper_eyelid: 'upper eyelids', lower_eyelid_shape: 'lower eyelids' }));
    if (parts.length) {
      const text = sentence(parts);
      paragraphs.push(text[0].toUpperCase() + text.slice(1));
    }
  }
  if (options.enhancers) {
    const enhanced = styling(p, options.appearance);
    if (enhanced) paragraphs.push(enhanced);
  }
  paragraphs.push(...modules.paragraphs);
  paragraphs.push(...body.paragraphs);
  const setup = fullBody ? 'Full-body view, entire adult figure visible from head to feet, neutral eye-level perspective, relaxed standing pose. Plain opaque everyday clothing, no clothing style catalog. Soft neutral studio lighting, plain neutral background. Natural proportions and skin texture, no beauty filter.' : options.capture === 'head' ? 'Head-and-shoulders portrait, eye-level perspective, soft neutral studio lighting, plain neutral background. Natural proportions and skin texture, no beauty filter.' : capture(preset, p.capture);
  if (setup) paragraphs.push(setup);
  paragraphs.push(fullBody ? 'Preserve the specified facial and body proportions; keep the adult anatomy realistic and naturally integrated.' : 'Prioritize facial structure and feature proportions; keep the anatomy realistic and naturally integrated.');
  return paragraphs.join('\n\n');
}
