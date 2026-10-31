import {canonicalWordId} from '../app/word-aliases.js';
import {readFile,writeFile} from 'node:fs/promises';
import {WORDS} from '../app/course-content.js';
const source=JSON.parse(await readFile(new URL('../data/vocabulary/high-2025.json',import.meta.url),'utf8'));
const primary=JSON.parse(await readFile(new URL('../data/vocabulary/primary-2022.json',import.meta.url),'utf8'));
const normalize=s=>s.trim().replaceAll('’',"'").normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function forms(label){
 if(label==='according (to)')return ['according to'];
 const main=label.split('(')[0].trim().split('/').map(normalize);
 const optional=label.match(/\(([^)]+)\)/)?.[1].replace(/^=/,'').split(/,\s*/).map(normalize)||[];
 return [...new Set([...main,...optional].filter(w=>/^[a-z][a-z .'-]{0,49}$/.test(w)))];
}
const targets=source.map((r,i)=>({...r,key:`high-2025-${i+1}`,forms:forms(r.entry)}));
const primaryNames=new Set(primary.flatMap(r=>r.entry.split('/').map(normalize)));
const metadata={};
for(const row of targets){
 const elementary=row.forms.some(w=>primaryNames.has(w));
 for(const id of row.forms){const info=metadata[id]??={entries:[],primary:false,highSchoolMarker:row.highSchoolMarker,display:id};info.entries.push(row.key);info.primary||=elementary;info.highSchoolMarker=Math.min(info.highSchoolMarker,row.highSchoolMarker);if(row.forms[0]===id)info.display=row.entry.split('(')[0].trim().split('/')[0];}
}
// Preserve primary entries not explicitly repeated in the high-school main table.
for(const row of primary)for(const id of row.entry.split('/').map(normalize)){metadata[id]??={entries:[],primary:true,highSchoolMarker:0,display:row.entry};metadata[id].primary=true;}
for(const [id,info] of Object.entries(metadata))info.canonicalId=canonicalWordId(id);
const ids=Object.keys(metadata);const existing=new Map(WORDS.map(w=>[w.id,w]));
const audit={source:'data/vocabulary/sources.json',declaredHighHeadwords:3100,extractedHighRows:source.length,primaryRows:primary.length,normalizedForms:ids.length,existingCards:WORDS.length,matchedForms:ids.filter(w=>existing.has(w)).length,missingForms:ids.filter(w=>!existing.has(w)),extraCards:WORDS.filter(w=>!metadata[w.id]).map(w=>w.id),primary:{covered:primary.filter(r=>r.entry.split('/').map(normalize).some(w=>existing.has(w))).length,total:primary.length},high:{covered:targets.filter(r=>r.forms.some(w=>existing.has(w))).length,total:targets.length}};
await writeFile(new URL('../data/vocabulary/targets.json',import.meta.url),JSON.stringify(metadata,null,2)+'\n');
await writeFile(new URL('../data/vocabulary/coverage-audit.json',import.meta.url),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({...audit,missingForms:audit.missingForms.length,extraCards:audit.extraCards.length}));
