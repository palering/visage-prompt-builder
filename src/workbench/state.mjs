import { compileOutput, validateOutput } from './output.mjs';
import { validateProfile } from '../compiler/validate.mjs';
import { validateAppearance } from '../appearance/modules.mjs';
import { validateBody } from '../body/body.mjs';
import { createConstraints, validateConstraints, randomizeConstrained, samplingStatus } from './constraints.mjs';
import { sampleProfile } from '../sampling/sample.mjs';
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
export function createDefaultState() {
  return {version:'workbench-v0.2',constraints:createConstraints(),profile:{schema_version:'face-v0.2',subject:{age_group:'adult',gender_presentation:'person'},face_geometry:{face_length:50,face_width:50},eyes:{eye_size:50}},appearance:{version:'appearance-v0.1'},body:{version:'body-v0.1',state:'off',controls:{}},capture:'head',seed:'visage-01',archetypes:['beautiful','elegant'],headEnabled:true};
}
export function validateWorkbench(state) {
  if(!object(state)) throw new Error('配置必须是 JSON 对象');
  const required=['constraints','version','profile','appearance','body','capture','seed','archetypes','headEnabled'];
  for(const key of Object.keys(state)) if(![...required,'sampling','output'].includes(key)) throw new Error(`未知配置字段：${key}`);
  for(const key of required) if(!Object.hasOwn(state,key)) throw new Error(`缺少配置字段：${key}`);
  if(state.version!=='workbench-v0.2') throw new Error('不支持的工作台版本');
  validateConstraints(state);
  if(state.output!==undefined)validateOutput(state.output);
  if(state.sampling!==undefined && (!object(state.sampling)||state.sampling.version!=='workbench-sampler-v0.1')) throw new Error('不支持的采样记录');
  validateProfile(state.profile); validateAppearance(state.appearance); validateBody(state.body);
  if(state.profile.subject?.age_group!=='adult') throw new Error('工作台仅支持 adult 成年角色');
  if(!['head','full_body'].includes(state.capture)) throw new Error('构图必须是 head 或 full_body');
  if(typeof state.headEnabled!=='boolean') throw new Error('headEnabled 必须为布尔值');
  if(typeof state.seed!=='string'||!state.seed.trim()||state.seed.length>200) throw new Error('随机种子须为 1–200 字符');
  if(!Array.isArray(state.archetypes)||!state.archetypes.length||state.archetypes.length>2||state.archetypes.some(x=>typeof x!=='string'||x.length>100)) throw new Error('无效的采样方向');
  // Validate even before a reroll; never retain hidden invalid sampler settings.
  sampleProfile({seed:state.seed,archetypes:state.archetypes});
  return state;
}
export function compileWorkbench(state) {
  validateWorkbench(state);
  return compileOutput(state).prompt;
}
export function randomizeWorkbenchDetailed(state,seed,options) {
  validateWorkbench(state);
  const selectedSeed=seed??state.seed;
  if(typeof selectedSeed!=='string'||!selectedSeed.trim()||selectedSeed.length>200) throw new Error('随机种子须为 1–200 字符');
  const result=randomizeConstrained(state,selectedSeed,options);
  validateWorkbench(result.state);return result;
}
export function randomizeWorkbench(state,seed,options) { return randomizeWorkbenchDetailed(state,seed,options).state; }
export function exportWorkbench(state) {validateWorkbench(state);const snapshot=structuredClone(state);if(snapshot.sampling)snapshot.sampling.status=samplingStatus(state);return JSON.stringify(snapshot,null,2);}
export function importWorkbench(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>1000000) throw new Error('配置文件过大（上限 1 MB）');
  const state=JSON.parse(text,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key)) throw new Error('不安全的配置字段');return value;});
  if(state?.version==='workbench-v0.1') { if(Object.hasOwn(state,'constraints')||Object.hasOwn(state,'sampling')) throw new Error('旧版配置含不支持的字段');state.version='workbench-v0.2';state.constraints=createConstraints();state.constraints.locks=[]; }
  validateWorkbench(state); return structuredClone(state);
}

export function compileWorkbenchDetails(state) {
  validateWorkbench(state);
  const result=compileOutput(state),warnings=[...result.warnings];
  const face=state.output?.mode!=='selected'||state.output.modules.includes('face');
  const makeup=state.output?.mode!=='selected'||state.output.modules.includes('makeup');
  if(face&&makeup&&state.constraints.locks.some(p=>p==='profile.skin.tone'||p==='profile.skin'||p==='profile') && (state.appearance.makeup?.state==='selected'||(!state.appearance.makeup&&Object.keys(state.profile.makeup??{}).length>0))) warnings.push('肤色固定保留输入文本；妆容底色、遮盖和光线仍可能改变画面中的肤色，不保证像素锁定。');
  if(samplingStatus(state)==='historical')warnings.push('当前配置已在采样后修改，SEED 仅标识上次重抽；采样记录为历史记录，不能用该种子单独复现当前配置。');
  return {...result,warnings:[...new Set(warnings)]};
}
