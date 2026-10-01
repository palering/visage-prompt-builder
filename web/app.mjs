import { initializeShell } from './shell.mjs';
import { icon } from './icons.mjs';
import { createDefaultState, validateWorkbench, compileWorkbenchDetails, randomizeWorkbenchDetailed, exportWorkbench, importWorkbench } from '../src/workbench/state.mjs';
import { samplingStatus, isLocked, setLocks, lockState, regionPaths, pathValue } from '../src/workbench/constraints.mjs';
import { defaultCatalog } from '../src/sampling/sample.mjs';
import { BODY_AXES, describeBodyValue } from '../src/body/body.mjs';
import { appearanceCatalog } from '../src/appearance/modules.mjs';
import { createOutputSettings, OUTPUT_MODULES } from '../src/workbench/output.mjs';
import { SUBJECT_PRESETS, subjectPresetValue } from '../src/workbench/subject-presets.mjs';
import { HEAD_GROUPS } from '../src/workbench/controls.mjs';
import { describeFaceValue } from '../src/compiler/gpt-image-2.5.mjs';

const compileWorkbench = compileWorkbenchDetails;
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'visage.workbench.v0.1';
const MAX_IMPORT_BYTES = 1024 * 1024;
const expressionLabels = { relaxed_neutral: '放松中性', slight_smile: '轻微闭口笑', broad_smile: '开朗露齿笑', frown: '皱眉表情', surprise: '惊讶表情' };
const categoryLabels = { modern_cut: '现代剪裁', trend_alias: '趋势别名', texture: '发丝纹理', arrangement: '编扎与盘发', historical: '历史启发', fantasy: '幻想造型', anime: '动漫造型', base: '底妆', brows: '眉妆', eyes: '眼妆', blush: '腮红', contour: '修容', lips: '唇妆', trend: '趋势配方' };
const bodyGroupLabels = { frame: '骨架与比例', muscle: '局部肌量', contour: '软组织与轮廓' };
const bodyValueLabels = {
  shoulder_span: ['窄肩架', '中等肩架', '宽肩架'], ribcage_breadth: ['窄胸廓', '中等胸廓', '宽胸廓'], pelvic_span: ['窄骨盆', '中等骨盆', '宽骨盆'],
  leg_length: ['偏短', '中等', '偏长'], arm_length: ['偏短', '中等', '偏长'],
  deltoid_volume: ['较少', '中等', '饱满'], pectoral_volume: ['较薄', '中等', '厚实'], lat_breadth: ['较窄', '中等', '较宽'],
  upper_arm_volume: ['较少', '中等', '饱满'], thigh_volume: ['较少', '中等', '饱满'], calf_volume: ['较少', '中等', '饱满'], gluteal_volume: ['较少', '中等', '饱满'],
  waist_taper: ['平直', '轻微收束', '明显收束'], abdominal_definition: ['柔和', '轻微可见', '清晰可见'],
  breast_volume: ['较少', '中等', '饱满'], abdominal_softness: ['较少', '中等', '较明显'], hip_fullness: ['较少', '中等', '饱满']
};
const headControls = [], bodyControls = [], groupCounters = [], constraintControls = [];
let undoState = null;
let shell = null;
let outputCustomSelection = false;
let state, compiledPrompt = '', importSequence = 0, stateRevision = 0, statusTimer = null, copySequence = 0, notificationSequence = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function option(value, text) {
  const node = element('option', '', text); node.value = value; return node;
}
function clearStatus() {
  notificationSequence++;
  if(statusTimer!==null) clearTimeout(statusTimer);
  statusTimer=null; $('status').hidden=true;
}
function notify(message, error = false, duration = error ? 8000 : 4000) {
  clearStatus();
  const node = $('status');
  node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
  // Each new status owns a fresh timer; an old copy completion cannot hide a newer one.
  statusTimer=setTimeout(()=>{node.hidden=true;statusTimer=null;},duration);
}
function errorText(error) { return error instanceof Error ? error.message : String(error); }
function promptResult(result) {
  if (typeof result === 'string') return { prompt: result, warnings: [] };
  if (result && typeof result.prompt === 'string') return { prompt: result.prompt, warnings: Array.isArray(result.warnings) ? result.warnings : [] };
  throw new Error('编译器未返回有效提示词。');
}
function commit(candidate, message, {preserveUndo=false}={}) {
  // Validate and compile before changing current state, so invalid imports are atomic.
  try {
    validateWorkbench(candidate);
    const result = promptResult(compileWorkbench(candidate));
    shell?.validateState(candidate); // Validate workspace admissibility before changing app state, prompt or undo.
    state = structuredClone(candidate); stateRevision++; if(!preserveUndo)undoState=null;
    compiledPrompt = result.prompt;
    sync(result);
    if (message) notify(message);
    else { clearStatus(); }
    return true;
  } catch (error) {
    notify(`未应用更改：${errorText(error)}`, true);
    if (state) sync(promptResult(compileWorkbench(state)));
    return false;
  }
}
function update(mutator, message) {
  const next = structuredClone(state);
  try { mutator(next); if(next.profile.schema_version==='face-v0.1' && (Object.hasOwn(next.profile.subject??{},'appearance')||Object.hasOwn(next.profile.face_geometry??{},'cheek_to_chin_contour')||['upper_medial_cheek_fullness','lateral_cheek_fullness'].some(k=>Object.hasOwn(next.profile.soft_tissue??{},k))))next.profile.schema_version='face-v0.2'; } catch (error) { notify(errorText(error), true); return false; }
  return commit(next, message);
}
function isHeadActive(section, key) { return typeof state.profile?.[section]?.[key] === 'number'; }
function isBodyActive(id) { return Object.hasOwn(state.body.controls ?? {}, id); }

