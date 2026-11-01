import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WORDS} from '../app/course-content.js';
import {renderWondersScene} from './pictures/wonders-scenes.mjs';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const plans=await read('data/vocabulary/wonders-gk-picture-plan.json'),mappings=await read('data/vocabulary/picture-mappings.json'),credits=await read('assets/credits.json');
const byId=new Map(WORDS.map(w=>[w.id,w]));
for(const plan of plans){
 const word=byId.get(plan.id);
 if(!word?.contentSource||word.zh!==plan.zh||word.sentence!==plan.sentence)throw Error(`Re-review changed picture meaning: ${plan.id}`);
 const svg=renderWondersScene(plan.scene),file=`pictures/${plan.id}.svg`;
 await writeFile(new URL(`assets/${file}`,root),svg);
 mappings[plan.id]={drawing:`wonders-${plan.scene}`,topic:plan.topic,emoji:`project-wonders-${plan.scene}`,pictureCue:plan.pictureCue,review:'Project-reviewed against the recorded sense and example; contextual scenes are excluded from picture quizzes.'};
 const credit={file,author:'ABC Garden project',source:'Project-authored SVG; scripts/pictures/wonders-scenes.mjs',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',changes:'Original contextual vector illustration',sha256:createHash('sha256').update(svg).digest('hex')};
 const index=credits.findIndex(c=>c.file===file);if(index<0)credits.push(credit);else credits[index]=credit;
}
await writeFile(new URL('data/vocabulary/picture-mappings.json',root),JSON.stringify(mappings,null,2)+'\n');
await writeFile(new URL('assets/credits.json',root),JSON.stringify(credits,null,2)+'\n');
console.log(`Generated ${plans.length} Wonders pictures.`);
