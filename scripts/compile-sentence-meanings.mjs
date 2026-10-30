import {readFile,writeFile} from 'node:fs/promises';
import {WORDS} from '../app/course-content.js';
const rows=(await readFile(new URL('../data/word-sentence-meanings.tsv',import.meta.url),'utf8')).split('\n').filter(s=>s&&!s.startsWith('#'));
const seen=new Set(),meanings={};
for(const row of rows){const [id,english,chinese,...rest]=row.split('|'),word=WORDS.find(w=>w.id===id);if(!word||word.sentence!==english||rest.length||!chinese||seen.has(id))throw Error(`Stale or invalid sentence meaning: ${id}`);seen.add(id);meanings[english]??=chinese;}
if(seen.size!==WORDS.length)throw Error('Each word needs a sentence meaning');
await writeFile(new URL('../app/sentence-meanings.js',import.meta.url),'// Generated from data/word-sentence-meanings.tsv; project-authored translations.\nconst meanings='+JSON.stringify(meanings,null,1)+';\nexport const sentenceMeaning=english=>meanings[english]||\'\';\n');
console.log(`Validated ${seen.size} paired examples, ${Object.keys(meanings).length} distinct sentences.`);
