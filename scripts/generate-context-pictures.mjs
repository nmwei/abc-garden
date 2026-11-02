// Rebuild only explicitly reviewed completion batches; do not promote unrelated pending cards.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CATALOG_BY_ID} from '../app/course-content.js';
import {renderQualityScene} from './pictures/quality-scenes.mjs';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const plan=await json('data/vocabulary/context-completion-plan.json');
const mappings=await json('data/vocabulary/picture-mappings.json'),credits=await json('assets/credits.json');
const seen=new Set();let count=0;
for(const batch of plan.batches){
 if(!/^\d{2}$/.test(batch.id))throw Error(`Invalid batch: ${batch.id}`);
 const generic=batch.renderer==='context-layouts';
 const {contextScenes,renderContextScene,renderContextRecipe}=await import(generic?'./pictures/context-layouts.mjs':`./pictures/context-batch-${batch.id}.mjs`);
 for(const card of batch.cards){
  const word=CATALOG_BY_ID.get(card.id),scene=generic||card.qualityRecipe?{topic:card.topic,note:card.reviewNote}:contextScenes[card.id];
  if(seen.has(card.id)||!plan.baselineIds.includes(card.id)||!word?.contentSource||!scene)throw Error(`Invalid completion card: ${card.id}`);
  seen.add(card.id);
  for(const key of ['zh','pos','sentence','sentenceZh'])if(word[key]!==card[key])throw Error(`Re-review ${card.id}: changed ${key}`);
  if(scene.note!==card.reviewNote||scene.topic!==card.topic||!card.pictureCue)throw Error(`Re-review scene: ${card.id}`);
  if(mappings[card.id]&&mappings[card.id].completionBatch!==batch.id)throw Error(`Refuse unrelated picture overwrite: ${card.id}`);
  const rendered=card.qualityRecipe?await renderQualityScene(card.qualityRecipe):generic?await renderContextRecipe(card.recipe):{svg:renderContextScene(card.id),license:'CC0-1.0'};
  const {svg}=rendered,file=`pictures/${card.id}.svg`;
  await writeFile(new URL(`assets/${file}`,root),svg);
  mappings[card.id]={drawing:`context-${batch.id}-${card.id}`,topic:card.topic,emoji:card.qualityRecipe?mappings[card.id]?.emoji||`project-context-${batch.id}-${card.id}`:`project-context-${batch.id}-${card.id}`,pictureCue:true,completionBatch:batch.id,review:card.reviewNote};
  const credit={file,author:rendered.components?.some(c=>c.license==='Apache-2.0')?'ABC Garden project; Google Noto Emoji contributors':'ABC Garden project',source:card.qualityRecipe?'Project-authored reviewed SVG; scripts/pictures/quality-scenes.mjs':generic?'Project-authored composition; scripts/pictures/context-layouts.mjs':`Project-authored SVG; scripts/pictures/context-batch-${batch.id}.mjs`,license:rendered.license,licenseUrl:rendered.license==='Apache-2.0'?'https://www.apache.org/licenses/LICENSE-2.0':'https://creativecommons.org/publicdomain/zero/1.0/',changes:generic?'Contextual composition of attributed local SVG components':'Original contextual vector illustration',...(rendered.components?{components:rendered.components}:{}),sha256:createHash('sha256').update(svg).digest('hex')};
  const index=credits.findIndex(c=>c.file===file);if(index<0)credits.push(credit);else credits[index]=credit;
  count++;
 }
}
await writeFile(new URL('data/vocabulary/picture-mappings.json',root),JSON.stringify(mappings,null,2)+'\n');
await writeFile(new URL('assets/credits.json',root),JSON.stringify(credits,null,2)+'\n');
console.log(`Generated ${count} reviewed completion pictures.`);
