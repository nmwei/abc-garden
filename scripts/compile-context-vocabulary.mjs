import {readFile,writeFile} from 'node:fs/promises';
const input=new URL('../data/vocabulary/primary-context.tsv',import.meta.url);
const rows=(await readFile(input,'utf8')).trim().split('\n').map(line=>line.split('\t'));
const groups=JSON.parse(await readFile(new URL('../data/vocabulary/context-parts-of-speech.json',import.meta.url),'utf8'));
const pos=new Map();for(const [label,ids] of Object.entries(groups))for(const id of ids.split(' ')){if(pos.has(id))throw Error(`Duplicate part of speech: ${id}`);pos.set(id,label);}
const seen=new Set(),display={i:'I',china:'China',chinese:'Chinese',english:'English',internet:'Internet',miss:'Miss',mr:'Mr',mrs:'Mrs',ms:'Ms',pe:'PE',tv:'TV',ok:'OK'};
const speech={mr:'Mister',mrs:'Missus',ms:'Ms.',pe:'P. E.',tv:'T. V.',ok:'Okay'};
const words=rows.map(([id,zh,sentence,sentenceZh,...extra])=>{
 if(extra.length||![id,zh,sentence,sentenceZh].every(Boolean)||!/^[a-z][a-z '-]*$/.test(id)||seen.has(id)||!pos.has(id))throw Error(`Invalid context word: ${id}`);
 seen.add(id);return {id,pos:pos.get(id),display:display[id]||id,spoken:speech[id]||display[id]||id,zh,sentence,sentenceZh,topic:null,image:null,pictureCue:true,audio:`word-${id}`,contentSource:'primary-context-v1'};
});
const extended=JSON.parse(await readFile(new URL('../data/vocabulary/extended-context.json',import.meta.url),'utf8'));
const targets=JSON.parse(await readFile(new URL('../data/vocabulary/targets.json',import.meta.url),'utf8'));
for(const row of extended){
 const {id,zh,pos,sentence,sentenceZh,attribution}=row;
 if(![id,zh,pos,sentence,sentenceZh].every(v=>typeof v==='string'&&v.trim())||!/^[a-z][a-z '-]*$/.test(id)||seen.has(id))throw Error(`Invalid extended word: ${id}`);
 if(attribution&&!/^CC-BY 2\.0 \(France\) Attribution: tatoeba\.org #\d+ \(.+\) & #\d+ \(.+\)$/.test(attribution.credit))throw Error(`Invalid sentence credit: ${id}`);
 seen.add(id);
 const targetLabel=targets[id]?.display;
 const label=row.display||(targetLabel?.toLowerCase()===id?targetLabel:id);
 words.push({id,zh,pos,sentence,sentenceZh,display:label,spoken:row.spoken||label,topic:null,image:null,pictureCue:true,audio:`word-${id}`,contentSource:'extended-context-v1',...(attribution?{sentenceCredit:attribution.credit,sentenceAdapted:attribution.adapted}:{})});
}
const pictures=JSON.parse(await readFile(new URL('../data/vocabulary/picture-mappings.json',import.meta.url),'utf8'));
const topics=new Set('food animals home school clothes body people nature travel sports play music places actions feelings colors'.split(' '));
for(const [id,picture] of Object.entries(pictures)){
 const word=words.find(w=>w.id===id);
 if(!word||!topics.has(picture.topic)||!picture.emoji)throw Error(`Invalid picture mapping: ${id}`);
 Object.assign(word,{topic:picture.topic,emoji:picture.emoji,image:`./assets/pictures/${id}.svg`,pictureCue:false});
}
await writeFile(new URL('../app/context-words.js',import.meta.url),'// Generated from data/vocabulary context sources. See docs/vocabulary-content.md for credits and review limits.\nexport const CONTEXT_WORDS='+JSON.stringify(words,null,1)+';\n');
console.log(`Compiled ${words.length} contextual word cards.`);

const quizGroups=JSON.parse(await readFile(new URL('../data/vocabulary/picture-quiz-groups.json',import.meta.url),'utf8')),quizIndex={};
for(const [group,ids] of Object.entries(quizGroups))for(const id of ids){if(quizIndex[id])throw Error(`Duplicate picture quiz group: ${id}`);quizIndex[id]=group;}
await writeFile(new URL('../app/picture-quiz-groups.js',import.meta.url),'// Generated semantic groups: do not offer equivalent images as different answers.\nexport const PICTURE_QUIZ_GROUPS='+JSON.stringify(quizIndex,null,1)+';\n');
