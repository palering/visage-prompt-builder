export const BODY_VERSION = 'body-v0.1';
// Bounded artistic descriptors, not measured anatomy, BMI, health or training outcomes.
export const BODY_AXES = {
  "shoulder_span": {
    "group": "frame",
    "label": "肩架宽度",
    "low": "narrow shoulder frame",
    "mid": "medium-width shoulder frame",
    "high": "broad shoulder frame",
    "description": "0–33：narrow shoulder frame；34–66：medium-width shoulder frame；67–100：broad shoulder frame"
  },
  "ribcage_breadth": {
    "group": "frame",
    "label": "胸廓宽度",
    "low": "narrow rib cage",
    "mid": "medium-width rib cage",
    "high": "broad rib cage",
    "description": "0–33：narrow rib cage；34–66：medium-width rib cage；67–100：broad rib cage"
  },
  "pelvic_span": {
    "group": "frame",
    "label": "骨盆宽度",
    "low": "narrow pelvic frame",
    "mid": "medium-width pelvic frame",
    "high": "broad pelvic frame",
    "description": "0–33：narrow pelvic frame；34–66：medium-width pelvic frame；67–100：broad pelvic frame"
  },
  "leg_length": {
    "group": "frame",
    "label": "腿长比例",
    "low": "relatively short legs",
    "mid": "medium-length legs relative to the torso",
    "high": "relatively long legs",
    "description": "0–33：relatively short legs；34–66：medium-length legs relative to the torso；67–100：relatively long legs"
  },
  "arm_length": {
    "group": "frame",
    "label": "臂长比例",
    "low": "relatively short arms",
    "mid": "medium-length arms relative to the torso",
    "high": "relatively long arms",
    "description": "0–33：relatively short arms；34–66：medium-length arms relative to the torso；67–100：relatively long arms"
  },
  "deltoid_volume": {
    "group": "muscle",
    "label": "肩部肌量",
    "low": "small deltoid volume",
    "mid": "moderate deltoid volume",
    "high": "full deltoid volume",
    "description": "0–33：small deltoid volume；34–66：moderate deltoid volume；67–100：full deltoid volume"
  },
  "pectoral_volume": {
    "group": "muscle",
    "label": "胸肌厚度",
    "low": "slight pectoral volume",
    "mid": "moderate pectoral volume",
    "high": "substantial pectoral volume",
    "description": "0–33：slight pectoral volume；34–66：moderate pectoral volume；67–100：substantial pectoral volume"
  },
  "lat_breadth": {
    "group": "muscle",
    "label": "背部肌宽",
    "low": "modest lateral back-muscle breadth",
    "mid": "moderate lateral back-muscle breadth",
    "high": "broad latissimus contours",
    "description": "0–33：modest lateral back-muscle breadth；34–66：moderate lateral back-muscle breadth；67–100：broad latissimus contours"
  },
  "upper_arm_volume": {
    "group": "muscle",
    "label": "上臂肌量",
    "low": "slight upper-arm muscle volume",
    "mid": "moderate upper-arm muscle volume",
    "high": "substantial upper-arm muscle volume",
    "description": "0–33：slight upper-arm muscle volume；34–66：moderate upper-arm muscle volume；67–100：substantial upper-arm muscle volume"
  },
  "thigh_volume": {
    "group": "muscle",
    "label": "大腿肌量",
    "low": "slight thigh muscle volume",
    "mid": "moderate thigh muscle volume",
    "high": "substantial thigh muscle volume",
    "description": "0–33：slight thigh muscle volume；34–66：moderate thigh muscle volume；67–100：substantial thigh muscle volume"
  },
  "calf_volume": {
    "group": "muscle",
    "label": "小腿肌量",
    "low": "slight calf muscle volume",
    "mid": "moderate calf muscle volume",
    "high": "substantial calf muscle volume",
    "description": "0–33：slight calf muscle volume；34–66：moderate calf muscle volume；67–100：substantial calf muscle volume"
  },
  "gluteal_volume": {
    "group": "muscle",
    "label": "臀肌体量",
    "low": "slight gluteal muscle volume",
    "mid": "moderate gluteal muscle volume",
    "high": "substantial gluteal muscle volume",
    "description": "0–33：slight gluteal muscle volume；34–66：moderate gluteal muscle volume；67–100：substantial gluteal muscle volume"
  },
  "waist_taper": {
    "group": "contour",
    "label": "腰线收束",
    "low": "a straighter waist contour",
    "mid": "a gently tapered waist contour",
    "high": "a clearly tapered waist contour",
    "description": "0–33：a straighter waist contour；34–66：a gently tapered waist contour；67–100：a clearly tapered waist contour"
  },
  "abdominal_definition": {
    "group": "contour",
    "label": "腹部线条",
    "low": "subtle abdominal muscle contours",
    "mid": "gently visible abdominal definition",
    "high": "clearly visible abdominal definition",
    "description": "0–33：subtle abdominal muscle contours；34–66：gently visible abdominal definition；67–100：clearly visible abdominal definition"
  },
  "breast_volume": {
    "group": "contour",
    "label": "乳房体量",
    "low": "slight breast volume",
    "mid": "moderate breast volume",
    "high": "fuller breast volume",
    "description": "0–33：slight breast volume；34–66：moderate breast volume；67–100：fuller breast volume"
  },
  "abdominal_softness": {
    "group": "contour",
    "label": "腹部柔软轮廓",
    "low": "slight abdominal soft-tissue fullness",
    "mid": "moderate abdominal soft-tissue fullness",
    "high": "pronounced abdominal soft-tissue fullness",
    "description": "0–33：slight abdominal soft-tissue fullness；34–66：moderate abdominal soft-tissue fullness；67–100：pronounced abdominal soft-tissue fullness"
  },
  "hip_fullness": {
    "group": "contour",
    "label": "胯部软组织",
    "low": "slight outer-hip soft-tissue fullness",
    "mid": "moderate outer-hip soft-tissue fullness",
    "high": "fuller outer-hip soft-tissue contours",
    "description": "0–33：slight outer-hip soft-tissue fullness；34–66：moderate outer-hip soft-tissue fullness；67–100：fuller outer-hip soft-tissue contours"
  }
};
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
export function validateBody(body) {
  if (!object(body)) throw new Error('Body must be an object.');
  for (const key of Object.keys(body)) if (!['version','state','controls'].includes(key)) throw new Error(`Unknown body field: ${key}.`);
  if (body.version !== BODY_VERSION) throw new Error(`Expected body version ${BODY_VERSION}.`);
  if (!['off','selected'].includes(body.state)) throw new Error('Body state must be off or selected.');
  if (!object(body.controls)) throw new Error('Body controls must be an object.');
  for (const [id,value] of Object.entries(body.controls)) {
    if (!Object.hasOwn(BODY_AXES,id)) throw new Error(`Unknown body control: ${id}.`);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Body ${id} must be a finite number from 0 to 100.`);
  }
  return body;
}
export function describeBodyValue(id,value) {
  if (!Object.hasOwn(BODY_AXES,id) || !Number.isFinite(value) || value<0 || value>100) throw new Error('Invalid body axis/value.');
  const axis=BODY_AXES[id];
  return value<34?axis.low:value>66?axis.high:axis.mid;
}
export function resolveBody(body, {profile={}, capture='full_body'}={}) {
  if (body===undefined) return {paragraphs:[],active:false};
  validateBody(body);
  if (body.state==='off') return {paragraphs:[],active:false};
  if (profile.subject?.age_group !== 'adult') throw new Error('Selected body requires subject.age_group to be adult.');
  if (!['head','full_body'].includes(capture)) throw new Error('Body capture must be head or full_body.');
  if(capture==='head') return {paragraphs:[],active:true};
  const descriptions=Object.entries(body.controls).map(([id,value])=>describeBodyValue(id,value));
  return {active:true,paragraphs:descriptions.length?[`Adult body proportions and visible contours: ${descriptions.join('; ')}.`]:[]};
}
