import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const modules=new Map();
function collect(relative){
  const file=path.resolve(root,relative),id=path.relative(root,file).replaceAll('\\','/');
  if(modules.has(id))return id;
  let source=fs.readFileSync(file,'utf8');modules.set(id,'');
  source=source.replace(/import fs from 'node:fs';\n/g,'');
  if(id==='src/sampling/sample.mjs'){
    const dependencies=['src/compiler/gpt-image-2.5.mjs','src/compiler/validate.mjs','schemas/face_schema_v0.1.json','schemas/face_schema_v0.2.json','src/appearance/modules.mjs','presets/appearance.v0.1.json','src/body/body.mjs'];
    const hash=createHash('sha256').update(dependencies.map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n')).digest('hex');
    source=source.replace(/^const compilerHash = .*;$/m,`const compilerHash = ${JSON.stringify(hash)};`);
  }
  source=source.replace(/JSON\.parse\(fs\.readFileSync\(new URL\('([^']+)', import\.meta\.url\), 'utf8'\)\)/g,(_,p)=>JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(path.dirname(file),p),'utf8'))));
  source=source.replace(/import \{([^}]+)\} from '([^']+)';/g,(_,names,p)=>{
    const dep=p==='node:crypto'?'src/workbench/browser-crypto.mjs':path.relative(root,path.resolve(path.dirname(file),p));
    return `const {${names}} = require(${JSON.stringify(collect(dep))});`;
  });
  const exports=[];
  source=source.replace(/export (const|function|class) (\w+)/g,(_,kind,name)=>{exports.push(name);return `${kind} ${name}`;});
  if(/\bimport\s|\bexport\s|readFileSync|import\.meta/.test(source))throw new Error(`Unsupported browser dependency in ${id}`);
  modules.set(id,`${source}\nObject.assign(exports,{${exports.join(',')}});`);return id;
}
const entry=collect('web/app.mjs');
const bundle=`(()=>{'use strict';const modules={${[...modules].map(([id,s])=>`${JSON.stringify(id)}:(exports,require)=>{\n${s}\n}`).join(',\n')}};const cache={};function require(id){if(cache[id])return cache[id];const exports=cache[id]={};modules[id](exports,require);return exports;}require(${JSON.stringify(entry)});})();`;
let html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
if(modules.has('web/icons.mjs')) html=html.replace('<title>',`<!-- Feather Icons 4.29.2: ${fs.readFileSync(path.join(root,'web/vendor/feather-LICENSE'),'utf8')} -->\n<title>`);
if(html.includes('<link rel="stylesheet" href="./workbench.css">')) html=html.replace('<link rel="stylesheet" href="./workbench.css">',`<style>${fs.readFileSync(path.join(root,'web/workbench.css'),'utf8')}</style>`);
html=html.replace('<script type="module" src="./app.mjs"></script>',`<script>${bundle.replaceAll('</script','<\\/script')}</script>`);
if(html.includes('src="./app.mjs"'))throw new Error('Missing offline entry substitution');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/visage-workbench.html'),html);
console.log(`Built dist/visage-workbench.html (${Buffer.byteLength(html)} bytes), ${modules.size} shared modules, no external dependencies.`);
