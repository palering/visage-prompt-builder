import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { defaultCatalog } from '../sampling/sample.mjs';
import { validateProfile } from '../compiler/validate.mjs';
import { validateAppearance, resolveAppearance } from '../appearance/modules.mjs';
import { BODY_AXES } from '../body/body.mjs';

export const CONSTRAINTS_VERSION = 'constraints-v0.1';
export const CONSTRAINED_SAMPLER_VERSION = 'workbench-sampler-v0.1';
const template = JSON.parse(fs.readFileSync(new URL('../../schemas/face_schema_v0.1.json', import.meta.url), 'utf8'));
template.subject.appearance=''; template.face_geometry.cheek_to_chin_contour=''; template.soft_tissue.upper_medial_cheek_fullness=50; template.soft_tissue.lateral_cheek_fullness=50;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
const modules = ['hair','makeup','expression','apparentAge'];
const headSections = ['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'];
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const PROFILE_PATHS = Object.entries(template).filter(([,v])=>object(v)).flatMap(([section,fields])=>Object.keys(fields).map(field=>`profile.${section}.${field}`));
export const NUMERIC_PATHS = Object.entries(template).filter(([,v])=>object(v)).flatMap(([section,fields])=>Object.entries(fields).filter(([,v])=>typeof v==='number' && headSections.includes(section)).map(([field])=>`profile.${section}.${field}`)).concat(Object.keys(BODY_AXES).map(id=>`body.controls.${id}`),'appearance.apparentAge.years');
export const LOCK_PATHS = ['profile',...Object.keys(template).filter(k=>object(template[k])).map(k=>`profile.${k}`),...PROFILE_PATHS,'appearance',...modules.map(m=>`appearance.${m}`),'body','body.state',...Object.keys(BODY_AXES).map(id=>`body.controls.${id}`),'headEnabled','capture'];
const identityPaths = ['profile.subject.appearance','profile.subject.gender_presentation','profile.skin.tone','profile.face_geometry.face_shape'];
function configurationHash(state) {return hash({profile:state.profile,appearance:state.appearance,body:state.body,capture:state.capture,headEnabled:state.headEnabled,archetypes:state.archetypes,constraints:state.constraints,seed:state.seed});}
export function samplingStatus(state) {return state.sampling?(state.sampling.configurationSha256===configurationHash(state)?'current':'historical'):'none';}
export function createConstraints() { return {version:CONSTRAINTS_VERSION,includeBody:false,locks:[...identityPaths],ranges:{},choices:{},morphologyBundles:defaultCatalog.morphology_bundles.map(b=>b.id)}; }
export function pathValue(state,path) { return path.split('.').reduce((o,k)=>o?.[k],state); }
export function isLocked(state,path) { return state.constraints.locks.some(lock=>path===lock || path.startsWith(lock+'.')); }
export function regionPaths(section) { return PROFILE_PATHS.filter(p=>p.startsWith(`profile.${section}.`)); }
export function lockState(state,paths) { const n=paths.filter(p=>isLocked(state,p)).length; return n===0?'none':n===paths.length?'all':'mixed'; }
export function setLocks(state,paths,locked) {
  // Expand ancestor locks before clearing a child; missing schema leaves remain locked.
  let locks=[...state.constraints.locks];
  if (!locked) for (const path of paths) {
    const ancestors=locks.filter(l=>path.startsWith(l+'.'));
    for (const ancestor of ancestors) {
      locks=locks.filter(l=>l!==ancestor);
      const leaves=LOCK_PATHS.filter(p=>p.startsWith(ancestor+'.') && !LOCK_PATHS.some(q=>q.startsWith(p+'.')));
      locks.push(...leaves);
    }
  }
  locks=locks.filter(l=>!paths.some(p=>l===p || l.startsWith(p+'.')));
  if(locked) locks.push(...paths);
  state.constraints.locks=[...new Set(locks)].sort();
}
function keys(value,allowed,label) { if(!object(value)) throw new Error(`${label} 必须是对象`); for(const k of Object.keys(value)) if(!allowed.includes(k)) throw new Error(`${label} 未知字段：${k}`); }
function validateChoice(path,value) {
  if(identityPaths.includes(path)) {
    if(typeof value!=='string'||!value.trim()||value.length>200) throw new Error(`${path} 候选须为 1–200 字符文本`);
    const [,section,field]=path.split('.');validateProfile({schema_version:'face-v0.2',[section]:{[field]:value}});
  } else if(modules.filter(m=>m!=='apparentAge').some(m=>path===`appearance.${m}`)) {
    if(typeof value!=='string') throw new Error(`${path} 候选须为预设名称`);
    const module=path.split('.')[1];validateAppearance({version:'appearance-v0.1',...(value==='inherit'?{}:{[module]:value==='off'?{state:'off'}:{state:'selected',preset:value}})});
  } else throw new Error(`不支持候选范围：${path}`);
}
export function validateConstraints(state) {
  const c=state.constraints;keys(c,['version','includeBody','locks','ranges','choices','morphologyBundles'],'随机约束');
  if(typeof c.includeBody!=='boolean') throw new Error('身体随机范围开关必须是布尔值');
  if(c.version!==CONSTRAINTS_VERSION) throw new Error('不支持的随机约束版本');
  if(!Array.isArray(c.locks)||new Set(c.locks).size!==c.locks.length||c.locks.some(p=>!LOCK_PATHS.includes(p))) throw new Error('固定字段列表无效');
  keys(c.ranges,NUMERIC_PATHS,'数值范围');
  for(const [path,r] of Object.entries(c.ranges)) {
    keys(r,['min','max'],'数值范围');const age=path==='appearance.apparentAge.years';
    if(!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min<(age?18:0)||r.max>(age?90:100)||r.min>r.max || (age && (!Number.isInteger(r.min)||!Number.isInteger(r.max)))) throw new Error(`${path} 范围无效`);
  }
  keys(c.choices,[...identityPaths,...modules.filter(m=>m!=='apparentAge').map(m=>`appearance.${m}`)],'候选范围');
  for(const [p,values] of Object.entries(c.choices)) {
    if(!Array.isArray(values)||!values.length||values.length>100||new Set(values).size!==values.length) throw new Error(`${p} 候选列表不可为空或重复（最多 100 项）`);
    values.forEach(v=>validateChoice(p,v));
  }
  if(!Array.isArray(c.morphologyBundles)||!c.morphologyBundles.length||new Set(c.morphologyBundles).size!==c.morphologyBundles.length||c.morphologyBundles.some(id=>!defaultCatalog.morphology_bundles.some(b=>b.id===id))) throw new Error('至少选择一个有效的结构范围');
  return c;
}
function assign(state,path,value) { const parts=path.split('.');let current=state;for(const p of parts.slice(0,-1)) current=current[p]??=( {} );current[parts.at(-1)]=structuredClone(value); }
function random(seed,key) { return parseInt(hash([CONSTRAINED_SAMPLER_VERSION,seed,key]).slice(0,13),16)/0x10000000000000; }
function triangular(u,{min,mode,max}) { if(min===max) return min;return u<(mode-min)/(max-min)?min+Math.sqrt(u*(max-min)*(mode-min)):max-Math.sqrt((1-u)*(max-min)*(max-mode)); }
function appearanceChoice(state,path) { const v=pathValue(state,path);return v===undefined?'inherit':v.state==='off'?'off':v.preset; }
function blocked(state,path) {
  if(isLocked(state,path)) return true;
  if(path.startsWith('profile.')) {
    const section=path.split('.')[1];
    if(headSections.includes(section)&&!state.headEnabled) return true;
    if(['hair','makeup','expression'].includes(section) && (isLocked(state,`appearance.${section}`) || state.appearance[section]!==undefined)) return true;
  }
  return false;
}
export const REROLL_SCOPES = ['legacy','global','head','appearance','body'];
export function pathInRerollScope(path,scope) {
  if(!REROLL_SCOPES.includes(scope)) throw new Error('不支持的重抽范围');
  if(scope==='legacy') return true;
  if(scope==='global') return ['head','appearance','body'].some(tab=>pathInRerollScope(path,tab));
  if(scope==='body') return path.startsWith('body.controls.');
  if(scope==='appearance') return path.startsWith('appearance.') || ['hair','makeup','expression'].some(section=>path.startsWith(`profile.${section}.`));
  return headSections.some(section=>path.startsWith(`profile.${section}.`)) || identityPaths.includes(path);
}
function validateConflicts(state,scope) {
  for(const [path,r] of Object.entries(state.constraints.ranges)) {
    if(!pathInRerollScope(path,scope)) continue;
    const value=pathValue(state,path);
    if(isLocked(state,path) && typeof value==='number' && (value<r.min||value>r.max)) throw new Error(`${path}：固定值不在范围内，请调整范围或解锁`);
  }
  for(const [path,choices] of Object.entries(state.constraints.choices)) {
    if(!pathInRerollScope(path,scope)) continue;
    const value=path.startsWith('appearance.')?appearanceChoice(state,path):pathValue(state,path);
    if(isLocked(state,path) && !choices.includes(value)) throw new Error(`${path}：固定值不在候选内，请调整候选或解锁`);
    if(path.startsWith('appearance.') && pathValue(state,path)?.overrides && !isLocked(state,path)) throw new Error(`${path}：含自定义覆盖，请先固定模块或手动移除覆盖后重抽`);
  }
}
export function randomizeConstrained(source,seed,{scope='legacy'}={}) {
  if(!REROLL_SCOPES.includes(scope)) throw new Error('不支持的重抽范围');
  validateConstraints(source);validateConflicts(source,scope);
  const next=structuredClone(source),c=source.constraints;
  const includeBody=scope==='global'||scope==='body'||(scope==='legacy'&&c.includeBody);
  const eligible=defaultCatalog.morphology_bundles.filter(b=>c.morphologyBundles.includes(b.id));
  let roll=random(seed,'bundle')*eligible.reduce((sum,b)=>sum+b.weight,0);
  const bundle=eligible.find(b=>(roll-=b.weight)<0)??eligible.at(-1);
  const definitions=[bundle,...[...source.archetypes].sort().map(id=>defaultCatalog.archetypes[id])];
  const ranges={},fixed={},applied=[],skipped=[],resolvedRanges={};
  for(const definition of definitions) {
    for(const [p,v] of Object.entries(definition.fixed??{})) {
      const path='profile.'+p;
      if(!pathInRerollScope(path,scope)) continue;
      if(p==='subject.overall_impression') fixed[path]=[...(fixed[path]??[]),...v];else fixed[path]=v;
    }
    for(const [p,r] of Object.entries(definition.ranges??{})) if(pathInRerollScope('profile.'+p,scope)) ranges['profile.'+p]=structuredClone(r);
  }
  // User-added bounds constrain authored distributions, and define a range for otherwise manual axes.
  for(const [path,bounds] of Object.entries(c.ranges)) {
    if(!pathInRerollScope(path,scope)) continue;
    if(path.startsWith('body.') && (!includeBody||source.body.state!=='selected'||pathValue(source,path)===undefined)) continue;
    if(path==='appearance.apparentAge.years' && source.appearance.apparentAge?.state!=='selected') continue;
    if(isLocked(source,path)) continue;
    const r=ranges[path]??{min:bounds.min,max:bounds.max,mode:(bounds.min+bounds.max)/2,group:path};
    const min=Math.max(r.min,bounds.min),max=Math.min(r.max,bounds.max);
    if(min>max) throw new Error(`${path}：自定义范围与本次结构范围无交集；请调整范围或结构预设`);
    ranges[path]={...r,min,max,mode:Math.min(max,Math.max(min,r.mode))};
  }
  if(includeBody && source.body.state==='selected') for(const id of Object.keys(source.body.controls)) {
    const path=`body.controls.${id}`;ranges[path]??={min:0,mode:50,max:100,group:path};
  }
  const groups=new Map();for(const [path,r] of Object.entries(ranges)) {if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(path);}
  for(const [group,paths] of groups) {
    const blockedPaths=paths.filter(p=>blocked(source,p));
    if(blockedPaths.length) { skipped.push({group,paths,reason:'固定或停用字段保留；关联组整体跳过',blockedPaths});continue; }
    for(const path of paths) {
      const r=ranges[path],u=defaultCatalog.correlation.shared_weight*random(seed,`group:${group}`)+defaultCatalog.correlation.local_weight*random(seed,`field:${path}`);
      const value=triangular(u,r),rounded=path==='appearance.apparentAge.years'?Math.round(value):Math.round(value*100)/100;
      assign(next,path,Math.max(r.min,Math.min(r.max,rounded)));applied.push(path);resolvedRanges[path]=r;
    }
  }
  for(const [path,value] of Object.entries(fixed)) {
    // Author-entered identity/category text is never inferred or replaced from a numeric range preset.
    if(['profile.face_geometry.face_shape','profile.face_geometry.cheek_to_chin_contour'].includes(path)) continue;
    if(identityPaths.includes(path) && pathValue(source,path)!==undefined) continue;
    if(blocked(source,path)) continue;
    assign(next,path,value);applied.push(path);
  }
  for(const [path,values] of Object.entries(c.choices)) {
    if(!pathInRerollScope(path,scope)) continue;
    if(blocked(source,path)) continue;
    const value=values[Math.floor(random(seed,`choice:${path}`)*values.length)];
    if(path.startsWith('appearance.')) {
      if(value==='inherit') delete next.appearance[path.split('.')[1]];
      else assign(next,path,value==='off'?{state:'off'}:{state:'selected',preset:value});
    } else assign(next,path,value);
    applied.push(path);
  }
  if(next.profile.schema_version==='face-v0.1' && applied.some(p=>['profile.soft_tissue.upper_medial_cheek_fullness','profile.soft_tissue.lateral_cheek_fullness','profile.subject.appearance'].includes(p))) {next.profile.schema_version='face-v0.2';applied.push('profile.schema_version');}
  const changed=applied.filter(path=>JSON.stringify(pathValue(source,path))!==JSON.stringify(pathValue(next,path)));
  // No eligible actual change is a genuine no-op, including seed and previous provenance.
  if(!changed.length) return {state:structuredClone(source),report:{changed:[],applied:[],skipped,noOp:true}};
  next.seed=seed;
  const parentProfileSha256=hash(source.profile),sourceSampling=source.profile.metadata?.sampling;
  next.sampling={version:CONSTRAINED_SAMPLER_VERSION,status:'current',scope,configurationSha256:configurationHash(next),seed,archetypes:[...source.archetypes],morphologyBundle:bundle.id,constraints:structuredClone(c),catalogSha256:hash(defaultCatalog),parentProfileSha256,sourceSamplingSha256:sourceSampling?hash(sourceSampling):null,applied:[...new Set(applied)].sort(),changed:[...new Set(changed)].sort(),skipped,resolvedRanges,appearanceResolution:resolveAppearance(next.appearance,{preset:'profile',enhancers:true,profile:next.profile}),profileSha256:hash(next.profile),limitations:'Preserves parameter values, not rendered image identity. Authored distributions only; pinned correlation groups are skipped, not conditionally sampled. Manual text is not an anatomical rule.'};
  return {state:next,report:{changed,applied,skipped,noOp:false}};
}
