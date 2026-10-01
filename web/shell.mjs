import { createDefaultState, importWorkbench, exportWorkbench } from '../src/workbench/state.mjs';
import { createWorkspace, validateWorkspace, addCharacter, renameCharacter, updateDraft, saveVersion, activateCharacter, restoreVersion } from '../src/workbench/workspace.mjs';
import { icon, decorateIcons } from './icons.mjs';
import { exampleImage } from './example-image.mjs';

const WORKSPACE_KEY = 'visage.workspace.v0.1';
const LEGACY_KEY = 'visage.workbench.v0.1';
const UI_KEY = 'visage.ui.v0.1';
const $ = id => document.getElementById(id);
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const sameCharacterParameters=(a,b)=>{const left={...a},right={...b};delete left.output;delete right.output;return equal(left,right);};
export function boundedSplit(value) { const n=Number(value); return Number.isFinite(n)?Math.round(Math.max(35,Math.min(78,n))*10)/10:65; }
export function splitBounds(height) { const available=Math.max(434,Number(height)-14||434);return {min:Math.ceil(Math.max(35,240/available*100)*10)/10,max:Math.floor(Math.min(78,(available-194)/available*100)*10)/10}; }
export function initializeShell({getState,commit,notify}) {
  let workspace=createWorkspace(getState()), ui={theme:'light',split:65,navCollapsed:false}, suppressSync=false, referenceSequence=0, dirty=true;
  const references=new Map();
  let activeTab='head';
  const active=()=>workspace.characters.find(c=>c.id===workspace.activeId);
  const make=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  try {const saved=JSON.parse(localStorage.getItem(UI_KEY)??'null');if(saved&&typeof saved==='object'){ui.theme=saved.theme==='dark'?'dark':'light';ui.split=boundedSplit(saved.split);ui.navCollapsed=saved.navCollapsed===true;}}catch{/* Local preferences are optional. */}
  const rememberUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch{/* The visible controls still work with storage disabled. */}};
  function applyUI(){
    document.documentElement.setAttribute('data-theme',ui.theme);
    $('theme-toggle').replaceChildren(icon(ui.theme==='dark'?'sun':'moon'));
    $('theme-toggle').setAttribute('aria-label',ui.theme==='dark'?'切换浅色主题':'切换深色主题');$('theme-toggle').title=ui.theme==='dark'?'切换浅色主题':'切换深色主题';
    $('app-shell').classList.toggle('nav-collapsed',ui.navCollapsed);$('expand-nav').hidden=!ui.navCollapsed;$('collapse-nav').setAttribute('aria-expanded',String(!ui.navCollapsed));
    const bounds=splitBounds($('center-column').getBoundingClientRect().height);ui.split=Math.max(bounds.min,Math.min(bounds.max,ui.split));
    $('preview-divider').setAttribute('aria-valuemin',String(bounds.min));$('preview-divider').setAttribute('aria-valuemax',String(bounds.max));
    $('center-column').style.setProperty('--split',`${ui.split}%`);$('preview-divider').setAttribute('aria-valuenow',String(ui.split));$('preview-divider').setAttribute('aria-valuetext',`参考图占 ${Math.round(ui.split)}%`);
  }
  function selectTab(name,focus=false){
    activeTab=name;const label={head:'头部',appearance:'外观',body:'身体'}[name];
    $('randomize-tab').replaceChildren(icon('refresh-cw'),document.createTextNode?.(`只重抽${label}`)??make('span','',`只重抽${label}`));
    $('randomize-tab').setAttribute('aria-label',`只重抽当前${label}标签的未固定项`);
    $('randomize-tab').setAttribute('aria-controls',`panel-${name}`);
    for(const tab of ['head','appearance','body']){const selected=tab===name;$(`tab-${tab}`).setAttribute('aria-selected',String(selected));$(`tab-${tab}`).tabIndex=selected?0:-1;$(`panel-${tab}`).hidden=!selected;if(selected&&focus)$(`tab-${tab}`).focus();}
    $('inspector-scroll').scrollTop=0;
  }
  function clearReference(id){const prior=references.get(id);if(prior?.objectURL)URL.revokeObjectURL(prior.url);references.delete(id);}
  function showReference(){
    const ref=references.get(workspace.activeId);const image=$('reference-image');image.hidden=!ref;$('reference-empty').hidden=!!ref;$('clear-reference').hidden=!ref;$('reference-source').hidden=!ref;
    $('reference-stage').classList.toggle('is-example',ref?.kind==='example');
    if(ref){image.src=ref.url;image.alt=ref.kind==='example'?'项目 v0.8 合成角色的静态示例，不是当前参数生成结果':`当前角色导入的静态参考：${ref.name}`;$('reference-source').textContent=ref.kind==='example'?'静态示例 · v0.8':`本地参考 · ${ref.name}`;}
    else image.removeAttribute('src');
    const stale=ref?.kind==='import'&&!sameCharacterParameters(ref.state,getState());
    $('reference-label').textContent=!ref?'参考图片仅在本机展示，不随参数变化':ref.kind==='example'?'静态示例，非当前参数生成结果':stale?'参数已更改 · 参考图片不会同步更新':'导入参考 · 不随参数变化，仅保留在当前会话';
    $('reference-label').parentElement.classList.toggle('is-stale',stale);
  }
  function renderCharacters(){
    const focused=document.activeElement;const restoreFocus=focused&&$('character-list').contains(focused)?focused.id:null;
    const cards=workspace.characters.map(character=>{
      const selected=character.id===workspace.activeId;const card=make('div',`character-card${selected?' is-active':''}`);const button=make('button','character-select');button.type='button';button.id=`character-${character.id}`;button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`选择角色 ${character.name}`);
      const avatar=make('span','character-avatar'),reference=references.get(character.id);
      if(reference){const image=make('img');image.src=reference.url;image.alt='';image.style.width='100%';image.style.height='100%';image.style.objectFit='cover';avatar.append(image);}else avatar.append(icon('user'));
      const text=make('span','character-text');text.append(make('span','character-name',character.name),make('small','',`${character.versions.length} 个版本`));button.append(avatar,text);button.addEventListener('click',()=>{
        if(selected)return;referenceSequence++;workspace=activateCharacter(workspace,character.id);dirty=true;commit(active().draft,`已切换到 ${active().name}；当前草稿已保留。`);$('rename-form').hidden=true;
      });card.append(button);
      if(selected){
        const versions=make('div','version-list');
        const latest=character.versions.findLast?character.versions.findLast(v=>equal(v.state,character.draft)):[...character.versions].reverse().find(v=>equal(v.state,character.draft));
        const draft=make('div',`version-row${latest?'':' is-current'}`);draft.append(make('span','','工作草稿'),make('span','',latest?'与 '+latest.label+' 相同':'当前'));versions.append(draft);
        for(const version of [...character.versions].reverse()){
          const b=make('button',`version-row${latest?.id===version.id?' is-current':''}`);b.type='button';b.id=`restore-${character.id}-${version.id}`;b.setAttribute('aria-label',`读取 ${character.name} ${version.label}`);b.append(make('span','',version.label),make('span','',latest?.id===version.id?'当前':'读取'));b.addEventListener('click',()=>{workspace=restoreVersion(workspace,character.id,version.id);dirty=true;commit(active().draft,`已读取 ${character.name} ${version.label}。已保存的版本不变。`);});versions.append(b);
        }
        const save=make('button','save-version');save.type='button';save.id='save-version';save.append(icon('file-plus'),make('span','','保存版本'));save.disabled=character.versions.length>=30;save.addEventListener('click',()=>{try{workspace=saveVersion(workspace,character.id,getState());dirty=true;renderCharacters();notify('已创建版本快照。点击“保存到本机”持久保存整个工作区。');}catch(e){notify(e.message,true);}});versions.append(save);card.append(versions);
      }return card;
    });$('character-list').replaceChildren(...cards);$('current-character-title').textContent=active().name;
    const version=[...active().versions].reverse().find(v=>equal(v.state,active().draft));$('current-revision').textContent=version?.label??'草稿';$('workspace-status').textContent=dirty?'当前会话 · 有未保存更改':'已保存到当前浏览器';$('new-character').disabled=workspace.characters.length>=30;
    if(restoreFocus)$(restoreFocus)?.focus();
  }
  function syncState(){if(suppressSync)return;const changed=!equal(active().draft,getState());if(changed){workspace=updateDraft(workspace,workspace.activeId,getState());dirty=true;}renderCharacters();showReference();}
  function validateState(candidate){updateDraft(workspace,workspace.activeId,candidate);}
  function saveLocal(){
    try{
      workspace=updateDraft(workspace,workspace.activeId,getState());validateWorkspace(workspace);
      const priorLegacy=localStorage.getItem(LEGACY_KEY),priorWorkspace=localStorage.getItem(WORKSPACE_KEY);
      try{localStorage.setItem(LEGACY_KEY,exportWorkbench(getState()));localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));}
      catch(error){try{if(priorLegacy===null)localStorage.removeItem(LEGACY_KEY);else localStorage.setItem(LEGACY_KEY,priorLegacy);if(priorWorkspace===null)localStorage.removeItem(WORKSPACE_KEY);else localStorage.setItem(WORKSPACE_KEY,priorWorkspace);}catch{/* Report the original storage failure. */}throw error;}
      dirty=false;renderCharacters();notify('角色与版本已保存到当前浏览器。参考图片不保存；建议导出当前 JSON 备份。');
    }catch(e){notify(`浏览器本地保存不可用，请使用导出 JSON：${e.message}`,true);}
  }
  function loadLocal(){
    try{
      const saved=localStorage.getItem(WORKSPACE_KEY),legacy=localStorage.getItem(LEGACY_KEY);
      if(saved===null&&legacy===null){notify('当前浏览器还没有保存过配置。',true);return;}
      const candidate=saved!==null?JSON.parse(saved):createWorkspace(importWorkbench(legacy));validateWorkspace(candidate);
      const next=candidate.characters.find(c=>c.id===candidate.activeId).draft;suppressSync=true;
      const applied=commit(next,'已读取本机工作区。参考图片仅在当前会话中使用，请按需重新导入。');suppressSync=false;
      if(!applied)return;workspace=structuredClone(candidate);dirty=false;referenceSequence++;for(const id of references.keys())clearReference(id);renderCharacters();showReference();$('rename-form').hidden=true;
    }catch(e){suppressSync=false;notify(`读取失败，当前参数未改变：${e.message}`,true);}
  }
  decorateIcons();applyUI();
  $('theme-toggle').addEventListener('click',()=>{ui.theme=ui.theme==='light'?'dark':'light';applyUI();rememberUI();});
  $('collapse-nav').addEventListener('click',()=>{ui.navCollapsed=true;applyUI();rememberUI();$('expand-nav').focus();});
  $('expand-nav').addEventListener('click',()=>{ui.navCollapsed=false;applyUI();rememberUI();$('collapse-nav').focus();});
  for(const name of ['head','appearance','body']){
    $(`tab-${name}`).addEventListener('click',()=>selectTab(name));
    $(`tab-${name}`).addEventListener('keydown',event=>{const tabs=['head','appearance','body'],index=tabs.indexOf(name);let target;if(event.key==='ArrowRight')target=(index+1)%3;if(event.key==='ArrowLeft')target=(index+2)%3;if(event.key==='Home')target=0;if(event.key==='End')target=2;if(target!==undefined){event.preventDefault();selectTab(tabs[target],true);}});
  }
  $('nav-workbench').addEventListener('click',()=>{$('character-panel').scrollIntoView({behavior:'smooth',block:'nearest'});$('new-character').focus();});
  $('workspace-files').addEventListener('toggle',()=>{$('character-panel').classList.toggle('workspace-expanded',$('workspace-files').open);});
  $('nav-workspace').addEventListener('click',()=>{$('workspace-files').open=!$('workspace-files').open;$('character-panel').classList.toggle('workspace-expanded',$('workspace-files').open);$('workspace-panel').scrollIntoView({behavior:'smooth',block:'nearest'});$('save-local').focus();});
  $('nav-inspector').addEventListener('click',()=>{$('inspector').scrollIntoView({behavior:'smooth',block:'nearest'});$('tab-head').focus();});
  $('nav-help').addEventListener('click',()=>{$('help-dialog').showModal();});$('close-help').addEventListener('click',()=>$('help-dialog').close());
  $('new-character').addEventListener('click',()=>{try{workspace=addCharacter(workspace,createDefaultState());dirty=true;referenceSequence++;commit(active().draft,'已创建新角色。角色之间的参数与版本独立。');$('rename-form').hidden=true;}catch(e){notify(e.message,true);}});
  $('rename-character').addEventListener('click',()=>{$('rename-form').hidden=false;$('character-name').value=active().name;$('character-name').focus();$('character-name').select();});
  $('cancel-rename').addEventListener('click',()=>{$('rename-form').hidden=true;$('rename-character').focus();});
  $('rename-form').addEventListener('submit',event=>{event.preventDefault();try{workspace=renameCharacter(workspace,workspace.activeId,$('character-name').value);dirty=true;renderCharacters();$('rename-form').hidden=true;$('rename-character').focus();notify('角色名称已更新。');}catch(e){notify(e.message,true);}});
  $('rename-form').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();$('cancel-rename').click();}});
  const showExample=()=>{if(!exampleImage)return;referenceSequence++;clearReference(workspace.activeId);references.set(workspace.activeId,{url:exampleImage,kind:'example'});showReference();renderCharacters();};
  $('load-example').hidden=!exampleImage;$('load-example').disabled=!exampleImage;
  $('load-example').addEventListener('click',showExample);
  $('clear-reference').addEventListener('click',()=>{referenceSequence++;clearReference(workspace.activeId);showReference();renderCharacters();notify('已移除当前会话的参考图片；参数未改变。');});
  $('import-reference').addEventListener('click',()=>$('reference-file').click());
  $('reference-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0],sequence=++referenceSequence,characterId=workspace.activeId;event.target.value='';if(!file)return;
    let url;
    try{
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('请选择 PNG、JPEG、WebP 或 GIF 图片。');
      if(file.size>10*1024*1024)throw new Error('图片超过 10 MB，请选择较小的图片。');
      url=URL.createObjectURL(file);await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve():reject(new Error('图片尺寸无效。'));image.onerror=()=>reject(new Error('无法解码这张图片。'));image.src=url;});
      if(sequence!==referenceSequence||characterId!==workspace.activeId){URL.revokeObjectURL(url);return;}
      clearReference(characterId);references.set(characterId,{url,objectURL:true,kind:'import',name:file.name.slice(0,160),state:structuredClone(getState())});showReference();renderCharacters();notify('已在本机载入静态参考。图片不会上传、保存或随参数变化。');
    }catch(e){if(url)URL.revokeObjectURL(url);if(sequence===referenceSequence)notify(`参考图未更改：${e.message}`,true);}
  });
  const divider=$('preview-divider');let drag=null;
  const setSplit=value=>{ui.split=boundedSplit(value);applyUI();};
  divider.addEventListener('keydown',event=>{let next;if(event.key==='ArrowUp')next=ui.split-(event.shiftKey?10:2);if(event.key==='ArrowDown')next=ui.split+(event.shiftKey?10:2);if(event.key==='Home')next=35;if(event.key==='End')next=78;if(next!==undefined){event.preventDefault();setSplit(next);rememberUI();}});
  divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId};divider.setPointerCapture(event.pointerId);divider.classList.toggle('is-dragging',true);$('app-shell').classList.toggle('is-resizing',true);});
  divider.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const bounds=$('center-column').getBoundingClientRect();setSplit((event.clientY-bounds.top)/Math.max(1,bounds.height-14)*100);});
  const finish=event=>{if(!drag||drag.id!==event.pointerId)return;drag=null;if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);divider.classList.toggle('is-dragging',false);$('app-shell').classList.toggle('is-resizing',false);rememberUI();};
  divider.addEventListener('pointerup',finish);divider.addEventListener('pointercancel',finish);divider.addEventListener('lostpointercapture',finish);
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(()=>applyUI());observer.observe($('center-column'));}
  // The image-free backup starts empty and waits for a local reference import.
  if(exampleImage)showExample();else{showReference();renderCharacters();}
  selectTab(activeTab);
  return {syncState,saveLocal,loadLocal,validateState,getActiveTab:()=>activeTab};
}
