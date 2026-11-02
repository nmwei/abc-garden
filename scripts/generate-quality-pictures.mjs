// Explicit, reviewed repairs only. A changed source sentence needs a new review snapshot.
import './generate-quality-geography.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_BY_ID} from '../app/course-content.js';
import {sentenceMeaning} from '../app/sentence-meanings.js';
import {qualityScenes,renderQualityScene} from './pictures/quality-scenes.mjs';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const fixes=await json('data/vocabulary/quality-fixes.json'),baseline=await json('data/vocabulary/quality-review-2026-11-02.json');
const targets=new Map(baseline.cards.filter(c=>c.findings.length).map(c=>[c.id,c]));
const mappings=await json('data/vocabulary/picture-mappings.json'),credits=await json('assets/credits.json');
const plan=await json('data/vocabulary/context-completion-plan.json');
const completionCards=new Map(plan.batches.flatMap(b=>b.cards).map(c=>[c.id,c]));
const seen=new Set(),prepared=[];
for(const fix of fixes.entries){
 const word=CATALOG_BY_ID.get(fix.id);
 if(seen.has(fix.id)||!targets.has(fix.id)||!word||!qualityScenes[fix.id]||!fix.note)throw Error(`Invalid quality repair: ${fix.id}`);
 seen.add(fix.id);
 for(const key of ['id','zh','pos','sentence','sentenceZh']){
  const actual=key==='sentenceZh'?(word.sentenceZh??sentenceMeaning(word.sentence)):word[key]??'';
  if(actual!==fix.reviewedCard[key])throw Error(`Re-review changed quality content: ${fix.id}/${key}`);
 }
 const result=await renderQualityScene(fix.id),file=`pictures/${fix.id}.svg`;
 prepared.push({fix,result,file});
}
for(const id of targets.keys())if(!seen.has(id))throw Error(`Missing quality repair: ${id}`);
for(const id of Object.keys(qualityScenes))if(!seen.has(id))throw Error(`Untracked quality scene: ${id}`);
// Validate every recipe before writing any vocabulary image.
for(const {fix,result,file} of prepared){
 await writeFile(new URL(`assets/${file}`,root),result.svg);
 const apache=result.license==='Apache-2.0';
 const credit={file,author:apache?'ABC Garden project; Google Noto Emoji contributors':'ABC Garden project',source:'Project-authored reviewed SVG; scripts/pictures/quality-scenes.mjs',license:result.license,licenseUrl:apache?'https://www.apache.org/licenses/LICENSE-2.0':'https://creativecommons.org/publicdomain/zero/1.0/',changes:'Replaced after full vocabulary quality review; see data/vocabulary/quality-fixes.json',components:result.components,sha256:createHash('sha256').update(result.svg).digest('hex')};
 const index=credits.findIndex(c=>c.file===file);if(index<0)credits.push(credit);else credits[index]=credit;
 // Preserve cue/quiz semantics and completion-batch ownership.
 if(mappings[fix.id])Object.assign(mappings[fix.id],{drawing:`quality-${fix.id}`,qualityReview:'2026-11-02',review:fix.note,...(fix.sharedImageGroup?{emoji:fix.sharedImageGroup}:{})});
 const completed=completionCards.get(fix.id);
 if(completed)Object.assign(completed,fix.reviewedCard,{qualityRecipe:fix.id,reviewNote:fix.note});
}
await writeFile(new URL('assets/credits.json',root),JSON.stringify(credits,null,2)+'\n');
await writeFile(new URL('data/vocabulary/picture-mappings.json',root),JSON.stringify(mappings,null,2)+'\n');
await writeFile(new URL('data/vocabulary/context-completion-plan.json',root),JSON.stringify(plan,null,2)+'\n');
console.log(`Generated ${seen.size} explicit quality repairs.`);
