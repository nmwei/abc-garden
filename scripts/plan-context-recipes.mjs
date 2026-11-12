import {readFile,writeFile} from 'node:fs/promises';
import {CATALOG_BY_ID} from '../domain/course-content.js';
const root=new URL('../',import.meta.url),json=path=>readFile(new URL(path.startsWith('assets/')||path.startsWith('./assets/')?'web/'+path:path,root),'utf8').then(JSON.parse);
const plan=await json('data/vocabulary/context-completion-plan.json'),first=plan.batches[0];
const original=new Map(plan.batches.slice(1).flatMap(b=>b.cards).map(w=>[w.id,w]));
const ids=plan.baselineIds.slice(100),recipes=new Map();
const credits=new Map((await json('assets/credits.json')).map(c=>[c.file,c]));
for(const line of (await readFile(new URL('data/vocabulary/context-recipes.tsv',root),'utf8')).split('\n')){
 if(!line.trim()||line.startsWith('#'))continue;
 const [raw,layout,left,right,label,caption,...extra]=line.split('|'),id=raw.trim();
 if(extra.length||!ids.includes(id)||recipes.has(id)||![layout,left,right,caption].every(Boolean))throw Error(`Invalid context recipe: ${line}`);
 for(const component of [left,right].filter(s=>s!=='-').map(s=>s.split('~')[0].split('!')[0]))if(!credits.has(`pictures/${component}.svg`))throw Error(`Unknown picture: ${id}/${component}`);
 recipes.set(id,{layout,left,right,label,caption});
}
const cards=ids.filter(id=>recipes.has(id)).map(id=>{
 const word=CATALOG_BY_ID.get(id),recipe=recipes.get(id);
 const snapshot={id,zh:word.zh,pos:word.pos,sentence:word.sentence,sentenceZh:word.sentenceZh};
 if(original.has(id))for(const key of Object.keys(snapshot))if(original.get(id)[key]!==snapshot[key])throw Error(`Re-review source change: ${id}/${key}`);
 const left=CATALOG_BY_ID.get(recipe.left.split('~')[0].split('!')[0]);
 return {...original.get(id),...snapshot,topic:/动词/.test(word.pos)?'actions':left?.topic||'school',pictureCue:true,reviewNote:original.get(id)?.qualityRecipe?original.get(id).reviewNote:`${word.zh}；${recipe.label?recipe.label+'；':''}${recipe.caption}。${recipe.layout} 情境构图，须结合当前双语例句理解，不作为唯一识图答案。`,recipe};
});
const batches=[first];
for(let i=0;i<cards.length;i+=100)batches.push({id:String(2+i/100).padStart(2,'0'),renderer:'context-layouts',cards:cards.slice(i,i+100)});
plan.batches=batches;
await writeFile(new URL('data/vocabulary/context-completion-plan.json',root),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({reviewed:cards.length+first.cards.length,remaining:ids.length-cards.length}));
