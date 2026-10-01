import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {boundedSplit,splitBounds} from '../web/shell.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('split values are finite, bounded and stable to one decimal',()=>{
 for(const [input,value] of [[-2,35],[300,78],[NaN,65],[Infinity,65],[55.00000000001,55],[64.36,64.4]])assert.equal(boundedSplit(input),value);
 for(const height of [480,600,650,720,800,1080]){const b=splitBounds(height),available=Math.max(434,height-14);assert(b.min<=b.max);assert(available*b.max/100+194<=available+0.01);assert(available*b.min/100>=240-0.01);}
});
test('shell retains supported controls and gives tabs/output/dialog accessible associations',()=>{
 const html=read('web/index.html'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
 for(const id of ['randomize','undo-randomize','reset','save-local','load-local','export-json','import-json','import-file','direction-select','head-enabled','head-groups','hair-search','hair-select','makeup-search','makeup-select','expression-select','age-mode','age-number','body-enabled','body-fields','body-groups','capture','prompt-output','warnings','warning-list','lock-head','lock-body','bundle-options','identity-fields','randomize-tab','prompt-language','output-scope','output-context','reroll-context'])assert(ids.includes(id),id);
 for(const name of ['head','appearance','body']){assert(html.includes(`aria-controls="panel-${name}"`));assert(html.includes(`aria-labelledby="tab-${name}"`));}
 assert.match(html,/id="prompt-output"[^>]*aria-labelledby="preview-title"/);assert.match(html,/<dialog[^>]*aria-labelledby="help-title"/);assert.match(html,/role="separator"[^>]*tabindex="0"[^>]*aria-orientation="horizontal"/);
});
test('light and dark themes retain cards, accessible focus, mobile JSON controls and bounded center rows',()=>{
 const css=read('web/workbench.css');assert(css.includes(':root[data-theme="dark"]'));assert(css.includes('--surface:rgba('));assert(css.includes('var(--radius)'));assert(css.includes('outline:2px solid var(--focus)'));assert(css.includes('calc(100% - 194px)'));assert(!/[^}]*#workspace-files[^}]*\{display:none\}/.test(css));assert(css.includes('.character-panel.workspace-expanded{max-height:none}'));
});
test('vendored Feather icon selection matches the exact pinned package data',()=>{
 const icons=JSON.parse(read('web/vendor/feather-icons.json'));assert.equal(Object.keys(icons).length,27);for(const name of ['image','lock','unlock','moon','sun','sliders'])assert(read('web/icons.mjs').includes(JSON.stringify(icons[name])));assert(read('web/vendor/feather-LICENSE').includes('Cole Bemis'));
});
