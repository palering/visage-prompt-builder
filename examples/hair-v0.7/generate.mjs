import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compileFacePrompt } from '../../src/compiler/gpt-image-2.5.mjs';
import { resolveAppearance } from '../../src/appearance/modules.mjs';
const root=new URL('./',import.meta.url);
const base=JSON.parse(fs.readFileSync(new URL('../appearance/base-profile.json',import.meta.url),'utf8'));
base.subject.appearance='East Asian appearance';
base.subject.overall_impression=['beautiful','elegant'];
base.capture.camera_distance='head and upper torso portrait, entire head and complete hairstyle visible with generous clear space above and beside hair, no top or side cropping';
base.makeup={intensity:0};
fs.writeFileSync(new URL('base-profile.json',root),JSON.stringify(base,null,2)+'\n');
for(const [name,preset]of [['anime-twin-drills','high_twin_drills'],['historical-double-loops','open_double_loop_reference']]) {
 const appearance={version:'appearance-v0.1',hair:{state:'selected',preset,overrides:{color:'black',accessories:[]}},makeup:{state:'off'},expression:{state:'selected',preset:'relaxed_neutral'},apparentAge:{state:'selected',years:25}};
 const options={preset:'profile',enhancers:true,appearance};
 const prompt=compileFacePrompt(base,options)+'\n';
 fs.writeFileSync(new URL(name+'.appearance.json',root),JSON.stringify(appearance,null,2)+'\n');
 fs.writeFileSync(new URL(name+'.prompt.txt',root),prompt);
 fs.writeFileSync(new URL(name+'.manifest.json',root),JSON.stringify({version:'hair-demo-v0.7',base:'base-profile.json',compiler_options:options,appearance_resolution:resolveAppearance(appearance,{...options,profile:base}),prompt_sha256:createHash('sha256').update(prompt).digest('hex'),purpose:'Observable hairstyle constraints; shared input geometry does not establish same-image identity. Generated images are a separate test result.'},null,2)+'\n');
}
