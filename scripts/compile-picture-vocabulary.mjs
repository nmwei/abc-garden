import {readFile,writeFile} from 'node:fs/promises';
import {BASE_PICTURE_ROWS,TOPICS} from '../app/course-content.js';
const source=await readFile(new URL('../data/picture-vocabulary.tsv',import.meta.url),'utf8');
const existing=new Set(BASE_PICTURE_ROWS.map(r=>r[0])),seen=new Set(),rows=[],skipped=[];
for(const [index,line] of source.split('\n').entries()){
 if(!line.trim()||line.startsWith('#'))continue;
 const [topic,word,zh,emoji,sentence,...rest]=line.split('|').map(s=>s.trim());
 if(!Object.hasOwn(TOPICS,topic)||topic==='all'||rest.length||!sentence||sentence.length>160||!zh||zh.length>50||! /^[a-z][a-z '-]{0,49}$/.test(word)||! /^[a-f0-9]+(?:_[a-f0-9]+)*$/.test(emoji)||! /^[a-zA-Z0-9\s.,!?'-]+$/.test(sentence))throw Error(`Invalid vocabulary line ${index+1}: ${line}`);
 if(seen.has(word))throw Error(`Duplicate word: ${word}`);seen.add(word);
 if(existing.has(word)){skipped.push(word);continue;}
 rows.push([word,zh,topic,emoji,sentence]);
}
await writeFile(new URL('../app/themed-picture-words.js',import.meta.url),'// Generated from data/picture-vocabulary.tsv. Text: project-authored; pictures: Noto Emoji v2.047.\nexport const THEMED_PICTURE_WORDS='+JSON.stringify(rows,null,1)+';\n');
console.log(JSON.stringify({base:existing.size,added:rows.length,total:existing.size+rows.length,skippedExisting:skipped}));
