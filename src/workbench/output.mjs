import { compileFacePrompt, describeFaceValue } from '../compiler/gpt-image-2.5.mjs';
import { validateProfile } from '../compiler/validate.mjs';
import { appearanceCatalog, validateAppearance, resolvePresetId, resolveAppearance } from '../appearance/modules.mjs';
import { validateBody, describeBodyValue } from '../body/body.mjs';
import { catalogChinese } from './catalog.zh.mjs';
import { FACE_AXES_ZH, describeFaceValueChinese, describeBodyValueChinese } from './geometry.zh.mjs';

export const OUTPUT_VERSION='output-v0.1';
export const OUTPUT_MODULES=Object.freeze({identity:'身份',face:'脸部',hair:'发型',makeup:'妆容',expression:'表情',age:'外观年龄',body:'体型'});
const moduleIds=Object.keys(OUTPUT_MODULES);
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
const own=(o,k)=>Object.hasOwn(o??{},k);
const headSections=['face_geometry','soft_tissue','eyes','eyebrows','nose','mouth'];
export function createOutputSettings(overrides={}) {
 if(!object(overrides)) throw new Error('输出设置必须是对象');
 const settings={version:OUTPUT_VERSION,language:'en',mode:'full',modules:[...moduleIds],context:'none',contextSeed:'context-01',...structuredClone(overrides)};
 validateOutput(settings);return settings;
}
export function validateOutput(settings) {
 if(!object(settings)) throw new Error('输出设置必须是对象');
 const fields=['version','language','mode','modules','context','contextSeed'];
 for(const k of Object.keys(settings)) if(!fields.includes(k)) throw new Error(`未知输出设置：${k}`);
 for(const k of fields) if(!own(settings,k)) throw new Error(`缺少输出设置：${k}`);
 if(settings.version!==OUTPUT_VERSION) throw new Error('不支持的输出设置版本');
 if(!['en','zh'].includes(settings.language)) throw new Error('输出语言必须是 en 或 zh');
 if(!['full','selected'].includes(settings.mode)) throw new Error('输出模式必须是 full 或 selected');
 if(!Array.isArray(settings.modules)||settings.modules.some(m=>!moduleIds.includes(m))||new Set(settings.modules).size!==settings.modules.length) throw new Error('输出模块必须有效且不重复');
 if(!['none','default','random','clay'].includes(settings.context)) throw new Error('未知补全模式');
 if(typeof settings.contextSeed!=='string'||!settings.contextSeed.trim()||settings.contextSeed.length>200) throw new Error('补全种子须为 1–200 字符');
 return settings;
}
const fieldsZh={color:'颜色',length:'长度',cut:'剪裁',fringe:'刘海',part:'分缝',texture:'质感',volume:'发量',arrangement:'盘扎结构',front:'前侧',sides:'两侧',back:'后侧',accessories:'配饰',coverage:'遮盖度',finish:'底妆光泽',browRendering:'眉部画法',eyelinerGeometry:'眼线形状',lashes:'睫毛',shadowPlacement:'眼影位置',blushPlacement:'腮红位置',contour:'修容',highlight:'高光',lipBoundary:'唇缘',lipFinish:'唇部光泽',palette:'配色',ornament:'装饰'};
const expressions={
 relaxed_neutral:['Relaxed neutral expression, resting brows, naturally open eyes and relaxed closed lips','放松的中性表情，眉毛自然静止，双眼自然睁开，嘴唇放松闭合'],
 slight_smile:['A slight closed-mouth smile, gently raised mouth corners and subtle cheek lift','轻微闭嘴微笑，嘴角轻轻上扬，面颊略微提起'],
 broad_smile:['A broad smile with parted lips, raised cheeks and naturally narrowed eye apertures','开怀微笑，嘴唇分开，面颊抬起，眼裂自然收窄'],
 frown:['A posed frown, drawn-together lowered brows and mildly tense lips','皱眉表情，眉毛向中间靠拢并下压，嘴唇略微紧绷'],
 surprise:['A posed surprised expression, raised brows, widened eye apertures and slightly parted lips','惊讶表情，眉毛抬起，眼裂睁大，嘴唇微张']
};
const contours={smooth_taper:['a continuous smooth contour tapering from the cheeks through the jaw to the chin','从面颊经下颌到下巴连续平滑收束的轮廓'],angular_taper:['an angular contour tapering from the cheeks through the jaw to the chin','从面颊经下颌到下巴带有棱角并逐渐收束的轮廓'],near_parallel:['nearly parallel lateral contours from the cheeks to the jaw','从面颊到下颌近乎平行的两侧轮廓']};
const englishLabel=k=>k.replace(/[A-Z]/g,c=>' '+c.toLowerCase());
const stop=zh=>zh?'。':'.';
const sentence=(parts,zh)=>parts.filter(Boolean).join(zh?'；':'; ')+stop(zh);
function axisPhrases(section,values={},zh=false) {
 const regional=section==='soft_tissue'&&(own(values,'upper_medial_cheek_fullness')||own(values,'lateral_cheek_fullness'));
 return Object.keys(FACE_AXES_ZH[section]).filter(k=>own(values,k)&&!(regional&&k==='cheek_fullness')).map(k=>zh?describeFaceValueChinese(section,k,values[k]):describeFaceValue(section,k,values[k]));
}
// Text is data: do not trim, normalize underscores, split, translate or interpolate
// user content through the owned-string translation map.
function textPhrases(values,fields,zh,custom) {
 return Object.entries(fields).flatMap(([key,labels])=>own(values,key)?(custom.push(values[key]),[`${labels[zh?1:0]}${zh?'：':': '}${values[key]}`]):[]);
}
function faceParagraphs(state,zh,custom) {
 const p=state.profile,paragraphs=[];
 if(state.headEnabled) for(const section of headSections) {
  const parts=axisPhrases(section,p[section],zh);
  if(section==='face_geometry'&&own(p[section],'face_shape')) parts.unshift(...textPhrases(p[section],{face_shape:['Face shape','脸型']},zh,custom));
  if(section==='face_geometry'&&p[section]?.cheek_to_chin_contour)parts.push(contours[p[section].cheek_to_chin_contour][zh?1:0]);
  if(section==='eyes')parts.push(...textPhrases(p.eyes,{upper_eyelid:['Upper eyelids','上眼睑'],lower_eyelid_shape:['Lower eyelids','下眼睑']},zh,custom));
  if(parts.length) paragraphs.push(sentence(parts,zh));
 }
 const skin=[...textPhrases(p.skin,{tone:['Skin tone','肤色'],texture:['Skin texture','皮肤质感']},zh,custom),...axisPhrases('skin',p.skin,zh)];
 if(skin.length)paragraphs.push(sentence(skin,zh));
 return paragraphs;
}
function identityParagraph(state,zh,custom,full=false) {
 const s=state.profile.subject??{},parts=[];
 const gender=s.gender_presentation??'person';
 const role=gender==='person'?(zh?'人物':'person'):(custom.push(gender),gender);
 let intro=full?(zh?`创作一幅写实肖像，描绘一位虚构的成年人（${role}）`:`Create a realistic portrait of one adult fictional ${role}`):(zh?`身份：虚构${role==='人物'?'人物':`人物；性别呈现：${role}`}`:`Identity: fictional ${role}`);
 if(own(s,'appearance')){custom.push(s.appearance);intro+=zh?`；外貌：${s.appearance}`:`; appearance: ${s.appearance}`;}
 if(full&&state.appearance.apparentAge?.state==='selected')intro+=zh?`；外观约${state.appearance.apparentAge.years}岁`:`; approximately ${state.appearance.apparentAge.years} years old`;
 parts.push(intro+stop(zh));
 if(s.overall_impression?.length){custom.push(...s.overall_impression);parts.push((zh?'整体印象：':'Overall impression: ')+[...new Set(s.overall_impression)].join(zh?'、':', ')+stop(zh));}
 return parts;
}
function ageParagraph(state,zh) {
 const age=state.appearance.apparentAge;
 if(age?.state==='off')return [];
 if(age?.state==='selected')return [zh?`外观年龄：成年人，约${age.years}岁。`:`Apparent age: adult, approximately ${age.years} years old.`];
 return [zh?'年龄范围：成年人。':'Age group: adult.'];
}
function appearanceParagraph(state,module,zh,custom) {
 const setting=state.appearance[module];
 if(setting?.state==='off')return [];
 if(setting?.state==='selected') {
  if(module==='expression')return [expressions[setting.preset][zh?1:0]+stop(zh)];
  const entry=appearanceCatalog[module][resolvePresetId(module,setting.preset)];
  const base={...entry.geometry,...(entry.accessories?{accessories:entry.accessories}:{})};
  const resolved={...base,...setting.overrides};
  const parts=Object.entries(resolved).flatMap(([field,value])=>{
   const overridden=own(setting.overrides,field);
   // Only the owned unspecified sentinel is absent direction. A custom literal
   // "unspecified" is user content and must not silently disappear.
   if(!overridden&&value==='unspecified')return [];
   let rendered;
   if(overridden){custom.push(...[value].flat());rendered=Array.isArray(value)?(value.length?value.join(zh?'、':', '):(zh?'无':'none')):value;}
   else if(Array.isArray(value))rendered=value.length?value.map(v=>zh?catalogChinese(v,module,field):v).join(zh?'、':', '):(zh?'无':'none');
   else rendered=zh?catalogChinese(value,module,field):value.replaceAll('_',' ');
   return [`${zh?fieldsZh[field]:englishLabel(field)}${zh?'：':': '}${rendered}`];
  });
  return parts.length?[(zh?(module==='hair'?'发型：':'妆容施加：'):(module==='hair'?'Hair styling: ':'Makeup application: '))+sentence(parts,zh)]:[];
 }
 const p=state.profile[module]??{};
 if(module==='hair') {
  const parts=[...textPhrases(p,{color:['Hair color','发色'],length:['Hair length','头发长度'],texture:['Hair texture','头发质感'],parting:['Parting','分缝'],face_framing:['Face framing','面部周围发束']},zh,custom),...axisPhrases('hair',p,zh)];
  return parts.length?[sentence(parts,zh)]:[];
 }
 if(module==='expression') {
  const parts=[...textPhrases(p,{expression:['Expression','表情']},zh,custom),...axisPhrases('expression',p,zh)];
  return parts.length?[sentence(parts,zh)]:[];
 }
 if(p.intensity===0)return [zh?'不施妆。':'No makeup.'];
 const parts=textPhrases(p,{base:['Base','底妆'],eyeliner:['Eyeliner','眼线'],eyeshadow:['Eyeshadow','眼影'],lashes:['Lashes','睫毛'],blush:['Blush','腮红'],lip_style:['Lip styling','唇妆'],lip_color:['Lip color','唇色']},zh,custom);
 if(p.intensity!==undefined){const i=p.intensity<=10?0:p.intensity<=30?1:p.intensity<=50?2:p.intensity<=70?3:p.intensity<=85?4:5;parts.unshift(zh?['几乎不可见的妆容','极淡妆','淡妆','中等浓度妆容','浓妆','极浓妆'][i]:['Barely visible makeup','Minimal makeup','Light makeup','Moderate makeup','Strong makeup','Very strong makeup'][i]);}
 return parts.length?[sentence(parts,zh)]:[];
}
function bodyParagraph(state,zh) {
 if(state.body.state!=='selected'||state.capture==='head')return [];
 const parts=Object.entries(state.body.controls).map(([id,v])=>zh?describeBodyValueChinese(id,v):describeBodyValue(id,v));
 return parts.length?[(zh?'成年人体型比例及可见轮廓：':'Adult body proportions and visible contours: ')+sentence(parts,zh)]:[];
}
const modulePaths={identity:['profile.subject.appearance','profile.subject.gender_presentation','profile.subject.overall_impression'],face:[...headSections.map(s=>'profile.'+s),'profile.skin','headEnabled'],hair:['profile.hair','appearance.hair'],makeup:['profile.makeup','appearance.makeup'],expression:['profile.expression','appearance.expression'],age:['profile.subject.age_group','appearance.apparentAge'],body:['body','capture']};
function lockedModule(state,module) {
 return (state.constraints?.locks??[]).some(lock=>modulePaths[module].some(path=>path===lock||path.startsWith(lock+'.')||lock.startsWith(path+'.')));
}
// Stateless FNV-1a choice: frozen by the explicit seed, domain, and catalog version.
// Rendering, language switches and tab changes never consume random state.
function choice(seed,module,size) {let h=2166136261;for(const c of `${OUTPUT_VERSION}|${seed}|${module}`){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)%size;}
const contextDefaults={identity:['a generic fictional person; appearance and gender presentation unspecified','通用虚构人物，外貌与性别呈现不指定'],face:['generic neutral facial geometry; skin color and detailed features unspecified','通用中性脸部几何，肤色和具体五官不指定'],hair:['a simple unobtrusive hair arrangement; hair color unspecified','简洁、不抢眼的发型，发色不指定'],makeup:['makeup details unspecified','妆容细节不指定'],expression:['a relaxed neutral expression','放松的中性表情'],age:['adult; exact apparent age unspecified','成年人，具体外观年龄不指定'],body:['generic adult proportions; detailed body traits unspecified','通用成年人体型比例，具体体型特征不指定']};
const contextRandom={
 identity:[['a generic fictional subject with no added identity descriptors','通用虚构主体，不添加身份描述']],
 face:[['an understated generic face with softly modeled forms; skin color unspecified','低调的通用脸部，形体柔和，肤色不指定'],['a generic face with evenly modeled forms; skin color unspecified','通用脸部，形体均衡，肤色不指定']],
 hair:[['a simple gathered-back arrangement; color unspecified','简洁向后收拢的发型，颜色不指定'],['a simple loose arrangement; color unspecified','简洁披散的发型，颜色不指定'],['a simple tucked-back arrangement; color unspecified','简洁向后收起的发型，颜色不指定']],
 makeup:[['barely visible neutral makeup','几乎不可见的中性妆容'],['light neutral makeup with restrained shine','光泽克制的淡中性妆容']],
 expression:[['a relaxed neutral expression','放松的中性表情'],['a restrained closed-mouth smile','克制的闭嘴微笑']],
 age:[['adult; exact apparent age unspecified','成年人，具体外观年龄不指定']],
 body:[['generic adult proportions in a relaxed upright stance','通用成年人体型比例，放松直立'],['generic adult proportions in a balanced standing stance','通用成年人体型比例，均衡站姿']]
};
function contextParagraph(state,settings,zh,selected,warnings) {
 const omitted=moduleIds.filter(m=>!selected.includes(m));
 const result={mode:settings.mode==='full'?'none':settings.context,seed:settings.context==='random'?settings.contextSeed:null,excludedLockedModules:[],modules:[],paragraphs:[]};
 if(settings.mode==='full'||settings.context==='none'||!omitted.length)return result;
 if(settings.context==='clay') {
  // Clay is an explicit display-material choice, never a character parameter
  // edit: use a separate generic support, not the stored omitted anatomy.
  result.modules=omitted;
  const named=result.modules.map(m=>zh?OUTPUT_MODULES[m]:m).join(zh?'、':', ');
  const keep=selected.map(m=>zh?OUTPUT_MODULES[m]:m).join(zh?'、':', ');
  if(named)result.paragraphs.push(zh?`白模补全仅用于未选模块（${named}）：使用无涂装的通用中性白色黏土展示载体（仅当脸部未选时使用白模头，体型未选时使用白模身体），不复制未选模块已保存的特征；身份和精确年龄不作造型推断。已选模块（${keep}）保留其指定的形状、颜色、质感与妆容，白色黏土材质不得覆盖它们。`:`White-clay context only for unselected modules (${named}): use an unpainted generic neutral white-clay display support (a mannequin head only when face is unselected, a mannequin body only when body is unselected), without copying saved traits from omitted modules; do not infer identity or exact age from its form. Preserve all specified shapes, colors, textures and cosmetics of selected modules (${keep}); never apply the white-clay material to them.`);
 } else {
  result.excludedLockedModules=omitted.filter(m=>lockedModule(state,m));
  result.modules=omitted.filter(m=>!result.excludedLockedModules.includes(m));
  const parts=result.modules.map(m=>{const variants=contextRandom[m],value=settings.context==='random'?variants[choice(settings.contextSeed,m,variants.length)]:contextDefaults[m];return `${zh?OUTPUT_MODULES[m]:m}${zh?'：':': '}${value[zh?1:0]}`;});
  if(parts.length) result.paragraphs.push((zh?(settings.context==='random'?'固定种子的辅助呈现建议，仅补全未选模块：':'中性默认补全，仅用于未选模块：'):(settings.context==='random'?'Frozen-seed complementary presentation suggestions, unselected modules only: ':'Neutral default context, unselected modules only: '))+sentence(parts,zh));
 }
 if(result.excludedLockedModules.length)warnings.push('未选且包含固定参数的模块不参与补全：'+result.excludedLockedModules.map(m=>OUTPUT_MODULES[m]).join('、')+'。补全不会改变角色参数或固定状态。');
 if(settings.context==='random')warnings.push('随机补全是由独立种子固定的有限呈现建议，不是角色重抽；不会输出未选模块原有参数，也不保证图像中的像素固定。');
 return result;
}
function validateSource(state) {
 if(!object(state))throw new Error('配置必须是对象');
 validateProfile(state.profile);validateAppearance(state.appearance);validateBody(state.body);
 if(state.profile.subject?.age_group!=='adult')throw new Error('输出仅支持成年人物');
 if(typeof state.headEnabled!=='boolean')throw new Error('headEnabled 必须为布尔值');
 if(!['head','full_body'].includes(state.capture))throw new Error('构图必须是 head 或 full_body');
 if(state.constraints!==undefined&&(!object(state.constraints)||!Array.isArray(state.constraints.locks)||state.constraints.locks.some(p=>typeof p!=='string')))throw new Error('固定字段列表无效');
}
export function compileOutput(state,settings=state?.output??createOutputSettings()) {
 validateSource(state);validateOutput(settings);
 const zh=settings.language==='zh',selected=settings.mode==='full'?[...moduleIds]:moduleIds.filter(m=>settings.modules.includes(m)),warnings=[],custom=[],paragraphs=[];
 if(!selected.length)return {prompt:'',warnings:['未选择输出模块；请勾选要输出的内容。'],settings:structuredClone(settings),context:{mode:'none',seed:null,excludedLockedModules:[],modules:[],paragraphs:[]}};
 if(settings.mode==='full'&&settings.language==='en') {
  const p=structuredClone(state.profile);if(!state.headEnabled)for(const section of headSections)delete p[section];
  const prompt=compileFacePrompt(p,{preset:'profile',enhancers:true,appearance:state.appearance,body:state.body,capture:state.capture});
  // Custom text in this compatibility path keeps the historical compiler rules.
  if(Object.values(state.profile).some(v=>object(v)&&Object.values(v).some(x=>typeof x==='string'&&/[\s_]/.test(x)))||['hair','makeup'].some(m=>Object.keys(state.appearance[m]?.overrides??{}).length))warnings.push('完整英文沿用原编译器；自定义文本仍按旧规则整理空白和下划线。中文与局部输出按输入原文保留。');
  if(settings.context!=='none')warnings.push('完整输出已包含所有模块，补全模式不应用。');
  return {prompt,warnings:[...new Set([...warnings,...moduleWarnings(state,selected),...appearanceWarnings(state,selected,settings)])],settings:structuredClone(settings),context:{mode:'none',seed:null,excludedLockedModules:[],modules:[],paragraphs:[]}};
 }
 if(selected.includes('identity'))paragraphs.push(...identityParagraph(state,zh,custom,settings.mode==='full'));
 if(selected.includes('age')&&settings.mode!=='full')paragraphs.push(...ageParagraph(state,zh));
 if(selected.includes('face'))paragraphs.push(...faceParagraphs(state,zh,custom));
 for(const module of ['hair','makeup','expression'])if(selected.includes(module))paragraphs.push(...appearanceParagraph(state,module,zh,custom));
 if(selected.includes('body'))paragraphs.push(...bodyParagraph(state,zh));
 if(settings.mode==='full') {
  paragraphs.push(state.capture==='full_body'?'全身构图，成年人物从头到脚完整可见，平视视角，放松站姿。穿普通不透明日常服装，不指定服装风格目录。柔和中性影棚光，纯净中性背景。自然比例和皮肤质感，不使用美颜滤镜。':'头肩肖像，平视视角，柔和中性影棚光，纯净中性背景。自然比例和皮肤质感，不使用美颜滤镜。');
  paragraphs.push(state.capture==='full_body'?'保留指定的面部与体型比例；成年人体结构保持写实且自然协调。':'优先保留面部结构与五官比例；人体结构保持写实且自然协调。');
  if(settings.context!=='none')warnings.push('完整输出已包含所有模块，补全模式不应用。');
 }
 const context=contextParagraph(state,settings,zh,selected,warnings);paragraphs.push(...context.paragraphs);
 if(custom.length)warnings.push('自定义文本按原文保留，不会自动翻译；中文输出中仍可能出现用户输入的其他语言。');
 warnings.push(...moduleWarnings(state,selected),...appearanceWarnings(state,selected,settings));
 if(!paragraphs.length)warnings.push('所选模块当前没有可输出内容；关闭、继承空值和头肩构图下的体型均不会自动启用。');
 return {prompt:paragraphs.join('\n\n'),warnings:[...new Set(warnings)],settings:structuredClone(settings),context};
}
function moduleWarnings(state,selected) {
 const warnings=[];
 if(selected.includes('body')&&state.body.state==='selected')warnings.push('体型数值是三档视觉描述，同档数值产生相同词句；不是人体测量或图像精度保证。');
 if(selected.includes('body')&&state.body.state==='selected'&&state.capture==='head')warnings.push('当前头肩构图不输出体型描述，已选参数仍保留。');
 for(const module of ['hair','makeup']) if(selected.includes(module)&&Object.keys(state.appearance[module]?.overrides??{}).length)warnings.push(`${OUTPUT_MODULES[module]}自定义覆盖是自由文本；覆盖后不保证预设的历史准确性、物理兼容性或遮挡估计仍适用。`);
 return warnings;
}
const warningZh={
 'Age cues can change perceived soft tissue, skin texture and facial proportions; baseline parameters are unchanged. This is an approximate appearance target, not an exact age guarantee.':'年龄线索可能改变软组织、皮肤质感与面部比例的观感；底层参数不变。外观年龄是近似目标，不是精确年龄保证。',
 'Muscle action changes visible brow height, eye aperture, cheek lift and mouth shape; neutral feature values are not a pixel-level lock.':'表情肌肉动作会改变可见眉位、眼裂、面颊和嘴形；中性五官数值不是像素级固定。',
 'Hair silhouette and occlusion change the apparent forehead, temples, cheeks and jaw.':'发型轮廓与遮挡会改变额头、太阳穴、面颊和下颌的观感。',
 'Cosmetic edges, highlights and shadows change perceived brows, eyes, nose, cheeks and lip boundaries.':'妆容边缘、高光与阴影会改变眉、眼、鼻、面颊及唇缘的观感。',
 'Hair silhouette and occlusion can alter perceived facial proportions.':'发型轮廓与遮挡可能改变面部比例的观感。',
 'Unobserved construction and rear topology are not established; this is a visible-silhouette interpretation, not an exact reconstruction.':'未观察到的构造与后侧结构尚未证实；这是对可见轮廓的诠释，并非精确复原。',
 'Legacy overall impression remains active and can bias appearance; use enhancers false for isolated module comparisons.':'旧版整体印象仍生效，可能影响外观；局部输出时排除身份模块可避免该影响。',
 'Profile capture is free text: check lighting, view and styling words manually for semantic conflicts.':'自由文本可能含有光照、视角与造型用词，请检查潜在的语义冲突。',
 'hair overrides are authored free-text geometry. Historical accuracy, physical compatibility and preset occlusion metadata are not guaranteed after overrides.':'发型覆盖是用户自定义的自由文本几何描述；覆盖后不保证历史准确性、物理兼容性与预设遮挡信息仍适用。',
 'makeup overrides are authored free-text geometry. Historical accuracy, physical compatibility and preset occlusion metadata are not guaranteed after overrides.':'妆容覆盖是用户自定义的自由文本几何描述；覆盖后不保证历史准确性、物理兼容性与预设遮挡信息仍适用。'
};
function appearanceWarnings(state,selected,settings) {
 const config={version:state.appearance.version};
 for(const m of ['hair','makeup','expression','age']){const key=m==='age'?'apparentAge':m;if(selected.includes(m)&&own(state.appearance,key))config[key]=state.appearance[key];}
 const profile=selected.includes('identity')?state.profile:{};
 const warnings=resolveAppearance(config,{preset:settings.mode==='full'?'profile':'none',enhancers:selected.includes('identity'),profile}).warnings;
 return settings.language==='zh'?warnings.map(w=>warningZh[w]??w):warnings;
}
