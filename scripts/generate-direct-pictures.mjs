import {readFile,writeFile} from 'node:fs/promises';
import{createHash}from'node:crypto';
import{scenes}from'./pictures/direct-scenes.mjs';import{actions}from'./pictures/action-scenes.mjs';import{finalScenes}from'./pictures/final-scenes.mjs';import{finishingScenes}from'./pictures/finishing-scenes.mjs';import{closingScenes}from'./pictures/closing-scenes.mjs';import{lastScenes}from'./pictures/last-scenes.mjs';import{spatialScenes}from'./pictures/spatial-scenes.mjs';
import{WORDS}from'../app/course-content.js';
const base=new URL('../',import.meta.url),map=JSON.parse(await readFile(new URL('data/vocabulary/picture-mappings.json',base))),credits=JSON.parse(await readFile(new URL('assets/credits.json',base))),byWord=new Map(WORDS.map(w=>[w.id,w]));
const rows=(await readFile(new URL('data/vocabulary/direct-picture-plan.tsv',base),'utf8')).split('\n').filter(l=>l&&!l.startsWith('#'));const seen=new Set();let count=0;
for(const row of rows){const[id,scene,topic,...extra]=row.split('|');if(extra.length||seen.has(id)||!byWord.has(id))throw Error(`Invalid picture plan: ${row}`);seen.add(id);const body=spatialScenes[scene]||lastScenes[scene]||closingScenes[scene]||finishingScenes[scene]||finalScenes[scene]||actions[scene]||scenes[scene];if(!body)throw Error(`Missing scene: ${scene}`);
 if(byWord.get(id).image&&!byWord.get(id).contentSource)throw Error(`Do not overwrite original picture: ${id}`);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>\n`;
 await writeFile(new URL(`assets/pictures/${id}.svg`,base),svg);
 map[id]={drawing:scene,topic,emoji:`project-direct-${scene}`,review:'Single-frame meaning reviewed against the current gloss and sentence.'};
 const file=`pictures/${id}.svg`;const existing=credits.findIndex(c=>c.file===file);const credit={file,author:'ABC Garden project',source:'Project-authored SVG illustration; scripts/pictures/',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',changes:'Original vector artwork',sha256:createHash('sha256').update(svg).digest('hex')};if(existing<0)credits.push(credit);else credits[existing]=credit;count++;
}
await writeFile(new URL('data/vocabulary/picture-mappings.json',base),JSON.stringify(map,null,2)+'\n');await writeFile(new URL('assets/credits.json',base),JSON.stringify(credits,null,2)+'\n');console.log(`Generated ${count} planned direct pictures.`);
