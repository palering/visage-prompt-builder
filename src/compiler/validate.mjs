import fs from 'node:fs';

// The template defines supported v0.1 controls, not values to fill into a profile.
const template = JSON.parse(fs.readFileSync(new URL('../../schemas/face_schema_v0.1.json', import.meta.url), 'utf8'));
const regionalFields = {
  subject: { appearance: '' },
  face_geometry: { cheek_to_chin_contour: '' },
  soft_tissue: { upper_medial_cheek_fullness: 50, lateral_cheek_fullness: 50 }
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.replaceAll('_', ' ').trim().length > 0;
const metadataKeys = new Set(['baseline_id', 'source', 'metadata', 'observation', 'confidence', 'analysis_metadata']);
const fail = (path, expected) => { throw new Error(`${path} must be ${expected}.`); };

export function validateProfile(profile) {
  if (!isObject(profile)) fail('Profile', 'an object');
  if (!['face-v0.1', 'face-v0.2'].includes(profile.schema_version)) throw new Error(`Unsupported schema_version: ${profile.schema_version ?? 'missing'}. Expected face-v0.1 or face-v0.2.`);
  // Recognized metadata is allowed but never compiled; typos must not silently erase anatomy.
  for (const key of Object.keys(profile)) {
    if (!Object.hasOwn(template, key) && !metadataKeys.has(key)) throw new Error(`Unknown profile field: ${key}.`);
  }
  for (const [section, originalFields] of Object.entries(template)) {
    const fields = { ...originalFields, ...(profile.schema_version === 'face-v0.2' ? regionalFields[section] : {}) };
    if (section === 'schema_version' || profile[section] === undefined) continue;
    const values = profile[section];
    if (!isObject(values)) fail(section, 'an object');
    for (const [key, value] of Object.entries(values)) {
      const path = `${section}.${key}`;
      if (!Object.hasOwn(fields, key)) throw new Error(`Unknown control: ${path}.`);
      if (key === 'appearance' && (!hasText(value) || value.length > 200)) fail(path, 'a non-empty string of at most 200 characters');
      if (key === 'cheek_to_chin_contour' && !['smooth_taper', 'angular_taper', 'near_parallel'].includes(value)) {
        fail(path, 'smooth_taper, angular_taper, or near_parallel');
      }
      if (Array.isArray(fields[key])) {
        if (!Array.isArray(value) || value.some((item) => !hasText(item))) fail(path, 'an array of non-empty strings');
      } else if (typeof fields[key] === 'number') {
        const angle = section === 'capture' && ['head_yaw', 'head_pitch', 'head_roll'].includes(key);
        const min = angle ? -180 : 0;
        const max = angle ? 180 : 100;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `a finite number from ${min} to ${max}`);
      } else if (!hasText(value)) {
        fail(path, 'a non-empty string');
      }
    }
  }
}