function makeGroup(container, title, controls, open = false, paths = []) {
  const details = element('details', 'control-group'); details.open = open;
  const summary = element('summary');
  summary.append(element('span', 'group-heading', title));
  const counter = element('span', 'group-count'); summary.append(counter);
  if(paths.length) {
    const pin=element('button','lock-button'); pin.type='button'; pin.id=`lock-group-${container.id}-${groupCounters.length}`;
    pin.addEventListener('click',event=>{event.preventDefault?.(); event.stopPropagation?.();update(next=>setLocks(next,paths,lockState(state,paths)!=='all'));});
    summary.append(pin); constraintControls.push({sync(){const status=lockState(state,paths);pin.textContent=status==='all'?'已固定':status==='mixed'?'部分固定':'固定本区';pin.setAttribute('aria-pressed',status==='mixed'?'mixed':String(status==='all'));}});
  }
  const chevron=element('span','chevron');chevron.append(icon('chevron-down'));summary.append(chevron);
  const fields = element('div', 'group-fields');
  details.append(summary, fields); container.append(details);
  groupCounters.push({ counter, controls });
  return fields;
}
function makeAxis(container, { id, label, low = '低', high = '高', description = '', read, enabled, toggle, change, moduleEnabled, path }) {
  const row = element('div', 'axis');
  const header = element('div', 'axis-header');
  const labelNode = element('label', 'axis-label');
  const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.id = `${id}-enabled`;
  labelNode.append(checkbox, element('span', '', label));
  const number = element('input', 'axis-value'); number.type = 'number'; number.min = '0'; number.max = '100'; number.step = '0.01'; number.id = `${id}-number`; number.setAttribute('aria-label', `${label}数值`);
  header.append(labelNode, number);
  if(path) header.append(makeLock(path, `${id}-lock`, `${label}固定`));
  const range = element('input'); range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '1'; range.id = `${id}-range`; range.setAttribute('aria-label', label);
  const scale = element('div', 'axis-scale'); scale.append(element('span', '', `0 · ${low}`), element('span', '', `100 · ${high}`));
  const note = element('p', 'axis-description', typeof description === 'function' ? '' : description); note.id = `${id}-description`;
  range.setAttribute('aria-describedby', note.id); number.setAttribute('aria-describedby', note.id);
  row.append(header, range, scale, note); if(path) row.append(makeRange(path,id,label)); container.append(row);
  checkbox.addEventListener('change', () => update(next => toggle(next, checkbox.checked)));
  range.addEventListener('input', () => update(next => change(next, Number(range.value))));
  number.addEventListener('change', () => {
    if (!number.value.trim() || !number.checkValidity()) { notify(`${label}必须是 0–100 之间的数值。`, true); sync(promptResult(compileWorkbench(state))); return; }
    update(next => change(next, Number(number.value)));
  });
  const control = { id, enabled, sync() {
    const active = enabled(); const allowed = moduleEnabled(); const value = active ? read() : 50;
    checkbox.checked = active; checkbox.disabled = !allowed;
    range.disabled = number.disabled = !active || !allowed;
    range.value = String(value); number.value = String(value);
    row.classList.toggle('is-inactive', !active || !allowed);
    note.textContent = active ? (typeof description === 'function' ? description(value) : description) : '未启用 · 不写入提示词';
    range.setAttribute('aria-valuetext', `${value}，${note.textContent}`);
  }};
  return control;
}
function buildHead() {
  for (const [label, group] of Object.entries(HEAD_GROUPS)) {
    const controls = [];
    const fields = makeGroup($('head-groups'), label, controls, headControls.length === 0, regionPaths(group.section));
    for (const [key, fieldLabel] of Object.entries(group.fields)) {
      const section = group.section;
      const control = makeAxis(fields, {
        id: `head-${section}-${key}`, label: fieldLabel, path:`profile.${section}.${key}`,
        description: value => describeFaceValue(section, key, value),
        read: () => state.profile[section][key], enabled: () => isHeadActive(section, key), moduleEnabled: () => state.headEnabled,
        toggle(next, checked) { next.profile[section] ??= {}; if (checked) next.profile[section][key] = 50; else delete next.profile[section][key]; },
        change(next, value) { next.profile[section][key] = value; }
      });
      controls.push(control); headControls.push(control);
    }
  }
}
function buildBody() {
  const groups = new Map();
  for (const [id, axis] of Object.entries(BODY_AXES)) {
    if (!groups.has(axis.group)) groups.set(axis.group, []);
    groups.get(axis.group).push([id, axis]);
  }
  for (const [label, axes] of groups) {
    const controls = []; const fields = makeGroup($('body-groups'), bodyGroupLabels[label] ?? label, controls, bodyControls.length === 0, axes.map(([id])=>`body.controls.${id}`));
    for (const [id, axis] of axes) {
      const control = makeAxis(fields, {
        id: `body-${id}`, label: axis.label, path:`body.controls.${id}`, low: bodyValueLabels[id]?.[0] ?? axis.low, high: bodyValueLabels[id]?.[2] ?? axis.high,
        description: value => `${describeBodyValue(id, value)} · ${value < 34 ? '低区间 <34' : value > 66 ? '高区间 >66' : '中区间 34–66'}`,
        read: () => state.body.controls[id], enabled: () => isBodyActive(id), moduleEnabled: () => state.body.state === 'selected',
        toggle(next, checked) { if (checked) next.body.controls[id] = 50; else delete next.body.controls[id]; },
        change(next, value) { next.body.controls[id] = value; }
      });
      controls.push(control); bodyControls.push(control);
    }
  }
}
function makeLock(path,id,label='固定') {
  const button=element('button','lock-button');button.type='button';button.id=id;
  button.setAttribute('aria-label',label);button.title='只阻止随机改动；仍可手动修改。未启用也可以固定。';
  button.addEventListener('click',()=>update(next=>setLocks(next,[path],!isLocked(state,path))));
  constraintControls.push({sync(){const locked=isLocked(state,path);button.replaceChildren(icon(locked?'lock':'unlock'));button.setAttribute('aria-label',`${label}：${locked?'已固定':'未固定'}`);button.setAttribute('aria-pressed',String(locked));button.classList.toggle('is-locked',locked);}});return button;
}
function makeRange(path,id,label) {
  const details=element('details','range-editor'),summary=element('summary');details.id=`${id}-bounds`;
  const fields=element('div','bounds-fields'),min=element('input'),max=element('input');
  for(const [node,suffix] of [[min,'min'],[max,'max']]) {node.type='number';node.min=path.includes('apparentAge')?'18':'0';node.max=path.includes('apparentAge')?'90':'100';node.step=path.includes('apparentAge')?'1':'0.01';node.id=`${id}-${suffix}`;node.setAttribute('aria-label',`${label}随机范围${suffix==='min'?'下限':'上限'}`);}
  const apply=element('button','','应用'),clear=element('button','quiet','清除范围'),cancel=element('button','quiet','取消');
  apply.type=clear.type=cancel.type='button';apply.id=`${id}-apply-range`;clear.id=`${id}-clear-range`;cancel.id=`${id}-cancel-range`;
  apply.addEventListener('click',()=>{if(!min.value.trim()||!max.value.trim()||!min.checkValidity()||!max.checkValidity()){notify('请输入有效的范围上下限。',true);return;} if(update(next=>{next.constraints.ranges[path]={min:Number(min.value),max:Number(max.value)};},'范围已保存；下次重抽时生效。固定值与自定义范围冲突时会整次取消。'))details.open=false;});
  clear.addEventListener('click',()=>{update(next=>{delete next.constraints.ranges[path];});details.open=false;});
  cancel.addEventListener('click',()=>{details.open=false;sync(promptResult(compileWorkbench(state)));});
  fields.append(min,element('span','','至'),max,apply,clear,cancel);details.append(summary,fields);
  constraintControls.push({sync(){const bounds=state.constraints.ranges[path];const sampled=defaultCatalog.morphology_bundles.some(b=>Object.hasOwn(b.ranges,path.replace(/^profile\./,'')))||path.startsWith('body.');summary.textContent=bounds?`随机范围 ${bounds.min}–${bounds.max}`:sampled?'随机范围 · 预设/默认':'随机范围 · 未设置（保留当前）';min.value=String(bounds?.min??(path.includes('apparentAge')?18:0));max.value=String(bounds?.max??(path.includes('apparentAge')?90:100));}});return details;
}
function buildIdentity() {
  for(const [id,{path,label,placeholder,choices}] of Object.entries(SUBJECT_PRESETS)) {
    const field=element('div','field'),header=element('div','axis-header'),labelNode=element('label','',label),input=element('input');
    input.type='text';input.maxLength=200;input.id=`subject-${id}`;input.placeholder=placeholder;labelNode.htmlFor=input.id;
    header.append(labelNode,makeLock(path,`subject-${id}-lock`,`${label}固定`));
    const presets=element('select');presets.id=`subject-${id}-preset`;presets.setAttribute('aria-label',`${label}常用选项`);
    presets.append(option('','未指定（留空）'),...choices.map(([value,text])=>option(value,text)),option('__custom__','自定义 / 更多描述…'));
    const hint=element('p','field-note','可以选择常用项，也可直接修改下方文字或输入更多自定义选项。');hint.id=`subject-${id}-hint`;input.setAttribute('aria-describedby',hint.id);
    presets.addEventListener('change',()=>{if(presets.value==='__custom__'){input.focus();input.select();return;}update(next=>{const [,section,key]=path.split('.');next.profile[section]??={};if(presets.value==='')delete next.profile[section][key];else next.profile[section][key]=presets.value;});});
    input.addEventListener('change',()=>update(next=>{const [,section,key]=path.split('.');next.profile[section]??={};if(input.value==='')delete next.profile[section][key];else next.profile[section][key]=input.value;}));
    const detail=element('details','choice-editor'),summary=element('summary','', '可选：限定文字候选'),pool=element('textarea');pool.rows=3;pool.id=`subject-${id}-choices`;pool.setAttribute('aria-label',`${label}随机候选，每行一个`);pool.placeholder='每行一个原样候选；留空则始终保留当前文字';
    const apply=element('button','','应用候选'),cancel=element('button','quiet','取消');apply.type=cancel.type='button';apply.id=`subject-${id}-apply-choices`;
    apply.addEventListener('click',()=>{const choices=pool.value.split('\n').filter(v=>v.trim());if(update(next=>{if(choices.length)next.constraints.choices[path]=choices;else delete next.constraints.choices[path];},'候选已保存；只在解锁后随机选择。'))detail.open=false;});
    cancel.addEventListener('click',()=>{detail.open=false;sync(promptResult(compileWorkbench(state)));});detail.append(summary,pool,apply,cancel);field.append(header,presets,input,hint,detail);$('identity-fields').append(field);
    constraintControls.push({sync(){input.value=pathValue(state,path)??'';presets.value=subjectPresetValue(id,input.value);pool.value=(state.constraints.choices[path]??[]).join('\n');summary.textContent=state.constraints.choices[path]?`文字候选 · ${state.constraints.choices[path].length} 项`:'可选：限定文字候选';}});
  }
}
function buildSampling() {
  $('lock-everything').addEventListener('click',()=>update(next=>{next.constraints.locks=['profile','appearance','body','headEnabled','capture'];},'已固定全部参数，包括未启用和继承状态。仍可手动修改。'));
  $('unlock-everything').addEventListener('click',()=>update(next=>{next.constraints.locks=[];},'已解除全部固定；当前值和范围未改变。'));

  for(const [id,recipe] of Object.entries(defaultCatalog.archetypes)) $('direction-select').append(option(id,recipe.label));
  $('direction-select').addEventListener('change',event=>update(next=>{next.archetypes=event.target.value==='beautiful'?['beautiful']:['beautiful',event.target.value];}));
  const bundles=$('bundle-options');
  for(const b of defaultCatalog.morphology_bundles) {const label=element('label','toggle'),input=element('input');input.type='checkbox';input.id=`bundle-${b.id}`;label.append(input,element('span','',({'soft-oval':'柔和范围','defined-taper':'收束范围','broad-contour':'宽轮廓范围'})[b.id]));bundles.append(label);input.addEventListener('change',()=>update(next=>{next.constraints.morphologyBundles=input.checked?[...next.constraints.morphologyBundles,b.id]:next.constraints.morphologyBundles.filter(id=>id!==b.id);}));constraintControls.push({sync(){input.checked=state.constraints.morphologyBundles.includes(b.id);}});}
  for(const [module,label] of [['hair','发型'],['makeup','妆容'],['expression','表情'],['apparentAge','年龄']]) {
    const node=$(`${module==='apparentAge'?'age':module}-constraint`);node.append(makeLock(`appearance.${module}`,`appearance-${module}-lock`,`${label}模块固定`));
    if(module==='apparentAge') {node.append(makeRange('appearance.apparentAge.years','age','外观年龄'));continue;}
    const add=element('button','quiet','将当前加入候选'),clear=element('button','quiet','清空候选'),summary=element('p','field-note');add.type=clear.type='button';add.id=`${module}-add-choice`;clear.id=`${module}-clear-choices`;
    add.addEventListener('click',()=>update(next=>{const path=`appearance.${module}`,values=next.constraints.choices[path]??[];next.constraints.choices[path]=[...new Set([...values,selectedAppearance(module)])];},'已加入候选；可选另一项后继续加入，重抽只在候选内选择。'));
    clear.addEventListener('click',()=>update(next=>{delete next.constraints.choices[`appearance.${module}`];},'已清空候选，随机时保留当前外观模块。'));
    node.append(add,clear,summary);constraintControls.push({sync(){const values=state.constraints.choices[`appearance.${module}`];summary.textContent=values?'候选：'+values.map(id=>id==='off'?'关闭':id==='inherit'?'继承':appearanceCatalog[module]?.[id]?.label??expressionLabels[id]??id).join(' / '):'未设置候选：重抽时保留当前模块';}});
  }
  const headPaths=Object.values(HEAD_GROUPS).flatMap(group=>regionPaths(group.section));
  const headLock=element('button','lock-button');headLock.type='button';headLock.id='all-profile-lock';headLock.addEventListener('click',()=>update(next=>setLocks(next,headPaths,lockState(state,headPaths)!=='all')));$('lock-head').append(headLock);
  constraintControls.push({sync(){const status=lockState(state,headPaths);headLock.textContent=status==='all'?'全部结构已固定':status==='mixed'?'结构部分固定':'固定全部结构';headLock.setAttribute('aria-pressed',status==='mixed'?'mixed':String(status==='all'));}});
  $('lock-body').append(makeLock('body','all-body-lock','全部身体字段固定'));
}
function outputSettings() { return state.output??createOutputSettings(); }
function updateOutput(mutator,message) {
  const next=structuredClone(state);next.output??=createOutputSettings();
  try {mutator(next.output);}catch(error){notify(errorText(error),true);return false;}
  if(!commit(next,message,{preserveUndo:true}))return false;
  // Prompt-view edits do not cancel a character reroll or get undone with it.
  if(undoState)undoState.output=structuredClone(next.output);
  return true;
}
function buildOutput() {
  for(const [id,label] of Object.entries(OUTPUT_MODULES)) {
    const wrapper=element('label','output-module-toggle'),checkbox=element('input');checkbox.type='checkbox';checkbox.id=`output-module-${id}`;
    wrapper.append(checkbox,element('span','',label));$('output-module-options').append(wrapper);
    checkbox.addEventListener('change',()=>updateOutput(settings=>{settings.mode='selected';settings.modules=checkbox.checked?[...settings.modules,id]:settings.modules.filter(key=>key!==id);}));
  }
  $('prompt-language').addEventListener('click',()=>updateOutput(settings=>{settings.language=settings.language==='en'?'zh':'en';}));
  $('output-scope').addEventListener('change',event=>{outputCustomSelection=event.target.value==='custom';updateOutput(settings=>{
    const choice=event.target.value;
    if(choice==='full')settings.mode='full';
    else {settings.mode='selected';if(choice!=='custom')settings.modules=[choice];}
  });});
  $('output-context').addEventListener('change',event=>updateOutput(settings=>{settings.context=event.target.value;}));
  $('reroll-context').addEventListener('click',()=>updateOutput(settings=>{settings.contextSeed=uniqueSeed();},'已更新展示上下文种子；人物参数与固定保持不变。'));
}
function syncOutput() {
  const settings=outputSettings(),full=settings.mode==='full';
  const shortcut=!outputCustomSelection&&!full&&settings.modules.length===1&&['face','hair','body'].includes(settings.modules[0])?settings.modules[0]:'custom';
  $('output-scope').value=full?'full':shortcut;
  $('output-module-options').hidden=full||shortcut!=='custom';
  for(const id of Object.keys(OUTPUT_MODULES))$(`output-module-${id}`).checked=settings.modules.includes(id);
  $('output-context').value=settings.context;$('output-context').disabled=full;
  $('context-random-controls').hidden=full||settings.context!=='random';$('context-seed').textContent=settings.contextSeed;
  $('output-summary').textContent=full?'全部模块':settings.modules.length?settings.modules.length===1?OUTPUT_MODULES[settings.modules[0]]:`${settings.modules.length} 个模块`:'未选模块';
  $('prompt-language').textContent=settings.language==='zh'?'中文':'EN';
  $('prompt-language').setAttribute('aria-label',`提示词语言：${settings.language==='zh'?'中文；点击切换英文':'英文；点击切换中文'}`);
  $('prompt-output').setAttribute('lang',settings.language==='zh'?'zh-CN':'en');
  $('output-scope-note').textContent=full?'完整角色输出已启用模块；自定义文字保留原文，输出设置不改变人物参数。':!settings.modules.length?'尚未选择模块；不会退回完整角色，也不会自动启用任何参数。':settings.context==='none'?'只描述选中模块；人物参数、固定与角色种子保持不变。':settings.context==='clay'?'只把未选的展示载体设为白模；选中发型等细节与颜色保持原描述。':settings.context==='random'?'随机上下文固定到当前上下文种子；跳过含固定字段的未选模块，不改人物参数。':'为未选部分补充中性展示说明，不借用当前角色的未选细节。';
}
function selectedAppearance(module) {
  const config = state?.appearance?.[module];
  return !config ? 'inherit' : config.state === 'off' ? 'off' : config.preset;
}
function setAppearance(module, value) {
  update(next => {
    if (value === 'inherit') delete next.appearance[module];
    else if (value === 'off') next.appearance[module] = { state: 'off' };
    else next.appearance[module] = { state: 'selected', preset: value };
  });
}
function populateCatalog(select, module, search = '') {
  const selected = selectedAppearance(module);
  const query = search.trim().toLocaleLowerCase();
  const catalog = appearanceCatalog[module];
  select.replaceChildren(option('inherit', '继承原配置'), option('off', '关闭该模块'));
  const groups = new Map(); let matches = 0;
  for (const [id, entry] of Object.entries(catalog)) {
    const haystack = [id, entry.label, entry.category, categoryLabels[entry.category], entry.family, ...(entry.aliases ?? [])].join(' ').toLocaleLowerCase();
    const match = !query || haystack.includes(query); if (match) matches++;
    if (!match && id !== selected) continue;
    const category = entry.category ?? 'other';
    if (!groups.has(category)) {
      const group = element('optgroup'); group.label = categoryLabels[category] ?? '其他造型';
      groups.set(category, group); select.append(group);
    }
    groups.get(category).append(option(id, `${entry.label}${!match ? '（当前选择）' : ''}`));
  }
  // Preserve a validated alias on imported configurations until the user picks a new preset.
  if (selected !== 'inherit' && selected !== 'off' && !Object.hasOwn(catalog, selected)) {
    const entry = Object.values(catalog).find(item => item.aliases?.includes(selected));
    if (entry) select.append(option(selected, `${entry.label}（已导入别名）`));
  }
  select.value = selected;
  if (module === 'hair') {
    $('hair-total').textContent = `· ${Object.keys(catalog).length} 项`;
    $('hair-note').textContent = query ? `找到 ${matches} 个匹配；搜索不会更改当前发型。` : '可按中文名称、英文名或别名搜索。';
  } else if (module === 'makeup') {
    $('makeup-note').textContent = query ? `找到 ${matches} 个匹配；搜索不会更改当前妆容。` : '选择一项妆容配方；不改变原始面部参数。';
  }
}
function syncAppearance() {
  populateCatalog($('hair-select'), 'hair', $('hair-search').value);
  populateCatalog($('makeup-select'), 'makeup', $('makeup-search').value);
  $('expression-select').value = selectedAppearance('expression');
  const age = state.appearance.apparentAge;
  $('age-mode').value = age?.state ?? 'inherit';
  $('age-control').hidden = age?.state !== 'selected';
  const years = age?.state === 'selected' ? age.years : 26;
  $('age-range').value = $('age-number').value = String(years);
}
function chip(label, active = true) { return element('span', `chip${active ? '' : ' off'}`, label); }
function sync(result) {
  for(const control of constraintControls) control.sync();
  $('direction-select').value=state.archetypes.find(id=>id!=='beautiful')??'beautiful';
  $('constraint-count').textContent=`已固定 ${state.constraints.locks.length} 项规则 · ${Object.keys(state.constraints.ranges).length} 个数值范围 · ${Object.keys(state.constraints.choices).length} 组候选`;
  $('undo-randomize').disabled=!undoState;
  $('head-enabled').checked = state.headEnabled;
  $('head-fields').classList.toggle('is-disabled', !state.headEnabled);
  const bodyOn = state.body.state === 'selected';
  $('body-enabled').checked = bodyOn; $('body-fields').hidden = !bodyOn; $('body-placeholder').hidden = bodyOn;
  for (const control of [...headControls, ...bodyControls]) control.sync();
  for (const { counter, controls } of groupCounters) counter.textContent = `${controls.filter(control => control.enabled()).length}/${controls.length}`;
  syncAppearance();syncOutput();
  $('capture').value = state.capture;
  $('capture-note').hidden = !bodyOn || state.capture !== 'head';
  $('prompt-output').value = result.prompt;
  $('prompt-length').textContent = `${result.prompt.length.toLocaleString('zh-CN')} 字符`;
  $('seed-value').textContent = (state.seed || '未设置')+(samplingStatus(state)==='historical'?' · 配置已编辑':''); $('seed-value').title = state.seed || '';
  const output=outputSettings(),fullOutput=output.mode==='full',selected=id=>fullOutput||output.modules.includes(id);
  const badges = [chip(fullOutput?'输出：完整角色':`输出：${output.modules.length?output.modules.map(id=>OUTPUT_MODULES[id]).join('、'):'空'}`)];
  if(fullOutput)badges.push(chip(state.capture === 'head' ? '头部构图' : '全身构图'));
  if(selected('face'))badges.push(chip('头部结构',state.headEnabled));
  for (const [module, label] of [['hair', '发型'], ['makeup', '妆容'], ['expression', '表情'], ['apparentAge', '年龄']]) {
    const setting = state.appearance[module];
    if(!selected(module==='apparentAge'?'age':module))continue;
    if (setting?.state === 'selected') badges.push(chip(label));
    else if (setting?.state === 'off') badges.push(chip(`${label}关闭`, false));
  }
  if(selected('body'))badges.push(chip(bodyOn && state.capture === 'full_body' ? '身体轮廓' : bodyOn ? '身体已保留' : '身体关闭', bodyOn && state.capture === 'full_body'));
  if(!fullOutput&&output.context!=='none')badges.push(chip(`上下文：${{default:'中性',random:'固定种子',clay:'白模载体'}[output.context]}`));
  $('module-summary').replaceChildren(...badges);
  const warnings = [...new Set(result.warnings.map(item => typeof item === 'string' ? item : String(item)))];
  $('warning-list').replaceChildren(...warnings.map(message => element('li', '', message)));
  $('warnings').hidden = warnings.length === 0;
  $('warnings-title').textContent = `编译提示 · ${warnings.length}`;
  shell?.syncState();
}
function uniqueSeed() {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function configText() {
  const exported = exportWorkbench(state);
  return typeof exported === 'string' ? exported : JSON.stringify(exported, null, 2);
}
function parseConfig(text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('配置文件超过 1 MB。');
  return importWorkbench(text);
}
function download(filename, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bindEvents() {
  $('head-enabled').addEventListener('change', event => update(next => { next.headEnabled = event.target.checked; }));
  $('body-enabled').addEventListener('change', event => update(next => {
    if (event.target.checked) { next.body.state = 'selected'; next.body.controls ??= {}; next.capture = 'full_body'; }
    else { next.body.state = 'off'; }
  }, event.target.checked ? '身体模块已启用，并切换为全身构图。勾选需要输出的身体参数。' : '身体模块已关闭；已选数值保留，不写入提示词。'));
  $('capture').addEventListener('change', event => update(next => { next.capture = event.target.value; }));
  $('hair-search').addEventListener('input', () => populateCatalog($('hair-select'), 'hair', $('hair-search').value));
  $('makeup-search').addEventListener('input', () => populateCatalog($('makeup-select'), 'makeup', $('makeup-search').value));
  for (const module of ['hair', 'makeup', 'expression']) $(module + '-select').addEventListener('change', event => setAppearance(module, event.target.value));
  $('age-mode').addEventListener('change', event => update(next => {
    if (event.target.value === 'inherit') delete next.appearance.apparentAge;
    else if (event.target.value === 'off') next.appearance.apparentAge = { state: 'off' };
    else next.appearance.apparentAge = { state: 'selected', years: 26 };
  }));
  $('age-range').addEventListener('input', event => update(next => { next.appearance.apparentAge = { state: 'selected', years: Number(event.target.value) }; }));
  $('age-number').addEventListener('change', event => {
    const value = event.target.value;
    if (!value.trim() || !event.target.checkValidity()) { notify('外观年龄须为 18–90 之间的整数。', true); sync(promptResult(compileWorkbench(state))); return; }
    update(next => { next.appearance.apparentAge = { state: 'selected', years: Number(value) }; });
  });
  const reroll = scope => {
    try {
      const result=randomizeWorkbenchDetailed(state,uniqueSeed(),{scope});
      if(result.report.noOp) {notify(`没有可变化的项目。固定值与当前种子保持不变${result.report.skipped.length?`；${result.report.skipped.length} 个关联组因固定/停用而跳过`:''}。`);return;}
      const previous=structuredClone(state);undoState=previous;
      const label={global:'全局',head:'头部',appearance:'外观',body:'身体'}[scope];
      if(!commit(result.state,`${label}已重抽 ${result.report.applied.length} 项，${result.report.changed.length} 项数值/选择变化${result.report.skipped.length?`；${result.report.skipped.length} 个关联组因固定/停用而整体跳过`:''}。可撤销本次重抽。`,{preserveUndo:true}))undoState=null;
    } catch (error) { notify(`重抽已取消，当前参数未改变：${errorText(error)}`, true); }
  };
  $('randomize').addEventListener('click',()=>reroll('global'));
  $('randomize-tab').addEventListener('click',()=>reroll(shell?.getActiveTab()??'head'));
  $('undo-randomize').addEventListener('click',()=>{if(undoState){const previous=undoState;undoState=null;commit(previous,'已撤销最近一次重抽，包括当时的参数、固定与范围。');}});
  $('reset').addEventListener('click', () => {
    undoState=null;
    try { const next = createDefaultState(); if (commit(next, '已恢复默认参数。已保存的本机配置未更改。')) { $('hair-search').value = $('makeup-search').value = ''; syncAppearance(); } }
    catch (error) { notify(`重置失败：${errorText(error)}`, true); }
  });
  $('save-local').addEventListener('click', () => shell.saveLocal());
  $('load-local').addEventListener('click', () => shell.loadLocal());
  $('export-json').addEventListener('click', () => {
    try { download('visage-workbench-v0.12.json', configText(), 'application/json;charset=utf-8'); notify('已发起 JSON 下载，可用于备份或重新导入。'); }
    catch (error) { notify(`导出失败：${errorText(error)}`, true); }
  });
  $('import-json').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; const sequence = ++importSequence; const revision = stateRevision; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('配置文件超过 1 MB。');
      const candidate = parseConfig(await file.text());
      if (sequence !== importSequence) return;
      if (revision !== stateRevision) { notify('读取文件期间参数已变化，本次导入未应用。请重新选择文件。', true); return; }
      commit(candidate, `已导入 ${file.name}。`);
    } catch (error) { if (sequence === importSequence) notify(`导入失败，当前参数未改变：${errorText(error)}`, true); }
  });
  $('select-prompt').addEventListener('click', () => { $('prompt-output').focus(); $('prompt-output').select(); notify('已选中提示词，可按 Ctrl+C 或 ⌘C 复制。'); });
  $('copy-prompt').addEventListener('click', async () => {
    const sequence=++copySequence,revision=stateRevision,notification=notificationSequence,text=compiledPrompt;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(text); if(sequence===copySequence&&revision===stateRevision&&notification===notificationSequence)notify('提示词已复制。',false,2500);
    } catch {
      if(sequence!==copySequence||revision!==stateRevision||notification!==notificationSequence)return;
      $('prompt-output').focus(); $('prompt-output').select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual copy remains available. */ }
      notify(copied ? '提示词已复制。' : '浏览器限制自动复制。已选中提示词，请按 Ctrl+C 或 ⌘C。', !copied, copied?2500:8000);
    }
  });
}
function initialize() {
  $('expression-select').append(option('inherit', '继承原配置'), option('off', '关闭表情修饰'), ...Object.entries(expressionLabels).map(([id, label]) => option(id, label)));
  buildIdentity();buildSampling();buildHead(); buildBody();buildOutput(); bindEvents();
  if (!commit(createDefaultState())) throw new Error('默认配置初始化失败。');
  shell=initializeShell({getState:()=>state,commit,notify});
}
try { initialize(); }
catch (error) { $('compile-status').textContent = '载入失败'; $('prompt-output').placeholder = '无法载入工作台。请使用构建生成的离线 HTML 文件。'; notify(`工作台载入失败：${errorText(error)}`, true); }
